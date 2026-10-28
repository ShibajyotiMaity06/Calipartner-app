-- Repair partially deployed room extras without replaying unrelated historical migrations.
-- Owner repair request, 27 October: restore read/share APIs and room-slot lifecycle.
-- Explicit workout sharing and mutual Plus pair challenges. Base tracking tables stay owner-only.
create table if not exists public.room_workout_shares (
  id uuid primary key, room_id uuid not null references public.rooms on delete cascade,
  sender_id uuid not null references auth.users on delete cascade,
  workout_id uuid not null references public.workouts on delete cascade,
  shared_at timestamptz not null default now(),
  unique(room_id,sender_id,workout_id)
);
alter table public.room_workout_shares enable row level security;
drop policy if exists shares_no_direct_access on public.room_workout_shares;
create policy shares_no_direct_access on public.room_workout_shares for all to authenticated using(false) with check(false);
create index if not exists room_workout_shares_room_date on public.room_workout_shares(room_id,shared_at desc);

create or replace function public.share_room_workout(p_client_id uuid,p_room_id uuid,p_workout_id uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_existing public.room_workout_shares;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if public.active_room_tier(auth.uid())='free' then raise exception 'PLUS_REQUIRED'; end if;
  if not public.is_room_member(p_room_id,auth.uid()) then raise exception 'NOT_ROOM_MEMBER'; end if;
  if not public.room_is_usable(p_room_id) then raise exception 'ROOM_LOCKED'; end if;
  if not exists(select 1 from public.workouts where id=p_workout_id and user_id=auth.uid() and deleted_at is null) then raise exception 'WORKOUT_NOT_FOUND'; end if;
  select * into v_existing from public.room_workout_shares where id=p_client_id;
  if found then
    if v_existing.sender_id<>auth.uid() or v_existing.room_id<>p_room_id or v_existing.workout_id<>p_workout_id then raise exception 'NOT_AUTHORIZED'; end if;
    return v_existing.id;
  end if;
  insert into public.room_workout_shares(id,room_id,sender_id,workout_id) values(p_client_id,p_room_id,auth.uid(),p_workout_id) on conflict(room_id,sender_id,workout_id) do nothing;
  update public.rooms set updated_at=now() where id=p_room_id;
  return (select id from public.room_workout_shares where room_id=p_room_id and sender_id=auth.uid() and workout_id=p_workout_id);
end; $$;

create or replace function public.get_room_workout_shares(p_room_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_result jsonb;
begin
  if not public.is_room_member(p_room_id,auth.uid()) then raise exception 'NOT_ROOM_MEMBER'; end if;
  if not public.room_is_usable(p_room_id) then raise exception 'ROOM_LOCKED'; end if;
  select coalesce(jsonb_agg(item order by shared_at desc),'[]'::jsonb) into v_result from (
    select s.shared_at,jsonb_build_object('id',s.id,'sender',p.nickname,'name',w.name,'type',w.type,'duration_minutes',w.duration_minutes,'local_date',w.local_date,
      'exercises',(select coalesce(jsonb_agg(jsonb_build_object('name',e.exercise_name,'sets',(
        select coalesce(jsonb_agg(jsonb_build_object('reps',ws.reps,'weight_kg',ws.weight_kg,'duration_seconds',ws.duration_seconds,'distance_meters',ws.distance_meters,'completed',ws.completed,'is_warmup',ws.is_warmup) order by ws.set_number),'[]'::jsonb)
        from public.workout_sets ws where ws.workout_exercise_id=e.id and ws.user_id=s.sender_id and ws.deleted_at is null
      )) order by e.order_in_workout),'[]'::jsonb) from public.workout_exercises e where e.workout_id=w.id and e.user_id=s.sender_id and e.deleted_at is null)) as item
    from public.room_workout_shares s join public.workouts w on w.id=s.workout_id and w.user_id=s.sender_id and w.deleted_at is null
    join public.profiles p on p.id=s.sender_id
    join public.room_members m on m.room_id=s.room_id and m.user_id=s.sender_id and m.status <> 'left'
    where s.room_id=p_room_id and coalesce((m.privacy_settings->>'share_workouts')::boolean,true)
    and not exists(select 1 from public.blocks b where (b.blocker_id=auth.uid() and b.blocked_id=s.sender_id) or (b.blocked_id=auth.uid() and b.blocker_id=s.sender_id))
    order by s.shared_at desc limit 50
  ) shared;
  return v_result;
end; $$;

create table if not exists public.pair_challenges (
  id uuid primary key,room_id uuid not null references public.rooms on delete cascade,
  creator_id uuid not null references auth.users on delete cascade,
  partner_id uuid not null references auth.users on delete cascade,
  status text not null default 'pending' check(status in ('pending','active','declined')),
  started_at timestamptz,created_at timestamptz not null default now(),
  check(creator_id<>partner_id)
);
alter table public.pair_challenges enable row level security;
drop policy if exists pair_challenges_no_direct_access on public.pair_challenges;
create policy pair_challenges_no_direct_access on public.pair_challenges for all to authenticated using(false) with check(false);
create index if not exists pair_challenges_room_created on public.pair_challenges(room_id,created_at desc);

create or replace function public.create_pair_challenge(p_client_id uuid,p_room_id uuid,p_partner_id uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_existing public.pair_challenges;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if not public.is_room_member(p_room_id,auth.uid()) or not public.is_room_member(p_room_id,p_partner_id) or auth.uid()=p_partner_id then raise exception 'NOT_ROOM_MEMBER'; end if;
  if not public.room_is_usable(p_room_id) then raise exception 'ROOM_LOCKED'; end if;
  if public.active_room_tier(auth.uid())='free' or public.active_room_tier(p_partner_id)='free' then raise exception 'BOTH_PLUS_REQUIRED'; end if;
  if exists(select 1 from public.blocks where (blocker_id=auth.uid() and blocked_id=p_partner_id) or (blocked_id=auth.uid() and blocker_id=p_partner_id)) then raise exception 'USER_BLOCKED'; end if;
  select * into v_existing from public.pair_challenges where id=p_client_id;
  if found then
    if v_existing.creator_id<>auth.uid() or v_existing.room_id<>p_room_id or v_existing.partner_id<>p_partner_id then raise exception 'NOT_AUTHORIZED'; end if;
    return p_client_id;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_room_id::text,32));
  select * into v_existing from public.pair_challenges where room_id=p_room_id and ((creator_id=auth.uid() and partner_id=p_partner_id) or (partner_id=auth.uid() and creator_id=p_partner_id)) and (status='pending' or (status='active' and started_at>now()-interval '7 days')) limit 1;
  if found then return v_existing.id; end if;
  insert into public.pair_challenges(id,room_id,creator_id,partner_id) values(p_client_id,p_room_id,auth.uid(),p_partner_id);
  update public.rooms set updated_at=now() where id=p_room_id;
  return p_client_id;
end; $$;
create or replace function public.respond_pair_challenge(p_challenge_id uuid,p_accept boolean)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.pair_challenges;
begin
  select * into c from public.pair_challenges where id=p_challenge_id for update;
  if not found or auth.uid() is distinct from c.partner_id then raise exception 'NOT_AUTHORIZED'; end if;
  if not public.is_room_member(c.room_id,auth.uid()) or not public.is_room_member(c.room_id,c.creator_id) then raise exception 'NOT_ROOM_MEMBER'; end if;
  if not public.room_is_usable(c.room_id) then raise exception 'ROOM_LOCKED'; end if;
  if p_accept and (public.active_room_tier(c.creator_id)='free' or public.active_room_tier(c.partner_id)='free') then raise exception 'BOTH_PLUS_REQUIRED'; end if;
  if c.status='pending' then update public.pair_challenges set status=case when p_accept then 'active' else 'declined' end,started_at=case when p_accept then now() else null end where id=c.id; update public.rooms set updated_at=now() where id=c.room_id; end if;
end; $$;
create or replace function public.get_pair_challenges(p_room_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_result jsonb;
begin
  if not public.is_room_member(p_room_id,auth.uid()) then raise exception 'NOT_ROOM_MEMBER'; end if;
  if not public.room_is_usable(p_room_id) then raise exception 'ROOM_LOCKED'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'creator_id',c.creator_id,'partner_id',c.partner_id,'status',case when c.status='active' and c.started_at<=now()-interval '7 days' then 'completed' else c.status end,'started_at',c.started_at,
    'days',(select jsonb_agg(jsonb_build_object('user_id',p.id,'name',p.nickname,'logged_days',case when coalesce((m.privacy_settings->>'share_streak')::boolean,true) then
      to_jsonb((select count(*) from public.daily_summaries d where d.user_id=p.id and d.logged_day and d.local_date >= (c.started_at at time zone p.timezone)::date::text and d.local_date < ((c.started_at at time zone p.timezone)::date+7)::text and d.local_date <= (now() at time zone p.timezone)::date::text)) else '"locked"'::jsonb end))
      from public.profiles p join public.room_members m on m.user_id=p.id and m.room_id=p_room_id and m.status<>'left' where p.id in (c.creator_id,c.partner_id))
    ) order by c.created_at desc),'[]'::jsonb) into v_result
  from public.pair_challenges c where c.room_id=p_room_id and auth.uid() in (c.creator_id,c.partner_id)
    and public.active_room_tier(c.creator_id)<>'free' and public.active_room_tier(c.partner_id)<>'free'
    and not exists(select 1 from public.blocks where (blocker_id=c.creator_id and blocked_id=c.partner_id) or (blocked_id=c.creator_id and blocker_id=c.partner_id));
  return v_result;
end; $$;
revoke all on function public.share_room_workout(uuid,uuid,uuid),public.get_room_workout_shares(uuid),public.create_pair_challenge(uuid,uuid,uuid),public.respond_pair_challenge(uuid,boolean),public.get_pair_challenges(uuid) from public,anon;
grant execute on function public.share_room_workout(uuid,uuid,uuid),public.get_room_workout_shares(uuid),public.create_pair_challenge(uuid,uuid,uuid),public.respond_pair_challenge(uuid,boolean),public.get_pair_challenges(uuid) to authenticated;


-- Route legacy installed clients through the same consent/capacity checks as new clients.
create or replace function public.respond_to_request(p_request_id uuid,p_accept boolean,p_device_hash text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if p_accept is null then raise exception 'INVALID_ACTION'; end if;
  return public.respond_to_request(p_request_id,case when p_accept then 'accept' else 'decline' end);
end; $$;
revoke all on function public.respond_to_request(uuid,boolean,text) from public,anon;
grant execute on function public.respond_to_request(uuid,boolean,text) to authenticated;

-- Membership, host ownership, invitations and the hosted slot change in one transaction.
create or replace function public.leave_room(p_room_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.rooms; m public.room_members; v_next uuid;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,31));
  select * into r from public.rooms where id=p_room_id for update;
  select * into m from public.room_members where room_id=p_room_id and user_id=auth.uid();
  if not found then raise exception 'NOT_ROOM_MEMBER'; end if;
  if m.status='left' then return jsonb_build_object('status','left','room_id',p_room_id); end if;
  update public.room_members set status='left',role='member',updated_at=now() where id=m.id;
  if not exists(select 1 from public.room_members where room_id=p_room_id and status<>'left') then
    update public.rooms set state='archived',archived_at=now(),updated_at=now() where id=p_room_id;
    update public.room_requests set status='cancelled',responded_at=now() where room_id=p_room_id and status='pending';
  elsif m.role='host' or r.plan_holder_id=auth.uid() then
    select user_id into v_next from public.room_members where room_id=p_room_id and status<>'left' order by joined_at,user_id limit 1;
    update public.room_members set role='host',updated_at=now() where room_id=p_room_id and user_id=v_next;
    update public.rooms set plan_holder_id=v_next,updated_at=now() where id=p_room_id;
    perform public.recompute_room_state(p_room_id);
  else
    perform public.recompute_room_state(p_room_id);
  end if;
  return jsonb_build_object('status','left','room_id',p_room_id);
end; $$;
revoke all on function public.leave_room(uuid) from public,anon;
grant execute on function public.leave_room(uuid) to authenticated;

-- Recover slots stranded by the legacy leave function / client membership fallback.
-- Rooms with any remaining member are deliberately retained.
update public.rooms r set state='archived',archived_at=now(),updated_at=now()
where r.state<>'archived' and not exists(select 1 from public.room_members m where m.room_id=r.id and m.status<>'left');
update public.room_requests q set status='cancelled',responded_at=now()
where q.status='pending' and exists(select 1 from public.rooms r where r.id=q.room_id and r.state='archived');
notify pgrst, 'reload schema';
