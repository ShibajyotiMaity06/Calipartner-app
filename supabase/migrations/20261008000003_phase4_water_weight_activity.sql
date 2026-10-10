-- Phase 4: Water logs, Weight logs, Activity days (Steps & Distance)
-- Complies with PRD 6.5 (WAT-1..WAT-5, STP-1..STP-5, TRK-1, TRK-2) and 7.8

-- -----------------------------------------------------------------------------
-- 1. water_logs table
-- -----------------------------------------------------------------------------
create table if not exists public.water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_ml integer not null check (amount_ml > 0),
  logged_at timestamptz not null default now(),
  local_date text not null check (length(local_date) = 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_water_logs_user_date
  on public.water_logs (user_id, local_date) where deleted_at is null;

create index if not exists idx_water_logs_updated
  on public.water_logs (updated_at);

alter table public.water_logs enable row level security;

create policy water_logs_select on public.water_logs
  for select to authenticated
  using (auth.uid() = user_id);

create policy water_logs_insert on public.water_logs
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy water_logs_update on public.water_logs
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy water_logs_delete on public.water_logs
  for delete to authenticated
  using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 2. weight_logs table
-- -----------------------------------------------------------------------------
create table if not exists public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  weight_kg numeric(5,2) not null check (weight_kg > 0 and weight_kg < 500),
  logged_at timestamptz not null default now(),
  local_date text not null check (length(local_date) = 10),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_weight_logs_user_date
  on public.weight_logs (user_id, local_date desc) where deleted_at is null;

create index if not exists idx_weight_logs_updated
  on public.weight_logs (updated_at);

alter table public.weight_logs enable row level security;

create policy weight_logs_select on public.weight_logs
  for select to authenticated
  using (auth.uid() = user_id);

create policy weight_logs_insert on public.weight_logs
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy weight_logs_update on public.weight_logs
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy weight_logs_delete on public.weight_logs
  for delete to authenticated
  using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 3. activity_days table (one row per user per local date, merge-safe)
-- -----------------------------------------------------------------------------
create table if not exists public.activity_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_date text not null check (length(local_date) = 10),
  steps integer not null default 0 check (steps >= 0),
  distance_m numeric(10,2) not null default 0 check (distance_m >= 0),
  source text not null check (source in ('health_platform', 'pedometer', 'manual')),
  active_calories integer default 0 check (active_calories >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint uq_activity_days_user_date unique (user_id, local_date)
);

create index if not exists idx_activity_days_user_date
  on public.activity_days (user_id, local_date);

create index if not exists idx_activity_days_updated
  on public.activity_days (updated_at);

alter table public.activity_days enable row level security;

create policy activity_days_select on public.activity_days
  for select to authenticated
  using (auth.uid() = user_id);

create policy activity_days_insert on public.activity_days
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy activity_days_update on public.activity_days
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy activity_days_delete on public.activity_days
  for delete to authenticated
  using (auth.uid() = user_id);
