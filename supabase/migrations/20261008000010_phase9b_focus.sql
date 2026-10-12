-- =============================================================================
-- Migration: 20261008000010_phase9b_focus.sql
-- Description: Phase 9B — Focus Time (Personal & Room Sessions)
-- PRD: 6.25 (FOC-1..FOC-15), 7.13, 6.13 (focus rows), 6.15 (PRG-14, RPG-8), 7.6
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. DAILY SUMMARIES SCHEMA ENHANCEMENT
-- -----------------------------------------------------------------------------
alter table public.daily_summaries
  add column if not exists focus_minutes integer not null default 0;

-- -----------------------------------------------------------------------------
-- 2. PRIVACY SETTINGS UPDATE FOR FOCUS (PRD 6.13)
-- Add focus_status (default shared) and focus_label (default hidden)
-- -----------------------------------------------------------------------------
create or replace function public.default_privacy_settings()
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'share_streak', true,
    'share_goal_completion', true,
    'share_steps', true,
    'share_water', true,
    'share_workouts', true,
    'share_workout_details', false,
    'share_calories_macros', false,
    'share_meals', 'never',
    'share_weight_number', false,
    'share_weight_progress', false,
    'share_fasting', false,
    'share_focus_status', true,
    'share_focus_label', false,
    'focus_status', true,
    'focus_label', false
  );
$$;

create or replace function public.sanitize_privacy_settings(p_settings jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  v_def jsonb := public.default_privacy_settings();
  v_meals text;
  v_focus_status boolean;
  v_focus_label boolean;
begin
  if p_settings is null then
    return v_def;
  end if;

  v_meals := coalesce(p_settings->>'share_meals', 'never');
  if v_meals not in ('never', 'per_meal', 'always') then
    v_meals := 'never';
  end if;

  -- Resolve focus_status and focus_label supporting both naming variants
  if (p_settings ? 'share_focus_status') and (p_settings ? 'focus_status') then
    v_focus_status := ((p_settings->>'share_focus_status')::boolean and (p_settings->>'focus_status')::boolean);
  elsif (p_settings ? 'share_focus_status') then
    v_focus_status := (p_settings->>'share_focus_status')::boolean;
  elsif (p_settings ? 'focus_status') then
    v_focus_status := (p_settings->>'focus_status')::boolean;
  else
    v_focus_status := true;
  end if;

  if (p_settings ? 'share_focus_label') and (p_settings ? 'focus_label') then
    v_focus_label := ((p_settings->>'share_focus_label')::boolean or (p_settings->>'focus_label')::boolean);
  elsif (p_settings ? 'share_focus_label') then
    v_focus_label := (p_settings->>'share_focus_label')::boolean;
  elsif (p_settings ? 'focus_label') then
    v_focus_label := (p_settings->>'focus_label')::boolean;
  else
    v_focus_label := false;
  end if;

  return jsonb_build_object(
    'share_streak', coalesce((p_settings->>'share_streak')::boolean, (v_def->>'share_streak')::boolean),
    'share_goal_completion', coalesce((p_settings->>'share_goal_completion')::boolean, (v_def->>'share_goal_completion')::boolean),
    'share_steps', coalesce((p_settings->>'share_steps')::boolean, (v_def->>'share_steps')::boolean),
    'share_water', coalesce((p_settings->>'share_water')::boolean, (v_def->>'share_water')::boolean),
    'share_workouts', coalesce((p_settings->>'share_workouts')::boolean, (v_def->>'share_workouts')::boolean),
    'share_workout_details', coalesce((p_settings->>'share_workout_details')::boolean, (v_def->>'share_workout_details')::boolean),
    'share_calories_macros', coalesce((p_settings->>'share_calories_macros')::boolean, (v_def->>'share_calories_macros')::boolean),
    'share_meals', v_meals,
    'share_weight_number', coalesce((p_settings->>'share_weight_number')::boolean, (v_def->>'share_weight_number')::boolean),
    'share_weight_progress', coalesce((p_settings->>'share_weight_progress')::boolean, (v_def->>'share_weight_progress')::boolean),
    'share_fasting', coalesce((p_settings->>'share_fasting')::boolean, (v_def->>'share_fasting')::boolean),
    'share_focus_status', v_focus_status,
    'share_focus_label', v_focus_label,
    'focus_status', v_focus_status,
    'focus_label', v_focus_label
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. TABLES: ROOM FOCUS SESSIONS, PARTICIPANTS, FOCUS SESSIONS & FOCUS SETTINGS
-- -----------------------------------------------------------------------------

-- Room Focus Sessions (one active per room, starter, mode, planned_seconds, started_at set by server)
create table if not exists public.room_focus_sessions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  started_by uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('stopwatch', 'timer')),
  label text check (label is null or length(label) <= 20),
  planned_seconds integer check (planned_seconds is null or (planned_seconds > 0 and planned_seconds <= 86400)),
  started_at timestamptz not null default now(), -- SET BY SERVER
  ends_at timestamptz, -- for timers
  ended_at timestamptz,
  status text not null default 'active' check (status in ('active', 'ended', 'auto_ended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_rfs_room_status on public.room_focus_sessions (room_id, status);
create index if not exists idx_rfs_ends_at on public.room_focus_sessions (ends_at) where status = 'active';

alter table public.room_focus_sessions enable row level security;

-- Readable only by members of a usable (not Locked) room
drop policy if exists room_focus_sessions_select on public.room_focus_sessions;
create policy room_focus_sessions_select on public.room_focus_sessions
  for select to authenticated
  using (
    public.is_room_member(room_id, auth.uid())
    and public.room_is_usable(room_id)
    and exists (
      select 1 from public.rooms r
      where r.id = room_focus_sessions.room_id
        and r.state not in ('locked', 'archived')
    )
  );

drop policy if exists room_focus_sessions_no_client_write on public.room_focus_sessions;
create policy room_focus_sessions_no_client_write on public.room_focus_sessions
  for all to anon, authenticated
  using (false)
  with check (false);

-- Room Focus Participants
create table if not exists public.room_focus_participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.room_focus_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  paused_seconds integer not null default 0,
  last_paused_at timestamptz,
  status text not null default 'focusing' check (status in ('focusing', 'break', 'left')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, user_id)
);

create index if not exists idx_rfp_session_status on public.room_focus_participants (session_id, status);
create index if not exists idx_rfp_user on public.room_focus_participants (user_id);

alter table public.room_focus_participants enable row level security;

-- Readable only by members of a usable room
drop policy if exists room_focus_participants_select on public.room_focus_participants;
create policy room_focus_participants_select on public.room_focus_participants
  for select to authenticated
  using (
    exists (
      select 1 from public.room_focus_sessions s
      join public.rooms r on r.id = s.room_id
      where s.id = room_focus_participants.session_id
        and public.is_room_member(s.room_id, auth.uid())
        and public.room_is_usable(s.room_id)
        and r.state not in ('locked', 'archived')
    )
  );

drop policy if exists room_focus_participants_no_client_write on public.room_focus_participants;
create policy room_focus_participants_no_client_write on public.room_focus_participants
  for all to anon, authenticated
  using (false)
  with check (false);

-- Personal Focus Sessions (owner only RLS, idempotent client UUID)
create table if not exists public.focus_sessions (
  id uuid primary key, -- client-generated UUID
  user_id uuid not null references auth.users(id) on delete cascade,
  room_session_id uuid references public.room_focus_sessions(id) on delete set null,
  mode text not null check (mode in ('stopwatch', 'timer')),
  label text check (label is null or length(label) <= 20),
  planned_seconds integer check (planned_seconds is null or (planned_seconds > 0 and planned_seconds <= 86400)),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  paused_seconds integer not null default 0,
  last_paused_at timestamptz,
  status text not null default 'active' check (status in ('active', 'paused', 'ended', 'auto_ended')),
  source text not null default 'personal' check (source in ('personal', 'room')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_focus_sessions_user_date on public.focus_sessions (user_id, started_at desc);
create index if not exists idx_focus_sessions_room on public.focus_sessions (room_session_id);
create index if not exists idx_focus_sessions_status on public.focus_sessions (status);

alter table public.focus_sessions enable row level security;

drop policy if exists focus_sessions_select_own on public.focus_sessions;
create policy focus_sessions_select_own on public.focus_sessions
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists focus_sessions_insert_own on public.focus_sessions;
create policy focus_sessions_insert_own on public.focus_sessions
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists focus_sessions_update_own on public.focus_sessions;
create policy focus_sessions_update_own on public.focus_sessions
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists focus_sessions_delete_own on public.focus_sessions;
create policy focus_sessions_delete_own on public.focus_sessions
  for delete to authenticated
  using (auth.uid() = user_id);

-- User Focus Settings (PRD FOC-11, FOC-12)
create table if not exists public.focus_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  weekly_goal_minutes integer not null default 300,
  streak_minimum_minutes integer not null default 25,
  break_reminders boolean not null default true,
  default_label text check (default_label is null or length(default_label) <= 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.focus_settings enable row level security;

drop policy if exists focus_settings_select_own on public.focus_settings;
create policy focus_settings_select_own on public.focus_settings
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists focus_settings_insert_own on public.focus_settings;
create policy focus_settings_insert_own on public.focus_settings
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists focus_settings_update_own on public.focus_settings;
create policy focus_settings_update_own on public.focus_settings
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 4. SERVER TIME HELPER (CLOCK OFFSET CORRECTION)
-- -----------------------------------------------------------------------------
create or replace function public.server_time()
returns timestamptz
language sql
stable
as $$
  select clock_timestamp();
$$;

-- -----------------------------------------------------------------------------
-- 5. RECOMPUTE DAILY FOCUS MINUTES (IDEMPOTENT DAILY_SUMMARIES SYNC)
-- -----------------------------------------------------------------------------
create or replace function public.recompute_daily_focus_minutes(
  p_user_id uuid,
  p_local_date text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tz text := 'UTC';
  v_rec record;
  v_total_mins int;
begin
  -- Get user timezone
  select coalesce(timezone, 'UTC') into v_tz from public.profiles where id = p_user_id;

  -- Recompute for each local date affected (or all recent dates if p_local_date is null)
  for v_rec in (
    select
      to_char(started_at at time zone v_tz, 'YYYY-MM-DD') as ldate,
      coalesce(sum(
        case
          when ended_at is not null then
            greatest(0, round((extract(epoch from (ended_at - started_at)) - paused_seconds) / 60))
          else 0
        end
      ), 0)::int as total_minutes
    from public.focus_sessions
    where user_id = p_user_id
      and status in ('ended', 'auto_ended')
      and (p_local_date is null or to_char(started_at at time zone v_tz, 'YYYY-MM-DD') = p_local_date)
    group by to_char(started_at at time zone v_tz, 'YYYY-MM-DD')
  ) loop
    insert into public.daily_summaries (user_id, local_date, focus_minutes, updated_at)
    values (p_user_id, v_rec.ldate, v_rec.total_minutes, now())
    on conflict (user_id, local_date) do update
    set focus_minutes = excluded.focus_minutes,
        updated_at = now();
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. PERSONAL FOCUS FUNCTIONS (IDEMPOTENT BY CLIENT UUID)
-- -----------------------------------------------------------------------------

create or replace function public.start_personal_focus(
  p_id uuid,
  p_mode text,
  p_label text default null,
  p_planned_seconds integer default null
)
returns public.focus_sessions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid;
  v_row public.focus_sessions;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if p_mode not in ('stopwatch', 'timer') then
    raise exception 'INVALID_MODE';
  end if;

  if p_mode = 'timer' and (p_planned_seconds is null or p_planned_seconds <= 0 or p_planned_seconds > 86400) then
    raise exception 'INVALID_PLANNED_SECONDS';
  end if;

  if p_label is not null and length(trim(p_label)) > 20 then
    raise exception 'LABEL_TOO_LONG';
  end if;

  -- Idempotent upsert by client UUID
  insert into public.focus_sessions (
    id,
    user_id,
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
    p_id,
    v_uid,
    p_mode,
    nullif(trim(p_label), ''),
    p_planned_seconds,
    now(),
    0,
    'active',
    'personal',
    now(),
    now()
  )
  on conflict (id) do update
  set updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.pause_personal_focus(p_id uuid)
returns public.focus_sessions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid;
  v_row public.focus_sessions;
begin
  v_uid := auth.uid();
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;

  select * into v_row from public.focus_sessions where id = p_id and user_id = v_uid;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;

  if v_row.status = 'active' then
    update public.focus_sessions
    set status = 'paused',
        last_paused_at = now(),
        updated_at = now()
    where id = p_id
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

create or replace function public.resume_personal_focus(p_id uuid)
returns public.focus_sessions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid;
  v_row public.focus_sessions;
  v_pause_diff int := 0;
begin
  v_uid := auth.uid();
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;

  select * into v_row from public.focus_sessions where id = p_id and user_id = v_uid;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;

  if v_row.status = 'paused' then
    if v_row.last_paused_at is not null then
      v_pause_diff := greatest(0, floor(extract(epoch from (now() - v_row.last_paused_at))))::int;
    end if;

    update public.focus_sessions
    set status = 'active',
        paused_seconds = paused_seconds + v_pause_diff,
        last_paused_at = null,
        updated_at = now()
    where id = p_id
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

create or replace function public.end_personal_focus(p_id uuid)
returns public.focus_sessions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid;
  v_row public.focus_sessions;
  v_pause_diff int := 0;
begin
  v_uid := auth.uid();
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;

  select * into v_row from public.focus_sessions where id = p_id and user_id = v_uid;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;

  if v_row.status in ('active', 'paused') then
    if v_row.status = 'paused' and v_row.last_paused_at is not null then
      v_pause_diff := greatest(0, floor(extract(epoch from (now() - v_row.last_paused_at))))::int;
    end if;

    update public.focus_sessions
    set status = 'ended',
        ended_at = now(),
        paused_seconds = paused_seconds + v_pause_diff,
        last_paused_at = null,
        updated_at = now()
    where id = p_id
    returning * into v_row;

    -- Recompute daily focus minutes
    perform public.recompute_daily_focus_minutes(v_uid);
  end if;

  return v_row;
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. ROOM FOCUS FUNCTIONS (ONE ACTIVE, CAPACITY, RATE LIMIT, PRIVACY SAFE)
-- -----------------------------------------------------------------------------

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

create or replace function public.leave_room_focus(p_session_id uuid)
returns public.room_focus_participants
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid;
  v_row public.room_focus_participants;
  v_session public.room_focus_sessions;
  v_pause_diff int := 0;
  v_active_left int;
begin
  v_uid := auth.uid();
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;

  select * into v_session from public.room_focus_sessions where id = p_session_id;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;

  select * into v_row from public.room_focus_participants
  where session_id = p_session_id and user_id = v_uid;

  if not found then raise exception 'NOT_A_PARTICIPANT'; end if;

  if v_row.status in ('focusing', 'break') then
    if v_row.status = 'break' and v_row.last_paused_at is not null then
      v_pause_diff := greatest(0, floor(extract(epoch from (now() - v_row.last_paused_at))))::int;
    end if;

    update public.room_focus_participants
    set status = 'left',
        left_at = now(),
        paused_seconds = paused_seconds + v_pause_diff,
        last_paused_at = null,
        updated_at = now()
    where session_id = p_session_id and user_id = v_uid
    returning * into v_row;

    -- Update personal session
    update public.focus_sessions
    set status = 'ended',
        ended_at = now(),
        paused_seconds = paused_seconds + v_pause_diff,
        last_paused_at = null,
        updated_at = now()
    where user_id = v_uid and room_session_id = p_session_id;

    perform public.recompute_daily_focus_minutes(v_uid);

    -- Stopwatch rule: ends when starter ends it or when the last participant leaves (PRD FOC-8)
    if v_session.mode = 'stopwatch' and v_session.status = 'active' then
      select count(*) into v_active_left
      from public.room_focus_participants
      where session_id = p_session_id and status in ('focusing', 'break');

      if v_active_left = 0 then
        update public.room_focus_sessions
        set status = 'ended',
            ended_at = now(),
            updated_at = now()
        where id = p_session_id;
      end if;
    end if;
  end if;

  return v_row;
end;
$$;

create or replace function public.pause_my_room_focus(p_session_id uuid)
returns public.room_focus_participants
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid;
  v_row public.room_focus_participants;
begin
  v_uid := auth.uid();
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;

  select * into v_row from public.room_focus_participants
  where session_id = p_session_id and user_id = v_uid;
  if not found then raise exception 'NOT_A_PARTICIPANT'; end if;

  if v_row.status = 'focusing' then
    update public.room_focus_participants
    set status = 'break',
        last_paused_at = now(),
        updated_at = now()
    where session_id = p_session_id and user_id = v_uid
    returning * into v_row;

    update public.focus_sessions
    set status = 'paused',
        last_paused_at = now(),
        updated_at = now()
    where user_id = v_uid and room_session_id = p_session_id;
  end if;

  return v_row;
end;
$$;

create or replace function public.resume_my_room_focus(p_session_id uuid)
returns public.room_focus_participants
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid;
  v_row public.room_focus_participants;
  v_diff int := 0;
begin
  v_uid := auth.uid();
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;

  select * into v_row from public.room_focus_participants
  where session_id = p_session_id and user_id = v_uid;
  if not found then raise exception 'NOT_A_PARTICIPANT'; end if;

  if v_row.status = 'break' then
    if v_row.last_paused_at is not null then
      v_diff := greatest(0, floor(extract(epoch from (now() - v_row.last_paused_at))))::int;
    end if;

    update public.room_focus_participants
    set status = 'focusing',
        paused_seconds = paused_seconds + v_diff,
        last_paused_at = null,
        updated_at = now()
    where session_id = p_session_id and user_id = v_uid
    returning * into v_row;

    update public.focus_sessions
    set status = 'active',
        paused_seconds = paused_seconds + v_diff,
        last_paused_at = null,
        updated_at = now()
    where user_id = v_uid and room_session_id = p_session_id;
  end if;

  return v_row;
end;
$$;

create or replace function public.end_room_focus(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid;
  v_session public.room_focus_sessions;
  v_is_host boolean;
  v_p record;
  v_member record;
begin
  v_uid := auth.uid();
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;

  select * into v_session from public.room_focus_sessions where id = p_session_id;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;

  -- Starter or room host only
  select (role = 'host') into v_is_host
  from public.room_members
  where room_id = v_session.room_id and user_id = v_uid and status = 'active';

  if v_session.started_by != v_uid and coalesce(v_is_host, false) = false then
    raise exception 'PERMISSION_DENIED';
  end if;

  if v_session.status = 'active' then
    -- End the session
    update public.room_focus_sessions
    set status = 'ended',
        ended_at = now(),
        updated_at = now()
    where id = p_session_id;

    -- Close all active participants
    for v_p in (
      select * from public.room_focus_participants
      where session_id = p_session_id and status in ('focusing', 'break')
    ) loop
      update public.room_focus_participants
      set status = 'left',
          left_at = now(),
          paused_seconds = paused_seconds + case
            when v_p.status = 'break' and v_p.last_paused_at is not null then
              greatest(0, floor(extract(epoch from (now() - v_p.last_paused_at))))::int
            else 0
          end,
          last_paused_at = null,
          updated_at = now()
      where id = v_p.id;

      -- Update personal session
      update public.focus_sessions
      set status = 'ended',
          ended_at = now(),
          paused_seconds = paused_seconds + case
            when v_p.status = 'break' and v_p.last_paused_at is not null then
              greatest(0, floor(extract(epoch from (now() - v_p.last_paused_at))))::int
            else 0
          end,
          last_paused_at = null,
          updated_at = now()
      where user_id = v_p.user_id and room_session_id = p_session_id;

      perform public.recompute_daily_focus_minutes(v_p.user_id);
    end loop;

    -- Notify room members: session ended
    for v_member in (
      select rm.user_id as recipient_id
      from public.room_members rm
      where rm.room_id = v_session.room_id
        and rm.status = 'active'
        and not public.is_room_chat_muted(v_session.room_id, rm.user_id)
    ) loop
      perform public.queue_push_notification(
        p_user_id := v_member.recipient_id,
        p_type := 'focus_session',
        p_title := 'Focus Session Ended',
        p_body := 'The room focus session has wrapped up.',
        p_data := jsonb_build_object(
          'roomId', v_session.room_id,
          'sessionId', p_session_id,
          'event', 'session_ended'
        ),
        p_room_id := v_session.room_id
      );
    end loop;
  end if;
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

-- -----------------------------------------------------------------------------
-- 8. STATS FUNCTIONS (PERSONAL & ROOM WEEKLY STATS)
-- -----------------------------------------------------------------------------

create or replace function public.get_personal_focus_stats(
  p_user_id uuid default null,
  p_start_date text default null,
  p_end_date text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid;
  v_tz text := 'UTC';
  v_settings public.focus_settings;
  v_goal_mins int;
  v_streak_min int;
  v_total_mins int := 0;
  v_longest_mins int := 0;
  v_daily jsonb := '[]'::jsonb;
  v_labels jsonb := '[]'::jsonb;
begin
  v_uid := coalesce(p_user_id, auth.uid());
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;

  select coalesce(timezone, 'UTC') into v_tz from public.profiles where id = v_uid;

  -- Settings
  select * into v_settings from public.focus_settings where user_id = v_uid;
  v_goal_mins := coalesce(v_settings.weekly_goal_minutes, 300);
  v_streak_min := coalesce(v_settings.streak_minimum_minutes, 25);

  -- Daily breakdown
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'local_date', ldate,
      'focus_minutes', mins,
      'session_count', scount
    ) order by ldate
  ), '[]'::jsonb) into v_daily
  from (
    select
      to_char(started_at at time zone v_tz, 'YYYY-MM-DD') as ldate,
      coalesce(sum(
        greatest(0, round((extract(epoch from (ended_at - started_at)) - paused_seconds) / 60))
      ), 0)::int as mins,
      count(*)::int as scount
    from public.focus_sessions
    where user_id = v_uid
      and status in ('ended', 'auto_ended')
      and ended_at is not null
      and (p_start_date is null or to_char(started_at at time zone v_tz, 'YYYY-MM-DD') >= p_start_date)
      and (p_end_date is null or to_char(started_at at time zone v_tz, 'YYYY-MM-DD') <= p_end_date)
    group by to_char(started_at at time zone v_tz, 'YYYY-MM-DD')
  ) d;

  -- Total minutes
  select coalesce(sum(
    greatest(0, round((extract(epoch from (ended_at - started_at)) - paused_seconds) / 60))
  ), 0)::int into v_total_mins
  from public.focus_sessions
  where user_id = v_uid
    and status in ('ended', 'auto_ended')
    and ended_at is not null
    and (p_start_date is null or to_char(started_at at time zone v_tz, 'YYYY-MM-DD') >= p_start_date)
    and (p_end_date is null or to_char(started_at at time zone v_tz, 'YYYY-MM-DD') <= p_end_date);

  -- Longest session
  select coalesce(max(
    greatest(0, round((extract(epoch from (ended_at - started_at)) - paused_seconds) / 60))
  ), 0)::int into v_longest_mins
  from public.focus_sessions
  where user_id = v_uid
    and status in ('ended', 'auto_ended')
    and ended_at is not null
    and (p_start_date is null or to_char(started_at at time zone v_tz, 'YYYY-MM-DD') >= p_start_date)
    and (p_end_date is null or to_char(started_at at time zone v_tz, 'YYYY-MM-DD') <= p_end_date);

  -- Breakdown by label
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'label', coalesce(label, 'Unlabeled'),
      'minutes', mins
    ) order by mins desc
  ), '[]'::jsonb) into v_labels
  from (
    select
      label,
      coalesce(sum(
        greatest(0, round((extract(epoch from (ended_at - started_at)) - paused_seconds) / 60))
      ), 0)::int as mins
    from public.focus_sessions
    where user_id = v_uid
      and status in ('ended', 'auto_ended')
      and ended_at is not null
      and (p_start_date is null or to_char(started_at at time zone v_tz, 'YYYY-MM-DD') >= p_start_date)
      and (p_end_date is null or to_char(started_at at time zone v_tz, 'YYYY-MM-DD') <= p_end_date)
    group by label
  ) l;

  return jsonb_build_object(
    'total_focus_minutes', v_total_mins,
    'weekly_goal_minutes', v_goal_mins,
    'goal_completion_percent', case when v_goal_mins > 0 then least(100, round((v_total_mins::numeric / v_goal_mins::numeric) * 100))::int else 0 end,
    'daily_breakdown', v_daily,
    'label_breakdown', v_labels,
    'longest_session_minutes', v_longest_mins
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

-- -----------------------------------------------------------------------------
-- 9. SCHEDULED MAINTENANCE JOB (PRD FOC-8, 7.13)
-- Closes forgotten stopwatch sessions at 12 hours, ends finished timers, maintains daily_summaries
-- -----------------------------------------------------------------------------

create or replace function public.process_focus_maintenance()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_closed_stopwatch int := 0;
  v_ended_timers int := 0;
  v_session record;
  v_p record;
  v_5min_count int := 0;
begin
  -- 1. Auto-close room stopwatch sessions running > 12 hours (PRD FOC-8)
  for v_session in (
    select * from public.room_focus_sessions
    where mode = 'stopwatch'
      and status = 'active'
      and started_at < now() - interval '12 hours'
  ) loop
    update public.room_focus_sessions
    set status = 'auto_ended',
        ended_at = started_at + interval '12 hours',
        updated_at = now()
    where id = v_session.id;

    -- Close active participants
    for v_p in (
      select * from public.room_focus_participants
      where session_id = v_session.id and status in ('focusing', 'break')
    ) loop
      update public.room_focus_participants
      set status = 'left',
          left_at = v_session.started_at + interval '12 hours',
          updated_at = now()
      where id = v_p.id;

      update public.focus_sessions
      set status = 'auto_ended',
          ended_at = v_session.started_at + interval '12 hours',
          updated_at = now()
      where user_id = v_p.user_id and room_session_id = v_session.id;

      perform public.recompute_daily_focus_minutes(v_p.user_id);
    end loop;

    v_closed_stopwatch := v_closed_stopwatch + 1;
  end loop;

  -- 2. Auto-close personal stopwatch sessions running > 12 hours
  for v_session in (
    select * from public.focus_sessions
    where mode = 'stopwatch'
      and status in ('active', 'paused')
      and source = 'personal'
      and started_at < now() - interval '12 hours'
  ) loop
    update public.focus_sessions
    set status = 'auto_ended',
        ended_at = started_at + interval '12 hours',
        updated_at = now()
    where id = v_session.id;

    perform public.recompute_daily_focus_minutes(v_session.user_id);
    v_closed_stopwatch := v_closed_stopwatch + 1;
  end loop;

  -- 3. Auto-end room timer sessions where ends_at <= now()
  for v_session in (
    select * from public.room_focus_sessions
    where mode = 'timer'
      and status = 'active'
      and ends_at <= now()
  ) loop
    update public.room_focus_sessions
    set status = 'ended',
        ended_at = ends_at,
        updated_at = now()
    where id = v_session.id;

    for v_p in (
      select * from public.room_focus_participants
      where session_id = v_session.id and status in ('focusing', 'break')
    ) loop
      update public.room_focus_participants
      set status = 'left',
          left_at = v_session.ends_at,
          updated_at = now()
      where id = v_p.id;

      update public.focus_sessions
      set status = 'ended',
          ended_at = v_session.ends_at,
          updated_at = now()
      where user_id = v_p.user_id and room_session_id = v_session.id;

      perform public.recompute_daily_focus_minutes(v_p.user_id);
    end loop;

    v_ended_timers := v_ended_timers + 1;
  end loop;

  -- 4. Queue "5 minutes left" notifications for room timers (PRD FOC-9)
  for v_session in (
    select rfs.*, r.name as room_name
    from public.room_focus_sessions rfs
    join public.rooms r on r.id = rfs.room_id
    where rfs.mode = 'timer'
      and rfs.status = 'active'
      and rfs.ends_at between now() and now() + interval '5 minutes'
      and not exists (
        select 1 from public.push_notification_queue
        where data->>'sessionId' = rfs.id::text
          and data->>'event' = 'timer_5_min_left'
      )
  ) loop
    for v_p in (
      select rfp.user_id
      from public.room_focus_participants rfp
      where rfp.session_id = v_session.id
        and rfp.status = 'focusing'
        and not public.is_room_chat_muted(v_session.room_id, rfp.user_id)
    ) loop
      perform public.queue_push_notification(
        p_user_id := v_p.user_id,
        p_type := 'focus_session',
        p_title := coalesce(v_session.room_name, 'Focus Timer'),
        p_body := '5 minutes left in the focus session!',
        p_data := jsonb_build_object(
          'roomId', v_session.room_id,
          'sessionId', v_session.id,
          'event', 'timer_5_min_left'
        ),
        p_room_id := v_session.room_id
      );
      v_5min_count := v_5min_count + 1;
    end loop;
  end loop;

  return jsonb_build_object(
    'closed_stopwatches', v_closed_stopwatch,
    'ended_timers', v_ended_timers,
    'five_minute_warnings', v_5min_count
  );
end;
$$;
