-- Phase 3: Foods, Food Entries, User Food Stats, Saved Meals, and Sync support
-- Complies with PRD 6.3 (LOG-1..LOG-16), 6.4, 9, and AGENT_RULES.md

-- -----------------------------------------------------------------------------
-- 1. foods table
-- Public global foods (IFCT, USDA, Open Food Facts) have owner_id IS NULL.
-- Custom user foods have owner_id = auth.users.id and are private to that owner.
-- -----------------------------------------------------------------------------
create table if not exists public.foods (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('ifct', 'off', 'usda', 'user')),
  name text not null check (length(trim(name)) >= 1),
  brand text,
  barcode text,
  serving_units jsonb not null default '[]'::jsonb,
  calories_per_100g numeric(7,2) not null check (calories_per_100g >= 0),
  protein_per_100g numeric(7,2) not null check (protein_per_100g >= 0),
  carbs_per_100g numeric(7,2) not null check (carbs_per_100g >= 0),
  fat_per_100g numeric(7,2) not null check (fat_per_100g >= 0),
  fiber_per_100g numeric(7,2) default 0 check (fiber_per_100g >= 0),
  sugar_per_100g numeric(7,2) default 0 check (sugar_per_100g >= 0),
  sodium_mg_per_100g numeric(7,2) default 0 check (sodium_mg_per_100g >= 0),
  owner_id uuid references auth.users(id) on delete cascade,
  attribution text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_foods_barcode
  on public.foods (barcode) where barcode is not null and deleted_at is null;

create index if not exists idx_foods_owner
  on public.foods (owner_id) where owner_id is not null;

create index if not exists idx_foods_name
  on public.foods (name);

create index if not exists idx_foods_updated
  on public.foods (updated_at);

alter table public.foods enable row level security;

-- Global foods are readable by any authenticated user.
-- Custom foods are readable only by their owner.
create policy foods_select on public.foods
  for select to authenticated
  using (owner_id is null or auth.uid() = owner_id);

-- Users can only insert custom foods they own. Global foods are managed by service role / migrations.
create policy foods_insert on public.foods
  for insert to authenticated
  with check (auth.uid() is not null and auth.uid() = owner_id);

-- Users can only update their own custom foods.
create policy foods_update on public.foods
  for update to authenticated
  using (auth.uid() is not null and auth.uid() = owner_id)
  with check (auth.uid() is not null and auth.uid() = owner_id);

-- Users can only delete their own custom foods.
create policy foods_delete on public.foods
  for delete to authenticated
  using (auth.uid() is not null and auth.uid() = owner_id);

-- -----------------------------------------------------------------------------
-- 2. food_entries table
-- Client-generated UUID for offline idempotency.
-- Snapshot columns freeze nutrient values at log time.
-- -----------------------------------------------------------------------------
create table if not exists public.food_entries (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  food_id uuid references public.foods(id) on delete set null,
  meal_section text not null check (meal_section in ('breakfast', 'lunch', 'dinner', 'snacks', 'extra')),
  quantity numeric(8,2) not null check (quantity > 0),
  unit text not null check (length(trim(unit)) >= 1),
  calories numeric(7,2) not null check (calories >= 0),
  protein numeric(7,2) not null check (protein >= 0),
  carbs numeric(7,2) not null check (carbs >= 0),
  fat numeric(7,2) not null check (fat >= 0),
  fiber numeric(7,2) default 0 check (fiber >= 0),
  sugar numeric(7,2) default 0 check (sugar >= 0),
  sodium_mg numeric(7,2) default 0 check (sodium_mg >= 0),
  food_name text not null check (length(trim(food_name)) >= 1),
  brand_name text,
  logged_at timestamptz not null default now(),
  local_date date not null,
  source text not null check (source in ('search', 'scan', 'photo', 'history', 'copy', 'recipe')),
  shared_meal_id uuid,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_food_entries_user_date
  on public.food_entries (user_id, local_date, deleted_at);

create index if not exists idx_food_entries_user_updated
  on public.food_entries (user_id, updated_at);

create index if not exists idx_food_entries_user_section_logged
  on public.food_entries (user_id, meal_section, logged_at desc);

alter table public.food_entries enable row level security;

-- Strictly owner-only RLS:
create policy food_entries_select_own on public.food_entries
  for select to authenticated
  using (auth.uid() = user_id);

create policy food_entries_insert_own on public.food_entries
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy food_entries_update_own on public.food_entries
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy food_entries_delete_own on public.food_entries
  for delete to authenticated
  using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 3. user_food_stats table
-- Tracks usage frequency, last portion and section for quick-add and suggestions.
-- -----------------------------------------------------------------------------
create table if not exists public.user_food_stats (
  user_id uuid not null references auth.users(id) on delete cascade,
  food_id uuid not null references public.foods(id) on delete cascade,
  use_count integer not null default 1 check (use_count >= 1),
  last_used_at timestamptz not null default now(),
  last_quantity numeric(8,2) not null check (last_quantity > 0),
  last_unit text not null check (length(trim(last_unit)) >= 1),
  last_meal_section text not null check (last_meal_section in ('breakfast', 'lunch', 'dinner', 'snacks', 'extra')),
  hidden boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, food_id)
);

create index if not exists idx_user_food_stats_user_used
  on public.user_food_stats (user_id, last_used_at desc) where hidden = false;

create index if not exists idx_user_food_stats_user_count
  on public.user_food_stats (user_id, use_count desc) where hidden = false;

create index if not exists idx_user_food_stats_user_updated
  on public.user_food_stats (user_id, updated_at);

alter table public.user_food_stats enable row level security;

-- Strictly owner-only RLS:
create policy user_food_stats_select_own on public.user_food_stats
  for select to authenticated
  using (auth.uid() = user_id);

create policy user_food_stats_insert_own on public.user_food_stats
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy user_food_stats_update_own on public.user_food_stats
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy user_food_stats_delete_own on public.user_food_stats
  for delete to authenticated
  using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 4. saved_meals table
-- Multi-food combination saved as a reusable meal (PRD LOG-8).
-- -----------------------------------------------------------------------------
create table if not exists public.saved_meals (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) >= 1),
  items jsonb not null default '[]'::jsonb,
  total_calories numeric(7,2) not null default 0 check (total_calories >= 0),
  total_protein numeric(7,2) not null default 0 check (total_protein >= 0),
  total_carbs numeric(7,2) not null default 0 check (total_carbs >= 0),
  total_fat numeric(7,2) not null default 0 check (total_fat >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_saved_meals_user
  on public.saved_meals (user_id, updated_at);

alter table public.saved_meals enable row level security;

-- Strictly owner-only RLS:
create policy saved_meals_select_own on public.saved_meals
  for select to authenticated
  using (auth.uid() = user_id);

create policy saved_meals_insert_own on public.saved_meals
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy saved_meals_update_own on public.saved_meals
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy saved_meals_delete_own on public.saved_meals
  for delete to authenticated
  using (auth.uid() = user_id);
