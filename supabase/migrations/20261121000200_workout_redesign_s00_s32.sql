-- 20261121000200_workout_redesign_s00_s32.sql
-- Workout Redesign: S00-S32 schema, plan templates, sessions, activity logs, personal bests, settings, and AI state.

-- 1. Workout Settings (S25)
create table if not exists public.workout_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  weight_unit text not null default 'kg' check (weight_unit in ('kg', 'lb')),
  default_rest_seconds integer not null default 60 check (default_rest_seconds between 10 and 600),
  auto_start_rest boolean not null default true,
  rest_sound boolean not null default true,
  rest_haptics boolean not null default true,
  keep_screen_awake boolean not null default true,
  remind_ai_unlock boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.workout_settings enable row level security;

create policy workout_settings_select on public.workout_settings
  for select to authenticated using (auth.uid() = user_id);
create policy workout_settings_insert on public.workout_settings
  for insert to authenticated with check (auth.uid() = user_id);
create policy workout_settings_update on public.workout_settings
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 2. AI Plan State (Section 5 & 10)
create table if not exists public.ai_plan_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_generated_at timestamptz,
  next_available_at timestamptz,
  generation_count integer not null default 0,
  previews_used integer not null default 0 check (previews_used between 0 and 3),
  current_draft_id uuid,
  current_draft jsonb,
  draft_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_plan_state enable row level security;

create policy ai_plan_state_select on public.ai_plan_state
  for select to authenticated using (auth.uid() = user_id);

-- 3. Activity Logs (S29 & S04)
create table if not exists public.activity_logs (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  local_date text not null check (length(local_date) = 10),
  name text not null check (length(trim(name)) >= 1 and length(name) <= 100),
  sets jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_activity_logs_user_date on public.activity_logs(user_id, local_date desc) where deleted_at is null;

alter table public.activity_logs enable row level security;

create policy activity_logs_select on public.activity_logs
  for select to authenticated using (auth.uid() = user_id);
create policy activity_logs_insert on public.activity_logs
  for insert to authenticated with check (auth.uid() = user_id);
create policy activity_logs_update on public.activity_logs
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy activity_logs_delete on public.activity_logs
  for delete to authenticated using (auth.uid() = user_id);

-- 4. Personal Bests (S06 & History)
create table if not exists public.personal_bests (
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  best_weight_kg numeric(6,2) not null default 0,
  best_reps integer not null default 0,
  achieved_at timestamptz not null default now(),
  primary key (user_id, exercise_id)
);

alter table public.personal_bests enable row level security;

create policy personal_bests_select on public.personal_bests
  for select to authenticated using (auth.uid() = user_id);
create policy personal_bests_insert on public.personal_bests
  for insert to authenticated with check (auth.uid() = user_id);
create policy personal_bests_update on public.personal_bests
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 5. Extend exercises table if columns missing
alter table public.exercises add column if not exists level_min text not null default 'beginner';
alter table public.exercises add column if not exists contraindication_tags text[] not null default '{}'::text[];

-- 6. Extend workouts table for active session state (S05, S27, S28, S30)
alter table public.workouts add column if not exists plan_day_id uuid;
alter table public.workouts add column if not exists status text not null default 'completed' check (status in ('planned','in_progress','completed','discarded'));
alter table public.workouts add column if not exists started_at timestamptz;
alter table public.workouts add column if not exists ended_at timestamptz;
alter table public.workouts add column if not exists effort text check (effort is null or effort in ('easy','good','hard','max'));

create index if not exists idx_workouts_user_status on public.workouts(user_id, status) where deleted_at is null;

-- 7. Extend workout_exercises and workout_sets
alter table public.workout_exercises add column if not exists position integer not null default 1;
alter table public.workout_exercises add column if not exists target_sets integer not null default 3;
alter table public.workout_exercises add column if not exists target_reps integer not null default 10;
alter table public.workout_exercises add column if not exists target_weight_kg numeric(6,2);
alter table public.workout_exercises add column if not exists rest_seconds integer not null default 60;

alter table public.workout_sets add column if not exists completed_at timestamptz;

-- 8. Relational Workout Plans & Plan Days (Section 5)
create table if not exists public.user_workout_plans (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('ai', 'custom')),
  status text not null default 'active' check (status in ('active', 'archived')),
  name text not null default 'Weekly Plan',
  ai_inputs jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_workout_plans_user_status on public.user_workout_plans(user_id, status);

alter table public.user_workout_plans enable row level security;

create policy user_workout_plans_select on public.user_workout_plans
  for select to authenticated using (auth.uid() = user_id);
create policy user_workout_plans_insert on public.user_workout_plans
  for insert to authenticated with check (auth.uid() = user_id);
create policy user_workout_plans_update on public.user_workout_plans
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.plan_days (
  id uuid primary key,
  plan_id uuid not null references public.user_workout_plans(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  weekday integer not null check (weekday between 1 and 7), -- 1 Mon to 7 Sun
  is_rest boolean not null default false,
  name text not null check (length(trim(name)) >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, weekday)
);

create index if not exists idx_plan_days_plan on public.plan_days(plan_id, weekday);

alter table public.plan_days enable row level security;

create policy plan_days_select on public.plan_days
  for select to authenticated using (auth.uid() = user_id);
create policy plan_days_insert on public.plan_days
  for insert to authenticated with check (auth.uid() = user_id);
create policy plan_days_update on public.plan_days
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.plan_exercises (
  id uuid primary key,
  plan_day_id uuid not null references public.plan_days(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  position integer not null check (position >= 1),
  target_sets integer not null check (target_sets between 1 and 10),
  target_reps integer not null check (target_reps between 1 and 50),
  target_weight_kg numeric(6,2),
  rest_seconds integer not null default 60 check (rest_seconds between 10 and 600),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_day_id, position)
);

create index if not exists idx_plan_exercises_day on public.plan_exercises(plan_day_id, position);

alter table public.plan_exercises enable row level security;

create policy plan_exercises_select on public.plan_exercises
  for select to authenticated using (
    exists (
      select 1 from public.plan_days pd
      where pd.id = plan_exercises.plan_day_id and pd.user_id = auth.uid()
    )
  );
create policy plan_exercises_insert on public.plan_exercises
  for insert to authenticated with check (
    exists (
      select 1 from public.plan_days pd
      where pd.id = plan_exercises.plan_day_id and pd.user_id = auth.uid()
    )
  );
create policy plan_exercises_update on public.plan_exercises
  for update to authenticated using (
    exists (
      select 1 from public.plan_days pd
      where pd.id = plan_exercises.plan_day_id and pd.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.plan_days pd
      where pd.id = plan_exercises.plan_day_id and pd.user_id = auth.uid()
    )
  );
create policy plan_exercises_delete on public.plan_exercises
  for delete to authenticated using (
    exists (
      select 1 from public.plan_days pd
      where pd.id = plan_exercises.plan_day_id and pd.user_id = auth.uid()
    )
  );
