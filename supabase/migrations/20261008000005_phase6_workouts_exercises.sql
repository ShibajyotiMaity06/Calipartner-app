-- Phase 6: Workout Tracking, Exercises, Sets, and Room Integration
-- Complies with PRD 6.6 (WRK-1..WRK-10), 6.13, 7.8, and AGENT_RULES.md

-- -----------------------------------------------------------------------------
-- 1. exercises table (Library + Custom user exercises)
-- Library exercises have owner_id IS NULL.
-- Custom exercises have owner_id = auth.users.id and are private to that user.
-- -----------------------------------------------------------------------------
create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) >= 1),
  muscle_group text not null check (muscle_group in (
    'chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'full_body', 'cardio', 'other'
  )),
  equipment text not null check (equipment in (
    'barbell', 'dumbbell', 'cable', 'machine', 'bodyweight', 'kettlebell', 'band', 'other', 'none'
  )),
  type text not null check (type in (
    'strength', 'cardio', 'bodyweight', 'duration', 'distance'
  )),
  owner_id uuid references auth.users(id) on delete cascade,
  attribution text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_exercises_owner
  on public.exercises (owner_id);

create index if not exists idx_exercises_muscle_group
  on public.exercises (muscle_group);

create index if not exists idx_exercises_name
  on public.exercises (name);

create index if not exists idx_exercises_updated
  on public.exercises (updated_at);

alter table public.exercises enable row level security;

-- Global exercises are readable by any authenticated user.
-- Custom exercises are readable only by their owner.
create policy exercises_select on public.exercises
  for select to authenticated
  using (owner_id is null or auth.uid() = owner_id);

-- Users can only insert custom exercises they own.
create policy exercises_insert on public.exercises
  for insert to authenticated
  with check (auth.uid() is not null and auth.uid() = owner_id);

-- Users can only update their own custom exercises.
create policy exercises_update on public.exercises
  for update to authenticated
  using (auth.uid() is not null and auth.uid() = owner_id)
  with check (auth.uid() is not null and auth.uid() = owner_id);

-- Users can only delete their own custom exercises.
create policy exercises_delete on public.exercises
  for delete to authenticated
  using (auth.uid() is not null and auth.uid() = owner_id);

-- -----------------------------------------------------------------------------
-- 2. workouts table (Owner-only RLS)
-- Client-generated UUID for offline idempotency.
-- -----------------------------------------------------------------------------
create table if not exists public.workouts (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in (
    'strength', 'cardio', 'sports', 'yoga_mobility', 'walk_run', 'other'
  )),
  name text,
  start_time timestamptz,
  duration_minutes integer not null default 0 check (duration_minutes >= 0),
  local_date text not null check (length(local_date) = 10),
  notes text,
  effort_rating integer check (effort_rating is null or (effort_rating >= 1 and effort_rating <= 10)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_workouts_user_date
  on public.workouts (user_id, local_date desc) where deleted_at is null;

create index if not exists idx_workouts_updated
  on public.workouts (updated_at);

alter table public.workouts enable row level security;

-- STRICT: Owner-only RLS. Room members CANNOT read base workout tables directly!
create policy workouts_select on public.workouts
  for select to authenticated
  using (auth.uid() = user_id);

create policy workouts_insert on public.workouts
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy workouts_update on public.workouts
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy workouts_delete on public.workouts
  for delete to authenticated
  using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 3. workout_exercises table (Owner-only RLS)
-- -----------------------------------------------------------------------------
create table if not exists public.workout_exercises (
  id uuid primary key,
  workout_id uuid not null references public.workouts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid references public.exercises(id) on delete set null,
  exercise_name text not null check (length(trim(exercise_name)) >= 1),
  order_in_workout integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_workout_exercises_workout
  on public.workout_exercises (workout_id, order_in_workout) where deleted_at is null;

create index if not exists idx_workout_exercises_user_exercise
  on public.workout_exercises (user_id, exercise_id) where deleted_at is null;

create index if not exists idx_workout_exercises_updated
  on public.workout_exercises (updated_at);

alter table public.workout_exercises enable row level security;

create policy workout_exercises_select on public.workout_exercises
  for select to authenticated
  using (auth.uid() = user_id);

create policy workout_exercises_insert on public.workout_exercises
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy workout_exercises_update on public.workout_exercises
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy workout_exercises_delete on public.workout_exercises
  for delete to authenticated
  using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 4. workout_sets table (Owner-only RLS)
-- -----------------------------------------------------------------------------
create table if not exists public.workout_sets (
  id uuid primary key,
  workout_exercise_id uuid not null references public.workout_exercises(id) on delete cascade,
  workout_id uuid not null references public.workouts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  set_number integer not null default 1 check (set_number >= 1),
  reps integer check (reps is null or reps >= 0),
  weight_kg numeric(6,2) check (weight_kg is null or weight_kg >= 0),
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  distance_meters numeric(10,2) check (distance_meters is null or distance_meters >= 0),
  is_warmup boolean not null default false,
  completed boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_workout_sets_exercise
  on public.workout_sets (workout_exercise_id, set_number) where deleted_at is null;

create index if not exists idx_workout_sets_workout
  on public.workout_sets (workout_id) where deleted_at is null;

create index if not exists idx_workout_sets_user
  on public.workout_sets (user_id);

create index if not exists idx_workout_sets_updated
  on public.workout_sets (updated_at);

alter table public.workout_sets enable row level security;

create policy workout_sets_select on public.workout_sets
  for select to authenticated
  using (auth.uid() = user_id);

create policy workout_sets_insert on public.workout_sets
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy workout_sets_update on public.workout_sets
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy workout_sets_delete on public.workout_sets
  for delete to authenticated
  using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 5. DAILY SUMMARIES RECOMPUTE & TRIGGER
-- Recompute function computes workout_minutes from public.workouts
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
  v_logged_day boolean := false;
  v_goal_day boolean := false;
  v_goal_prof record;
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

  -- 3. Steps
  select coalesce(sum(steps), 0)
  into v_steps
  from public.activity_days
  where user_id = p_user_id
    and local_date = p_local_date
    and deleted_at is null;

  -- 4. Workouts (PRD 6.6 WRK-9, 7.8)
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

  if found and v_goal_prof.target_calories is not null then
    v_target_kcal := v_goal_prof.target_calories;
    v_goal := coalesce(v_goal_prof.goal, 'maintain');
  end if;

  -- PRD 7.3: logged_day requires >= 2 food entries and calories >= 50% of target
  if v_entry_count >= 2 and v_calories >= (0.50 * v_target_kcal) then
    v_logged_day := true;
  else
    v_logged_day := false;
  end if;

  -- PRD 7.3: goal_day requires logged_day and calories within range:
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

  -- Upsert summary
  insert into public.daily_summaries (
    user_id, local_date, calories, protein, carbs, fat, steps, water_ml,
    workout_minutes, weight_kg, logged_day, goal_day, updated_at
  ) values (
    p_user_id, p_local_date, v_calories, v_protein, v_carbs, v_fat, v_steps, v_water_ml,
    v_workout_minutes, v_weight_kg, v_logged_day, v_goal_day, now()
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
    updated_at = now();
end;
$$;

-- Triggers for workouts to keep daily_summaries in sync
create or replace function public.tr_workouts_sync_summary()
returns trigger
language plpgsql
security definer
as $$
begin
  if TG_OP = 'DELETE' then
    perform public.recompute_daily_summary(OLD.user_id, OLD.local_date);
    return OLD;
  else
    perform public.recompute_daily_summary(NEW.user_id, NEW.local_date);
    if TG_OP = 'UPDATE' and OLD.local_date <> NEW.local_date then
      perform public.recompute_daily_summary(OLD.user_id, OLD.local_date);
    end if;
    return NEW;
  end if;
end;
$$;

drop trigger if exists tr_workouts_sync_summary on public.workouts;
create trigger tr_workouts_sync_summary
  after insert or update or delete on public.workouts
  for each row execute function public.tr_workouts_sync_summary();

-- -----------------------------------------------------------------------------
-- 6. ROOM INTEGRATION: ROOM EVENTS FOR COMPLETED WORKOUTS (PRD 6.6 WRK-9, 6.13)
-- When a workout is logged with duration > 0 and not deleted:
-- If user shares workouts in that room, post 'workout_finished' event.
-- Workout details (sets/weights) stay STRICTLY HIDDEN!
-- -----------------------------------------------------------------------------
create or replace function public.tr_workouts_room_event()
returns trigger
language plpgsql
security definer
as $$
declare
  v_rm record;
  v_share boolean;
begin
  if NEW.deleted_at is not null or NEW.duration_minutes <= 0 then
    return NEW;
  end if;

  -- Only post event on new insert or when becoming non-deleted
  if TG_OP = 'UPDATE' and OLD.deleted_at is null and OLD.duration_minutes > 0 then
    return NEW;
  end if;

  for v_rm in
    select rm.room_id, rm.privacy_settings
    from public.room_members rm
    join public.rooms r on r.id = rm.room_id
    where rm.user_id = NEW.user_id
      and rm.status in ('active', 'paused')
      and r.state = 'active'
  loop
    v_share := coalesce((v_rm.privacy_settings->>'share_workouts')::boolean, true);
    if v_share then
      insert into public.room_events (
        room_id, user_id, event_type, payload
      ) values (
        v_rm.room_id,
        NEW.user_id,
        'workout_finished',
        jsonb_build_object(
          'type', NEW.type,
          'duration_minutes', NEW.duration_minutes,
          'local_date', NEW.local_date
        )
      );
    end if;
  end loop;

  return NEW;
end;
$$;

drop trigger if exists tr_workouts_room_event on public.workouts;
create trigger tr_workouts_room_event
  after insert or update on public.workouts
  for each row execute function public.tr_workouts_room_event();

-- -----------------------------------------------------------------------------
-- 7. DEV SEED: 40 EXERCISE LIBRARY (CaliPartner Open Exercise Library CC-BY-4.0)
-- -----------------------------------------------------------------------------
insert into public.exercises (
  id, name, muscle_group, equipment, type, owner_id, attribution
) values
  -- Chest
  ('00000000-0000-0000-0000-000000000101', 'Barbell Bench Press', 'chest', 'barbell', 'strength', null, 'CaliPartner Open Exercise Library (CC-BY-4.0)'),
  ('00000000-0000-0000-0000-000000000102', 'Incline Dumbbell Bench Press', 'chest', 'dumbbell', 'strength', null, 'CaliPartner Open Exercise Library (CC-BY-4.0)'),
  ('00000000-0000-0000-0000-000000000103', 'Push-up', 'chest', 'bodyweight', 'bodyweight', null, 'CaliPartner Open Exercise Library (CC-BY-4.0)'),
  ('00000000-0000-0000-0000-000000000104', 'Cable Chest Fly', 'chest', 'cable', 'strength', null, 'CaliPartner Open Exercise Library (CC-BY-4.0)'),
  ('00000000-0000-0000-0000-000000000105', 'Chest Dip', 'chest', 'bodyweight', 'bodyweight', null, 'CaliPartner Open Exercise Library (CC-BY-4.0)'),

  -- Back
  ('00000000-0000-0000-0000-000000000106', 'Barbell Deadlift', 'back', 'barbell', 'strength', null, 'CaliPartner Open Exercise Library (CC-BY-4.0)'),
  ('00000000-0000-0000-0000-000000000107', 'Barbell Bent-Over Row', 'back', 'barbell', 'strength', null, 'CaliPartner Open Exercise Library (CC-BY-4.0)'),
  ('00000000-0000-0000-0000-000000000108', 'Pull-up', 'back', 'bodyweight', 'bodyweight', null, 'CaliPartner Open Exercise Library (CC-BY-4.0)'),
  ('00000000-0000-0000-0000-000000000109', 'Lat Pulldown', 'back', 'cable', 'strength', null, 'CaliPartner Open Exercise Library (CC-BY-4.0)'),
  ('00000000-0000-0000-0000-000000000110', 'Seated Cable Row', 'back', 'cable', 'strength', null, 'CaliPartner Open Exercise Library (CC-BY-4.0)'),

  -- Legs
  ('00000000-0000-0000-0000-000000000111', 'Barbell Back Squat', 'legs', 'barbell', 'strength', null, 'CaliPartner Open Exercise Library (CC-BY-4.0)'),
  ('00000000-0000-0000-0000-000000000112', 'Barbell Front Squat', 'legs', 'barbell', 'strength', null, 'CaliPartner Open Exercise Library (CC-BY-4.0)'),
  ('00000000-0000-0000-0000-000000000113', 'Romanian Deadlift', 'legs', 'barbell', 'strength', null, 'CaliPartner Open Exercise Library (CC-BY-4.0)'),
  ('00000000-0000-0000-0000-000000000114', 'Leg Press', 'legs', 'machine', 'strength', null, 'CaliPartner Open Exercise Library (CC-BY-4.0)'),
  ('00000000-0000-0000-0000-000000000115', 'Walking Lunge', 'legs', 'dumbbell', 'strength', null, 'CaliPartner Open Exercise Library (CC-BY-4.0)'),
  ('00000000-0000-0000-0000-000000000116', 'Bulgarian Split Squat', 'legs', 'dumbbell', 'strength', null, 'CaliPartner Open Exercise Library (CC-BY-4.0)'),
  ('00000000-0000-0000-0000-000000000117', 'Standing Calf Raise', 'legs', 'machine', 'strength', null, 'CaliPartner Open Exercise Library (CC-BY-4.0)'),
  ('00000000-0000-0000-0000-000000000118', 'Leg Extension', 'legs', 'machine', 'strength', null, 'CaliPartner Open Exercise Library (CC-BY-4.0)'),

  -- Shoulders
  ('00000000-0000-0000-0000-000000000119', 'Overhead Press', 'shoulders', 'barbell', 'strength', null, 'CaliPartner Open Exercise Library (CC-BY-4.0)'),
  ('00000000-0000-0000-0000-000000000120', 'Dumbbell Lateral Raise', 'shoulders', 'dumbbell', 'strength', null, 'CaliPartner Open Exercise Library (CC-BY-4.0)'),
  ('00000000-0000-0000-0000-000000000121', 'Face Pull', 'shoulders', 'cable', 'strength', null, 'CaliPartner Open Exercise Library (CC-BY-4.0)'),
  ('00000000-0000-0000-0000-000000000122', 'Seated Dumbbell Shoulder Press', 'shoulders', 'dumbbell', 'strength', null, 'CaliPartner Open Exercise Library (CC-BY-4.0)'),
  ('00000000-0000-0000-0000-000000000123', 'Arnold Press', 'shoulders', 'dumbbell', 'strength', null, 'CaliPartner Open Exercise Library (CC-BY-4.0)'),

  -- Arms
  ('00000000-0000-0000-0000-000000000124', 'Barbell Bicep Curl', 'arms', 'barbell', 'strength', null, 'CaliPartner Open Exercise Library (CC-BY-4.0)'),
  ('00000000-0000-0000-0000-000000000125', 'Hammer Curl', 'arms', 'dumbbell', 'strength', null, 'CaliPartner Open Exercise Library (CC-BY-4.0)'),
  ('00000000-0000-0000-0000-000000000126', 'Tricep Rope Pushdown', 'arms', 'cable', 'strength', null, 'CaliPartner Open Exercise Library (CC-BY-4.0)'),
  ('00000000-0000-0000-0000-000000000127', 'Skull Crusher', 'arms', 'barbell', 'strength', null, 'CaliPartner Open Exercise Library (CC-BY-4.0)'),
  ('00000000-0000-0000-0000-000000000128', 'Preacher Curl', 'arms', 'dumbbell', 'strength', null, 'CaliPartner Open Exercise Library (CC-BY-4.0)'),
  ('00000000-0000-0000-0000-000000000129', 'Overhead Tricep Extension', 'arms', 'dumbbell', 'strength', null, 'CaliPartner Open Exercise Library (CC-BY-4.0)'),

  -- Core
  ('00000000-0000-0000-0000-000000000130', 'Plank', 'core', 'bodyweight', 'duration', null, 'CaliPartner Open Exercise Library (CC-BY-4.0)'),
  ('00000000-0000-0000-0000-000000000131', 'Hanging Leg Raise', 'core', 'bodyweight', 'bodyweight', null, 'CaliPartner Open Exercise Library (CC-BY-4.0)'),
  ('00000000-0000-0000-0000-000000000132', 'Cable Woodchopper', 'core', 'cable', 'strength', null, 'CaliPartner Open Exercise Library (CC-BY-4.0)'),
  ('00000000-0000-0000-0000-000000000133', 'Ab Roller', 'core', 'other', 'bodyweight', null, 'CaliPartner Open Exercise Library (CC-BY-4.0)'),
  ('00000000-0000-0000-0000-000000000134', 'Russian Twist', 'core', 'bodyweight', 'bodyweight', null, 'CaliPartner Open Exercise Library (CC-BY-4.0)'),

  -- Cardio & Walk/Run
  ('00000000-0000-0000-0000-000000000135', 'Treadmill Running', 'cardio', 'machine', 'cardio', null, 'CaliPartner Open Exercise Library (CC-BY-4.0)'),
  ('00000000-0000-0000-0000-000000000136', 'Stationary Cycling', 'cardio', 'machine', 'cardio', null, 'CaliPartner Open Exercise Library (CC-BY-4.0)'),
  ('00000000-0000-0000-0000-000000000137', 'Rowing Machine', 'cardio', 'machine', 'cardio', null, 'CaliPartner Open Exercise Library (CC-BY-4.0)'),
  ('00000000-0000-0000-0000-000000000138', 'Jump Rope', 'cardio', 'other', 'cardio', null, 'CaliPartner Open Exercise Library (CC-BY-4.0)'),
  ('00000000-0000-0000-0000-000000000139', 'Outdoor Running', 'cardio', 'none', 'distance', null, 'CaliPartner Open Exercise Library (CC-BY-4.0)'),
  ('00000000-0000-0000-0000-000000000140', 'Brisk Walking', 'cardio', 'none', 'distance', null, 'CaliPartner Open Exercise Library (CC-BY-4.0)')
on conflict (id) do nothing;
