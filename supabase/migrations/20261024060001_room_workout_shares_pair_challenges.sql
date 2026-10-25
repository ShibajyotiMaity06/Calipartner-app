-- Explicit workout sharing and mutual Plus pair challenges. Base tracking tables stay owner-only.
create table public.room_workout_shares (
  id uuid primary key, room_id uuid not null references public.rooms on delete cascade,
  sender_id uuid not null references auth.users on delete cascade,
  workout_id uuid not null references public.workouts on delete cascade,
  shared_at timestamptz not null default now(),
  unique(room_id,sender_id,workout_id)
);
alter table public.room_workout_shares enable row level security;
create policy shares_no_direct_access on public.room_workout_shares for all to authenticated using(false) with check(false);
create index room_workout_shares_room_date on public.room_workout_shares(room_id,shared_at desc);

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

create table public.pair_challenges (
  id uuid primary key,room_id uuid not null references public.rooms on delete cascade,
  creator_id uuid not null references auth.users on delete cascade,
  partner_id uuid not null references auth.users on delete cascade,
  status text not null default 'pending' check(status in ('pending','active','declined')),
  started_at timestamptz,created_at timestamptz not null default now(),
  check(creator_id<>partner_id)
);
alter table public.pair_challenges enable row level security;
create policy pair_challenges_no_direct_access on public.pair_challenges for all to authenticated using(false) with check(false);
create index pair_challenges_room_created on public.pair_challenges(room_id,created_at desc);

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

-- pg_cron is optional in local tests; hosted projects with it get automatic cleanup.
do $$ begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    perform cron.schedule('rooms_v3_lifecycle','*/15 * * * *','select public.process_room_lifecycle_cron()');
  end if;
end; $$;

create or replace function public.trg_workouts_after_insert_push()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sender_nick text;
  v_member record;
begin
  select nickname into v_sender_nick from public.profiles where id = NEW.user_id;
  v_sender_nick := coalesce(v_sender_nick, 'Your partner');

  -- Notify active/paused members across all common usable rooms
  for v_member in (
    select rm.room_id, rm.user_id as recipient_id, sender_rm.privacy_settings as sender_privacy
    from public.room_members rm
    join public.room_members sender_rm on sender_rm.room_id = rm.room_id and sender_rm.user_id = NEW.user_id
    join public.rooms r on r.id = rm.room_id
    where rm.user_id <> NEW.user_id
      and rm.status in ('active', 'paused')
      and sender_rm.status in ('active', 'paused')
      and r.state not in ('locked', 'archived')
      and public.room_is_usable(rm.room_id)
  ) loop
    -- Check privacy: share_workouts must be true
    if coalesce((v_member.sender_privacy->>'share_workouts')::boolean, true) then
      -- Check blocks and mutes
      if not exists (select 1 from public.blocks where blocker_id = v_member.recipient_id and blocked_id = NEW.user_id)
         and not exists (select 1 from public.member_mutes where user_id = v_member.recipient_id and muted_user_id = NEW.user_id) then
        perform public.queue_push_notification(
          p_user_id := v_member.recipient_id,
          p_type := 'partner_workout',
          p_title := v_sender_nick || ' trained today',
          p_body := v_sender_nick || ' trained today.',
          p_data := jsonb_build_object(
            'type', 'partner_workout',
            'roomId', v_member.room_id,
            'workoutId', NEW.id,
            'url', '/room'
          ),
          p_room_id := v_member.room_id
        );
      end if;
    end if;
  end loop;

  return NEW;
end;
$$;

create or replace function public.trg_room_requests_push()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sender_nick text;
  v_room_name text;
  v_host_id uuid;
begin
  select r.name, (select user_id from public.room_members where room_id=r.id and role='host' and status<>'left' limit 1) into v_room_name, v_host_id from public.rooms r where r.id=NEW.room_id;
  v_room_name := coalesce(v_room_name, 'a room');

  select nickname into v_sender_nick from public.profiles where id = NEW.sender_id;
  v_sender_nick := coalesce(v_sender_nick, 'Someone');

  if TG_OP = 'INSERT' then
    if NEW.type = 'invitation' and NEW.recipient_id is not null then
      -- User was invited
      perform public.queue_push_notification(
        p_user_id := NEW.recipient_id,
        p_type := 'room_invitation',
        p_title := 'Room Invitation',
        p_body := v_sender_nick || ' invited you to join ' || v_room_name || '!',
        p_data := jsonb_build_object(
          'type', 'room_invitation',
          'roomId', NEW.room_id,
          'requestId', NEW.id,
          'url', '/room/requests'
        ),
        p_room_id := NEW.room_id
      );
    elsif NEW.type = 'join_request' and v_host_id is not null then
      -- User requested to join room, notify host
      perform public.queue_push_notification(
        p_user_id := v_host_id,
        p_type := 'room_join_request',
        p_title := 'Join Request',
        p_body := v_sender_nick || ' requested to join ' || v_room_name || '.',
        p_data := jsonb_build_object(
          'type', 'room_join_request',
          'roomId', NEW.room_id,
          'requestId', NEW.id,
          'url', '/room/requests'
        ),
        p_room_id := NEW.room_id
      );
    end if;

  elsif TG_OP = 'UPDATE' and OLD.status = 'pending' and NEW.status = 'accepted' then
    if NEW.type = 'invitation' then
      -- Recipient accepted, notify inviter
      select nickname into v_sender_nick from public.profiles where id = NEW.recipient_id;
      v_sender_nick := coalesce(v_sender_nick, 'Your partner');
      perform public.queue_push_notification(
        p_user_id := NEW.sender_id,
        p_type := 'room_request_accepted',
        p_title := 'Invitation Accepted',
        p_body := v_sender_nick || ' joined ' || v_room_name || '!',
        p_data := jsonb_build_object(
          'type', 'room_request_accepted',
          'roomId', NEW.room_id,
          'requestId', NEW.id,
          'url', '/room'
        ),
        p_room_id := NEW.room_id
      );
    elsif NEW.type = 'join_request' then
      -- Host accepted, notify requester (sender_id)
      perform public.queue_push_notification(
        p_user_id := NEW.sender_id,
        p_type := 'room_request_accepted',
        p_title := 'Request Accepted',
        p_body := 'You were accepted into ' || v_room_name || '!',
        p_data := jsonb_build_object(
          'type', 'room_request_accepted',
          'roomId', NEW.room_id,
          'requestId', NEW.id,
          'url', '/room'
        ),
        p_room_id := NEW.room_id
      );
    end if;
  end if;

  return NEW;
end;
$$;

-- V3 subscriptions are individual; the legacy sponsor reconciliation must not reassign hosts.
revoke all on function public.reconcile_room_subscriptions(uuid),public.recompute_room_state(uuid) from public,anon,authenticated;
grant execute on function public.recompute_room_state(uuid) to service_role;
create or replace function public.caller_has_room_plan()
returns boolean language sql stable security definer set search_path=public,pg_temp as $$ select public.active_room_tier(auth.uid())<>'free'; $$;
revoke all on function public.caller_has_room_plan() from public,anon;
grant execute on function public.caller_has_room_plan() to authenticated;
revoke all on function public.active_room_tier(uuid) from authenticated;
create policy v3_paid_details on public.room_events as restrictive for select to authenticated using(public.caller_has_room_plan() and public.room_is_usable(room_id));
create policy v3_paid_details on public.shared_meals as restrictive for select to authenticated using(public.caller_has_room_plan() and public.room_is_usable(room_id));
create policy v3_paid_details on public.reactions as restrictive for select to authenticated using(public.caller_has_room_plan() and public.room_is_usable(room_id));

create or replace function public.transfer_host(p_room_id uuid,p_target_user_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.rooms; v_count integer;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_target_user_id::text,31));
  select * into r from public.rooms where id=p_room_id for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if not exists(select 1 from public.room_members where room_id=p_room_id and user_id=auth.uid() and role='host' and status<>'left') then raise exception 'NOT_AUTHORIZED'; end if;
  if not public.is_room_member(p_room_id,p_target_user_id) then raise exception 'NOT_ROOM_MEMBER'; end if;
  if r.plan_holder_id=p_target_user_id then return jsonb_build_object('status','transferred','room_id',p_room_id); end if;
  if not public.can_create_room(p_target_user_id) then raise exception 'HOSTED_ROOM_LIMIT'; end if;
  select count(*) into v_count from public.room_members where room_id=p_room_id and status<>'left';
  if v_count > (case public.active_room_tier(p_target_user_id) when 'pro' then 20 when 'plus' then 5 else 2 end) then raise exception 'PLAN_REQUIRED'; end if;
  update public.room_members set role=case when user_id=p_target_user_id then 'host' else 'member' end where room_id=p_room_id;
  update public.rooms set plan_holder_id=p_target_user_id where id=p_room_id;
  perform public.recompute_room_state(p_room_id);
  return jsonb_build_object('status','transferred','room_id',p_room_id,'new_host_id',p_target_user_id);
end; $$;

create or replace function public.leave_room(p_room_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.rooms; m public.room_members; v_next uuid;
begin
  select * into r from public.rooms where id=p_room_id for update;
  select * into m from public.room_members where room_id=p_room_id and user_id=auth.uid() and status<>'left';
  if not found then raise exception 'NOT_ROOM_MEMBER'; end if;
  update public.room_members set status='left',updated_at=now() where id=m.id;
  if m.role='host' then
    select user_id into v_next from public.room_members where room_id=p_room_id and status<>'left' order by joined_at,user_id limit 1;
    if v_next is null then
      update public.rooms set state='archived',archived_at=now(),updated_at=now() where id=p_room_id;
    else
      update public.room_members set role='host',updated_at=now() where room_id=p_room_id and user_id=v_next;
      update public.rooms set plan_holder_id=v_next,updated_at=now() where id=p_room_id;
      perform public.recompute_room_state(p_room_id);
    end if;
  else perform public.recompute_room_state(p_room_id);
  end if;
  return jsonb_build_object('status','left','room_id',p_room_id);
end; $$;

create or replace function public.get_room_progress(
  p_room_id uuid,
  p_range text default '30d',
  p_selected_member_ids uuid[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_id uuid := auth.uid();
  v_room record;
  v_total_members integer := 0;
  v_is_large_room boolean := false;
  v_start_date date;
  v_today date := current_date;
  v_members_series jsonb := '{}'::jsonb;
  v_summary_table jsonb := '[]'::jsonb;
  v_room_averages jsonb := '{}'::jsonb;
  v_selected_ids uuid[];
  v_m record;
  v_p jsonb;
  v_is_self boolean;
  v_is_locked boolean;

  -- Member metrics
  v_start_weight numeric(5,2);
  v_cur_weight numeric(5,2);
  v_target_weight numeric(5,2);
  v_wt_change numeric(5,2);
  v_wt_change_pct numeric(5,2);
  v_goal_prog_pct numeric(5,1);

  v_logged_days integer;
  v_goal_days integer;
  v_consistency_score numeric(5,2);

  v_avg_cal_vs_target numeric(5,1);
  v_avg_steps integer;
  v_workouts_cnt integer;

  v_wt_series jsonb := '[]'::jsonb;
  v_cal_series jsonb := '[]'::jsonb;
  v_step_series jsonb := '[]'::jsonb;
  v_water_series jsonb := '[]'::jsonb;
  v_wrk_series jsonb := '[]'::jsonb;
  v_con_series jsonb := '[]'::jsonb;
begin
  if public.active_room_tier(auth.uid())='free' then raise exception 'PLUS_REQUIRED'; end if;
  if v_caller_id is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  select * into v_room
  from public.rooms where id = p_room_id;

  if not found or v_room.status in ('archived', 'locked') then
    raise exception 'ROOM_NOT_ACCESSIBLE';
  end if;

  if not exists (
    select 1 from public.room_members
    where room_id = p_room_id and user_id = v_caller_id
      and status in ('active', 'paused')
  ) then
    raise exception 'NOT_A_ROOM_MEMBER';
  end if;

  -- Range resolution
  if p_range = '7d' then
    v_start_date := v_today - interval '6 days';
  elsif p_range = '30d' then
    v_start_date := v_today - interval '29 days';
  elsif p_range = '90d' then
    v_start_date := v_today - interval '89 days';
  elsif p_range = '6m' then
    v_start_date := v_today - interval '180 days';
  elsif p_range = '1y' then
    v_start_date := v_today - interval '365 days';
  elsif p_range = 'since_start' then
    v_start_date := v_room.created_at::date;
  else
    v_start_date := v_today - interval '29 days';
  end if;

  -- Member count
  select count(*) into v_total_members
  from public.room_members
  where room_id = p_room_id and status in ('active', 'paused', 'locked');

  v_is_large_room := (v_total_members > 10);

  -- Large rooms (RPG-7): return at most 8 selected members (default: me + 3 most recently active)
  if v_is_large_room then
    if p_selected_member_ids is not null and array_length(p_selected_member_ids, 1) > 0 then
      v_selected_ids := p_selected_member_ids;
      -- Ensure caller is always in selection
      if not (v_caller_id = any(v_selected_ids)) then
        v_selected_ids := array_append(v_selected_ids, v_caller_id);
      end if;
    else
      -- Default: me plus 3 most recently active
      select array_agg(uid) into v_selected_ids
      from (
        select rm.user_id as uid
        from public.room_members rm
        left join lateral (
          select max(updated_at) as last_act from public.daily_summaries where user_id = rm.user_id
        ) ds on true
        where rm.room_id = p_room_id and rm.status in ('active', 'paused')
        order by
          case when rm.user_id = v_caller_id then 0 else 1 end,
          coalesce(ds.last_act, rm.created_at) desc
        limit 4
      ) top_m;
    end if;
  end if;

  -- Iterate room members
  for v_m in
    select rm.user_id, rm.status, rm.privacy_settings,
           p.nickname, p.username, p.avatar_url, p.created_at as profile_created_at
    from public.room_members rm
    join public.profiles p on p.id = rm.user_id
    where rm.room_id = p_room_id
    order by
      case when rm.user_id = v_caller_id then 0 else 1 end,
      lower(p.nickname) asc
  loop
    v_is_self := (v_m.user_id = v_caller_id);
    v_is_locked := (v_m.status = 'locked');
    v_p := v_m.privacy_settings;

    if v_is_locked then
      -- Locked members excluded from charts and marked (PRD RPG-3, RPG-4)
      v_summary_table := v_summary_table || jsonb_build_array(
        jsonb_build_object(
          'user_id', v_m.user_id,
          'nickname', v_m.nickname,
          'avatar_url', v_m.avatar_url,
          'status', 'locked',
          'is_self', v_is_self,
          'is_locked_member', true,
          'weight_change_kg', 'locked',
          'weight_change_pct', 'locked',
          'goal_progress_pct', 'locked',
          'average_calories_vs_target_pct', 'locked',
          'average_steps', 'locked',
          'total_workouts', 'locked',
          'consistency_score', 'locked'
        )
      );
      continue;
    end if;

    -- Compute member summaries for period
    select
      coalesce(count(*) filter (where logged_day = true), 0),
      coalesce(count(*) filter (where goal_day = true), 0),
      coalesce(round(avg(calories / nullif(target_calories, 0)) * 100, 1), 0),
      coalesce(round(avg(steps), 0), 0)
    into v_logged_days, v_goal_days, v_avg_cal_vs_target, v_avg_steps
    from public.daily_summaries
    where user_id = v_m.user_id and local_date::date between v_start_date and v_today;

    v_consistency_score := round(least(100.0, 100.0 * (0.40 * (v_logged_days::numeric / 7.0) + 0.60 * (v_goal_days::numeric / 7.0))), 1);

    select count(*) into v_workouts_cnt
    from public.workouts
    where user_id = v_m.user_id and deleted_at is null
      and local_date::date between v_start_date and v_today;

    -- Weight progress (RPG-2: never raw weight unless opted in)
    select weight_kg into v_start_weight
    from public.weight_logs
    where user_id = v_m.user_id and deleted_at is null
    order by local_date asc, logged_at asc limit 1;

    select weight_kg into v_cur_weight
    from public.weight_logs
    where user_id = v_m.user_id and deleted_at is null
    order by local_date desc, logged_at desc limit 1;

    select target_weight_kg into v_target_weight
    from public.goal_profiles
    where user_id = v_m.user_id and effective_from <= v_today
    order by effective_from desc limit 1;

    if v_start_weight is not null and v_cur_weight is not null then
      v_wt_change := v_cur_weight - v_start_weight;
      if v_start_weight > 0 then
        v_wt_change_pct := round((v_wt_change / v_start_weight) * 100, 1);
      end if;
      if v_target_weight is not null and abs(v_start_weight - v_target_weight) > 0.001 then
        v_goal_prog_pct := round(((v_start_weight - v_cur_weight) / (v_start_weight - v_target_weight)) * 100, 1);
        v_goal_prog_pct := greatest(0.0, least(100.0, v_goal_prog_pct));
      end if;
    end if;

    -- Enforce privacy on summary table
    v_summary_table := v_summary_table || jsonb_build_array(
      jsonb_build_object(
        'user_id', v_m.user_id,
        'nickname', v_m.nickname,
        'avatar_url', v_m.avatar_url,
        'status', v_m.status,
        'is_self', v_is_self,
        'is_locked_member', false,
        'weight_change_kg', case when v_is_self or coalesce((v_p->>'share_weight_progress')::boolean, false) then to_jsonb(v_wt_change) else '"locked"'::jsonb end,
        'weight_change_pct', case when v_is_self or coalesce((v_p->>'share_weight_progress')::boolean, false) then to_jsonb(v_wt_change_pct) else '"locked"'::jsonb end,
        'goal_progress_pct', case when v_is_self or coalesce((v_p->>'share_weight_progress')::boolean, false) then to_jsonb(v_goal_prog_pct) else '"locked"'::jsonb end,
        'average_calories_vs_target_pct', case when v_is_self or coalesce((v_p->>'share_goal_completion')::boolean, true) then to_jsonb(v_avg_cal_vs_target) else '"locked"'::jsonb end,
        'average_steps', case when v_is_self or coalesce((v_p->>'share_steps')::boolean, true) then to_jsonb(v_avg_steps) else '"locked"'::jsonb end,
        'total_workouts', case when v_is_self or coalesce((v_p->>'share_workouts')::boolean, true) then to_jsonb(v_workouts_cnt) else '"locked"'::jsonb end,
        'consistency_score', case when v_is_self or coalesce((v_p->>'share_streak')::boolean, true) then to_jsonb(v_consistency_score) else '"locked"'::jsonb end
      )
    );

    -- Build member series for charts (if selected in large room or standard room)
    if not v_is_large_room or (v_selected_ids is not null and v_m.user_id = any(v_selected_ids)) then
      -- Steps series
      v_step_series := v_step_series || jsonb_build_array(
        jsonb_build_object(
          'user_id', v_m.user_id,
          'nickname', v_m.nickname,
          'username', v_m.username,
          'avatar_url', v_m.avatar_url,
          'status', v_m.status,
          'is_self', v_is_self,
          'is_locked_member', false,
          'is_metric_locked', not (v_is_self or coalesce((v_p->>'share_steps')::boolean, true)),
          'data', case when v_is_self or coalesce((v_p->>'share_steps')::boolean, true) then (
            select coalesce(jsonb_agg(jsonb_build_object('date', local_date, 'value', steps) order by local_date asc), '[]'::jsonb)
            from public.daily_summaries where user_id = v_m.user_id and local_date::date between v_start_date and v_today
          ) else '[]'::jsonb end
        )
      );

      -- Consistency series
      v_con_series := v_con_series || jsonb_build_array(
        jsonb_build_object(
          'user_id', v_m.user_id,
          'nickname', v_m.nickname,
          'username', v_m.username,
          'avatar_url', v_m.avatar_url,
          'status', v_m.status,
          'is_self', v_is_self,
          'is_locked_member', false,
          'is_metric_locked', not (v_is_self or coalesce((v_p->>'share_streak')::boolean, true)),
          'data', case when v_is_self or coalesce((v_p->>'share_streak')::boolean, true) then (
            select coalesce(jsonb_agg(jsonb_build_object('date', local_date, 'value', case when logged_day then 100 else 0 end) order by local_date asc), '[]'::jsonb)
            from public.daily_summaries where user_id = v_m.user_id and local_date::date between v_start_date and v_today
          ) else '[]'::jsonb end
        )
      );

      -- Weight change series (progress towards goal or change from start)
      v_wt_series := v_wt_series || jsonb_build_array(
        jsonb_build_object(
          'user_id', v_m.user_id,
          'nickname', v_m.nickname,
          'username', v_m.username,
          'avatar_url', v_m.avatar_url,
          'status', v_m.status,
          'is_self', v_is_self,
          'is_locked_member', false,
          'is_metric_locked', not (v_is_self or coalesce((v_p->>'share_weight_progress')::boolean, false)),
          'data', case when v_is_self or coalesce((v_p->>'share_weight_progress')::boolean, false) then (
            select coalesce(jsonb_agg(jsonb_build_object('date', local_date, 'value', round(weight_kg - coalesce(v_start_weight, weight_kg), 2)) order by local_date asc), '[]'::jsonb)
            from public.weight_logs where user_id = v_m.user_id and deleted_at is null and local_date::date between v_start_date and v_today
          ) else '[]'::jsonb end
        )
      );

      -- Calories vs target % series
      v_cal_series := v_cal_series || jsonb_build_array(
        jsonb_build_object(
          'user_id', v_m.user_id,
          'nickname', v_m.nickname,
          'username', v_m.username,
          'avatar_url', v_m.avatar_url,
          'status', v_m.status,
          'is_self', v_is_self,
          'is_locked_member', false,
          'is_metric_locked', not (v_is_self or coalesce((v_p->>'share_goal_completion')::boolean, true)),
          'data', case when v_is_self or coalesce((v_p->>'share_goal_completion')::boolean, true) then (
            select coalesce(jsonb_agg(jsonb_build_object('date', local_date, 'value', round((calories / nullif(target_calories, 0)) * 100, 1)) order by local_date asc), '[]'::jsonb)
            from public.daily_summaries where user_id = v_m.user_id and local_date::date between v_start_date and v_today
          ) else '[]'::jsonb end
        )
      );

      -- Water series
      v_water_series := v_water_series || jsonb_build_array(
        jsonb_build_object(
          'user_id', v_m.user_id,
          'nickname', v_m.nickname,
          'username', v_m.username,
          'avatar_url', v_m.avatar_url,
          'status', v_m.status,
          'is_self', v_is_self,
          'is_locked_member', false,
          'is_metric_locked', not (v_is_self or coalesce((v_p->>'share_water')::boolean, true)),
          'data', case when v_is_self or coalesce((v_p->>'share_water')::boolean, true) then (
            select coalesce(jsonb_agg(jsonb_build_object('date', local_date, 'value', water_ml) order by local_date asc), '[]'::jsonb)
            from public.daily_summaries where user_id = v_m.user_id and local_date::date between v_start_date and v_today
          ) else '[]'::jsonb end
        )
      );

      -- Workouts series
      v_wrk_series := v_wrk_series || jsonb_build_array(
        jsonb_build_object(
          'user_id', v_m.user_id,
          'nickname', v_m.nickname,
          'username', v_m.username,
          'avatar_url', v_m.avatar_url,
          'status', v_m.status,
          'is_self', v_is_self,
          'is_locked_member', false,
          'is_metric_locked', not (v_is_self or coalesce((v_p->>'share_workouts')::boolean, true)),
          'data', case when v_is_self or coalesce((v_p->>'share_workouts')::boolean, true) then (
            select coalesce(jsonb_agg(jsonb_build_object('date', local_date, 'value', workout_minutes) order by local_date asc), '[]'::jsonb)
            from public.daily_summaries where user_id = v_m.user_id and local_date::date between v_start_date and v_today
          ) else '[]'::jsonb end
        )
      );
    end if;
  end loop;

  -- Room averages (RPG-7: room-average series)
  select coalesce(
    jsonb_object_agg(
      'steps', (
        select coalesce(jsonb_agg(jsonb_build_object('date', d.ldate, 'value', round(coalesce(avg(ds.steps), 0), 0))), '[]'::jsonb)
        from generate_series(v_start_date, v_today, '1 day'::interval) d(ldate)
        left join public.room_members rm on rm.room_id = p_room_id and rm.status = 'active'
        left join public.daily_summaries ds on ds.user_id = rm.user_id and ds.local_date = d.ldate::date::text
        group by d.ldate order by d.ldate asc
      )
    ), '{}'::jsonb
  ) into v_room_averages;

  return jsonb_build_object(
    'room_id', p_room_id,
    'range', p_range,
    'start_date', v_start_date::text,
    'end_date', v_today::text,
    'total_members', v_total_members,
    'is_large_room', v_is_large_room,
    'selected_member_ids', coalesce(to_jsonb(v_selected_ids), '[]'::jsonb),
    'members_series', jsonb_build_object(
      'consistency', v_con_series,
      'weight_change', v_wt_series,
      'calories_vs_target', v_cal_series,
      'steps', v_step_series,
      'water', v_water_series,
      'workouts', v_wrk_series
    ),
    'room_average_series', v_room_averages,
    'summary_table', v_summary_table
  );
end;
$$;

create or replace function public.start_room_focus(
  p_room_id uuid,
  p_mode text,
  p_label text default null,
  p_planned_seconds integer default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid;
  v_room public.rooms;
  v_active_count int;
  v_daily_count int;
  v_session_id uuid;
  v_started_at timestamptz;
  v_ends_at timestamptz := null;
  v_personal_id uuid;
  v_member record;
  v_sender_name text;
  v_last_push_at timestamptz;
begin
  if public.active_room_tier(auth.uid())='free' then raise exception 'PLUS_REQUIRED'; end if;
  v_uid := auth.uid();
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;

  -- 1. Membership check
  if not public.is_room_member(p_room_id, v_uid) then
    raise exception 'NOT_A_MEMBER';
  end if;

  -- 2. Room usable & not locked
  select * into v_room from public.rooms where id = p_room_id;
  if not found or not public.room_is_usable(p_room_id) or v_room.state in ('locked', 'archived') then
    raise exception 'ROOM_LOCKED';
  end if;

  -- 3. Validate mode & planned seconds
  if p_mode not in ('stopwatch', 'timer') then
    raise exception 'INVALID_MODE';
  end if;

  if p_mode = 'timer' and (p_planned_seconds is null or p_planned_seconds <= 0 or p_planned_seconds > 86400) then
    raise exception 'INVALID_PLANNED_SECONDS';
  end if;

  if p_label is not null and length(trim(p_label)) > 20 then
    raise exception 'LABEL_TOO_LONG';
  end if;

  -- 4. Rate limit 1: ONE active session per room at a time
  select count(*) into v_active_count
  from public.room_focus_sessions
  where room_id = p_room_id and status = 'active';

  if v_active_count > 0 then
    raise exception 'SESSION_ALREADY_ACTIVE';
  end if;

  -- 5. Rate limit 2: 10 sessions per room per day (last 24 hours)
  select count(*) into v_daily_count
  from public.room_focus_sessions
  where room_id = p_room_id
    and started_at >= now() - interval '24 hours';

  if v_daily_count >= 10 then
    raise exception 'RATE_LIMITED';
  end if;

  -- 6. Server sets start time and ends_at
  v_started_at := now();
  if p_mode = 'timer' then
    v_ends_at := v_started_at + (p_planned_seconds || ' seconds')::interval;
  end if;

  insert into public.room_focus_sessions (
    room_id,
    started_by,
    mode,
    label,
    planned_seconds,
    started_at,
    ends_at,
    status,
    created_at,
    updated_at
  )
  values (
    p_room_id,
    v_uid,
    p_mode,
    nullif(trim(p_label), ''),
    p_planned_seconds,
    v_started_at,
    v_ends_at,
    'active',
    now(),
    now()
  )
  returning id into v_session_id;

  -- 7. Add starter as first participant
  insert into public.room_focus_participants (
    session_id,
    user_id,
    joined_at,
    status,
    created_at,
    updated_at
  )
  values (
    v_session_id,
    v_uid,
    v_started_at,
    'focusing',
    now(),
    now()
  );

  -- 8. Add starter's corresponding personal session row
  v_personal_id := gen_random_uuid();
  insert into public.focus_sessions (
    id,
    user_id,
    room_session_id,
    mode,
    label,
    planned_seconds,
    started_at,
    paused_seconds,
    status,
    source,
    created_at,
    updated_at
  )
  values (
    v_personal_id,
    v_uid,
    v_session_id,
    p_mode,
    nullif(trim(p_label), ''),
    p_planned_seconds,
    v_started_at,
    0,
    'active',
    'room',
    now(),
    now()
  );

  -- 9. Notification (PRD 6.25 FOC-9): member started a session
  -- Max 1 push per 10 minutes per room, respects per-room mute, quiet hours, usable room
  select coalesce(nickname, username, 'A partner') into v_sender_name
  from public.profiles where id = v_uid;

  -- Check room-level throttle (at most 1 focus push per 10 minutes per room)
  select max(created_at) into v_last_push_at
  from public.push_notification_queue
  where notification_type = 'focus_session'
    and data->>'roomId' = p_room_id::text
    and data->>'event' = 'session_started';

  if v_last_push_at is null or v_last_push_at < now() - interval '10 minutes' then
    for v_member in (
      select rm.user_id as recipient_id
      from public.room_members rm
      where rm.room_id = p_room_id
        and rm.user_id != v_uid
        and rm.status = 'active'
        and not public.is_room_chat_muted(p_room_id, rm.user_id)
    ) loop
      perform public.queue_push_notification(
        p_user_id := v_member.recipient_id,
        p_type := 'focus_session',
        p_title := coalesce(v_room.name, 'Room Focus'),
        p_body := case
          when p_mode = 'timer' then v_sender_name || ' started a ' || round(p_planned_seconds / 60) || '-minute focus session. Join?'
          else v_sender_name || ' started a focus session. Join?'
        end,
        p_data := jsonb_build_object(
          'roomId', p_room_id,
          'sessionId', v_session_id,
          'event', 'session_started',
          'mode', p_mode
        ),
        p_room_id := p_room_id
      );
    end loop;
  end if;

  return v_session_id;
end;
$$;

create or replace function public.join_room_focus(p_session_id uuid)
returns public.room_focus_participants
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid;
  v_session public.room_focus_sessions;
  v_room public.rooms;
  v_cap int;
  v_active_participants int;
  v_row public.room_focus_participants;
  v_personal_id uuid;
begin
  if public.active_room_tier(auth.uid())='free' then raise exception 'PLUS_REQUIRED'; end if;
  v_uid := auth.uid();
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;

  select * into v_session from public.room_focus_sessions where id = p_session_id;
  if not found or v_session.status != 'active' then
    raise exception 'SESSION_ENDED';
  end if;

  -- Timer ended check
  if v_session.mode = 'timer' and v_session.ends_at is not null and now() >= v_session.ends_at then
    -- Auto-end session
    update public.room_focus_sessions set status = 'ended', ended_at = v_session.ends_at where id = p_session_id;
    raise exception 'SESSION_ENDED';
  end if;

  -- Membership & usability check
  if not public.is_room_member(v_session.room_id, v_uid) then
    raise exception 'NOT_A_MEMBER';
  end if;

  select * into v_room from public.rooms where id = v_session.room_id;
  if not found or not public.room_is_usable(v_session.room_id) or v_room.state in ('locked', 'archived') then
    raise exception 'ROOM_LOCKED';
  end if;

  -- Capacity check (up to the room's cap)
  v_cap := public.get_room_member_cap(v_session.room_id);
  select count(*) into v_active_participants
  from public.room_focus_participants
  where session_id = p_session_id and status in ('focusing', 'break');

  if v_active_participants >= v_cap then
    raise exception 'ROOM_FULL';
  end if;

  -- Join or re-join
  insert into public.room_focus_participants (
    session_id,
    user_id,
    joined_at,
    left_at,
    paused_seconds,
    status,
    created_at,
    updated_at
  )
  values (
    p_session_id,
    v_uid,
    now(),
    null,
    0,
    'focusing',
    now(),
    now()
  )
  on conflict (session_id, user_id) do update
  set status = 'focusing',
      left_at = null,
      updated_at = now()
  returning * into v_row;

  -- Upsert linked personal focus session row
  select id into v_personal_id
  from public.focus_sessions
  where user_id = v_uid and room_session_id = p_session_id;

  if v_personal_id is null then
    v_personal_id := gen_random_uuid();
    insert into public.focus_sessions (
      id,
      user_id,
      room_session_id,
      mode,
      label,
      planned_seconds,
      started_at,
      paused_seconds,
      status,
      source,
      created_at,
      updated_at
    )
    values (
      v_personal_id,
      v_uid,
      p_session_id,
      v_session.mode,
      v_session.label,
      v_session.planned_seconds,
      now(),
      0,
      'active',
      'room',
      now(),
      now()
    );
  else
    update public.focus_sessions
    set status = 'active',
        ended_at = null,
        updated_at = now()
    where id = v_personal_id;
  end if;

  return v_row;
end;
$$;

create or replace function public.get_room_focus(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid;
  v_room public.rooms;
  v_active_session record;
  v_active_json jsonb := null;
  v_participants jsonb := '[]'::jsonb;
  v_recent_json jsonb := '[]'::jsonb;
  v_starter_privacy jsonb;
  v_share_label boolean := false;
  v_my_part record;
  v_my_part_json jsonb := null;
begin
  if public.active_room_tier(auth.uid())='free' then raise exception 'PLUS_REQUIRED'; end if;
  v_uid := auth.uid();
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;

  if not public.is_room_member(p_room_id, v_uid) then
    raise exception 'NOT_A_MEMBER';
  end if;

  select * into v_room from public.rooms where id = p_room_id;
  if not found or not public.room_is_usable(p_room_id) or v_room.state in ('locked', 'archived') then
    raise exception 'ROOM_LOCKED';
  end if;

  -- 1. Auto-end active timers that passed ends_at
  update public.room_focus_sessions
  set status = 'ended',
      ended_at = ends_at,
      updated_at = now()
  where room_id = p_room_id
    and status = 'active'
    and mode = 'timer'
    and ends_at <= now();

  -- 2. Fetch active session
  select * into v_active_session
  from public.room_focus_sessions
  where room_id = p_room_id and status = 'active'
  order by started_at desc
  limit 1;

  if found then
    -- Check starter privacy for label
    select rm.privacy_settings into v_starter_privacy
    from public.room_members rm
    where rm.room_id = p_room_id and rm.user_id = v_active_session.started_by;

    v_share_label := (v_active_session.started_by = v_uid) or coalesce(
      (v_starter_privacy->>'share_focus_label')::boolean,
      (v_starter_privacy->>'focus_label')::boolean,
      false
    );

    -- Participants
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', rfp.id,
        'user_id', rfp.user_id,
        'joined_at', rfp.joined_at,
        'left_at', rfp.left_at,
        'paused_seconds', rfp.paused_seconds,
        'status', rfp.status,
        'nickname', p.nickname,
        'username', p.username,
        'avatar_url', p.avatar_url,
        'elapsed_seconds', case
          when rfp.left_at is not null then
            greatest(0, floor(extract(epoch from (rfp.left_at - rfp.joined_at))) - rfp.paused_seconds)::int
          else
            greatest(0, floor(extract(epoch from (now() - rfp.joined_at))) - rfp.paused_seconds)::int
        end
      )
    ), '[]'::jsonb) into v_participants
    from public.room_focus_participants rfp
    left join public.profiles p on p.id = rfp.user_id
    where rfp.session_id = v_active_session.id;

    -- My participant row
    select * into v_my_part
    from public.room_focus_participants
    where session_id = v_active_session.id and user_id = v_uid;

    if found then
      v_my_part_json := jsonb_build_object(
        'id', v_my_part.id,
        'user_id', v_my_part.user_id,
        'joined_at', v_my_part.joined_at,
        'left_at', v_my_part.left_at,
        'paused_seconds', v_my_part.paused_seconds,
        'status', v_my_part.status
      );
    end if;

    v_active_json := jsonb_build_object(
      'session', jsonb_build_object(
        'id', v_active_session.id,
        'room_id', v_active_session.room_id,
        'started_by', v_active_session.started_by,
        'mode', v_active_session.mode,
        'label', case when v_share_label then v_active_session.label else null end,
        'planned_seconds', v_active_session.planned_seconds,
        'started_at', v_active_session.started_at,
        'ends_at', v_active_session.ends_at,
        'ended_at', v_active_session.ended_at,
        'status', v_active_session.status,
        'created_at', v_active_session.created_at,
        'updated_at', v_active_session.updated_at
      ),
      'participants', v_participants,
      'remaining_seconds', case
        when v_active_session.ends_at is not null then
          greatest(0, floor(extract(epoch from (v_active_session.ends_at - now()))))::int
        else null
      end,
      'is_starter', (v_active_session.started_by = v_uid),
      'is_participating', (v_my_part_json is not null and v_my_part.status in ('focusing', 'break')),
      'my_participant', v_my_part_json
    );
  end if;

  -- 3. Last 10 recent sessions
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'mode', s.mode,
      'label', case
        when (s.started_by = v_uid) or coalesce(
          (rm.privacy_settings->>'share_focus_label')::boolean,
          (rm.privacy_settings->>'focus_label')::boolean,
          false
        ) then s.label
        else null
      end,
      'started_at', s.started_at,
      'ended_at', s.ended_at,
      'duration_minutes', case
        when s.ended_at is not null then
          greatest(0, round(extract(epoch from (s.ended_at - s.started_at)) / 60))::int
        else 0
      end,
      'participant_count', (select count(*) from public.room_focus_participants where session_id = s.id)
    )
  ), '[]'::jsonb) into v_recent_json
  from (
    select * from public.room_focus_sessions
    where room_id = p_room_id and status in ('ended', 'auto_ended')
    order by ended_at desc nulls last
    limit 10
  ) s
  left join public.room_members rm on rm.room_id = p_room_id and rm.user_id = s.started_by;

  return jsonb_build_object(
    'active_session', v_active_json,
    'recent_sessions', v_recent_json
  );
end;
$$;

create or replace function public.get_room_weekly_focus_stats(
  p_room_id uuid,
  p_week_start text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid;
  v_room public.rooms;
  v_start_date date;
  v_end_date date;
  v_members jsonb;
  v_room_total int := 0;
begin
  if public.active_room_tier(auth.uid())='free' then raise exception 'PLUS_REQUIRED'; end if;
  v_uid := auth.uid();
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;

  if not public.is_room_member(p_room_id, v_uid) then
    raise exception 'NOT_A_MEMBER';
  end if;

  select * into v_room from public.rooms where id = p_room_id;
  if not found or not public.room_is_usable(p_room_id) or v_room.state in ('locked', 'archived') then
    raise exception 'ROOM_LOCKED';
  end if;

  if p_week_start is not null then
    v_start_date := p_week_start::date;
  else
    v_start_date := date_trunc('week', now())::date;
  end if;
  v_end_date := v_start_date + interval '6 days';

  -- Select active members, check privacy, compute focus minutes, order me first then alphabetical (PRD FOC-10, RPG-8: NO ranking!)
  with member_focus as (
    select
      rm.user_id,
      p.nickname,
      p.username,
      p.avatar_url,
      (rm.user_id = v_uid) as is_me,
      case
        when rm.user_id = v_uid then false
        when not coalesce(
          (rm.privacy_settings->>'share_focus_status')::boolean,
          (rm.privacy_settings->>'focus_status')::boolean,
          true
        ) then true
        else false
      end as is_hidden,
      coalesce((
        select sum(ds.focus_minutes)::int
        from public.daily_summaries ds
        where ds.user_id = rm.user_id
          and ds.local_date::date between v_start_date and v_end_date
      ), 0) as focus_mins
    from public.room_members rm
    join public.profiles p on p.id = rm.user_id
    where rm.room_id = p_room_id
      and rm.status = 'active'
  )
  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'user_id', user_id,
        'nickname', nickname,
        'username', username,
        'avatar_url', avatar_url,
        'is_me', is_me,
        'is_hidden', is_hidden,
        'weekly_focus_minutes', case when is_hidden then null else focus_mins end
      )
      order by
        case when is_me then 0 else 1 end,
        coalesce(nickname, username) asc
    ), '[]'::jsonb),
    coalesce(sum(case when not is_hidden then focus_mins else 0 end), 0)::int
  into v_members, v_room_total
  from member_focus;

  return jsonb_build_object(
    'room_id', p_room_id,
    'room_total_minutes', v_room_total,
    'members', v_members
  );
end;
$$;

create or replace function public.nudge(
  p_room_id uuid,
  p_recipient_id uuid,
  p_message text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_today_start timestamptz;
  v_nudge_count integer;
  v_nudge_id uuid;
begin
  if public.active_room_tier(auth.uid())='free' then raise exception 'PLUS_REQUIRED'; end if;
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  if not public.is_room_member(p_room_id, v_uid) then
    raise exception 'NOT_ROOM_MEMBER' using errcode = 'P0001';
  end if;

  if not public.room_is_usable(p_room_id) then
    raise exception 'ROOM_LOCKED' using errcode = 'P0001';
  end if;

  if not public.is_room_member(p_room_id, p_recipient_id) then
    raise exception 'RECIPIENT_NOT_MEMBER' using errcode = 'P0001';
  end if;

  if length(trim(p_message)) < 1 then
    raise exception 'INVALID_NUDGE_MESSAGE' using errcode = 'P0001';
  end if;

  v_today_start := date_trunc('day', now());
  select count(*) into v_nudge_count
  from public.nudges
  where room_id = p_room_id
    and sender_id = v_uid
    and recipient_id = p_recipient_id
    and created_at >= v_today_start;

  if v_nudge_count >= 2 then
    raise exception 'NUDGE_LIMIT_REACHED' using errcode = 'P0001';
  end if;

  insert into public.nudges (room_id, sender_id, recipient_id, message)
  values (p_room_id, v_uid, p_recipient_id, trim(p_message))
  returning id into v_nudge_id;

  return jsonb_build_object('nudge_id', v_nudge_id, 'status', 'sent');
end;
$$;

create or replace function public.react(
  p_room_id uuid,
  p_event_id uuid,
  p_reaction text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_clean text := lower(trim(p_reaction));
begin
  if public.active_room_tier(auth.uid())='free' then raise exception 'PLUS_REQUIRED'; end if;
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  if not public.is_room_member(p_room_id, v_uid) then
    raise exception 'NOT_ROOM_MEMBER' using errcode = 'P0001';
  end if;

  if not public.room_is_usable(p_room_id) then
    raise exception 'ROOM_LOCKED' using errcode = 'P0001';
  end if;

  if v_clean not in ('fire', 'clap', 'muscle', 'heart', 'party') then
    raise exception 'INVALID_REACTION' using errcode = 'P0001';
  end if;

  insert into public.reactions (room_id, user_id, event_id, reaction)
  values (p_room_id, v_uid, p_event_id, v_clean)
  on conflict (room_id, user_id, event_id, reaction) do nothing;

  return jsonb_build_object('status', 'reacted', 'reaction', v_clean);
end;
$$;

create or replace function public.tag_shared_meal(
  p_room_id uuid,
  p_food_entry_id uuid,
  p_participant_user_ids uuid[],
  p_default_portion numeric default 1.0
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_entry record;
  v_shared_meal_id uuid;
  v_p_id uuid;
  v_p_count integer := 0;
begin
  if public.active_room_tier(auth.uid())='free' then raise exception 'PLUS_REQUIRED'; end if;
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  if not public.is_room_member(p_room_id, v_uid) then
    raise exception 'NOT_ROOM_MEMBER' using errcode = 'P0001';
  end if;

  if not public.room_is_usable(p_room_id) then
    raise exception 'ROOM_LOCKED' using errcode = 'P0001';
  end if;

  select * into v_entry
  from public.food_entries
  where id = p_food_entry_id and user_id = v_uid and deleted_at is null;

  if not found then
    raise exception 'ENTRY_NOT_FOUND' using errcode = 'P0001';
  end if;

  insert into public.shared_meals (
    room_id, creator_id, source_food_entry_id, food_name, brand,
    portion_display, calories_per_portion, protein_g, carbs_g, fat_g, meal_section
  ) values (
    p_room_id, v_uid, v_entry.id, v_entry.food_name, v_entry.brand,
    v_entry.portion_display, v_entry.calories, v_entry.protein_g, v_entry.carbs_g, v_entry.fat_g, v_entry.meal_section
  )
  returning id into v_shared_meal_id;

  foreach v_p_id in array p_participant_user_ids loop
    if v_p_id <> v_uid and public.is_room_member(p_room_id, v_p_id) then
      insert into public.shared_meal_participants (shared_meal_id, user_id, status)
      values (v_shared_meal_id, v_p_id, 'pending')
      on conflict (shared_meal_id, user_id) do nothing;
      v_p_count := v_p_count + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'shared_meal_id', v_shared_meal_id,
    'participants_count', v_p_count
  );
end;
$$;

-- Publish only a metadata change. Clients refetch the privacy-filtered snapshot;
-- free members never need direct access to health-bearing room event payloads.
create or replace function public.touch_room_for_event_v3()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin update public.rooms set updated_at=now() where id=new.room_id; return new; end; $$;
create trigger room_events_refresh_metadata_v3 after insert on public.room_events for each row execute function public.touch_room_for_event_v3();
