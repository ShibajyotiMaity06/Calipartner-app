-- Phase 5: Rooms, Room Members, Privacy Settings, Requests, Entitlements Stub,
-- Shared Meals, Nudges, Reactions, Daily Summaries & Privacy-Enforcing Read API.
-- Complies with PRD 6.7 (USR-5..8), 6.8, 6.11, 6.13, 7.1, 7.6 and AGENT_RULES.md.

-- -----------------------------------------------------------------------------
-- 1. ENTITLEMENTS & DEVICE TRIALS (PRD 7.1)
-- -----------------------------------------------------------------------------
create table if not exists public.entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('monthly', 'three_month', 'annual', 'free')),
  source text not null default 'none' check (source in ('apple', 'google', 'dodo', 'none')),
  status text not null default 'free' check (status in ('trial', 'paid', 'grace', 'free')),
  trial_started_at timestamptz,
  period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.entitlements enable row level security;

create policy entitlements_select_own on public.entitlements
  for select to authenticated
  using (auth.uid() = user_id);

create policy entitlements_no_client_write on public.entitlements
  for all to anon, authenticated
  using (false)
  with check (false);

create table if not exists public.device_trials (
  device_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  trial_started_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.device_trials enable row level security;

create policy device_trials_no_client on public.device_trials
  for all to anon, authenticated
  using (false)
  with check (false);

-- Helper: has_premium(uid) -> true if paid or grace and not expired
create or replace function public.has_premium(p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.entitlements e
    where e.user_id = p_user_id
      and e.status in ('paid', 'grace')
      and (e.period_end is null or e.period_end > now())
  );
$$;

-- Helper: has_room_access(uid) -> true if premium OR active 3-day trial
create or replace function public.has_room_access(p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.entitlements e
    where e.user_id = p_user_id
      and (
        (e.status in ('paid', 'grace') and (e.period_end is null or e.period_end > now()))
        or
        (e.status = 'trial' and e.period_end is not null and e.period_end > now())
      )
  );
$$;

-- Helper: start_trial_if_eligible(uid, device_hash)
create or replace function public.start_trial_if_eligible(
  p_user_id uuid,
  p_device_hash text default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ent record;
  v_dev_user uuid;
begin
  if p_user_id is null then
    return false;
  end if;

  select * into v_ent
  from public.entitlements
  where user_id = p_user_id
  for update;

  -- If user already has active room access, no need to start trial
  if found and (
    (v_ent.status in ('paid', 'grace') and (v_ent.period_end is null or v_ent.period_end > now()))
    or
    (v_ent.status = 'trial' and v_ent.period_end is not null and v_ent.period_end > now())
  ) then
    return true;
  end if;

  -- PRD 7.1: One trial per account (trial_started_at not null means trial was already used)
  if found and v_ent.trial_started_at is not null then
    return false;
  end if;

  -- PRD 7.1 & 6.1 AUTH-7: One trial per hashed device id
  if p_device_hash is not null and length(trim(p_device_hash)) > 0 then
    select user_id into v_dev_user
    from public.device_trials
    where device_hash = p_device_hash;

    if found and v_dev_user <> p_user_id then
      return false; -- Device already claimed trial by another account
    end if;
  end if;

  -- Grant 3-day trial
  insert into public.entitlements (
    user_id, plan, source, status, trial_started_at, period_end, updated_at
  ) values (
    p_user_id, 'free', 'none', 'trial', now(), now() + interval '3 days', now()
  )
  on conflict (user_id) do update set
    status = 'trial',
    trial_started_at = coalesce(public.entitlements.trial_started_at, now()),
    period_end = now() + interval '3 days',
    updated_at = now();

  if p_device_hash is not null and length(trim(p_device_hash)) > 0 then
    insert into public.device_trials (device_hash, user_id, trial_started_at)
    values (p_device_hash, p_user_id, now())
    on conflict (device_hash) do nothing;
  end if;

  return true;
end;
$$;

-- Dev-only helper: grant premium for testing
create or replace function public.dev_grant_premium(
  p_user_id uuid,
  p_days integer default 30
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.entitlements (
    user_id, plan, source, status, period_end, updated_at
  ) values (
    p_user_id, 'monthly', 'apple', 'paid', now() + (p_days || ' days')::interval, now()
  )
  on conflict (user_id) do update set
    plan = 'monthly',
    source = 'apple',
    status = 'paid',
    period_end = now() + (p_days || ' days')::interval,
    updated_at = now();
end;
$$;

-- Dev-only helper: revoke premium for testing
create or replace function public.dev_revoke_premium(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.entitlements
  set status = 'free',
      plan = 'free',
      period_end = now() - interval '1 second',
      updated_at = now()
  where user_id = p_user_id;
end;
$$;

-- Dev-only helper: expire trial immediately
create or replace function public.dev_expire_trial(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.entitlements
  set status = 'free',
      period_end = now() - interval '1 second',
      updated_at = now()
  where user_id = p_user_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. PRIVACY SETTINGS HELPER (PRD 6.13 DEFAULTS)
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
    'share_fasting', false
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
begin
  if p_settings is null then
    return v_def;
  end if;

  v_meals := coalesce(p_settings->>'share_meals', 'never');
  if v_meals not in ('never', 'per_meal', 'always') then
    v_meals := 'never';
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
    'share_fasting', coalesce((p_settings->>'share_fasting')::boolean, (v_def->>'share_fasting')::boolean)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. ROOMS & ROOM_MEMBERS TABLES & RLS
-- -----------------------------------------------------------------------------
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) >= 1 and length(name) <= 100),
  code text unique not null check (code ~ '^[A-Z0-9]{6,8}$'),
  state text not null default 'dormant' check (state in ('active', 'dormant', 'archived')),
  who_can_invite text not null default 'host_only' check (who_can_invite in ('host_only', 'any_member')),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  dormant_at timestamptz,
  archived_at timestamptz
);

create index if not exists idx_rooms_code on public.rooms (code);
create index if not exists idx_rooms_state on public.rooms (state);

alter table public.rooms enable row level security;

create table if not exists public.room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('host', 'member')),
  status text not null default 'active' check (status in ('active', 'locked', 'paused', 'left')),
  privacy_settings jsonb not null default public.default_privacy_settings(),
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_room_members unique (room_id, user_id)
);

create index if not exists idx_room_members_user on public.room_members (user_id, status);
create index if not exists idx_room_members_room on public.room_members (room_id, status);

alter table public.room_members enable row level security;

-- Helper function: evaluate room membership safely without triggering RLS recursion on room_members
create or replace function public.is_room_member(p_room_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select exists (
    select 1 from public.room_members
    where room_id = p_room_id
      and user_id = p_user_id
      and status in ('active', 'locked', 'paused')
  );
$$;

-- Room RLS policies:
-- Only active/locked/paused members can view room meta; non-members and left members cannot.
create policy rooms_select on public.rooms
  for select to authenticated
  using (
    public.is_room_member(id, auth.uid())
  );

create policy rooms_no_client_write on public.rooms
  for all to anon, authenticated
  using (false)
  with check (false);

-- Room members RLS:
-- Current members in room can select members of their room. Non-members and left members cannot.
create policy room_members_select on public.room_members
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_room_member(room_id, auth.uid())
  );

create policy room_members_no_client_write on public.room_members
  for all to anon, authenticated
  using (false)
  with check (false);

-- -----------------------------------------------------------------------------
-- 4. ROOM REQUESTS TABLE & RLS (PRD 6.7 USR-5..8)
-- -----------------------------------------------------------------------------
create table if not exists public.room_requests (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid references auth.users(id) on delete cascade,
  type text not null check (type in ('invitation', 'join_request')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'expired', 'cancelled')),
  expires_at timestamptz not null default (now() + interval '14 days'),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

create index if not exists idx_room_requests_sender on public.room_requests (sender_id, status);
create index if not exists idx_room_requests_recipient on public.room_requests (recipient_id, status);
create index if not exists idx_room_requests_room on public.room_requests (room_id, status);

alter table public.room_requests enable row level security;

create policy room_requests_select on public.room_requests
  for select to authenticated
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

create policy room_requests_no_client_write on public.room_requests
  for all to anon, authenticated
  using (false)
  with check (false);

-- -----------------------------------------------------------------------------
-- 5. REPORTS TABLE & RLS (PRD 6.7 USR-9, 6.8 ROOM-8)
-- -----------------------------------------------------------------------------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('user', 'room', 'message', 'profile', 'meal')),
  target_id text not null,
  reason text not null check (length(trim(reason)) >= 1),
  details text,
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now()
);

alter table public.reports enable row level security;

create policy reports_select_own on public.reports
  for select to authenticated
  using (auth.uid() = reporter_id);

create policy reports_insert_own on public.reports
  for insert to authenticated
  with check (auth.uid() = reporter_id);

-- -----------------------------------------------------------------------------
-- 6. SHARED MEALS, EVENTS, REACTIONS & NUDGES
-- -----------------------------------------------------------------------------
create table if not exists public.shared_meals (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  creator_id uuid not null references auth.users(id) on delete cascade,
  food_id uuid references public.foods(id) on delete set null,
  food_name text not null check (length(trim(food_name)) >= 1),
  meal_section text not null check (meal_section in ('breakfast', 'lunch', 'dinner', 'snacks', 'extra')),
  original_quantity numeric(8,2) not null check (original_quantity > 0),
  unit text not null,
  calories numeric(7,2) not null check (calories >= 0),
  protein numeric(7,2) not null check (protein >= 0),
  carbs numeric(7,2) not null check (carbs >= 0),
  fat numeric(7,2) not null check (fat >= 0),
  fiber numeric(7,2) default 0,
  sugar numeric(7,2) default 0,
  sodium_mg numeric(7,2) default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.shared_meals enable row level security;

create policy shared_meals_select on public.shared_meals
  for select to authenticated
  using (
    public.is_room_member(room_id, auth.uid())
  );

create policy shared_meals_no_client_write on public.shared_meals
  for all to anon, authenticated
  using (false)
  with check (false);

create table if not exists public.shared_meal_participants (
  id uuid primary key default gen_random_uuid(),
  shared_meal_id uuid not null references public.shared_meals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  responded_quantity numeric(8,2),
  created_diary_entry_id uuid references public.food_entries(id) on delete set null,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint uq_shared_meal_participant unique (shared_meal_id, user_id)
);

alter table public.shared_meal_participants enable row level security;

create policy shared_meal_participants_select on public.shared_meal_participants
  for select to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.shared_meals sm
      where sm.id = shared_meal_participants.shared_meal_id
        and public.is_room_member(sm.room_id, auth.uid())
    )
  );

create policy shared_meal_participants_no_client_write on public.shared_meal_participants
  for all to anon, authenticated
  using (false)
  with check (false);

create table if not exists public.room_events (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('meal_logged', 'workout_finished', 'goal_reached', 'streak_milestone', 'member_joined', 'member_left')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_room_events_room_created on public.room_events (room_id, created_at desc);

alter table public.room_events enable row level security;

create policy room_events_select on public.room_events
  for select to authenticated
  using (
    public.is_room_member(room_id, auth.uid())
  );

create policy room_events_no_client_write on public.room_events
  for all to anon, authenticated
  using (false)
  with check (false);

create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid references public.room_events(id) on delete cascade,
  reaction text not null check (reaction in ('fire', 'clap', 'muscle', 'heart', 'party')),
  created_at timestamptz not null default now(),
  constraint uq_reactions unique (room_id, user_id, event_id, reaction)
);

alter table public.reactions enable row level security;

create policy reactions_select on public.reactions
  for select to authenticated
  using (
    public.is_room_member(room_id, auth.uid())
  );

create policy reactions_no_client_write on public.reactions
  for all to anon, authenticated
  using (false)
  with check (false);

create table if not exists public.nudges (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  message text not null check (length(trim(message)) >= 1),
  created_at timestamptz not null default now()
);

create index if not exists idx_nudges_recipient_day
  on public.nudges (room_id, sender_id, recipient_id, created_at);

alter table public.nudges enable row level security;

create policy nudges_select on public.nudges
  for select to authenticated
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

create policy nudges_no_client_write on public.nudges
  for all to anon, authenticated
  using (false)
  with check (false);

-- -----------------------------------------------------------------------------
-- 7. DAILY SUMMARIES TABLE & TRIGGERS (PRD 6.15, 7.3)
-- -----------------------------------------------------------------------------
create table if not exists public.daily_summaries (
  user_id uuid not null references auth.users(id) on delete cascade,
  local_date text not null check (length(local_date) = 10),
  calories numeric(7,2) not null default 0,
  protein numeric(7,2) not null default 0,
  carbs numeric(7,2) not null default 0,
  fat numeric(7,2) not null default 0,
  steps integer not null default 0,
  water_ml integer not null default 0,
  workout_minutes integer not null default 0,
  weight_kg numeric(5,2),
  logged_day boolean not null default false,
  goal_day boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, local_date)
);

create index if not exists idx_daily_summaries_user_date
  on public.daily_summaries (user_id, local_date);

alter table public.daily_summaries enable row level security;

-- STRICT: Room members CANNOT directly select each other's daily_summaries!
-- Only owner can read own summary directly; room snapshot API enforces privacy.
create policy daily_summaries_select_own on public.daily_summaries
  for select to authenticated
  using (auth.uid() = user_id);

create policy daily_summaries_no_client_write on public.daily_summaries
  for all to anon, authenticated
  using (false)
  with check (false);

-- Function: recompute_daily_summary(user_id, local_date)
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

  -- 4. Weight
  select weight_kg
  into v_weight_kg
  from public.weight_logs
  where user_id = p_user_id
    and local_date = p_local_date
    and deleted_at is null
  order by logged_at desc
  limit 1;

  -- 5. Targets from goal_profiles
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
  -- Cutting: 85% to 105%
  -- Bulking: 95% to 115%
  -- Maintain: 90% to 110%
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
    0, v_weight_kg, v_logged_day, v_goal_day, now()
  )
  on conflict (user_id, local_date) do update set
    calories = excluded.calories,
    protein = excluded.protein,
    carbs = excluded.carbs,
    fat = excluded.fat,
    steps = excluded.steps,
    water_ml = excluded.water_ml,
    weight_kg = excluded.weight_kg,
    logged_day = excluded.logged_day,
    goal_day = excluded.goal_day,
    updated_at = now();
end;
$$;

-- Triggers on underlying log tables:
create or replace function public.tr_food_entries_sync_summary()
returns trigger
language plpgsql
security definer
as $$
begin
  if TG_OP = 'DELETE' then
    perform public.recompute_daily_summary(OLD.user_id, OLD.local_date::text);
    return OLD;
  else
    perform public.recompute_daily_summary(NEW.user_id, NEW.local_date::text);
    if TG_OP = 'UPDATE' and OLD.local_date <> NEW.local_date then
      perform public.recompute_daily_summary(OLD.user_id, OLD.local_date::text);
    end if;
    return NEW;
  end if;
end;
$$;

drop trigger if exists tr_food_entries_sync_daily_summary on public.food_entries;
create trigger tr_food_entries_sync_daily_summary
after insert or update or delete on public.food_entries
for each row execute function public.tr_food_entries_sync_summary();

create or replace function public.tr_water_logs_sync_summary()
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

drop trigger if exists tr_water_logs_sync_daily_summary on public.water_logs;
create trigger tr_water_logs_sync_daily_summary
after insert or update or delete on public.water_logs
for each row execute function public.tr_water_logs_sync_summary();

create or replace function public.tr_activity_days_sync_summary()
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

drop trigger if exists tr_activity_days_sync_daily_summary on public.activity_days;
create trigger tr_activity_days_sync_daily_summary
after insert or update or delete on public.activity_days
for each row execute function public.tr_activity_days_sync_summary();

create or replace function public.tr_weight_logs_sync_summary()
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

drop trigger if exists tr_weight_logs_sync_daily_summary on public.weight_logs;
create trigger tr_weight_logs_sync_daily_summary
after insert or update or delete on public.weight_logs
for each row execute function public.tr_weight_logs_sync_summary();

-- -----------------------------------------------------------------------------
-- 8. ROOM STATE MACHINE (PRD 6.8, 7.6)
-- -----------------------------------------------------------------------------
-- State machine: Active / Dormant (fewer than 2 members with access) / Archived
create or replace function public.update_room_state(p_room_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_room record;
  v_access_count integer := 0;
  v_new_state text;
  v_m record;
begin
  select * into v_room
  from public.rooms
  where id = p_room_id
  for update;

  if not found then
    return null;
  end if;

  if v_room.state = 'archived' then
    return 'archived';
  end if;

  -- Update member statuses: lapsed members become locked; renewed members become active
  for v_m in select * from public.room_members where room_id = p_room_id and status in ('active', 'locked') loop
    if public.has_room_access(v_m.user_id) then
      if v_m.status = 'locked' then
        update public.room_members set status = 'active', updated_at = now() where id = v_m.id;
      end if;
    else
      if v_m.status = 'active' then
        update public.room_members set status = 'locked', updated_at = now() where id = v_m.id;
      end if;
    end if;
  end loop;

  -- Count active members with access
  select count(*) into v_access_count
  from public.room_members m
  where m.room_id = p_room_id
    and m.status = 'active'
    and public.has_room_access(m.user_id);

  if v_access_count >= 2 then
    v_new_state := 'active';
    update public.rooms
    set state = 'active', dormant_at = null, updated_at = now()
    where id = p_room_id;
  else
    -- PRD 7.6: Dormant for more than 30 days -> Archived
    if v_room.dormant_at is not null and v_room.dormant_at < (now() - interval '30 days') then
      v_new_state := 'archived';
      update public.rooms
      set state = 'archived', archived_at = now(), updated_at = now()
      where id = p_room_id;
    else
      v_new_state := 'dormant';
      update public.rooms
      set state = 'dormant',
          dormant_at = coalesce(dormant_at, now()),
          updated_at = now()
      where id = p_room_id;
    end if;
  end if;

  return v_new_state;
end;
$$;

-- -----------------------------------------------------------------------------
-- 9. CORE ROOM SQL FUNCTIONS (SECURITY DEFINER)
-- -----------------------------------------------------------------------------

-- Helper: generate random room code
create or replace function public.generate_room_code()
returns text
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_chars text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_code text;
  v_exists boolean;
  v_i integer;
begin
  loop
    v_code := '';
    for v_i in 1..6 loop
      v_code := v_code || substr(v_chars, floor(random() * length(v_chars) + 1)::integer, 1);
    end loop;

    select exists(select 1 from public.rooms where code = v_code) into v_exists;
    if not v_exists then
      return v_code;
    end if;
  end loop;
end;
$$;

-- 1. create_room
create or replace function public.create_room(
  p_name text,
  p_device_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_clean_name text;
  v_code text;
  v_room_id uuid;
  v_user_room_count integer;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  v_clean_name := trim(p_name);
  if length(v_clean_name) < 1 or length(v_clean_name) > 100 then
    raise exception 'INVALID_ROOM_NAME' using errcode = 'P0001';
  end if;

  -- Entitlement check: start trial if eligible
  if not public.has_room_access(v_uid) then
    if not public.start_trial_if_eligible(v_uid, p_device_hash) then
      raise exception 'NO_ROOM_ACCESS' using errcode = 'P0001';
    end if;
  end if;

  -- Room limit: 3 rooms per user (PRD 6.8 ROOM-5)
  select count(*) into v_user_room_count
  from public.room_members
  where user_id = v_uid and status in ('active', 'locked', 'paused');

  if v_user_room_count >= 3 then
    raise exception 'MAX_ROOMS_REACHED' using errcode = 'P0001';
  end if;

  v_code := public.generate_room_code();

  insert into public.rooms (name, code, state, who_can_invite, created_by)
  values (v_clean_name, v_code, 'dormant', 'host_only', v_uid)
  returning id into v_room_id;

  insert into public.room_members (room_id, user_id, role, status, privacy_settings)
  values (v_room_id, v_uid, 'host', 'active', public.default_privacy_settings());

  insert into public.room_events (room_id, user_id, event_type, payload)
  values (v_room_id, v_uid, 'member_joined', jsonb_build_object('action', 'created_room'));

  perform public.update_room_state(v_room_id);

  return jsonb_build_object(
    'room_id', v_room_id,
    'name', v_clean_name,
    'code', v_code,
    'role', 'host',
    'state', 'dormant'
  );
end;
$$;

-- 2. send_room_invitation(room_id, username)
create or replace function public.send_room_invitation(
  p_room_id uuid,
  p_username text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_caller_member record;
  v_room record;
  v_recipient record;
  v_member_count integer;
  v_pending_count integer;
  v_req_id uuid;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  if not public.has_room_access(v_uid) then
    raise exception 'NO_ROOM_ACCESS' using errcode = 'P0001';
  end if;

  select * into v_caller_member
  from public.room_members
  where room_id = p_room_id and user_id = v_uid and status = 'active';

  if not found then
    raise exception 'NOT_ROOM_MEMBER' using errcode = 'P0001';
  end if;

  select * into v_room from public.rooms where id = p_room_id and state <> 'archived';
  if not found then
    raise exception 'ROOM_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Setting: who can invite
  if v_room.who_can_invite = 'host_only' and v_caller_member.role <> 'host' then
    raise exception 'HOST_ONLY_INVITE' using errcode = 'P0001';
  end if;

  -- Limit: 10 members per room (PRD 6.8 ROOM-1)
  select count(*) into v_member_count
  from public.room_members
  where room_id = p_room_id and status in ('active', 'locked', 'paused');

  if v_member_count >= 10 then
    raise exception 'ROOM_FULL' using errcode = 'P0001';
  end if;

  -- Recipient lookup (PRD 6.7 USR-1..4)
  select id, discoverable into v_recipient
  from public.profiles
  where username = lower(trim(p_username))::citext;

  if not found then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_recipient.id = v_uid then
    raise exception 'CANNOT_INVITE_SELF' using errcode = 'P0001';
  end if;

  -- Discoverability check: if undiscoverable, username invite is blocked
  if not v_recipient.discoverable then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Block check (PRD 6.7 USR-9)
  if exists (
    select 1 from public.blocks
    where (blocker_id = v_uid and blocked_id = v_recipient.id)
       or (blocker_id = v_recipient.id and blocked_id = v_uid)
  ) then
    raise exception 'USER_BLOCKED' using errcode = 'P0001';
  end if;

  -- Already member check
  if exists (
    select 1 from public.room_members
    where room_id = p_room_id and user_id = v_recipient.id and status in ('active', 'locked', 'paused')
  ) then
    raise exception 'ALREADY_MEMBER' using errcode = 'P0001';
  end if;

  -- Hourly rate limit: 10 requests per hour (PRD 6.7 USR-8)
  if not public.check_rate_limit('req_hour:' || v_uid::text, 10, 3600) then
    raise exception 'HOURLY_REQUEST_LIMIT_REACHED' using errcode = 'P0001';
  end if;

  -- Pending limit: 20 pending requests per user (PRD 6.7 USR-8)
  select count(*) into v_pending_count
  from public.room_requests
  where (sender_id = v_uid or recipient_id = v_uid)
    and status = 'pending' and expires_at > now();

  if v_pending_count >= 20 then
    raise exception 'REQUEST_LIMIT_REACHED' using errcode = 'P0001';
  end if;

  insert into public.room_requests (
    room_id, sender_id, recipient_id, type, status, expires_at
  ) values (
    p_room_id, v_uid, v_recipient.id, 'invitation', 'pending', now() + interval '14 days'
  )
  returning id into v_req_id;

  return jsonb_build_object(
    'request_id', v_req_id,
    'room_id', p_room_id,
    'recipient_id', v_recipient.id,
    'status', 'pending'
  );
end;
$$;

-- 3. request_to_join(room_code_or_username, device_hash)
create or replace function public.request_to_join(
  p_target text,
  p_device_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_clean text := upper(trim(p_target));
  v_room record;
  v_host_id uuid;
  v_user_room_count integer;
  v_pending_count integer;
  v_req_id uuid;
  v_profile record;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  -- Entitlement check: start trial if eligible
  if not public.has_room_access(v_uid) then
    if not public.start_trial_if_eligible(v_uid, p_device_hash) then
      raise exception 'NO_ROOM_ACCESS' using errcode = 'P0001';
    end if;
  end if;

  -- User room limit (3 max)
  select count(*) into v_user_room_count
  from public.room_members
  where user_id = v_uid and status in ('active', 'locked', 'paused');

  if v_user_room_count >= 3 then
    raise exception 'MAX_ROOMS_REACHED' using errcode = 'P0001';
  end if;

  -- Hourly rate limit
  if not public.check_rate_limit('req_hour:' || v_uid::text, 10, 3600) then
    raise exception 'HOURLY_REQUEST_LIMIT_REACHED' using errcode = 'P0001';
  end if;

  -- Pending limit
  select count(*) into v_pending_count
  from public.room_requests
  where (sender_id = v_uid or recipient_id = v_uid)
    and status = 'pending' and expires_at > now();

  if v_pending_count >= 20 then
    raise exception 'REQUEST_LIMIT_REACHED' using errcode = 'P0001';
  end if;

  -- Try match by room code first
  select * into v_room from public.rooms where code = v_clean and state <> 'archived';

  -- If not matched, try match by username
  if not found then
    select id, discoverable into v_profile
    from public.profiles
    where username = lower(trim(p_target))::citext;

    if found then
      if not v_profile.discoverable then
        raise exception 'USER_NOT_FOUND' using errcode = 'P0001';
      end if;

      if exists (
        select 1 from public.blocks
        where (blocker_id = v_uid and blocked_id = v_profile.id)
           or (blocker_id = v_profile.id and blocked_id = v_uid)
      ) then
        raise exception 'USER_BLOCKED' using errcode = 'P0001';
      end if;

      -- Find room where that target user is host or member
      select r.* into v_room
      from public.rooms r
      join public.room_members rm on rm.room_id = r.id
      where rm.user_id = v_profile.id and rm.status in ('active', 'locked') and r.state <> 'archived'
      order by (case when rm.role = 'host' then 0 else 1 end), r.created_at desc
      limit 1;
    end if;
  end if;

  if v_room.id is null then
    raise exception 'ROOM_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Find host
  select user_id into v_host_id
  from public.room_members
  where room_id = v_room.id and role = 'host' and status in ('active', 'locked')
  limit 1;

  if v_host_id is null then
    v_host_id := v_room.created_by;
  end if;

  -- Check block with host
  if exists (
    select 1 from public.blocks
    where (blocker_id = v_uid and blocked_id = v_host_id)
       or (blocker_id = v_host_id and blocked_id = v_uid)
  ) then
    raise exception 'USER_BLOCKED' using errcode = 'P0001';
  end if;

  -- Already member check
  if exists (
    select 1 from public.room_members
    where room_id = v_room.id and user_id = v_uid and status in ('active', 'locked', 'paused')
  ) then
    raise exception 'ALREADY_MEMBER' using errcode = 'P0001';
  end if;

  insert into public.room_requests (
    room_id, sender_id, recipient_id, type, status, expires_at
  ) values (
    v_room.id, v_uid, v_host_id, 'join_request', 'pending', now() + interval '14 days'
  )
  returning id into v_req_id;

  return jsonb_build_object(
    'request_id', v_req_id,
    'room_id', v_room.id,
    'status', 'pending'
  );
end;
$$;

-- 4. respond_to_request(request_id, accept, device_hash)
create or replace function public.respond_to_request(
  p_request_id uuid,
  p_accept boolean,
  p_device_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_req record;
  v_joining_user uuid;
  v_member_count integer;
  v_user_room_count integer;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  select * into v_req
  from public.room_requests
  where id = p_request_id and status = 'pending'
  for update;

  if not found then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_req.expires_at < now() then
    update public.room_requests set status = 'expired', responded_at = now() where id = p_request_id;
    raise exception 'REQUEST_EXPIRED' using errcode = 'P0001';
  end if;

  -- Permission check
  if v_req.type = 'invitation' then
    if v_req.recipient_id <> v_uid then
      raise exception 'NOT_AUTHORIZED' using errcode = 'P0001';
    end if;
    v_joining_user := v_uid;
  elsif v_req.type = 'join_request' then
    if v_req.recipient_id <> v_uid and not exists (
      select 1 from public.room_members where room_id = v_req.room_id and user_id = v_uid and role = 'host'
    ) then
      raise exception 'NOT_AUTHORIZED' using errcode = 'P0001';
    end if;
    v_joining_user := v_req.sender_id;
  end if;

  if not p_accept then
    update public.room_requests
    set status = 'declined', responded_at = now()
    where id = p_request_id;
    return jsonb_build_object('status', 'declined');
  end if;

  -- PRD 7.1 & Prompt 5: invitation acceptance by a user without access triggers the paywall flow
  -- Check joining user access / eligibility
  if not public.has_room_access(v_joining_user) then
    if not public.start_trial_if_eligible(v_joining_user, p_device_hash) then
      raise exception 'NO_ROOM_ACCESS' using errcode = 'P0001';
    end if;
  end if;

  -- Limits check
  select count(*) into v_member_count
  from public.room_members
  where room_id = v_req.room_id and status in ('active', 'locked', 'paused');

  if v_member_count >= 10 then
    raise exception 'ROOM_FULL' using errcode = 'P0001';
  end if;

  select count(*) into v_user_room_count
  from public.room_members
  where user_id = v_joining_user and status in ('active', 'locked', 'paused');

  if v_user_room_count >= 3 then
    raise exception 'MAX_ROOMS_REACHED' using errcode = 'P0001';
  end if;

  -- Add to room
  insert into public.room_members (
    room_id, user_id, role, status, privacy_settings, joined_at, updated_at
  ) values (
    v_req.room_id, v_joining_user, 'member', 'active', public.default_privacy_settings(), now(), now()
  )
  on conflict (room_id, user_id) do update set
    status = 'active',
    role = 'member',
    updated_at = now();

  update public.room_requests
  set status = 'accepted', responded_at = now()
  where id = p_request_id;

  insert into public.room_events (room_id, user_id, event_type, payload)
  values (v_req.room_id, v_joining_user, 'member_joined', '{}'::jsonb);

  perform public.update_room_state(v_req.room_id);

  return jsonb_build_object(
    'status', 'accepted',
    'room_id', v_req.room_id,
    'user_id', v_joining_user
  );
end;
$$;

-- 5. cancel_request(request_id)
create or replace function public.cancel_request(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  update public.room_requests
  set status = 'cancelled', responded_at = now()
  where id = p_request_id and sender_id = v_uid and status = 'pending';

  if not found then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0001';
  end if;

  return jsonb_build_object('status', 'cancelled');
end;
$$;

-- 6. join_by_code(code, device_hash)
create or replace function public.join_by_code(
  p_code text,
  p_device_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_room record;
  v_member_count integer;
  v_user_room_count integer;
  v_host_id uuid;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  select * into v_room
  from public.rooms
  where code = upper(trim(p_code)) and state <> 'archived';

  if not found then
    raise exception 'ROOM_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Entitlement check: start trial if eligible
  if not public.has_room_access(v_uid) then
    if not public.start_trial_if_eligible(v_uid, p_device_hash) then
      raise exception 'NO_ROOM_ACCESS' using errcode = 'P0001';
    end if;
  end if;

  -- Host block check
  select user_id into v_host_id
  from public.room_members
  where room_id = v_room.id and role = 'host' and status in ('active', 'locked')
  limit 1;

  if v_host_id is not null and exists (
    select 1 from public.blocks
    where (blocker_id = v_uid and blocked_id = v_host_id)
       or (blocker_id = v_host_id and blocked_id = v_uid)
  ) then
    raise exception 'USER_BLOCKED' using errcode = 'P0001';
  end if;

  -- Limit checks
  select count(*) into v_member_count
  from public.room_members
  where room_id = v_room.id and status in ('active', 'locked', 'paused');

  if v_member_count >= 10 then
    raise exception 'ROOM_FULL' using errcode = 'P0001';
  end if;

  select count(*) into v_user_room_count
  from public.room_members
  where user_id = v_uid and status in ('active', 'locked', 'paused');

  if v_user_room_count >= 3 then
    raise exception 'MAX_ROOMS_REACHED' using errcode = 'P0001';
  end if;

  -- Add member
  insert into public.room_members (
    room_id, user_id, role, status, privacy_settings, joined_at, updated_at
  ) values (
    v_room.id, v_uid, 'member', 'active', public.default_privacy_settings(), now(), now()
  )
  on conflict (room_id, user_id) do update set
    status = 'active',
    role = 'member',
    updated_at = now();

  insert into public.room_events (room_id, user_id, event_type, payload)
  values (v_room.id, v_uid, 'member_joined', '{}'::jsonb);

  perform public.update_room_state(v_room.id);

  return jsonb_build_object(
    'status', 'joined',
    'room_id', v_room.id,
    'name', v_room.name
  );
end;
$$;

-- 7. leave_room(room_id)
create or replace function public.leave_room(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_member record;
  v_next_host record;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  select * into v_member
  from public.room_members
  where room_id = p_room_id and user_id = v_uid and status in ('active', 'locked', 'paused');

  if not found then
    raise exception 'NOT_ROOM_MEMBER' using errcode = 'P0001';
  end if;

  -- PRD 6.8 ROOM-4: If host leaves, hosting transfers to the longest-standing active member
  if v_member.role = 'host' then
    select * into v_next_host
    from public.room_members
    where room_id = p_room_id and user_id <> v_uid and status in ('active', 'locked', 'paused')
    order by joined_at asc
    limit 1;

    if found then
      update public.room_members
      set role = 'host', updated_at = now()
      where id = v_next_host.id;
    else
      -- No members left -> archive room
      update public.rooms
      set state = 'archived', archived_at = now(), updated_at = now()
      where id = p_room_id;
    end if;
  end if;

  update public.room_members
  set status = 'left', updated_at = now()
  where room_id = p_room_id and user_id = v_uid;

  insert into public.room_events (room_id, user_id, event_type, payload)
  values (p_room_id, v_uid, 'member_left', jsonb_build_object('reason', 'left'));

  perform public.update_room_state(p_room_id);

  return jsonb_build_object('status', 'left', 'room_id', p_room_id);
end;
$$;

-- 8. remove_member(room_id, target_user_id)
create or replace function public.remove_member(
  p_room_id uuid,
  p_target_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_caller record;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  select * into v_caller
  from public.room_members
  where room_id = p_room_id and user_id = v_uid and role = 'host' and status = 'active';

  if not found then
    raise exception 'NOT_AUTHORIZED' using errcode = 'P0001';
  end if;

  if p_target_user_id = v_uid then
    raise exception 'CANNOT_REMOVE_SELF' using errcode = 'P0001';
  end if;

  update public.room_members
  set status = 'left', updated_at = now()
  where room_id = p_room_id and user_id = p_target_user_id and status in ('active', 'locked', 'paused');

  if not found then
    raise exception 'NOT_ROOM_MEMBER' using errcode = 'P0001';
  end if;

  insert into public.room_events (room_id, user_id, event_type, payload)
  values (p_room_id, p_target_user_id, 'member_left', jsonb_build_object('reason', 'removed'));

  perform public.update_room_state(p_room_id);

  return jsonb_build_object('status', 'removed', 'user_id', p_target_user_id);
end;
$$;

-- 9. transfer_host(room_id, new_host_id)
create or replace function public.transfer_host(
  p_room_id uuid,
  p_new_host_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_caller record;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  select * into v_caller
  from public.room_members
  where room_id = p_room_id and user_id = v_uid and role = 'host' and status = 'active';

  if not found then
    raise exception 'NOT_AUTHORIZED' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.room_members
    where room_id = p_room_id and user_id = p_new_host_id and status in ('active', 'locked', 'paused')
  ) then
    raise exception 'NOT_ROOM_MEMBER' using errcode = 'P0001';
  end if;

  update public.room_members set role = 'member', updated_at = now()
  where room_id = p_room_id and user_id = v_uid;

  update public.room_members set role = 'host', updated_at = now()
  where room_id = p_room_id and user_id = p_new_host_id;

  return jsonb_build_object('status', 'transferred', 'new_host_id', p_new_host_id);
end;
$$;

-- 10. set_privacy(room_id, privacy_settings)
create or replace function public.set_privacy(
  p_room_id uuid,
  p_privacy_settings jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_sanitized jsonb;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.room_members
    where room_id = p_room_id and user_id = v_uid and status in ('active', 'locked', 'paused')
  ) then
    raise exception 'NOT_ROOM_MEMBER' using errcode = 'P0001';
  end if;

  v_sanitized := public.sanitize_privacy_settings(p_privacy_settings);

  update public.room_members
  set privacy_settings = v_sanitized, updated_at = now()
  where room_id = p_room_id and user_id = v_uid;

  return v_sanitized;
end;
$$;

-- 11. set_who_can_invite(room_id, who_can_invite)
create or replace function public.set_who_can_invite(
  p_room_id uuid,
  p_who_can_invite text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  if p_who_can_invite not in ('host_only', 'any_member') then
    raise exception 'INVALID_SETTING' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.room_members
    where room_id = p_room_id and user_id = v_uid and role = 'host' and status = 'active'
  ) then
    raise exception 'NOT_AUTHORIZED' using errcode = 'P0001';
  end if;

  update public.rooms
  set who_can_invite = p_who_can_invite, updated_at = now()
  where id = p_room_id;

  return jsonb_build_object('who_can_invite', p_who_can_invite);
end;
$$;

-- 12. block_user(target_user_id)
create or replace function public.block_user(p_target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  if p_target_user_id = v_uid then
    raise exception 'CANNOT_BLOCK_SELF' using errcode = 'P0001';
  end if;

  insert into public.blocks (blocker_id, blocked_id)
  values (v_uid, p_target_user_id)
  on conflict (blocker_id, blocked_id) do nothing;

  -- Automatically cancel/decline any pending requests between the two users
  update public.room_requests
  set status = 'cancelled', responded_at = now()
  where status = 'pending'
    and ((sender_id = v_uid and recipient_id = p_target_user_id)
      or (sender_id = p_target_user_id and recipient_id = v_uid));

  return jsonb_build_object('status', 'blocked', 'target_user_id', p_target_user_id);
end;
$$;

-- 13. report(target_type, target_id, reason, details)
create or replace function public.report(
  p_target_type text,
  p_target_id text,
  p_reason text,
  p_details text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_rep_id uuid;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  if p_target_type not in ('user', 'room', 'message', 'profile', 'meal') then
    raise exception 'INVALID_TARGET_TYPE' using errcode = 'P0001';
  end if;

  if length(trim(p_reason)) < 1 then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;

  insert into public.reports (reporter_id, target_type, target_id, reason, details)
  values (v_uid, p_target_type, p_target_id, trim(p_reason), p_details)
  returning id into v_rep_id;

  return jsonb_build_object('status', 'reported', 'report_id', v_rep_id);
end;
$$;

-- 14. nudge(room_id, recipient_id, message_template) (PRD 6.12 SOC-1: limit 2/recipient/day)
create or replace function public.nudge(
  p_room_id uuid,
  p_recipient_id uuid,
  p_message_template text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_room record;
  v_count integer;
  v_nudge_id uuid;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  if not public.has_room_access(v_uid) then
    raise exception 'NO_ROOM_ACCESS' using errcode = 'P0001';
  end if;

  select * into v_room from public.rooms where id = p_room_id;
  if not found or v_room.state = 'archived' then
    raise exception 'ROOM_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_room.state = 'dormant' then
    raise exception 'ROOM_DORMANT' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.room_members where room_id = p_room_id and user_id = v_uid and status = 'active'
  ) then
    raise exception 'NOT_ROOM_MEMBER' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.room_members where room_id = p_room_id and user_id = p_recipient_id and status in ('active', 'locked', 'paused')
  ) then
    raise exception 'RECIPIENT_NOT_MEMBER' using errcode = 'P0001';
  end if;

  -- Block check
  if exists (
    select 1 from public.blocks
    where (blocker_id = v_uid and blocked_id = p_recipient_id)
       or (blocker_id = p_recipient_id and blocked_id = v_uid)
  ) then
    raise exception 'USER_BLOCKED' using errcode = 'P0001';
  end if;

  -- Limit check: 2 nudges per recipient per day (PRD 6.12 SOC-1)
  select count(*) into v_count
  from public.nudges
  where room_id = p_room_id
    and sender_id = v_uid
    and recipient_id = p_recipient_id
    and created_at >= (now() - interval '24 hours');

  if v_count >= 2 then
    raise exception 'NUDGE_LIMIT_REACHED' using errcode = 'P0001';
  end if;

  insert into public.nudges (room_id, sender_id, recipient_id, message)
  values (p_room_id, v_uid, p_recipient_id, trim(p_message_template))
  returning id into v_nudge_id;

  return jsonb_build_object('status', 'sent', 'nudge_id', v_nudge_id);
end;
$$;

-- 15. react(room_id, event_id, reaction) (PRD 6.12 SOC-2: 5 fixed reactions)
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
  v_room record;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  if not public.has_room_access(v_uid) then
    raise exception 'NO_ROOM_ACCESS' using errcode = 'P0001';
  end if;

  select * into v_room from public.rooms where id = p_room_id;
  if not found or v_room.state = 'archived' then
    raise exception 'ROOM_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_room.state = 'dormant' then
    raise exception 'ROOM_DORMANT' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.room_members where room_id = p_room_id and user_id = v_uid and status = 'active'
  ) then
    raise exception 'NOT_ROOM_MEMBER' using errcode = 'P0001';
  end if;

  if p_reaction not in ('fire', 'clap', 'muscle', 'heart', 'party') then
    raise exception 'INVALID_REACTION' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.room_events where id = p_event_id and room_id = p_room_id
  ) then
    raise exception 'EVENT_NOT_FOUND' using errcode = 'P0001';
  end if;

  insert into public.reactions (room_id, user_id, event_id, reaction)
  values (p_room_id, v_uid, p_event_id, p_reaction)
  on conflict (room_id, user_id, event_id, reaction) do nothing;

  return jsonb_build_object('status', 'reacted', 'reaction', p_reaction);
end;
$$;

-- 16. tag_shared_meal(...) (PRD 6.11 SHR-1..2)
create or replace function public.tag_shared_meal(
  p_room_id uuid,
  p_food_id uuid,
  p_food_name text,
  p_meal_section text,
  p_quantity numeric,
  p_unit text,
  p_calories numeric,
  p_protein numeric,
  p_carbs numeric,
  p_fat numeric,
  p_fiber numeric default 0,
  p_sugar numeric default 0,
  p_sodium_mg numeric default 0,
  p_participant_ids uuid[] default '{}'::uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_room record;
  v_meal_id uuid;
  v_pid uuid;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  if not public.has_room_access(v_uid) then
    raise exception 'NO_ROOM_ACCESS' using errcode = 'P0001';
  end if;

  select * into v_room from public.rooms where id = p_room_id;
  if not found or v_room.state = 'archived' then
    raise exception 'ROOM_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_room.state = 'dormant' then
    raise exception 'ROOM_DORMANT' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.room_members where room_id = p_room_id and user_id = v_uid and status = 'active'
  ) then
    raise exception 'NOT_ROOM_MEMBER' using errcode = 'P0001';
  end if;

  insert into public.shared_meals (
    room_id, creator_id, food_id, food_name, meal_section, original_quantity,
    unit, calories, protein, carbs, fat, fiber, sugar, sodium_mg
  ) values (
    p_room_id, v_uid, p_food_id, trim(p_food_name), p_meal_section, p_quantity,
    trim(p_unit), p_calories, p_protein, p_carbs, p_fat, p_fiber, p_sugar, p_sodium_mg
  )
  returning id into v_meal_id;

  if p_participant_ids is not null then
    foreach v_pid in array p_participant_ids loop
      if v_pid <> v_uid and exists (
        select 1 from public.room_members where room_id = p_room_id and user_id = v_pid and status in ('active', 'locked', 'paused')
      ) then
        insert into public.shared_meal_participants (shared_meal_id, user_id, status)
        values (v_meal_id, v_pid, 'pending')
        on conflict (shared_meal_id, user_id) do nothing;
      end if;
    end loop;
  end if;

  return jsonb_build_object('status', 'created', 'shared_meal_id', v_meal_id);
end;
$$;

-- 17. respond_shared_meal(shared_meal_id, accept, quantity, meal_section) (PRD 6.11 SHR-3)
create or replace function public.respond_shared_meal(
  p_shared_meal_id uuid,
  p_accept boolean,
  p_quantity numeric default null,
  p_meal_section text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_participant record;
  v_meal record;
  v_qty numeric;
  v_ratio numeric;
  v_cal numeric(7,2);
  v_pro numeric(7,2);
  v_carb numeric(7,2);
  v_fat numeric(7,2);
  v_fib numeric(7,2);
  v_sug numeric(7,2);
  v_sod numeric(7,2);
  v_entry_id uuid;
  v_sec text;
  v_today text;
  v_tz text;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  select * into v_participant
  from public.shared_meal_participants
  where shared_meal_id = p_shared_meal_id and user_id = v_uid and status = 'pending'
  for update;

  if not found then
    raise exception 'PARTICIPANT_NOT_FOUND' using errcode = 'P0001';
  end if;

  select * into v_meal
  from public.shared_meals
  where id = p_shared_meal_id;

  if not p_accept then
    update public.shared_meal_participants
    set status = 'declined', responded_at = now()
    where id = v_participant.id;

    return jsonb_build_object('status', 'declined');
  end if;

  -- PRD 6.11 SHR-3: Accepting creates an independent entry in member's own diary
  v_qty := coalesce(p_quantity, v_meal.original_quantity);
  if v_qty <= 0 then
    v_qty := v_meal.original_quantity;
  end if;

  v_ratio := v_qty / v_meal.original_quantity;
  v_cal := round(v_meal.calories * v_ratio, 2);
  v_pro := round(v_meal.protein * v_ratio, 2);
  v_carb := round(v_meal.carbs * v_ratio, 2);
  v_fat := round(v_meal.fat * v_ratio, 2);
  v_fib := round(coalesce(v_meal.fiber, 0) * v_ratio, 2);
  v_sug := round(coalesce(v_meal.sugar, 0) * v_ratio, 2);
  v_sod := round(coalesce(v_meal.sodium_mg, 0) * v_ratio, 2);
  v_sec := coalesce(p_meal_section, v_meal.meal_section);

  select timezone into v_tz from public.profiles where id = v_uid;
  v_today := (now() at time zone coalesce(v_tz, 'UTC'))::date::text;

  v_entry_id := gen_random_uuid();

  insert into public.food_entries (
    id, user_id, food_id, meal_section, quantity, unit, calories, protein,
    carbs, fat, fiber, sugar, sodium_mg, food_name, brand_name,
    logged_at, local_date, source, shared_meal_id, updated_at
  ) values (
    v_entry_id, v_uid, v_meal.food_id, v_sec, v_qty, v_meal.unit,
    v_cal, v_pro, v_carb, v_fat, v_fib, v_sug, v_sod,
    v_meal.food_name, null, now(), v_today::date, 'copy', v_meal.id, now()
  );

  update public.shared_meal_participants
  set status = 'accepted',
      responded_quantity = v_qty,
      created_diary_entry_id = v_entry_id,
      responded_at = now()
  where id = v_participant.id;

  return jsonb_build_object(
    'status', 'accepted',
    'diary_entry_id', v_entry_id,
    'quantity', v_qty,
    'calories', v_cal
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 10. PRIVACY-ENFORCING READ API: get_room_snapshot(room_id) (PRD 6.9, 6.13)
-- -----------------------------------------------------------------------------
create or replace function public.get_room_snapshot(p_room_id uuid)
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
begin
  if v_caller_id is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  -- 1. Check caller membership in room
  select * into v_caller_member
  from public.room_members
  where room_id = p_room_id and user_id = v_caller_id;

  if not found or v_caller_member.status = 'left' then
    raise exception 'NOT_ROOM_MEMBER' using errcode = 'P0001';
  end if;

  -- 2. Check caller entitlement / status
  if not public.has_room_access(v_caller_id) then
    raise exception 'NO_ROOM_ACCESS' using errcode = 'P0001';
  end if;

  -- 3. Update room state (active / dormant / archived)
  perform public.update_room_state(p_room_id);

  select * into v_room
  from public.rooms
  where id = p_room_id;

  if v_room.state = 'archived' then
    raise exception 'ROOM_ARCHIVED' using errcode = 'P0001';
  end if;

  -- 4. Build member snapshot array
  for v_m in
    select rm.*
    from public.room_members rm
    where rm.room_id = p_room_id
      and rm.status in ('active', 'locked', 'paused')
    order by rm.joined_at asc
  loop
    select * into v_prof
    from public.profiles
    where id = v_m.user_id;

    v_today := (now() at time zone coalesce(v_prof.timezone, 'UTC'))::date::text;

    -- Fetch latest summary for today
    select * into v_sum
    from public.daily_summaries
    where user_id = v_m.user_id and local_date = v_today;

    -- Check meal checklist
    select
      exists(select 1 from public.food_entries where user_id = v_m.user_id and local_date::text = v_today and meal_section = 'breakfast' and deleted_at is null),
      exists(select 1 from public.food_entries where user_id = v_m.user_id and local_date::text = v_today and meal_section = 'lunch' and deleted_at is null),
      exists(select 1 from public.food_entries where user_id = v_m.user_id and local_date::text = v_today and meal_section = 'dinner' and deleted_at is null),
      exists(select 1 from public.food_entries where user_id = v_m.user_id and local_date::text = v_today and meal_section = 'snacks' and deleted_at is null)
    into v_has_breakfast, v_has_lunch, v_has_dinner, v_has_snacks;

    -- Goal completion %
    select target_calories into v_goal_prof
    from public.goal_profiles
    where user_id = v_m.user_id and effective_from <= v_today::date
    order by effective_from desc limit 1;

    if found and v_goal_prof.target_calories is not null and v_goal_prof.target_calories > 0 then
      v_target_kcal := v_goal_prof.target_calories;
    else
      v_target_kcal := 2000;
    end if;

    if v_sum.calories is not null and v_target_kcal > 0 then
      v_pct := round((v_sum.calories / v_target_kcal) * 100, 1);
    else
      v_pct := 0;
    end if;

    -- Lapsed/locked member data is frozen and hidden (PRD 7.6)
    if v_m.status = 'locked' then
      v_member_metrics := jsonb_build_object(
        'status', 'locked',
        'display_message', 'Waiting for ' || coalesce(v_prof.nickname, 'partner') || ' to rejoin',
        'logged_today', 'locked',
        'goal_completion', 'locked',
        'steps', 'locked',
        'water_ml', 'locked',
        'workout_status', 'locked',
        'calories', 'locked',
        'macros', 'locked',
        'weight_kg', 'locked',
        'weight_progress', 'locked',
        'fasting_status', 'locked',
        'meal_checklist', 'locked'
      );
    elsif v_m.user_id = v_caller_id then
      -- Caller always sees own metrics
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
        'fasting_status', 'none',
        'meal_checklist', jsonb_build_object('breakfast', v_has_breakfast, 'lunch', v_has_lunch, 'dinner', v_has_dinner, 'snacks', v_has_snacks)
      );
    else
      -- Other members: STRICTLY enforce privacy settings
      v_p := v_m.privacy_settings;

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

      if coalesce((v_p->>'share_fasting')::boolean, false) then
        v_fasting_val := '"none"'::jsonb;
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

    v_members_json := v_members_json || jsonb_build_array(
      jsonb_build_object(
        'user_id', v_m.user_id,
        'username', v_prof.username,
        'nickname', v_prof.nickname,
        'avatar_url', v_prof.avatar_url,
        'role', v_m.role,
        'status', v_m.status,
        'is_self', (v_m.user_id = v_caller_id),
        'metrics', v_member_metrics
      )
    );
  end loop;

  return jsonb_build_object(
    'room', jsonb_build_object(
      'id', v_room.id,
      'name', v_room.name,
      'code', v_room.code,
      'state', v_room.state,
      'who_can_invite', v_room.who_can_invite,
      'created_by', v_room.created_by
    ),
    'caller_id', v_caller_id,
    'members', v_members_json
  );
end;
$$;
