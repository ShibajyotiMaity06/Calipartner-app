-- Phase 12: Recipes Library, Ingredients, Favorites, and Reports
-- Complies with PRD 6.21 (RCP-1..RCP-11) and AGENT_RULES.md

-- -----------------------------------------------------------------------------
-- 1. recipes table
-- Holds curated recipes written by the CaliPartner team.
-- Published recipes are readable by any authenticated user.
-- Drafts and write operations are strictly restricted to service_role (authoring scripts).
-- -----------------------------------------------------------------------------
create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) >= 1),
  description text,
  cuisine text not null check (length(trim(cuisine)) >= 1),
  diet_tags text[] not null default '{}',
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack', 'dessert', 'beverage')),
  prep_minutes integer not null default 0 check (prep_minutes >= 0),
  cook_minutes integer not null default 0 check (cook_minutes >= 0),
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  servings numeric(6,2) not null check (servings > 0),
  steps jsonb not null default '[]'::jsonb,
  tips jsonb not null default '[]'::jsonb,
  image_urls jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'published')),
  nutrition_per_serving jsonb not null check (
    nutrition_per_serving ? 'calories' and
    nutrition_per_serving ? 'protein' and
    nutrition_per_serving ? 'carbs' and
    nutrition_per_serving ? 'fat' and
    nutrition_per_serving ? 'fiber'
  ),
  nutrition_override_reason text,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_recipes_status
  on public.recipes (status) where deleted_at is null;

create index if not exists idx_recipes_cuisine
  on public.recipes (cuisine) where deleted_at is null;

create index if not exists idx_recipes_meal_type
  on public.recipes (meal_type) where deleted_at is null;

create index if not exists idx_recipes_updated_at
  on public.recipes (updated_at desc);

alter table public.recipes enable row level security;

-- Authenticated users can only read published, non-deleted recipes.
-- Drafts are invisible to regular users.
create policy recipes_select_published on public.recipes
  for select to authenticated
  using (status = 'published' and deleted_at is null);

-- Authenticated users CANNOT insert, update, or delete recipes.
-- Writes are performed only via service_role in import/authoring pipelines.

-- -----------------------------------------------------------------------------
-- 2. recipe_ingredients table
-- Links each recipe to catalog foods with quantity, unit, and notes.
-- -----------------------------------------------------------------------------
create table if not exists public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  food_id uuid not null references public.foods(id) on delete restrict,
  quantity numeric(8,2) not null check (quantity > 0),
  unit text not null check (length(trim(unit)) >= 1),
  note text,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_recipe_ingredients_recipe
  on public.recipe_ingredients (recipe_id);

create index if not exists idx_recipe_ingredients_food
  on public.recipe_ingredients (food_id);

alter table public.recipe_ingredients enable row level security;

-- Authenticated users can read ingredients only for published, non-deleted recipes.
create policy recipe_ingredients_select_published on public.recipe_ingredients
  for select to authenticated
  using (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_ingredients.recipe_id
        and r.status = 'published'
        and r.deleted_at is null
    )
  );

-- Authenticated users CANNOT insert, update, or delete recipe ingredients.

-- -----------------------------------------------------------------------------
-- 3. recipe_favorites table
-- Stores user's bookmarked / favorited recipes.
-- Strictly owner-managed: user can only see, insert, and delete their own.
-- -----------------------------------------------------------------------------
create table if not exists public.recipe_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, recipe_id)
);

create index if not exists idx_recipe_favorites_user
  on public.recipe_favorites (user_id);

alter table public.recipe_favorites enable row level security;

create policy recipe_favorites_select_own on public.recipe_favorites
  for select to authenticated
  using (auth.uid() = user_id);

create policy recipe_favorites_insert_own on public.recipe_favorites
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy recipe_favorites_delete_own on public.recipe_favorites
  for delete to authenticated
  using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 4. recipe_reports table
-- Allows users to report an error or issue in a recipe (RCP-9).
-- Strictly owner-submitted: users can only insert their own reports and view them.
-- -----------------------------------------------------------------------------
create table if not exists public.recipe_reports (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (length(trim(reason)) >= 3),
  details text,
  status text not null default 'open' check (status in ('open', 'reviewed', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_recipe_reports_recipe
  on public.recipe_reports (recipe_id);

create index if not exists idx_recipe_reports_user
  on public.recipe_reports (user_id);

alter table public.recipe_reports enable row level security;

create policy recipe_reports_select_own on public.recipe_reports
  for select to authenticated
  using (auth.uid() = user_id);

create policy recipe_reports_insert_own on public.recipe_reports
  for insert to authenticated
  with check (auth.uid() = user_id);
