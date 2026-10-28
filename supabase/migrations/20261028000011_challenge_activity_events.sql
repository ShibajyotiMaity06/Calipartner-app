create or replace function public.challenge_consent_event()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare kind text;actor uuid;c public.challenges;
begin
 select * into c from public.challenges where id=new.challenge_id;
 if tg_op='INSERT' and new.status='invited' then kind:='invite_sent';actor:=c.creator_id;
 elsif tg_op='UPDATE' and old.status='invited' and new.status='joined' then kind:='invite_accepted';actor:=new.user_id;
 elsif tg_op='UPDATE' and old.status='invited' and new.status='declined' then kind:=case when c.invite_expires_at<=now() then 'invite_expired' else 'invite_declined' end;actor:=new.user_id;
 else return new;end if;
 insert into public.challenge_events(id,challenge_id,actor_id,type) values(md5(new.challenge_id::text||new.user_id::text||kind)::uuid,new.challenge_id,actor,kind) on conflict do nothing;
 return new;
end;$$;
revoke all on function public.challenge_consent_event() from public,anon,authenticated;
create trigger challenge_consent_analytics after insert or update of status on public.challenge_participants for each row execute function public.challenge_consent_event();
create or replace function public.challenge_shield_event()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.status='shield' then
  insert into public.challenge_events(id,challenge_id,actor_id,type,params) values(md5(new.challenge_id::text||new.user_id::text||new.local_date::text||'shield')::uuid,new.challenge_id,new.user_id,'shield',jsonb_build_object('date',new.local_date)) on conflict do nothing;
 end if;
 return new;
end;$$;
revoke all on function public.challenge_shield_event() from public,anon,authenticated;
create trigger challenge_shield_analytics after insert or update of status on public.challenge_day_results for each row execute function public.challenge_shield_event();
