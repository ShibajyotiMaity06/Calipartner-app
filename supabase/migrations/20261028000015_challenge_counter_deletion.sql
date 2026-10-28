-- Counters exclude deleted accounts/fixtures while retaining real historical participation.
create or replace function public.challenge_counter_participant_deleted()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if old.joined_at is not null then
  update public.challenge_counters set joined_count=greatest(0,joined_count-1),completed_count=greatest(0,completed_count-case when old.status='completed' or old.summary->>'outcome'='completed' then 1 else 0 end) where template_id=(select template_id from public.challenges where id=old.challenge_id);
 end if;
 return old;
end;$$;
revoke all on function public.challenge_counter_participant_deleted() from public,anon,authenticated;
drop trigger if exists challenge_counter_member_delete on public.challenge_participants;
create trigger challenge_counter_member_delete after delete on public.challenge_participants for each row execute function public.challenge_counter_participant_deleted();
create or replace function public.challenge_counter_instance_deleted()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 update public.challenge_counters set joined_count=greatest(0,joined_count-(select count(*) from public.challenge_participants where challenge_id=old.id and joined_at is not null)),completed_count=greatest(0,completed_count-(select count(*) from public.challenge_participants where challenge_id=old.id and joined_at is not null and (status='completed' or summary->>'outcome'='completed'))) where template_id=old.template_id;
 return old;
end;$$;
revoke all on function public.challenge_counter_instance_deleted() from public,anon,authenticated;
drop trigger if exists challenge_counter_instance_delete on public.challenges;
create trigger challenge_counter_instance_delete before delete on public.challenges for each row execute function public.challenge_counter_instance_deleted();
do $$ begin
lock table public.challenges in share row exclusive mode;
lock table public.challenge_participants in share row exclusive mode;
update public.challenge_counters ctr set joined_count=(select count(*) from public.challenge_participants p join public.challenges c on c.id=p.challenge_id where c.template_id=ctr.template_id and p.joined_at is not null),completed_count=(select count(*) from public.challenge_participants p join public.challenges c on c.id=p.challenge_id where c.template_id=ctr.template_id and p.joined_at is not null and (p.status='completed' or p.summary->>'outcome'='completed'));
end;$$;
