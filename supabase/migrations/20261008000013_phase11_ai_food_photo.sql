-- =============================================================================
-- Migration: 20261008000013_phase11_ai_food_photo.sql
-- Description: Phase 11 - AI Food-Photo Logging, Consent Tracking, Usage Table,
--              Daily Caps by State, and Global Monthly Budget Switch (PRD 6.3 LOG-3, 7.7, 8.2)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. AI USAGE TABLE (PRD 7.7, 7.10)
-- -----------------------------------------------------------------------------
create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default (now() at time zone 'utc')::date,
  feature text not null check (feature in ('food_photo', 'coach')),
  count integer not null default 1,
  tokens integer not null default 0,
  estimated_cost numeric(10, 6) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_ai_usage_user_day_feature unique (user_id, day, feature)
);

alter table public.ai_usage enable row level security;

drop policy if exists ai_usage_select_own on public.ai_usage;
create policy ai_usage_select_own on public.ai_usage
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists ai_usage_no_client_write on public.ai_usage;
create policy ai_usage_no_client_write on public.ai_usage
  for all to authenticated, anon
  using (false)
  with check (false);

create index if not exists idx_ai_usage_user_day on public.ai_usage (user_id, day);
create index if not exists idx_ai_usage_feature_day on public.ai_usage (feature, day);
create index if not exists idx_ai_usage_day on public.ai_usage (day);

-- -----------------------------------------------------------------------------
-- 2. REMOTE CONFIG SEEDS FOR AI FOOD-PHOTO CAPS & GLOBAL MONTHLY BUDGET (PRD 7.7, 7.10)
-- -----------------------------------------------------------------------------
insert into public.remote_config (key, value, description)
values
  ('ai_food_photo_caps', '{"trial": 3, "paid": 15, "free_after_trial": 0}'::jsonb, 'Daily AI food photo scan limits per user state (trial, paid, free_after_trial)'),
  ('ai_budget', '{"monthly_budget_usd": 100.0, "current_month_cost_usd": 0.0, "food_photo_disabled": false, "ai_disabled": false}'::jsonb, 'Global monthly budget and kill switch for AI features')
on conflict (key) do update set
  value = excluded.value,
  description = excluded.description,
  updated_at = now();

-- -----------------------------------------------------------------------------
-- 3. USER STATE & ENTITLEMENT HELPER FOR AI FEATURES (PRD 7.7)
-- -----------------------------------------------------------------------------
create or replace function public.get_ai_food_photo_user_state(p_user_id uuid)
returns text
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_ent record;
begin
  if p_user_id is null then
    return 'free_after_trial';
  end if;

  select * into v_ent
  from public.entitlements
  where user_id = p_user_id;

  if not found then
    return 'free_after_trial';
  end if;

  -- 1. Paid or Grace
  if v_ent.status in ('paid', 'grace') then
    if v_ent.period_end is null or v_ent.period_end > now() then
      return 'paid';
    end if;
  end if;

  -- 2. Active Trial
  if v_ent.status = 'trial' then
    if v_ent.period_end is not null and v_ent.period_end > now() then
      return 'trial';
    end if;
  end if;

  return 'free_after_trial';
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. CONSENT HELPER FUNCTIONS (PRD 8.2)
-- -----------------------------------------------------------------------------
create or replace function public.has_ai_processing_consent(p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.consent_records
    where user_id = p_user_id
      and consent_type = 'ai_processing'
  );
$$;

create or replace function public.accept_ai_processing_consent(p_version text default '1.0')
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  insert into public.consent_records (user_id, consent_type, version, accepted_at)
  values (auth.uid(), 'ai_processing', coalesce(p_version, '1.0'), now())
  on conflict (user_id, consent_type, version) do update
  set accepted_at = now();
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. ATOMIC USAGE RECORDING FUNCTION (PRD 7.7, 7.10)
-- -----------------------------------------------------------------------------
create or replace function public.record_ai_usage(
  p_user_id uuid,
  p_feature text,
  p_tokens integer default 0,
  p_cost numeric default 0,
  p_day date default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_day date;
begin
  if p_user_id is null or p_feature is null then
    raise exception 'INVALID_ARGUMENTS';
  end if;

  v_day := coalesce(p_day, (now() at time zone 'utc')::date);

  insert into public.ai_usage (
    user_id,
    day,
    feature,
    count,
    tokens,
    estimated_cost,
    created_at,
    updated_at
  )
  values (
    p_user_id,
    v_day,
    p_feature,
    1,
    coalesce(p_tokens, 0),
    coalesce(p_cost, 0),
    now(),
    now()
  )
  on conflict (user_id, day, feature) do update set
    count = public.ai_usage.count + 1,
    tokens = public.ai_usage.tokens + coalesce(excluded.tokens, 0),
    estimated_cost = public.ai_usage.estimated_cost + coalesce(excluded.estimated_cost, 0),
    updated_at = now();
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. AUTHORITATIVE ACCESS & CAP VERIFICATION (PRD 6.3 LOG-3, 7.7, 7.10, 8.2)
-- -----------------------------------------------------------------------------
create or replace function public.check_ai_food_photo_access(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_budget_cfg jsonb;
  v_monthly_budget numeric;
  v_current_month_cost numeric;
  v_food_photo_disabled boolean;
  v_ai_disabled boolean;
  v_has_consent boolean;
  v_user_state text;
  v_caps_cfg jsonb;
  v_cap integer;
  v_used_today integer;
  v_today date;
begin
  if p_user_id is null then
    return jsonb_build_object(
      'allowed', false,
      'code', 'UNAUTHENTICATED',
      'message', 'User authentication required'
    );
  end if;

  -- 1. Check Global Monthly Budget Switch
  v_budget_cfg := public.get_remote_config('ai_budget', '{}'::jsonb);
  v_monthly_budget := coalesce((v_budget_cfg->>'monthly_budget_usd')::numeric, 100.0);
  v_food_photo_disabled := coalesce((v_budget_cfg->>'food_photo_disabled')::boolean, false);
  v_ai_disabled := coalesce((v_budget_cfg->>'ai_disabled')::boolean, false);

  if v_food_photo_disabled or v_ai_disabled then
    return jsonb_build_object(
      'allowed', false,
      'code', 'FEATURE_DISABLED',
      'message', 'AI photo scanning is temporarily disabled for maintenance'
    );
  end if;

  -- Calculate current month total estimated cost across all users
  select coalesce(sum(estimated_cost), 0) into v_current_month_cost
  from public.ai_usage
  where day >= (date_trunc('month', (now() at time zone 'utc')))::date;

  if v_monthly_budget > 0 and v_current_month_cost >= v_monthly_budget then
    return jsonb_build_object(
      'allowed', false,
      'code', 'BUDGET_EXCEEDED',
      'message', 'Monthly AI processing capacity reached. Please try again next month.'
    );
  end if;

  -- 2. Check AI Processing Consent (PRD 8.2)
  select exists (
    select 1 from public.consent_records
    where user_id = p_user_id
      and consent_type = 'ai_processing'
  ) into v_has_consent;

  if not v_has_consent then
    return jsonb_build_object(
      'allowed', false,
      'code', 'CONSENT_REQUIRED',
      'message', 'AI processing consent is required before photos can be analyzed'
    );
  end if;

  -- 3. Resolve User State & Daily Caps (PRD 7.7)
  v_user_state := public.get_ai_food_photo_user_state(p_user_id);
  v_caps_cfg := public.get_remote_config('ai_food_photo_caps', '{"trial": 3, "paid": 15, "free_after_trial": 0}'::jsonb);

  if v_user_state = 'paid' then
    v_cap := coalesce((v_caps_cfg->>'paid')::integer, 15);
  elsif v_user_state = 'trial' then
    v_cap := coalesce((v_caps_cfg->>'trial')::integer, 3);
  else
    v_cap := coalesce((v_caps_cfg->>'free_after_trial')::integer, 0);
  end if;

  -- Free users or users with 0 cap
  if v_cap <= 0 then
    return jsonb_build_object(
      'allowed', false,
      'code', 'DAILY_LIMIT_REACHED',
      'user_state', v_user_state,
      'used', 0,
      'cap', 0,
      'remaining', 0,
      'message', 'AI photo logging is only available on Trial or Paid plans'
    );
  end if;

  -- 4. Count Today's Scans
  v_today := (now() at time zone 'utc')::date;
  select coalesce(count, 0) into v_used_today
  from public.ai_usage
  where user_id = p_user_id
    and day = v_today
    and feature = 'food_photo';

  if v_used_today >= v_cap then
    return jsonb_build_object(
      'allowed', false,
      'code', 'DAILY_LIMIT_REACHED',
      'user_state', v_user_state,
      'used', v_used_today,
      'cap', v_cap,
      'remaining', 0,
      'message', format('Daily limit of %s photo scans reached for today', v_cap)
    );
  end if;

  return jsonb_build_object(
    'allowed', true,
    'user_state', v_user_state,
    'used', v_used_today,
    'cap', v_cap,
    'remaining', v_cap - v_used_today
  );
end;
$$;
