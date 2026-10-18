-- Phase 13: Fasting Tracker (Tables, RLS, Functions, Privacy Enforcement, Progress)
-- Complies with PRD 6.20 (FST-1..FST-12), 7.9, 6.2 (ONB-11), 8.1 and AGENT_RULES.md

-- -----------------------------------------------------------------------------
-- 1. fasting_settings table (Owner-only RLS)
-- -----------------------------------------------------------------------------
create table if not exists public.fasting_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  protocol text not null default '16:8' check (protocol in ('12:12', '14:10', '16:8', '18:6', '20:4', 'custom')),
  eating_window_start text not null default '12:00',
  eating_window_end text not null default '20:00',
  custom_fasting_hours integer check (custom_fasting_hours is null or (custom_fasting_hours >= 1 and custom_fasting_hours <= 20)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.fasting_settings enable row level security;

create policy fasting_settings_select_owner on public.fasting_settings
  for select to authenticated
  using (auth.uid() = user_id);

create policy fasting_settings_insert_owner on public.fasting_settings
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy fasting_settings_update_owner on public.fasting_settings
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy fasting_settings_delete_owner on public.fasting_settings
  for delete to authenticated
  using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 2. fasting_sessions table (Owner-only RLS, Max Planned 20h = 1200m)
-- -----------------------------------------------------------------------------
create table if not exists public.fasting_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  start_at timestamptz not null,
  planned_minutes integer not null check (planned_minutes >= 60 and planned_minutes <= 1200),
  end_at timestamptz,
  status text not null default 'active' check (status in ('active', 'completed', 'ended_early')),
  local_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Unique index ensuring at most one active fast per user at any time
create unique index if not exists idx_fasting_sessions_active_user
  on public.fasting_sessions (user_id) where (status = 'active');

create index if not exists idx_fasting_sessions_user_start
  on public.fasting_sessions (user_id, start_at desc);

create index if not exists idx_fasting_sessions_user_date
  on public.fasting_sessions (user_id, local_date desc);

alter table public.fasting_sessions enable row level security;

create policy fasting_sessions_select_owner on public.fasting_sessions
  for select to authenticated
  using (auth.uid() = user_id);

create policy fasting_sessions_insert_owner on public.fasting_sessions
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy fasting_sessions_update_owner on public.fasting_sessions
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy fasting_sessions_delete_owner on public.fasting_sessions
  for delete to authenticated
  using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 3. Gated Fasting Functions (SECURITY DEFINER, Strict Privacy & Health Gating)
-- -----------------------------------------------------------------------------

/**
 * Starts a new fasting session with safety gating checks:
 * - 18+ required
 * - Health screening: pregnant/breastfeeding, diabetes/medication, ED history block fasting
 * - Low-intake flag: pauses fasting while active
 * - Max planned duration: 20 hours (1200 minutes)
 */
create or replace function public.start_fasting_session(
  p_planned_minutes integer,
  p_start_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_tz text := 'UTC';
  v_dob date;
  v_age integer;
  v_screening record;
  v_low_intake boolean := false;
  v_local_date date;
  v_new_id uuid;
  v_session record;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  if p_planned_minutes < 60 or p_planned_minutes > 1200 then
    raise exception 'INVALID_PLANNED_MINUTES: Duration must be between 60 and 1200 minutes (20 hours max)' using errcode = 'P0001';
  end if;

  -- 1. Check Age (18+)
  select timezone, date_of_birth into v_tz, v_dob
  from public.profiles where id = v_uid;

  if v_dob is not null then
    v_age := extract(year from age(v_dob));
    if v_age < 18 then
      raise exception 'UNDER_18_BLOCKED: Fasting is available to users 18 and older only' using errcode = 'P0001';
    end if;
  end if;

  -- 2. Check Health Screening (ONB-11, FST-11)
  select pregnant_or_breastfeeding, has_diabetes_or_medication, has_eating_disorder_history
  into v_screening
  from public.health_screening where user_id = v_uid;

  if found then
    if v_screening.pregnant_or_breastfeeding then
      raise exception 'SCREENING_INELIGIBLE: Fasting is unavailable during pregnancy or breastfeeding' using errcode = 'P0001';
    end if;
    if v_screening.has_diabetes_or_medication then
      raise exception 'SCREENING_INELIGIBLE: Fasting is unavailable with diabetes or medication affecting food' using errcode = 'P0001';
    end if;
    if v_screening.has_eating_disorder_history then
      raise exception 'SCREENING_INELIGIBLE: Fasting is unavailable with a history of an eating disorder' using errcode = 'P0001';
    end if;
  end if;

  -- 3. Check Low Intake Flag (FST-11: temporary pause)
  select low_intake_flag into v_low_intake
  from public.daily_summaries
  where user_id = v_uid
  order by local_date desc limit 1;

  if v_low_intake = true then
    raise exception 'LOW_INTAKE_PAUSED: Fasting is paused while low-intake check-in is active' using errcode = 'P0001';
  end if;

  v_local_date := (p_start_at at time zone coalesce(v_tz, 'UTC'))::date;
  v_new_id := gen_random_uuid();

  insert into public.fasting_sessions (
    id, user_id, start_at, planned_minutes, status, local_date, created_at, updated_at
  ) values (
    v_new_id, v_uid, p_start_at, p_planned_minutes, 'active', v_local_date, now(), now()
  )
  returning * into v_session;

  return to_jsonb(v_session);
end;
$$;

/**
 * Ends an active fasting session.
 * Status becomes 'completed' if actual duration >= planned duration, otherwise 'ended_early'.
 * Displayed neutrally with no penalties or red warnings.
 */
create or replace function public.end_fasting_session(
  p_session_id uuid,
  p_end_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_session record;
  v_elapsed_mins integer;
  v_status text;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  select * into v_session
  from public.fasting_sessions
  where id = p_session_id and user_id = v_uid;

  if not found then
    raise exception 'SESSION_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_session.status <> 'active' then
    return to_jsonb(v_session);
  end if;

  v_elapsed_mins := round(extract(epoch from (p_end_at - v_session.start_at)) / 60);
  if v_elapsed_mins >= v_session.planned_minutes then
    v_status := 'completed';
  else
    v_status := 'ended_early';
  end if;

  update public.fasting_sessions
  set end_at = p_end_at,
      status = v_status,
      updated_at = now()
  where id = p_session_id and user_id = v_uid
  returning * into v_session;

  return to_jsonb(v_session);
end;
$$;

/**
 * Edits an existing fasting session's start, end, or planned duration afterwards (PRD 6.20 FST-3).
 */
create or replace function public.edit_fasting_session(
  p_session_id uuid,
  p_start_at timestamptz default null,
  p_end_at timestamptz default null,
  p_planned_minutes integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_session record;
  v_start timestamptz;
  v_end timestamptz;
  v_planned integer;
  v_status text;
  v_elapsed_mins integer;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  select * into v_session
  from public.fasting_sessions
  where id = p_session_id and user_id = v_uid;

  if not found then
    raise exception 'SESSION_NOT_FOUND' using errcode = 'P0001';
  end if;

  v_start := coalesce(p_start_at, v_session.start_at);
  v_end := coalesce(p_end_at, v_session.end_at);
  v_planned := coalesce(p_planned_minutes, v_session.planned_minutes);

  if v_planned < 60 or v_planned > 1200 then
    raise exception 'INVALID_PLANNED_MINUTES: Duration must be between 60 and 1200 minutes (20 hours max)' using errcode = 'P0001';
  end if;

  if v_end is not null then
    v_elapsed_mins := round(extract(epoch from (v_end - v_start)) / 60);
    if v_elapsed_mins >= v_planned then
      v_status := 'completed';
    else
      v_status := 'ended_early';
    end if;
  else
    v_status := 'active';
  end if;

  update public.fasting_sessions
  set start_at = v_start,
      end_at = v_end,
      planned_minutes = v_planned,
      status = v_status,
      updated_at = now()
  where id = p_session_id and user_id = v_uid
  returning * into v_session;

  return to_jsonb(v_session);
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Update get_room_snapshot with Fasting Privacy (PRD 6.20 FST-9)
-- -----------------------------------------------------------------------------
create or replace function public.get_room_snapshot(
  p_room_id uuid,
  p_selected_user_id uuid default null,
  p_search text default null,
  p_page integer default 1,
  p_page_size integer default 20
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_id uuid := auth.uid();
  v_caller_member record;
  v_room record;
  v_m record;
  v_prof record;
  v_today text;
  v_sum record;
  v_has_breakfast boolean;
  v_has_lunch boolean;
  v_has_dinner boolean;
  v_has_snacks boolean;
  v_members_json jsonb := '[]'::jsonb;
  v_member_metrics jsonb;
  v_checklist jsonb;
  v_streak_val jsonb;
  v_goal_comp_val jsonb;
  v_steps_val jsonb;
  v_water_val jsonb;
  v_workout_val jsonb;
  v_cal_val jsonb;
  v_macros_val jsonb;
  v_weight_val jsonb;
  v_weight_prog_val jsonb;
  v_fasting_val jsonb;
  v_p jsonb;
  v_goal_prof record;
  v_target_kcal numeric := 2000;
  v_pct numeric := 0;
  v_total_members integer;
  v_active_count integer := 0;
  v_sum_pct numeric := 0;
  v_is_large_room boolean := false;
  v_offset integer;
  v_total_paged integer;
  v_fasting_status_text text;
begin
  if v_caller_id is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  select * into v_caller_member
  from public.room_members
  where room_id = p_room_id and user_id = v_caller_id;

  if not found or v_caller_member.status = 'left' then
    raise exception 'NOT_ROOM_MEMBER' using errcode = 'P0001';
  end if;

  -- Recompute room state
  perform public.recompute_room_state(p_room_id);

  select * into v_room
  from public.rooms
  where id = p_room_id;

  if v_room.state = 'archived' then
    raise exception 'ROOM_ARCHIVED' using errcode = 'P0001';
  end if;

  -- User's local date for today
  select coalesce((now() at time zone coalesce(p.timezone, 'UTC'))::date::text, current_date::text)
  into v_today
  from public.profiles p where p.id = v_caller_id;

  select count(*) into v_total_members
  from public.room_members
  where room_id = p_room_id and status in ('active', 'locked', 'paused');

  v_is_large_room := (v_total_members > 12);

  v_offset := (greatest(1, p_page) - 1) * p_page_size;

  -- Count total matching members for pagination
  select count(*) into v_total_paged
  from public.room_members rm
  join public.profiles p on p.id = rm.user_id
  where rm.room_id = p_room_id and rm.status in ('active', 'locked', 'paused')
    and (p_search is null or p.username ilike '%' || p_search || '%' or p.nickname ilike '%' || p_search || '%');

  for v_m in
    select
      rm.user_id,
      rm.role,
      rm.status,
      rm.privacy_settings,
      p.username,
      p.nickname,
      p.avatar_url,
      p.timezone
    from public.room_members rm
    join public.profiles p on p.id = rm.user_id
    where rm.room_id = p_room_id and rm.status in ('active', 'locked', 'paused')
      and (p_search is null or p.username ilike '%' || p_search || '%' or p.nickname ilike '%' || p_search || '%')
    order by
      case when rm.user_id = v_caller_id then 0 else 1 end,
      p.nickname asc
    limit p_page_size offset v_offset
  loop
    select * into v_sum
    from public.daily_summaries
    where user_id = v_m.user_id and local_date::text = v_today;

    select target_calories into v_target_kcal
    from public.goal_profiles
    where user_id = v_m.user_id and effective_from <= v_today::date
    order by effective_from desc limit 1;

    v_target_kcal := coalesce(v_target_kcal, 2000);

    if v_target_kcal > 0 and v_sum.calories is not null then
      v_pct := round((v_sum.calories / v_target_kcal) * 100);
    else
      v_pct := 0;
    end if;

    v_sum_pct := v_sum_pct + v_pct;
    v_active_count := v_active_count + 1;

    -- Determine detail vs overview level (PRD 6.9 RV-4, RV-10)
    if v_is_large_room and v_m.user_id <> v_caller_id and (p_selected_user_id is null or v_m.user_id <> p_selected_user_id) then
      v_p := v_m.privacy_settings;

      -- Check fasting status for overview
      if coalesce((v_p->>'share_fasting')::boolean, false) then
        if exists(select 1 from public.fasting_sessions where user_id = v_m.user_id and status = 'active') then
          v_fasting_val := '"fasting_now"'::jsonb;
        elsif exists(select 1 from public.fasting_sessions where user_id = v_m.user_id and local_date = v_today::date and status = 'completed') then
          v_fasting_val := '"completed_today"'::jsonb;
        else
          v_fasting_val := '"none"'::jsonb;
        end if;
      else
        v_fasting_val := '"locked"'::jsonb;
      end if;

      v_member_metrics := jsonb_build_object(
        'status', v_m.status,
        'overview', true,
        'logged_today', case when coalesce((v_p->>'share_streak')::boolean, true) then to_jsonb(coalesce(v_sum.logged_day, false)) else '"locked"'::jsonb end,
        'goal_completion', case when coalesce((v_p->>'share_goal_completion')::boolean, true) then to_jsonb(v_pct) else '"locked"'::jsonb end,
        'steps', case when coalesce((v_p->>'share_steps')::boolean, true) then to_jsonb(coalesce(v_sum.steps, 0)) else '"locked"'::jsonb end,
        'water_ml', '"locked"'::jsonb,
        'workout_status', case when coalesce((v_p->>'share_workouts')::boolean, true) then jsonb_build_object('worked_out', (coalesce(v_sum.workout_minutes, 0) > 0), 'duration_minutes', coalesce(v_sum.workout_minutes, 0)) else '"locked"'::jsonb end,
        'calories', '"locked"'::jsonb,
        'macros', '"locked"'::jsonb,
        'weight_kg', '"locked"'::jsonb,
        'weight_progress', '"locked"'::jsonb,
        'fasting_status', v_fasting_val,
        'meal_checklist', '"locked"'::jsonb
      );
    elsif v_m.user_id = v_caller_id then
      select
        exists(select 1 from public.food_entries where user_id = v_m.user_id and local_date::text = v_today and meal_section = 'breakfast' and deleted_at is null),
        exists(select 1 from public.food_entries where user_id = v_m.user_id and local_date::text = v_today and meal_section = 'lunch' and deleted_at is null),
        exists(select 1 from public.food_entries where user_id = v_m.user_id and local_date::text = v_today and meal_section = 'dinner' and deleted_at is null),
        exists(select 1 from public.food_entries where user_id = v_m.user_id and local_date::text = v_today and meal_section = 'snacks' and deleted_at is null)
      into v_has_breakfast, v_has_lunch, v_has_dinner, v_has_snacks;

      -- Caller always sees their own actual fasting status
      if exists(select 1 from public.fasting_sessions where user_id = v_m.user_id and status = 'active') then
        v_fasting_val := '"fasting_now"'::jsonb;
      elsif exists(select 1 from public.fasting_sessions where user_id = v_m.user_id and local_date = v_today::date and status = 'completed') then
        v_fasting_val := '"completed_today"'::jsonb;
      else
        v_fasting_val := '"none"'::jsonb;
      end if;

      v_member_metrics := jsonb_build_object(
        'status', v_m.status,
        'logged_today', coalesce(v_sum.logged_day, false),
        'goal_completion', v_pct,
        'steps', coalesce(v_sum.steps, 0),
        'water_ml', coalesce(v_sum.water_ml, 0),
        'workout_status', jsonb_build_object('worked_out', (coalesce(v_sum.workout_minutes, 0) > 0), 'duration_minutes', coalesce(v_sum.workout_minutes, 0)),
        'calories', coalesce(v_sum.calories, 0),
        'macros', jsonb_build_object('protein', coalesce(v_sum.protein, 0), 'carbs', coalesce(v_sum.carbs, 0), 'fat', coalesce(v_sum.fat, 0)),
        'weight_kg', v_sum.weight_kg,
        'weight_progress', 0,
        'fasting_status', v_fasting_val,
        'meal_checklist', jsonb_build_object('breakfast', v_has_breakfast, 'lunch', v_has_lunch, 'dinner', v_has_dinner, 'snacks', v_has_snacks)
      );
    else
      -- Other member (selected or standard <= 12 room)
      v_p := v_m.privacy_settings;

      select
        exists(select 1 from public.food_entries where user_id = v_m.user_id and local_date::text = v_today and meal_section = 'breakfast' and deleted_at is null),
        exists(select 1 from public.food_entries where user_id = v_m.user_id and local_date::text = v_today and meal_section = 'lunch' and deleted_at is null),
        exists(select 1 from public.food_entries where user_id = v_m.user_id and local_date::text = v_today and meal_section = 'dinner' and deleted_at is null),
        exists(select 1 from public.food_entries where user_id = v_m.user_id and local_date::text = v_today and meal_section = 'snacks' and deleted_at is null)
      into v_has_breakfast, v_has_lunch, v_has_dinner, v_has_snacks;

      if coalesce((v_p->>'share_streak')::boolean, true) then
        v_streak_val := to_jsonb(coalesce(v_sum.logged_day, false));
      else
        v_streak_val := '"locked"'::jsonb;
      end if;

      if coalesce((v_p->>'share_goal_completion')::boolean, true) then
        v_goal_comp_val := to_jsonb(v_pct);
      else
        v_goal_comp_val := '"locked"'::jsonb;
      end if;

      if coalesce((v_p->>'share_steps')::boolean, true) then
        v_steps_val := to_jsonb(coalesce(v_sum.steps, 0));
      else
        v_steps_val := '"locked"'::jsonb;
      end if;

      if coalesce((v_p->>'share_water')::boolean, true) then
        v_water_val := to_jsonb(coalesce(v_sum.water_ml, 0));
      else
        v_water_val := '"locked"'::jsonb;
      end if;

      if coalesce((v_p->>'share_workouts')::boolean, true) then
        v_workout_val := jsonb_build_object('worked_out', (coalesce(v_sum.workout_minutes, 0) > 0), 'duration_minutes', coalesce(v_sum.workout_minutes, 0));
      else
        v_workout_val := '"locked"'::jsonb;
      end if;

      if coalesce((v_p->>'share_calories_macros')::boolean, false) then
        v_cal_val := to_jsonb(coalesce(v_sum.calories, 0));
        v_macros_val := jsonb_build_object('protein', coalesce(v_sum.protein, 0), 'carbs', coalesce(v_sum.carbs, 0), 'fat', coalesce(v_sum.fat, 0));
      else
        v_cal_val := '"locked"'::jsonb;
        v_macros_val := '"locked"'::jsonb;
      end if;

      if coalesce((v_p->>'share_weight_number')::boolean, false) then
        v_weight_val := to_jsonb(v_sum.weight_kg);
      else
        v_weight_val := '"locked"'::jsonb;
      end if;

      if coalesce((v_p->>'share_weight_progress')::boolean, false) then
        v_weight_prog_val := to_jsonb(0);
      else
        v_weight_prog_val := '"locked"'::jsonb;
      end if;

      -- PRD 6.20 FST-9: Fasting is hidden by default; user may opt in to share "fasting now / completed today"
      if coalesce((v_p->>'share_fasting')::boolean, false) then
        if exists(select 1 from public.fasting_sessions where user_id = v_m.user_id and status = 'active') then
          v_fasting_val := '"fasting_now"'::jsonb;
        elsif exists(select 1 from public.fasting_sessions where user_id = v_m.user_id and local_date = v_today::date and status = 'completed') then
          v_fasting_val := '"completed_today"'::jsonb;
        else
          v_fasting_val := '"none"'::jsonb;
        end if;
      else
        v_fasting_val := '"locked"'::jsonb;
      end if;

      if coalesce(v_p->>'share_meals', 'never') <> 'never' then
        v_checklist := jsonb_build_object('breakfast', v_has_breakfast, 'lunch', v_has_lunch, 'dinner', v_has_dinner, 'snacks', v_has_snacks);
      else
        v_checklist := '"locked"'::jsonb;
      end if;

      v_member_metrics := jsonb_build_object(
        'status', v_m.status,
        'logged_today', v_streak_val,
        'goal_completion', v_goal_comp_val,
        'steps', v_steps_val,
        'water_ml', v_water_val,
        'workout_status', v_workout_val,
        'calories', v_cal_val,
        'macros', v_macros_val,
        'weight_kg', v_weight_val,
        'weight_progress', v_weight_prog_val,
        'fasting_status', v_fasting_val,
        'meal_checklist', v_checklist
      );
    end if;

    v_members_json := v_members_json || jsonb_build_object(
      'user_id', v_m.user_id,
      'username', v_m.username,
      'nickname', v_m.nickname,
      'avatar_url', v_m.avatar_url,
      'role', v_m.role,
      'status', v_m.status,
      'metrics', v_member_metrics
    );
  end loop;

  return jsonb_build_object(
    'room', jsonb_build_object(
      'id', v_room.id,
      'name', v_room.name,
      'state', v_room.state,
      'code', v_room.code,
      'host_id', v_room.host_id,
      'total_members', v_total_members,
      'is_large_room', v_is_large_room,
      'average_goal_completion', case when v_active_count > 0 then round(v_sum_pct / v_active_count) else 0 end
    ),
    'members', v_members_json,
    'pagination', jsonb_build_object(
      'page', p_page,
      'page_size', p_page_size,
      'total_count', v_total_paged
    )
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Update get_individual_progress with Fasting Metrics (PRD 6.20 FST-7)
-- -----------------------------------------------------------------------------
create or replace function public.get_individual_progress(
  p_range text default '30d'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_tz text := 'UTC';
  v_today date;
  v_start_date date;
  v_goal_prof record;
  v_user_streak record;
  v_weight_logs jsonb := '[]'::jsonb;
  v_calories_daily jsonb := '[]'::jsonb;
  v_steps_daily jsonb := '[]'::jsonb;
  v_water_daily jsonb := '[]'::jsonb;
  v_scores_hist jsonb := '[]'::jsonb;
  v_exercise_prog jsonb := '[]'::jsonb;

  v_start_weight numeric(5,2) := null;
  v_current_weight numeric(5,2) := null;
  v_current_trend numeric(5,2) := null;
  v_target_weight numeric(5,2) := null;
  v_weight_change numeric(5,2) := null;
  v_weight_change_pct numeric(5,2) := null;
  v_weekly_pace numeric(5,3) := null;
  v_projected_date text := null;
  v_goal_progress_pct numeric(5,1) := null;

  v_logged_days_cnt integer := 0;
  v_goal_days_cnt integer := 0;
  v_total_days integer := 0;
  v_avg_calories numeric(7,2) := 0;
  v_avg_target numeric(7,2) := 2000;
  v_adherence_pct numeric(5,1) := 0;

  v_protein_avg numeric(7,2) := 0;
  v_carbs_avg numeric(7,2) := 0;
  v_fat_avg numeric(7,2) := 0;

  v_total_steps integer := 0;
  v_avg_steps integer := 0;

  v_total_water integer := 0;
  v_avg_water integer := 0;

  v_total_workouts integer := 0;
  v_total_workout_mins integer := 0;
  v_total_volume_kg numeric(9,2) := 0;
  v_sessions_per_week numeric(4,1) := 0;

  -- Fasting metrics
  v_total_fasts integer := 0;
  v_completed_fasts integer := 0;
  v_ended_early_fasts integer := 0;
  v_completion_rate_pct numeric(5,1) := 0;
  v_avg_fast_mins integer := 0;
  v_avg_fast_hours numeric(5,1) := 0;
  v_total_fast_hours numeric(7,1) := 0;
  v_fasting_hours_per_week numeric(5,1) := 0;
  v_fasting_daily jsonb := '[]'::jsonb;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  select coalesce(timezone, 'UTC') into v_tz
  from public.profiles where id = v_uid;

  v_today := (now() at time zone v_tz)::date;

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
  else -- 'all'
    select coalesce(min(local_date::date), v_today - interval '29 days')
    into v_start_date
    from public.daily_summaries
    where user_id = v_uid;
  end if;

  v_total_days := (v_today - v_start_date + 1);

  -- Goal profile
  select target_calories, target_weight_kg, protein_grams, carb_grams, fat_grams, goal
  into v_goal_prof
  from public.goal_profiles
  where user_id = v_uid and effective_from <= v_today
  order by effective_from desc limit 1;

  v_target_weight := v_goal_prof.target_weight_kg;
  v_avg_target := coalesce(v_goal_prof.target_calories, 2000);

  -- Weight: raw entries and start/current weight
  select weight_kg into v_start_weight
  from public.weight_logs
  where user_id = v_uid and deleted_at is null
  order by local_date asc, logged_at asc limit 1;

  select weight_kg into v_current_weight
  from public.weight_logs
  where user_id = v_uid and deleted_at is null
  order by local_date desc, logged_at desc limit 1;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'date', local_date,
        'raw_weight_kg', weight_kg,
        'trend_weight_kg', weight_kg
      ) order by local_date asc
    ), '[]'::jsonb
  ) into v_weight_logs
  from (
    select distinct on (local_date) local_date, weight_kg
    from public.weight_logs
    where user_id = v_uid and deleted_at is null
      and local_date::date between v_start_date and v_today
    order by local_date asc, logged_at desc
  ) wl;

  v_current_trend := v_current_weight;
  if v_start_weight is not null and v_current_trend is not null then
    v_weight_change := v_current_trend - v_start_weight;
    if v_start_weight > 0 then
      v_weight_change_pct := round((v_weight_change / v_start_weight) * 100, 1);
    end if;
  end if;

  if v_start_weight is not null and v_current_trend is not null and v_target_weight is not null then
    if abs(v_start_weight - v_target_weight) > 0.001 then
      v_goal_progress_pct := round(((v_start_weight - v_current_trend) / (v_start_weight - v_target_weight)) * 100, 1);
      v_goal_progress_pct := greatest(0.0, least(100.0, v_goal_progress_pct));
    else
      v_goal_progress_pct := 100.0;
    end if;
  end if;

  -- Daily calories, macros, steps, water
  select
    coalesce(count(*) filter (where logged_day = true), 0),
    coalesce(count(*) filter (where goal_day = true), 0),
    coalesce(round(avg(calories) filter (where logged_day = true), 1), 0),
    coalesce(round(avg(protein), 1), 0),
    coalesce(round(avg(carbs), 1), 0),
    coalesce(round(avg(fat), 1), 0),
    coalesce(sum(steps), 0),
    coalesce(round(avg(steps), 0), 0),
    coalesce(sum(water_ml), 0),
    coalesce(round(avg(water_ml), 0), 0)
  into
    v_logged_days_cnt, v_goal_days_cnt, v_avg_calories,
    v_protein_avg, v_carbs_avg, v_fat_avg,
    v_total_steps, v_avg_steps,
    v_total_water, v_avg_water
  from public.daily_summaries
  where user_id = v_uid and local_date::date between v_start_date and v_today;

  if v_logged_days_cnt > 0 then
    v_adherence_pct := round((v_goal_days_cnt::numeric / v_logged_days_cnt::numeric) * 100, 1);
  end if;

  -- Daily series
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'date', local_date,
        'calories', calories,
        'target_calories', target_calories,
        'is_logged_day', logged_day,
        'is_goal_day', goal_day
      ) order by local_date asc
    ), '[]'::jsonb
  ) into v_calories_daily
  from public.daily_summaries
  where user_id = v_uid and local_date::date between v_start_date and v_today;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'date', local_date,
        'steps', steps,
        'distance_km', round((steps * 0.75) / 1000, 2)
      ) order by local_date asc
    ), '[]'::jsonb
  ) into v_steps_daily
  from public.daily_summaries
  where user_id = v_uid and local_date::date between v_start_date and v_today;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'date', local_date,
        'water_ml', water_ml
      ) order by local_date asc
    ), '[]'::jsonb
  ) into v_water_daily
  from public.daily_summaries
  where user_id = v_uid and local_date::date between v_start_date and v_today;

  -- Workouts stats & volume
  select
    count(*),
    coalesce(sum(w.duration_minutes), 0),
    coalesce(sum(ws.reps * ws.weight_kg), 0)
  into v_total_workouts, v_total_workout_mins, v_total_volume_kg
  from public.workouts w
  left join public.workout_sets ws on ws.workout_id = w.id and ws.deleted_at is null
  where w.user_id = v_uid and w.deleted_at is null
    and w.local_date::date between v_start_date and v_today;

  if v_total_days > 0 then
    v_sessions_per_week := round((v_total_workouts::numeric / (v_total_days::numeric / 7.0)), 1);
  end if;

  -- Streaks
  select current_streak, longest_streak
  into v_user_streak
  from public.user_streaks where user_id = v_uid;

  -- Weekly score history
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'week_start_date', week_start_date,
        'logged_days', logged_days,
        'goal_days', goal_days,
        'consistency_score', consistency_score
      ) order by week_start_date asc
    ), '[]'::jsonb
  ) into v_scores_hist
  from public.weekly_scores
  where user_id = v_uid and week_start_date::date >= v_start_date;

  -- Fasting stats in range (PRD 6.20 FST-7)
  select
    count(*),
    count(*) filter (where status = 'completed'),
    count(*) filter (where status = 'ended_early'),
    coalesce(sum(extract(epoch from (coalesce(end_at, now()) - start_at)) / 60), 0)
  into v_total_fasts, v_completed_fasts, v_ended_early_fasts, v_avg_fast_mins
  from public.fasting_sessions
  where user_id = v_uid
    and local_date between v_start_date and v_today;

  if v_total_fasts > 0 then
    v_completion_rate_pct := round((v_completed_fasts::numeric / v_total_fasts::numeric) * 100, 1);
    v_avg_fast_mins := round(v_avg_fast_mins / v_total_fasts);
    v_avg_fast_hours := round((v_avg_fast_mins::numeric / 60.0), 1);
  end if;

  select coalesce(round(sum(extract(epoch from (coalesce(end_at, now()) - start_at)) / 3600), 1), 0)
  into v_total_fast_hours
  from public.fasting_sessions
  where user_id = v_uid and local_date between v_start_date and v_today;

  if v_total_days > 0 then
    v_fasting_hours_per_week := round((v_total_fast_hours / (v_total_days::numeric / 7.0)), 1);
  end if;

  -- Fasting daily breakdown
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'date', fs.local_date::text,
        'fasting_hours', round(extract(epoch from (coalesce(fs.end_at, now()) - fs.start_at)) / 3600, 1),
        'completed', (fs.status = 'completed')
      ) order by fs.local_date asc
    ), '[]'::jsonb
  ) into v_fasting_daily
  from public.fasting_sessions fs
  where fs.user_id = v_uid and fs.local_date between v_start_date and v_today;

  return jsonb_build_object(
    'range', p_range,
    'start_date', v_start_date::text,
    'end_date', v_today::text,
    'weight', jsonb_build_object(
      'history', v_weight_logs,
      'start_weight_kg', v_start_weight,
      'current_weight_kg', v_current_weight,
      'current_trend_kg', v_current_trend,
      'total_change_kg', v_weight_change,
      'total_change_pct', v_weight_change_pct,
      'target_weight_kg', v_target_weight,
      'weekly_pace_kg', v_weekly_pace,
      'projected_date', v_projected_date,
      'goal_progress_pct', v_goal_progress_pct
    ),
    'calories', jsonb_build_object(
      'daily', v_calories_daily,
      'average_calories', v_avg_calories,
      'average_target', v_avg_target,
      'logged_days_count', v_logged_days_cnt,
      'goal_days_count', v_goal_days_cnt,
      'total_days_in_range', v_total_days,
      'adherence_pct', v_adherence_pct
    ),
    'macros', jsonb_build_object(
      'protein_avg_g', v_protein_avg,
      'carbs_avg_g', v_carbs_avg,
      'fat_avg_g', v_fat_avg,
      'protein_target_g', coalesce(v_goal_prof.protein_grams, 140),
      'carbs_target_g', coalesce(v_goal_prof.carb_grams, 200),
      'fat_target_g', coalesce(v_goal_prof.fat_grams, 60)
    ),
    'steps', jsonb_build_object(
      'daily', v_steps_daily,
      'average_steps', v_avg_steps,
      'total_steps', v_total_steps,
      'total_distance_km', round((v_total_steps * 0.75) / 1000, 2),
      'goal_steps', 10000
    ),
    'water', jsonb_build_object(
      'daily', v_water_daily,
      'average_water_ml', v_avg_water,
      'total_water_ml', v_total_water,
      'goal_water_ml', 2500
    ),
    'workouts', jsonb_build_object(
      'total_workouts', v_total_workouts,
      'sessions_per_week', v_sessions_per_week,
      'total_duration_minutes', v_total_workout_mins,
      'total_volume_kg', v_total_volume_kg,
      'exercise_progression', v_exercise_prog
    ),
    'consistency', jsonb_build_object(
      'current_streak', coalesce(v_user_streak.current_streak, 0),
      'longest_streak', coalesce(v_user_streak.longest_streak, 0),
      'weekly_scores', v_scores_hist
    ),
    'fasting', jsonb_build_object(
      'total_fasts', v_total_fasts,
      'completed_fasts', v_completed_fasts,
      'ended_early_fasts', v_ended_early_fasts,
      'completion_rate_pct', v_completion_rate_pct,
      'average_duration_minutes', v_avg_fast_mins,
      'average_duration_hours', v_avg_fast_hours,
      'total_fasting_hours', v_total_fast_hours,
      'fasting_hours_per_week', v_fasting_hours_per_week,
      'daily_hours', v_fasting_daily
    ),
    'goal_progress_pct', v_goal_progress_pct
  );
end;
$$;
