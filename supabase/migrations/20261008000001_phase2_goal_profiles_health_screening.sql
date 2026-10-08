-- Phase 2: Goal Profiles, Health Screening, and Targets History
-- Adheres to PRD 6.2 (ONB-1..ONB-11), 7.2 (calculation rules) and AGENT_RULES.md

-- -----------------------------------------------------------------------------
-- 1. goal_profiles table
-- Stores history rows with effective_from. The current plan is the latest row.
-- -----------------------------------------------------------------------------
create table if not exists public.goal_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal text not null check (goal in ('cut', 'maintain', 'bulk')),
  activity_level text not null check (activity_level in ('sedentary', 'light', 'moderate', 'very_active', 'extra_active')),
  current_weight_kg numeric(5,2) not null check (current_weight_kg between 20 and 500),
  body_fat_percentage numeric(4,1) check (body_fat_percentage between 3 and 70),
  weekly_rate_kg numeric(4,2) not null default 0 check (weekly_rate_kg >= 0 and weekly_rate_kg <= 5),
  target_weight_kg numeric(5,2) check (target_weight_kg between 20 and 500),
  target_date date,
  daily_calorie_target integer not null check (daily_calorie_target between 800 and 10000),
  protein_grams integer not null check (protein_grams >= 0),
  fat_grams integer not null check (fat_grams >= 0),
  carb_grams integer not null check (carb_grams >= 0),
  bmr integer not null check (bmr > 0),
  tdee integer not null check (tdee > 0),
  step_goal integer not null default 8000 check (step_goal >= 0 and step_goal <= 100000),
  water_ml_goal integer not null default 2500 check (water_ml_goal >= 0 and water_ml_goal <= 20000),
  effective_from timestamptz not null default now(),
  confirmed_at timestamptz not null default now(),
  recompute_reason text check (recompute_reason in ('initial_onboarding', 'manual_edit', 'weight_change', 'recalibration')),
  created_at timestamptz not null default now()
);

create index if not exists idx_goal_profiles_user_effective
  on public.goal_profiles (user_id, effective_from desc);

alter table public.goal_profiles enable row level security;

-- Owner-only RLS policies:
-- AGENT_RULES.md: Never expose user targets to others except through privacy-respecting views.
create policy goal_profiles_select_own on public.goal_profiles
  for select to authenticated
  using (auth.uid() = user_id);

create policy goal_profiles_insert_own on public.goal_profiles
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy goal_profiles_update_own on public.goal_profiles
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy goal_profiles_delete_own on public.goal_profiles
  for delete to authenticated
  using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 2. Current goal profiles view (security invoker)
-- -----------------------------------------------------------------------------
create or replace view public.current_goal_profiles
with (security_invoker = true) as
select distinct on (user_id) *
from public.goal_profiles
order by user_id, effective_from desc;

-- -----------------------------------------------------------------------------
-- 3. health_screening table
-- Strictly private: pregnancy/breastfeeding, diabetes/medication, eating-disorder history.
-- Never readable by anyone but the owner. Never shared with rooms.
-- -----------------------------------------------------------------------------
create table if not exists public.health_screening (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pregnant_or_breastfeeding boolean not null default false,
  has_diabetes_or_medication boolean not null default false,
  has_eating_disorder_history boolean not null default false,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.health_screening enable row level security;

-- Owner-only RLS policies:
create policy health_screening_select_own on public.health_screening
  for select to authenticated
  using (auth.uid() = user_id);

create policy health_screening_insert_own on public.health_screening
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy health_screening_update_own on public.health_screening
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy health_screening_delete_own on public.health_screening
  for delete to authenticated
  using (auth.uid() = user_id);
