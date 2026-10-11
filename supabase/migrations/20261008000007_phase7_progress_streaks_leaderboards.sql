-- =============================================================================
-- Migration: 20261008000007_phase7_progress_streaks_leaderboards.sql
-- Description: Phase 7 — Progress graphs, streaks, consistency score, leaderboards
-- PRD: 6.14, 6.15 (PRG-1..PRG-10, RPG-1..RPG-7), 6.16 (RNK-1..RNK-7), 7.3, 7.4, 7.5, 7.8
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. DAILY SUMMARIES SCHEMA ENHANCEMENT
-- -----------------------------------------------------------------------------
alter table public.daily_summaries
  add column if not exists target_calories numeric(7,2) not null default 2000,
  add column if not exists entries_count integer not null default 0,
  add column if not exists calorie_floor numeric(7,2) not null default 1200,
  add column if not exists low_intake_flag boolean not null default false;

-- -----------------------------------------------------------------------------
-- 2. USER STREAKS & ROOM STREAKS TABLES
-- -----------------------------------------------------------------------------
create table if not exists public.user_streaks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_logged_date text check (length(last_logged_date) = 10),
  updated_at timestamptz not null default now()
);

alter table public.user_streaks enable row level security;

create policy user_streaks_select_own on public.user_streaks
  for select to authenticated
  using (auth.uid() = user_id);

create policy user_streaks_no_client_write on public.user_streaks
  for all to anon, authenticated
  using (false)
  with check (false);

create table if not exists public.room_streaks (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_achieved_date text check (length(last_achieved_date) = 10),
  updated_at timestamptz not null default now()
);

alter table public.room_streaks enable row level security;

create policy room_streaks_select on public.room_streaks
  for select to authenticated
  using (
    exists (
      select 1 from public.room_members
      where room_id = public.room_streaks.room_id
        and user_id = auth.uid()
        and status in ('active', 'paused')
    )
  );

create policy room_streaks_no_client_write on public.room_streaks
  for all to anon, authenticated
  using (false)
  with check (false);

-- -----------------------------------------------------------------------------
-- 3. LEADERBOARD SETTINGS TABLE (RNK-6: Opt-out)
-- -----------------------------------------------------------------------------
create table if not exists public.leaderboard_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  opted_out boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.leaderboard_settings enable row level security;

create policy leaderboard_settings_select_own on public.leaderboard_settings
  for select to authenticated
  using (auth.uid() = user_id);

create policy leaderboard_settings_update_own on public.leaderboard_settings
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy leaderboard_settings_insert_own on public.leaderboard_settings
  for insert to authenticated
  with check (auth.uid() = user_id);

create or replace function public.set_leaderboard_opt_out(p_opted_out boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  insert into public.leaderboard_settings (user_id, opted_out, updated_at)
  values (auth.uid(), coalesce(p_opted_out, false), now())
  on conflict (user_id) do update set
    opted_out = excluded.opted_out,
    updated_at = now();
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. WEEKLY SCORES TABLE (PRD 7.3, 7.5, RNK-1..RNK-7)
-- -----------------------------------------------------------------------------
create table if not exists public.weekly_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start_date text not null check (length(week_start_date) = 10), -- Monday YYYY-MM-DD
  division text not null check (division in ('beginner', 'cutting', 'bulking', 'maintain')),
  cohort_id text not null,
  logged_days integer not null default 0,
  goal_days integer not null default 0,
  consistency_score numeric(5,2) not null default 0,
  low_intake_flag boolean not null default false,
  is_eligible boolean not null default false,
  earliest_completion_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start_date)
);

create index if not exists idx_weekly_scores_lookup
  on public.weekly_scores (week_start_date, division, cohort_id, is_eligible, consistency_score desc);

alter table public.weekly_scores enable row level security;

create policy weekly_scores_select_own on public.weekly_scores
  for select to authenticated
  using (auth.uid() = user_id);

create policy weekly_scores_no_client_write on public.weekly_scores
  for all to anon, authenticated
  using (false)
  with check (false);

-- -----------------------------------------------------------------------------
-- 5. COMPLETE RECOMPUTE DAILY SUMMARY WITH LOW-INTAKE RULE & STREAKS
-- -----------------------------------------------------------------------------
create or replace function public.recompute_daily_summary(
  p_user_id uuid,
  p_local_date text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_calories numeric(7,2) := 0;
  v_protein numeric(7,2) := 0;
  v_carbs numeric(7,2) := 0;
  v_fat numeric(7,2) := 0;
  v_entry_count integer := 0;
  v_water_ml integer := 0;
  v_steps integer := 0;
  v_workout_minutes integer := 0;
  v_weight_kg numeric(5,2) := null;
  v_target_kcal numeric(7,2) := 2000;
  v_goal text := 'maintain';
  v_sex text := 'other';
  v_calorie_floor numeric(7,2) := 1350;
  v_logged_day boolean := false;
  v_goal_day boolean := false;
  v_low_intake_flag boolean := false;
  v_days_below_floor integer := 0;
  v_goal_prof record;
  v_room_rec record;
begin
  if p_user_id is null or p_local_date is null then
    return;
  end if;

  -- 1. Food entries
  select
    coalesce(sum(calories), 0),
    coalesce(sum(protein), 0),
    coalesce(sum(carbs), 0),
    coalesce(sum(fat), 0),
    count(*)
  into v_calories, v_protein, v_carbs, v_fat, v_entry_count
  from public.food_entries
  where user_id = p_user_id
    and local_date::text = p_local_date
    and deleted_at is null;

  -- 2. Water logs
  select coalesce(sum(amount_ml), 0)
  into v_water_ml
  from public.water_logs
  where user_id = p_user_id
    and local_date = p_local_date
    and deleted_at is null;

  -- 3. Steps & distance
  select coalesce(sum(steps), 0)
  into v_steps
  from public.activity_days
  where user_id = p_user_id
    and local_date = p_local_date
    and deleted_at is null;

  -- 4. Workouts
  select coalesce(sum(duration_minutes), 0)
  into v_workout_minutes
  from public.workouts
  where user_id = p_user_id
    and local_date = p_local_date
    and deleted_at is null;

  -- 5. Weight
  select weight_kg
  into v_weight_kg
  from public.weight_logs
  where user_id = p_user_id
    and local_date = p_local_date
    and deleted_at is null
  order by logged_at desc
  limit 1;

  -- 6. Targets from goal_profiles
  select target_calories, goal
  into v_goal_prof
  from public.goal_profiles
  where user_id = p_user_id
    and effective_from <= p_local_date::date
  order by effective_from desc
  limit 1;

  if found and v_goal_prof.target_calories is not null and v_goal_prof.target_calories > 0 then
    v_target_kcal := v_goal_prof.target_calories;
    v_goal := coalesce(v_goal_prof.goal, 'maintain');
  end if;

  -- 7. Calorie floor per sex (PRD 7.2)
  select sex into v_sex
  from public.profiles
  where id = p_user_id;

  if v_sex = 'female' then
    v_calorie_floor := 1200;
  elsif v_sex = 'male' then
    v_calorie_floor := 1500;
  else
    v_calorie_floor := 1350;
  end if;

  -- 8. PRD 7.3: logged_day requires >= 2 food entries and calories >= 50% of target
  if v_entry_count >= 2 and v_calories >= (0.50 * v_target_kcal) then
    v_logged_day := true;
  else
    v_logged_day := false;
  end if;

  -- 9. PRD 7.3: goal_day evaluation by range
  if v_logged_day then
    if v_goal = 'cut' and v_calories >= (0.85 * v_target_kcal) and v_calories <= (1.05 * v_target_kcal) then
      v_goal_day := true;
    elsif v_goal = 'bulk' and v_calories >= (0.95 * v_target_kcal) and v_calories <= (1.15 * v_target_kcal) then
      v_goal_day := true;
    elsif v_goal = 'maintain' and v_calories >= (0.90 * v_target_kcal) and v_calories <= (1.10 * v_target_kcal) then
      v_goal_day := true;
    else
      v_goal_day := false;
    end if;
  else
    v_goal_day := false;
  end if;

  -- 10. Low-Intake Rule (PRD 7.2, 7.3):
  -- Check 7-day window ending on p_local_date: if below floor on >= 5 of 7 days:
  -- Those days below floor cannot be goal days, and low_intake_flag is raised
  select count(*)
  into v_days_below_floor
  from public.daily_summaries
  where user_id = p_user_id
    and local_date::date between (p_local_date::date - interval '6 days')::date and (p_local_date::date - interval '1 day')::date
    and calories < v_calorie_floor;

  if v_calories < v_calorie_floor then
    v_days_below_floor := v_days_below_floor + 1;
  end if;

  if v_days_below_floor >= 5 then
    v_low_intake_flag := true;
    if v_calories < v_calorie_floor then
      v_goal_day := false;
    end if;
  end if;

  -- 11. Upsert summary
  insert into public.daily_summaries (
    user_id, local_date, calories, protein, carbs, fat, steps, water_ml,
    workout_minutes, weight_kg, logged_day, goal_day, target_calories,
    entries_count, calorie_floor, low_intake_flag, updated_at
  ) values (
    p_user_id, p_local_date, v_calories, v_protein, v_carbs, v_fat, v_steps, v_water_ml,
    v_workout_minutes, v_weight_kg, v_logged_day, v_goal_day, v_target_kcal,
    v_entry_count, v_calorie_floor, v_low_intake_flag, now()
  )
  on conflict (user_id, local_date) do update set
    calories = excluded.calories,
    protein = excluded.protein,
    carbs = excluded.carbs,
    fat = excluded.fat,
    steps = excluded.steps,
    water_ml = excluded.water_ml,
    workout_minutes = excluded.workout_minutes,
    weight_kg = excluded.weight_kg,
    logged_day = excluded.logged_day,
    goal_day = excluded.goal_day,
    target_calories = excluded.target_calories,
    entries_count = excluded.entries_count,
    calorie_floor = excluded.calorie_floor,
    low_intake_flag = excluded.low_intake_flag,
    updated_at = now();

  -- 12. Recompute personal streak
  perform public.recompute_user_streak(p_user_id);

  -- 13. Recompute room streak for all rooms the user belongs to
  for v_room_rec in
    select room_id from public.room_members
    where user_id = p_user_id and status in ('active', 'paused')
  loop
    perform public.recompute_room_streak(v_room_rec.room_id);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. RECOMPUTE USER STREAK & ROOM STREAK FUNCTIONS
-- -----------------------------------------------------------------------------
create or replace function public.recompute_user_streak(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tz text := 'UTC';
  v_today date;
  v_yesterday date;
  v_cur_streak integer := 0;
  v_longest_streak integer := 0;
  v_run integer := 0;
  v_prev_date date := null;
  v_rec record;
  v_check_date date;
  v_today_logged boolean := false;
  v_yesterday_logged boolean := false;
begin
  if p_user_id is null then return; end if;

  select coalesce(timezone, 'UTC') into v_tz
  from public.profiles where id = p_user_id;

  v_today := (now() at time zone v_tz)::date;
  v_yesterday := v_today - interval '1 day';

  -- Check today and yesterday
  select exists(select 1 from public.daily_summaries where user_id = p_user_id and local_date = v_today::text and logged_day = true)
  into v_today_logged;

  select exists(select 1 from public.daily_summaries where user_id = p_user_id and local_date = v_yesterday::text and logged_day = true)
  into v_yesterday_logged;

  if v_today_logged then
    v_cur_streak := 1;
    v_check_date := v_today - interval '1 day';
    while exists(select 1 from public.daily_summaries where user_id = p_user_id and local_date = v_check_date::text and logged_day = true) loop
      v_cur_streak := v_cur_streak + 1;
      v_check_date := v_check_date - interval '1 day';
    end loop;
  elsif v_yesterday_logged then
    v_cur_streak := 1;
    v_check_date := v_yesterday - interval '1 day';
    while exists(select 1 from public.daily_summaries where user_id = p_user_id and local_date = v_check_date::text and logged_day = true) loop
      v_cur_streak := v_cur_streak + 1;
      v_check_date := v_check_date - interval '1 day';
    end loop;
  else
    v_cur_streak := 0;
  end if;

  -- Longest streak calculation
  for v_rec in
    select local_date::date as ldate
    from public.daily_summaries
    where user_id = p_user_id and logged_day = true
    order by local_date asc
  loop
    if v_prev_date is not null and v_rec.ldate = (v_prev_date + interval '1 day')::date then
      v_run := v_run + 1;
    else
      v_run := 1;
    end if;
    v_prev_date := v_rec.ldate;
    if v_run > v_longest_streak then
      v_longest_streak := v_run;
    end if;
  end loop;

  if v_cur_streak > v_longest_streak then
    v_longest_streak := v_cur_streak;
  end if;

  insert into public.user_streaks (
    user_id, current_streak, longest_streak, last_logged_date, updated_at
  ) values (
    p_user_id, v_cur_streak, v_longest_streak,
    (case when v_today_logged then v_today::text when v_yesterday_logged then v_yesterday::text else null end),
    now()
  )
  on conflict (user_id) do update set
    current_streak = excluded.current_streak,
    longest_streak = excluded.longest_streak,
    last_logged_date = coalesce(excluded.last_logged_date, public.user_streaks.last_logged_date),
    updated_at = now();
end;
$$;

create or replace function public.recompute_room_streak(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_active_count integer := 0;
  v_threshold integer := 0;
  v_today date;
  v_yesterday date;
  v_cur_streak integer := 0;
  v_longest_streak integer := 0;
  v_run integer := 0;
  v_prev_date date := null;
  v_check_date date;
  v_logged_members integer := 0;
  v_today_achieved boolean := false;
  v_yesterday_achieved boolean := false;
  v_rec record;
begin
  if p_room_id is null then return; end if;

  -- Count active, non-paused members
  select count(*) into v_active_count
  from public.room_members
  where room_id = p_room_id and status = 'active';

  if v_active_count = 0 then
    insert into public.room_streaks (room_id, current_streak, longest_streak, updated_at)
    values (p_room_id, 0, 0, now())
    on conflict (room_id) do update set current_streak = 0, updated_at = now();
    return;
  end if;

  -- Room threshold (PRD 6.14 STR-2):
  -- <= 5 people: every active member (100%)
  -- > 5 people: at least 60% rounded up
  if v_active_count <= 5 then
    v_threshold := v_active_count;
  else
    v_threshold := ceil(0.60 * v_active_count);
  end if;

  v_today := current_date;
  v_yesterday := v_today - interval '1 day';

  -- Check today achieved
  select count(distinct rm.user_id) into v_logged_members
  from public.room_members rm
  join public.daily_summaries ds on ds.user_id = rm.user_id and ds.local_date = v_today::text
  where rm.room_id = p_room_id and rm.status = 'active' and ds.logged_day = true;

  v_today_achieved := (v_logged_members >= v_threshold);

  -- Check yesterday achieved
  select count(distinct rm.user_id) into v_logged_members
  from public.room_members rm
  join public.daily_summaries ds on ds.user_id = rm.user_id and ds.local_date = v_yesterday::text
  where rm.room_id = p_room_id and rm.status = 'active' and ds.logged_day = true;

  v_yesterday_achieved := (v_logged_members >= v_threshold);

  if v_today_achieved then
    v_cur_streak := 1;
    v_check_date := v_today - interval '1 day';
    loop
      select count(distinct rm.user_id) into v_logged_members
      from public.room_members rm
      join public.daily_summaries ds on ds.user_id = rm.user_id and ds.local_date = v_check_date::text
      where rm.room_id = p_room_id and rm.status = 'active' and ds.logged_day = true;

      if v_logged_members >= v_threshold then
        v_cur_streak := v_cur_streak + 1;
        v_check_date := v_check_date - interval '1 day';
      else
        exit;
      end if;
    end loop;
  elsif v_yesterday_achieved then
    v_cur_streak := 1;
    v_check_date := v_yesterday - interval '1 day';
    loop
      select count(distinct rm.user_id) into v_logged_members
      from public.room_members rm
      join public.daily_summaries ds on ds.user_id = rm.user_id and ds.local_date = v_check_date::text
      where rm.room_id = p_room_id and rm.status = 'active' and ds.logged_day = true;

      if v_logged_members >= v_threshold then
        v_cur_streak := v_cur_streak + 1;
        v_check_date := v_check_date - interval '1 day';
      else
        exit;
      end if;
    end loop;
  else
    v_cur_streak := 0;
  end if;

  -- Longest streak from daily aggregates
  for v_rec in
    select ds.local_date::date as ldate, count(distinct rm.user_id) as lcount
    from public.room_members rm
    join public.daily_summaries ds on ds.user_id = rm.user_id
    where rm.room_id = p_room_id and rm.status = 'active' and ds.logged_day = true
    group by ds.local_date
    having count(distinct rm.user_id) >= v_threshold
    order by ds.local_date asc
  loop
    if v_prev_date is not null and v_rec.ldate = (v_prev_date + interval '1 day')::date then
      v_run := v_run + 1;
    else
      v_run := 1;
    end if;
    v_prev_date := v_rec.ldate;
    if v_run > v_longest_streak then
      v_longest_streak := v_run;
    end if;
  end loop;

  if v_cur_streak > v_longest_streak then
    v_longest_streak := v_cur_streak;
  end if;

  insert into public.room_streaks (
    room_id, current_streak, longest_streak, last_achieved_date, updated_at
  ) values (
    p_room_id, v_cur_streak, v_longest_streak,
    (case when v_today_achieved then v_today::text when v_yesterday_achieved then v_yesterday::text else null end),
    now()
  )
  on conflict (room_id) do update set
    current_streak = excluded.current_streak,
    longest_streak = excluded.longest_streak,
    last_achieved_date = coalesce(excluded.last_achieved_date, public.room_streaks.last_achieved_date),
    updated_at = now();
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. COMPUTE WEEKLY SCORES & LEADERBOARD SCHEDULED JOB
-- -----------------------------------------------------------------------------
create or replace function public.compute_weekly_scores(p_week_start text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_week_start date;
  v_week_end date;
  v_u record;
  v_logged_days integer;
  v_goal_days integer;
  v_low_intake_days integer;
  v_low_intake_flag boolean;
  v_score numeric(5,2);
  v_division text;
  v_cohort_id text;
  v_is_eligible boolean;
  v_has_access boolean;
  v_is_opted_out boolean;
  v_earliest_completion timestamptz;
  v_row_idx integer := 0;
begin
  if p_week_start is null then return; end if;
  v_week_start := p_week_start::date;
  v_week_end := v_week_start + interval '6 days';

  for v_u in
    select p.id, p.created_at, p.timezone, p.country,
           coalesce(gp.goal, 'maintain') as goal
    from public.profiles p
    left join lateral (
      select goal from public.goal_profiles
      where user_id = p.id and effective_from <= v_week_end
      order by effective_from desc limit 1
    ) gp on true
  loop
    v_row_idx := v_row_idx + 1;

    -- Aggregate logged days and goal days in the 7-day week
    select
      count(*) filter (where logged_day = true),
      count(*) filter (where goal_day = true),
      count(*) filter (where calories < calorie_floor)
    into v_logged_days, v_goal_days, v_low_intake_days
    from public.daily_summaries
    where user_id = v_u.id
      and local_date::date between v_week_start and v_week_end;

    -- Low-intake rule: if below floor on >= 5 of 7 days
    if v_low_intake_days >= 5 then
      v_low_intake_flag := true;
      -- Goal days cannot be awarded for days below floor
      select count(*)
      into v_goal_days
      from public.daily_summaries
      where user_id = v_u.id
        and local_date::date between v_week_start and v_week_end
        and goal_day = true
        and calories >= calorie_floor;
    else
      v_low_intake_flag := false;
    end if;

    -- Formula (PRD 7.3): 100 x ( 0.4 x logged/7 + 0.6 x goal/7 ) capped at 100
    v_score := round(least(100.0, 100.0 * (0.40 * (v_logged_days::numeric / 7.0) + 0.60 * (v_goal_days::numeric / 7.0))), 2);

    -- Division (PRD 6.16 RNK-2): Beginner for first 28 days
    if v_u.created_at >= (v_week_start - interval '28 days') then
      v_division := 'beginner';
    elsif v_u.goal = 'cut' then
      v_division := 'cutting';
    elsif v_u.goal = 'bulk' then
      v_division := 'bulking';
    else
      v_division := 'maintain';
    end if;

    -- Check room access and opt-out
    select public.has_room_access(v_u.id) into v_has_access;
    if not v_has_access then
      -- Also eligible if active member of an active/dormant room
      select exists(
        select 1 from public.room_members rm
        join public.rooms r on r.id = rm.room_id
        where rm.user_id = v_u.id and rm.status = 'active'
          and public.has_room_access(r.host_id)
      ) into v_has_access;
    end if;

    select coalesce(opted_out, false) into v_is_opted_out
    from public.leaderboard_settings
    where user_id = v_u.id;

    -- Eligibility (PRD 6.16, 7.5): access + >= 3 logged days + not opted out
    v_is_eligible := (v_has_access and v_logged_days >= 3 and not coalesce(v_is_opted_out, false));

    -- Earliest completion timestamp (tie breaker)
    select min(updated_at) into v_earliest_completion
    from public.daily_summaries
    where user_id = v_u.id
      and local_date::date between v_week_start and v_week_end
      and logged_day = true;

    -- Cohort (~100 users matched by division, timezone region / country)
    v_cohort_id := v_division || '_' ||
                   coalesce(split_part(v_u.timezone, '/', 1), 'global') || '_' ||
                   coalesce(lower(v_u.country), 'xx') || '_c' ||
                   (v_row_idx / 100)::text;

    insert into public.weekly_scores (
      user_id, week_start_date, division, cohort_id, logged_days, goal_days,
      consistency_score, low_intake_flag, is_eligible, earliest_completion_at,
      updated_at
    ) values (
      v_u.id, p_week_start, v_division, v_cohort_id, v_logged_days, v_goal_days,
      v_score, v_low_intake_flag, v_is_eligible, v_earliest_completion,
      now()
    )
    on conflict (user_id, week_start_date) do update set
      division = excluded.division,
      cohort_id = excluded.cohort_id,
      logged_days = excluded.logged_days,
      goal_days = excluded.goal_days,
      consistency_score = excluded.consistency_score,
      low_intake_flag = excluded.low_intake_flag,
      is_eligible = excluded.is_eligible,
      earliest_completion_at = coalesce(excluded.earliest_completion_at, public.weekly_scores.earliest_completion_at),
      updated_at = now();
  end loop;
end;
$$;

create or replace function public.process_scheduled_streaks_and_weekly_scores()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cur_monday date;
  v_prev_monday date;
  v_u record;
  v_r record;
begin
  -- 1. Refresh user streaks
  for v_u in select id from public.profiles loop
    perform public.recompute_user_streak(v_u.id);
  end loop;

  -- 2. Refresh room streaks
  for v_r in select id from public.rooms where status in ('active', 'dormant') loop
    perform public.recompute_room_streak(v_r.id);
  end loop;

  -- 3. Calculate weekly scores:
  -- Week runs Monday-Sunday.
  -- Current Monday:
  v_cur_monday := (current_date - ((extract(isodow from current_date)::integer - 1) || ' days')::interval)::date;
  v_prev_monday := v_cur_monday - interval '7 days';

  -- Refresh current week
  perform public.compute_weekly_scores(v_cur_monday::text);

  -- 24-hour grace period for late time zones:
  -- UTC Monday gives late time zones (UTC-12) until Tuesday to complete logging
  perform public.compute_weekly_scores(v_prev_monday::text);
end;
$$;

-- -----------------------------------------------------------------------------
-- 8. INDIVIDUAL PROGRESS QUERY FUNCTION (PRD 6.15 PRG-1..PRG-10, 7.8)
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
  v_total_distance_km numeric(7,2) := 0;

  v_total_water integer := 0;
  v_avg_water integer := 0;

  v_total_workouts integer := 0;
  v_total_workout_mins integer := 0;
  v_total_volume_kg numeric(9,2) := 0;
  v_sessions_per_week numeric(4,1) := 0;
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
    'goal_progress_pct', v_goal_progress_pct
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 9. ROOM PROGRESS FUNCTIONS (PRD 6.15 RPG-1..RPG-7, RPG-8)
-- -----------------------------------------------------------------------------
create or replace function public.search_room_members_for_progress(
  p_room_id uuid,
  p_query text default null
)
returns table (
  user_id uuid,
  nickname text,
  username text,
  avatar_url text,
  status text,
  is_locked boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_id uuid := auth.uid();
begin
  if v_caller_id is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if not exists (
    select 1 from public.room_members
    where room_id = p_room_id and user_id = v_caller_id
      and status in ('active', 'paused')
  ) then
    raise exception 'NOT_A_ROOM_MEMBER';
  end if;

  return query
  select
    rm.user_id,
    p.nickname,
    p.username::text,
    p.avatar_url,
    rm.status,
    (rm.status = 'locked') as is_locked
  from public.room_members rm
  join public.profiles p on p.id = rm.user_id
  where rm.room_id = p_room_id
    and (
      p_query is null
      or length(trim(p_query)) = 0
      or p.nickname ilike '%' || trim(p_query) || '%'
      or p.username ilike '%' || trim(p_query) || '%'
    )
  order by
    case when rm.user_id = v_caller_id then 0 else 1 end,
    lower(p.nickname) asc;
end;
$$;

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

-- -----------------------------------------------------------------------------
-- 10. LEADERBOARDS QUERY FUNCTION (PRD 6.16 RNK-1..RNK-7, 7.5)
-- -----------------------------------------------------------------------------
create or replace function public.get_leaderboard(
  p_week_start text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_id uuid := auth.uid();
  v_week_start date;
  v_opted_out boolean := false;
  v_my_score record;
  v_division text;
  v_cohort_id text;
  v_top_10 jsonb := '[]'::jsonb;
  v_my_rank_entry jsonb := null;
  v_total_in_cohort integer := 0;
  v_rank integer := 0;
  v_r record;
begin
  if v_caller_id is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  -- Opt-out check (PRD 6.16 RNK-6: opted-out users are hidden entirely)
  select coalesce(opted_out, false) into v_opted_out
  from public.leaderboard_settings
  where user_id = v_caller_id;

  if v_opted_out then
    return jsonb_build_object(
      'opted_out', true,
      'info_note', 'Ranked by consistency, not restriction.'
    );
  end if;

  if p_week_start is not null then
    v_week_start := p_week_start::date;
  else
    v_week_start := (current_date - ((extract(isodow from current_date)::integer - 1) || ' days')::interval)::date;
  end if;

  -- Ensure weekly score computed for caller
  select * into v_my_score
  from public.weekly_scores
  where user_id = v_caller_id and week_start_date = v_week_start::text;

  if not found then
    perform public.compute_weekly_scores(v_week_start::text);
    select * into v_my_score
    from public.weekly_scores
    where user_id = v_caller_id and week_start_date = v_week_start::text;
  end if;

  v_division := coalesce(v_my_score.division, 'maintain');
  v_cohort_id := coalesce(v_my_score.cohort_id, 'maintain_global_xx_c0');

  -- Count total in cohort
  select count(*) into v_total_in_cohort
  from public.weekly_scores ws
  join public.leaderboard_settings ls on ls.user_id = ws.user_id and ls.opted_out = false
  where ws.week_start_date = v_week_start::text
    and ws.cohort_id = v_cohort_id
    and ws.is_eligible = true;

  -- Rank users in cohort (Tie-breakers: score DESC, logged_days DESC, earliest_completion ASC)
  v_rank := 0;
  for v_r in
    select ws.user_id, ws.consistency_score, ws.logged_days, ws.earliest_completion_at,
           p.nickname, p.avatar_url
    from public.weekly_scores ws
    join public.profiles p on p.id = ws.user_id
    left join public.leaderboard_settings ls on ls.user_id = ws.user_id
    where ws.week_start_date = v_week_start::text
      and ws.cohort_id = v_cohort_id
      and ws.is_eligible = true
      and coalesce(ls.opted_out, false) = false
    order by
      ws.consistency_score desc,
      ws.logged_days desc,
      ws.earliest_completion_at asc nulls last,
      ws.user_id asc
  loop
    v_rank := v_rank + 1;

    if v_rank <= 10 then
      v_top_10 := v_top_10 || jsonb_build_array(
        jsonb_build_object(
          'rank', v_rank,
          'nickname', v_r.nickname,
          'avatar_url', v_r.avatar_url,
          'consistency_score', v_r.consistency_score,
          'is_me', (v_r.user_id = v_caller_id)
        )
      );
    end if;

    if v_r.user_id = v_caller_id then
      v_my_rank_entry := jsonb_build_object(
        'rank', v_rank,
        'nickname', v_r.nickname,
        'avatar_url', v_r.avatar_url,
        'consistency_score', v_r.consistency_score,
        'is_eligible', true
      );
    end if;
  end loop;

  -- If user is not yet ranked / not eligible:
  if v_my_rank_entry is null then
    select p.nickname, p.avatar_url into v_r
    from public.profiles p where id = v_caller_id;

    v_my_rank_entry := jsonb_build_object(
      'rank', null,
      'nickname', coalesce(v_r.nickname, 'You'),
      'avatar_url', v_r.avatar_url,
      'consistency_score', coalesce(v_my_score.consistency_score, 0),
      'is_eligible', coalesce(v_my_score.is_eligible, false)
    );
  end if;

  return jsonb_build_object(
    'opted_out', false,
    'division', v_division,
    'cohort_id', v_cohort_id,
    'week_start_date', v_week_start::text,
    'top_10', v_top_10,
    'my_rank', v_my_rank_entry,
    'total_in_cohort', v_total_in_cohort,
    'info_note', 'Ranked by consistency, not restriction.'
  );
end;
$$;
