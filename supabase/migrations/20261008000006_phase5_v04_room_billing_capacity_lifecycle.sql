-- Phase 5 v0.4 Migration: Room-Level Billing, Dynamic Capacity & Lifecycles
-- Complies with PRD v0.4 sections 6.8, 6.18, 7.1, 7.6, 7.11 and AGENT_RULES.md.
-- Never edit past migrations; this is an additive migration file.

-- -----------------------------------------------------------------------------
-- 1. CONFIG TABLE FOR ROOM TIER CAPS (PRD 6.8 ROOM-1, 6.18 SUB-2, 7.11)
-- -----------------------------------------------------------------------------
create table if not exists public.room_tier_configs (
  tier text primary key check (tier in ('basic', 'plus', 'pro', 'community')),
  member_cap integer not null check (member_cap > 0),
  requires_host_approval boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.room_tier_configs enable row level security;

drop policy if exists room_tier_configs_select on public.room_tier_configs;
create policy room_tier_configs_select on public.room_tier_configs
  for select to authenticated, anon
  using (true);

insert into public.room_tier_configs (tier, member_cap, requires_host_approval)
values
  ('basic', 5, false),
  ('plus', 20, false),
  ('pro', 50, true),
  ('community', 100, true)
on conflict (tier) do update set
  member_cap = excluded.member_cap,
  requires_host_approval = excluded.requires_host_approval;

-- -----------------------------------------------------------------------------
-- 2. ALTER ROOMS TABLE (PRD 6.8 ROOM-1, ROOM-6, ROOM-11, 7.6)
-- -----------------------------------------------------------------------------
alter table public.rooms
  add column if not exists plan_holder_id uuid references auth.users(id) on delete set null,
  add column if not exists member_cap integer not null default 5,
  add column if not exists over_capacity_at timestamptz,
  add column if not exists locked_at timestamptz;

-- Default plan_holder_id to created_by for any existing rooms
update public.rooms
set plan_holder_id = created_by
where plan_holder_id is null;

-- Update rooms.state check constraint to support PRD 7.6 states:
-- active, dormant, locked, over_capacity, archived
alter table public.rooms drop constraint if exists rooms_state_check;
alter table public.rooms
  add constraint rooms_state_check
  check (state in ('active', 'dormant', 'locked', 'over_capacity', 'archived'));

create index if not exists idx_rooms_plan_holder on public.rooms (plan_holder_id);

-- -----------------------------------------------------------------------------
-- 3. ALTER ENTITLEMENTS TABLE (PRD 6.18 SUB-1, SUB-3, 7.1)
-- -----------------------------------------------------------------------------
alter table public.entitlements
  add column if not exists tier text default 'basic',
  add column if not exists period text default 'monthly',
  add column if not exists attached_room_id uuid references public.rooms(id) on delete set null;

-- Migrate existing rows to valid v0.4 tiers and periods
update public.entitlements set tier = 'basic' where tier is null;
update public.entitlements set period = 'monthly' where period is null;

update public.entitlements
set period = case
  when plan = 'three_month' then 'quarterly'
  when plan = 'annual' then 'annual'
  else 'monthly'
end
where period is null or period not in ('monthly', 'quarterly', 'annual');

-- Migrate status: 'free' -> 'lapsed'
update public.entitlements
set status = 'lapsed'
where status = 'free';

-- Update check constraints on entitlements
alter table public.entitlements drop constraint if exists entitlements_tier_check;
alter table public.entitlements
  add constraint entitlements_tier_check
  check (tier in ('basic', 'plus', 'pro', 'community'));

alter table public.entitlements drop constraint if exists entitlements_period_check;
alter table public.entitlements
  add constraint entitlements_period_check
  check (period in ('monthly', 'quarterly', 'annual'));

alter table public.entitlements drop constraint if exists entitlements_status_check;
alter table public.entitlements
  add constraint entitlements_status_check
  check (status in ('trial', 'paid', 'grace', 'lapsed'));

-- Attach rooms to existing entitlements where plan_holder matches
update public.entitlements e
set attached_room_id = r.id
from public.rooms r
where r.plan_holder_id = e.user_id
  and e.attached_room_id is null;

create index if not exists idx_entitlements_attached_room on public.entitlements (attached_room_id);

-- -----------------------------------------------------------------------------
-- 4. MIGRATE ROOM_MEMBERS (REMOVE PER-MEMBER 'locked' STATUS)
-- -----------------------------------------------------------------------------
update public.room_members
set status = 'active'
where status = 'locked';

alter table public.room_members drop constraint if exists room_members_status_check;
alter table public.room_members
  add constraint room_members_status_check
  check (status in ('active', 'paused', 'left'));

-- Update is_room_member helper
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
      and status in ('active', 'paused')
  );
$$;

-- -----------------------------------------------------------------------------
-- 5. REPLACEMENT HELPER FUNCTIONS (PRD 6.8, 6.18, 7.1, 7.11)
-- -----------------------------------------------------------------------------

-- Helper: has_plan(uid) -> true if user is a plan holder with active Paid or Grace
create or replace function public.has_plan(p_user_id uuid)
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

-- Helper: room_cap(room_id) -> returns member cap based on plan holder's tier
create or replace function public.room_cap(p_room_id uuid)
returns integer
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_plan_holder_id uuid;
  v_tier text;
  v_status text;
  v_period_end timestamptz;
  v_cap integer;
begin
  select plan_holder_id into v_plan_holder_id
  from public.rooms
  where id = p_room_id;

  if v_plan_holder_id is not null then
    select tier, status, period_end
    into v_tier, v_status, v_period_end
    from public.entitlements
    where user_id = v_plan_holder_id;

    if found then
      if v_status in ('paid', 'grace') and (v_period_end is null or v_period_end > now()) then
        select member_cap into v_cap
        from public.room_tier_configs
        where tier = v_tier;
        return coalesce(v_cap, 5);
      elsif v_status = 'trial' and (v_period_end is not null and v_period_end > now()) then
        return 5;
      end if;
    end if;
  end if;

  select coalesce(member_cap, 5) into v_cap
  from public.rooms
  where id = p_room_id;

  return coalesce(v_cap, 5);
end;
$$;

-- Helper: room_is_usable(room_id) -> true when room plan is Paid, Grace, or trial
create or replace function public.room_is_usable(p_room_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_state text;
  v_plan_holder_id uuid;
  v_ent record;
begin
  select state, plan_holder_id into v_state, v_plan_holder_id
  from public.rooms
  where id = p_room_id;

  if not found then
    return false;
  end if;

  if v_state in ('locked', 'archived') then
    return false;
  end if;

  if v_plan_holder_id is null then
    return false;
  end if;

  select * into v_ent
  from public.entitlements
  where user_id = v_plan_holder_id;

  if not found then
    return false;
  end if;

  if v_ent.status in ('paid', 'grace') then
    return (v_ent.period_end is null or v_ent.period_end > now());
  elsif v_ent.status = 'trial' then
    return (v_ent.period_end is not null and v_ent.period_end > now());
  end if;

  return false;
end;
$$;

-- Helper: can_create_room(uid) -> true if user has active plan or unused trial,
-- and does not already have an active hosted room covered by their plan.
create or replace function public.can_create_room(p_user_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_ent record;
  v_hosted_active_count integer;
begin
  if p_user_id is null then
    return false;
  end if;

  select * into v_ent
  from public.entitlements
  where user_id = p_user_id;

  -- Count existing active/dormant/over_capacity hosted rooms
  select count(*) into v_hosted_active_count
  from public.rooms
  where plan_holder_id = p_user_id
    and state in ('active', 'dormant', 'over_capacity');

  -- SUB-17: One plan covers one hosted room
  if found and v_ent.status in ('paid', 'grace') and (v_ent.period_end is null or v_ent.period_end > now()) then
    return v_hosted_active_count = 0;
  end if;

  -- Active trial
  if found and v_ent.status = 'trial' and (v_ent.period_end is not null and v_ent.period_end > now()) then
    return v_hosted_active_count = 0;
  end if;

  -- Trial eligible (trial not yet started)
  if not found or v_ent.trial_started_at is null then
    return true;
  end if;

  return false;
end;
$$;

-- Deprecated backwards-compatibility wrappers
create or replace function public.has_premium(p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select public.has_plan(p_user_id);
$$;

create or replace function public.has_room_access(p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select public.can_create_room(p_user_id);
$$;

-- -----------------------------------------------------------------------------
-- 6. TRIAL & DEV FUNCTIONS (PRD 6.18 SUB-3, 7.1)
-- -----------------------------------------------------------------------------

-- Helper: start_trial_if_eligible (starts trial when user CREATES a room)
create or replace function public.start_trial_if_eligible(
  p_user_id uuid,
  p_device_hash text default null,
  p_room_id uuid default null
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

  -- If user already has active paid plan, no trial needed
  if found and v_ent.status in ('paid', 'grace') and (v_ent.period_end is null or v_ent.period_end > now()) then
    return true;
  end if;

  -- PRD 7.1: One trial per account (trial_started_at not null means trial was used)
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

  -- Grant 3-day trial on Basic tier (cap 5)
  insert into public.entitlements (
    user_id, tier, period, source, status, attached_room_id, trial_started_at, period_end, updated_at
  ) values (
    p_user_id, 'basic', 'monthly', 'none', 'trial', p_room_id, now(), now() + interval '3 days', now()
  )
  on conflict (user_id) do update set
    tier = 'basic',
    period = 'monthly',
    source = 'none',
    status = 'trial',
    attached_room_id = coalesce(p_room_id, public.entitlements.attached_room_id),
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

-- Dev-only helper: grant plan with tier
create or replace function public.dev_grant_plan(
  p_user_id uuid,
  p_tier text default 'basic',
  p_period text default 'monthly',
  p_status text default 'paid',
  p_days integer default 30,
  p_room_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cap integer;
begin
  if p_tier not in ('basic', 'plus', 'pro', 'community') then
    raise exception 'INVALID_TIER' using errcode = 'P0001';
  end if;
  if p_status not in ('paid', 'grace', 'trial', 'lapsed') then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;

  select member_cap into v_cap
  from public.room_tier_configs
  where tier = p_tier;

  insert into public.entitlements (
    user_id, tier, period, source, status, attached_room_id, period_end, updated_at
  ) values (
    p_user_id, p_tier, p_period, 'apple', p_status, p_room_id,
    case when p_status = 'lapsed' then now() - interval '1 second' else now() + (p_days || ' days')::interval end,
    now()
  )
  on conflict (user_id) do update set
    tier = excluded.tier,
    period = excluded.period,
    source = 'apple',
    status = excluded.status,
    attached_room_id = coalesce(excluded.attached_room_id, public.entitlements.attached_room_id),
    period_end = excluded.period_end,
    updated_at = now();

  if p_room_id is not null then
    update public.rooms
    set plan_holder_id = p_user_id,
        member_cap = coalesce(v_cap, 5),
        updated_at = now()
    where id = p_room_id;
    perform public.recompute_room_state(p_room_id);
  end if;
end;
$$;

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
  perform public.dev_grant_plan(p_user_id, 'basic', 'monthly', 'paid', p_days);
end;
$$;

create or replace function public.dev_revoke_plan(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_room_id uuid;
begin
  select attached_room_id into v_room_id
  from public.entitlements
  where user_id = p_user_id;

  update public.entitlements
  set status = 'lapsed',
      period_end = now() - interval '1 second',
      updated_at = now()
  where user_id = p_user_id;

  if v_room_id is not null then
    perform public.recompute_room_state(v_room_id);
  end if;
end;
$$;

create or replace function public.dev_revoke_premium(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.dev_revoke_plan(p_user_id);
end;
$$;

create or replace function public.dev_expire_trial(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_room_id uuid;
begin
  select attached_room_id into v_room_id
  from public.entitlements
  where user_id = p_user_id;

  update public.entitlements
  set status = 'lapsed',
      period_end = now() - interval '1 second',
      updated_at = now()
  where user_id = p_user_id;

  if v_room_id is not null then
    perform public.recompute_room_state(v_room_id);
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. ROOM STATE MACHINE & SPONSOR STUB (PRD 6.8, 7.6)
-- -----------------------------------------------------------------------------
create or replace function public.recompute_room_state(p_room_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_room record;
  v_plan_holder_id uuid;
  v_ent record;
  v_has_active_plan boolean := false;
  v_member_count integer;
  v_cap integer;
  v_new_state text;
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

  -- 1. Check plan holder entitlement
  v_plan_holder_id := v_room.plan_holder_id;
  if v_plan_holder_id is not null then
    select * into v_ent
    from public.entitlements
    where user_id = v_plan_holder_id;

    if found then
      if v_ent.status in ('paid', 'grace') and (v_ent.period_end is null or v_ent.period_end > now()) then
        v_has_active_plan := true;
      elsif v_ent.status = 'trial' and (v_ent.period_end is not null and v_ent.period_end > now()) then
        v_has_active_plan := true;
      end if;
    end if;
  end if;

  -- 2. If plan ended and nobody sponsors it -> Locked (or Archived if locked > 90 days)
  if not v_has_active_plan then
    if v_room.locked_at is not null and v_room.locked_at < (now() - interval '90 days') then
      v_new_state := 'archived';
      update public.rooms
      set state = 'archived', archived_at = coalesce(archived_at, now()), updated_at = now()
      where id = p_room_id;
    else
      v_new_state := 'locked';
      update public.rooms
      set state = 'locked',
          locked_at = coalesce(locked_at, now()),
          updated_at = now()
      where id = p_room_id;
    end if;
    return v_new_state;
  end if;

  -- Plan is active: count active members
  select count(*) into v_member_count
  from public.room_members
  where room_id = p_room_id and status = 'active';

  v_cap := public.room_cap(p_room_id);

  -- 3. Check capacity limits
  if v_member_count > v_cap then
    if v_room.over_capacity_at is not null and v_room.over_capacity_at < (now() - interval '7 days') then
      v_new_state := 'locked';
      update public.rooms
      set state = 'locked',
          locked_at = coalesce(locked_at, now()),
          updated_at = now()
      where id = p_room_id;
      return v_new_state;
    else
      v_new_state := 'over_capacity';
      update public.rooms
      set state = 'over_capacity',
          over_capacity_at = coalesce(over_capacity_at, now()),
          locked_at = null,
          updated_at = now()
      where id = p_room_id;
      return v_new_state;
    end if;
  end if;

  -- 4. Within capacity: Active (>=2) or Dormant (<2)
  if v_member_count >= 2 then
    v_new_state := 'active';
    update public.rooms
    set state = 'active',
        dormant_at = null,
        over_capacity_at = null,
        locked_at = null,
        updated_at = now()
    where id = p_room_id;
  else
    if v_room.dormant_at is not null and v_room.dormant_at < (now() - interval '30 days') then
      v_new_state := 'archived';
      update public.rooms
      set state = 'archived',
          archived_at = coalesce(archived_at, now()),
          updated_at = now()
      where id = p_room_id;
    else
      v_new_state := 'dormant';
      update public.rooms
      set state = 'dormant',
          dormant_at = coalesce(dormant_at, now()),
          over_capacity_at = null,
          locked_at = null,
          updated_at = now()
      where id = p_room_id;
    end if;
  end if;

  return v_new_state;
end;
$$;

create or replace function public.update_room_state(p_room_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return public.recompute_room_state(p_room_id);
end;
$$;

-- Sponsor room stub (PRD 6.8 ROOM-11, 6.18 SUB-8)
create or replace function public.sponsor_room(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_ent record;
  v_cap integer;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  if not public.is_room_member(p_room_id, v_uid) then
    raise exception 'NOT_ROOM_MEMBER' using errcode = 'P0001';
  end if;

  -- Caller must have an active plan (paid or grace)
  select * into v_ent
  from public.entitlements
  where user_id = v_uid
    and status in ('paid', 'grace')
    and (period_end is null or period_end > now());

  if not found then
    raise exception 'PLAN_REQUIRED' using errcode = 'P0001';
  end if;

  -- Attach plan to this room
  update public.entitlements
  set attached_room_id = p_room_id,
      updated_at = now()
  where user_id = v_uid;

  select member_cap into v_cap
  from public.room_tier_configs
  where tier = v_ent.tier;

  update public.rooms
  set plan_holder_id = v_uid,
      member_cap = coalesce(v_cap, 5),
      updated_at = now()
  where id = p_room_id;

  perform public.recompute_room_state(p_room_id);

  return jsonb_build_object(
    'status', 'sponsored',
    'room_id', p_room_id,
    'plan_holder_id', v_uid
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 8. CORE ROOM ACTIONS WITH ROW LOCKING & USABLE CHECKS
-- -----------------------------------------------------------------------------

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
  v_cap integer := 5;
  v_has_active_plan boolean := false;
  v_ent record;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  v_clean_name := trim(p_name);
  if length(v_clean_name) < 1 or length(v_clean_name) > 100 then
    raise exception 'INVALID_ROOM_NAME' using errcode = 'P0001';
  end if;

  -- Room limit: 3 rooms per user (PRD 6.8 ROOM-5)
  select count(*) into v_user_room_count
  from public.room_members
  where user_id = v_uid and status in ('active', 'paused');

  if v_user_room_count >= 3 then
    raise exception 'MAX_ROOMS_REACHED' using errcode = 'P0001';
  end if;

  -- Plan / Trial check
  select * into v_ent
  from public.entitlements
  where user_id = v_uid;

  if found and v_ent.status in ('paid', 'grace') and (v_ent.period_end is null or v_ent.period_end > now()) then
    v_has_active_plan := true;
    -- SUB-17: One plan covers one hosted room
    if exists (
      select 1 from public.rooms
      where plan_holder_id = v_uid and state in ('active', 'dormant', 'over_capacity')
    ) then
      raise exception 'PLAN_ALREADY_ATTACHED' using errcode = 'P0001';
    end if;

    select member_cap into v_cap
    from public.room_tier_configs
    where tier = v_ent.tier;
    v_cap := coalesce(v_cap, 5);
  else
    -- Needs trial to create room (creating room starts the trial)
    if not public.start_trial_if_eligible(v_uid, p_device_hash) then
      raise exception 'PLAN_REQUIRED' using errcode = 'P0001';
    end if;
    v_cap := 5;
  end if;

  v_code := public.generate_room_code();

  insert into public.rooms (name, code, state, who_can_invite, created_by, plan_holder_id, member_cap)
  values (v_clean_name, v_code, 'dormant', 'host_only', v_uid, v_uid, v_cap)
  returning id into v_room_id;

  update public.entitlements
  set attached_room_id = v_room_id,
      updated_at = now()
  where user_id = v_uid;

  insert into public.room_members (room_id, user_id, role, status, privacy_settings)
  values (v_room_id, v_uid, 'host', 'active', public.default_privacy_settings());

  insert into public.room_events (room_id, user_id, event_type, payload)
  values (v_room_id, v_uid, 'member_joined', jsonb_build_object('action', 'created_room'));

  perform public.recompute_room_state(v_room_id);

  return jsonb_build_object(
    'room_id', v_room_id,
    'name', v_clean_name,
    'code', v_code,
    'role', 'host',
    'state', 'dormant',
    'member_cap', v_cap
  );
end;
$$;

-- 2. send_room_invitation
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
  v_cap integer;
  v_pending_count integer;
  v_req_id uuid;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  select * into v_caller_member
  from public.room_members
  where room_id = p_room_id and user_id = v_uid and status = 'active';

  if not found then
    raise exception 'NOT_ROOM_MEMBER' using errcode = 'P0001';
  end if;

  -- Row lock room
  select * into v_room
  from public.rooms
  where id = p_room_id
  for update;

  if not found or v_room.state = 'archived' then
    raise exception 'ROOM_NOT_FOUND' using errcode = 'P0001';
  end if;

  if not public.room_is_usable(p_room_id) or v_room.state = 'locked' then
    raise exception 'ROOM_LOCKED' using errcode = 'P0001';
  end if;

  if v_room.who_can_invite = 'host_only' and v_caller_member.role <> 'host' then
    raise exception 'HOST_ONLY_INVITE' using errcode = 'P0001';
  end if;

  if v_room.state = 'over_capacity' then
    raise exception 'ROOM_FULL' using errcode = 'P0001';
  end if;

  v_cap := public.room_cap(p_room_id);
  select count(*) into v_member_count
  from public.room_members
  where room_id = p_room_id and status = 'active';

  if v_member_count >= v_cap then
    raise exception 'ROOM_FULL' using errcode = 'P0001';
  end if;

  -- Recipient lookup
  select id, discoverable into v_recipient
  from public.profiles
  where username = lower(trim(p_username))::citext;

  if not found or not v_recipient.discoverable then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_recipient.id = v_uid then
    raise exception 'CANNOT_INVITE_SELF' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.blocks
    where (blocker_id = v_uid and blocked_id = v_recipient.id)
       or (blocker_id = v_recipient.id and blocked_id = v_uid)
  ) then
    raise exception 'USER_BLOCKED' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.room_members
    where room_id = p_room_id and user_id = v_recipient.id and status in ('active', 'paused')
  ) then
    raise exception 'ALREADY_MEMBER' using errcode = 'P0001';
  end if;

  if not public.check_rate_limit('req_hour:' || v_uid::text, 10, 3600) then
    raise exception 'HOURLY_REQUEST_LIMIT_REACHED' using errcode = 'P0001';
  end if;

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

-- 3. request_to_join
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
  v_member_count integer;
  v_cap integer;
  v_pending_count integer;
  v_req_id uuid;
  v_profile record;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  select count(*) into v_user_room_count
  from public.room_members
  where user_id = v_uid and status in ('active', 'paused');

  if v_user_room_count >= 3 then
    raise exception 'MAX_ROOMS_REACHED' using errcode = 'P0001';
  end if;

  if not public.check_rate_limit('req_hour:' || v_uid::text, 10, 3600) then
    raise exception 'HOURLY_REQUEST_LIMIT_REACHED' using errcode = 'P0001';
  end if;

  select count(*) into v_pending_count
  from public.room_requests
  where (sender_id = v_uid or recipient_id = v_uid)
    and status = 'pending' and expires_at > now();

  if v_pending_count >= 20 then
    raise exception 'REQUEST_LIMIT_REACHED' using errcode = 'P0001';
  end if;

  -- Match by room code first
  select * into v_room from public.rooms where code = v_clean and state <> 'archived';

  -- If not matched, match by host username
  if not found then
    select id into v_profile
    from public.profiles
    where username = lower(trim(p_target))::citext;

    if found then
      select r.* into v_room
      from public.rooms r
      join public.room_members rm on rm.room_id = r.id
      where rm.user_id = v_profile.id and rm.role = 'host' and r.state <> 'archived'
      limit 1;
    end if;
  end if;

  if v_room.id is null then
    raise exception 'ROOM_NOT_FOUND' using errcode = 'P0001';
  end if;

  if not public.room_is_usable(v_room.id) or v_room.state = 'locked' then
    raise exception 'ROOM_LOCKED' using errcode = 'P0001';
  end if;

  select user_id into v_host_id
  from public.room_members
  where room_id = v_room.id and role = 'host' and status in ('active', 'paused')
  limit 1;

  if v_host_id is not null and exists (
    select 1 from public.blocks
    where (blocker_id = v_uid and blocked_id = v_host_id)
       or (blocker_id = v_host_id and blocked_id = v_uid)
  ) then
    raise exception 'USER_BLOCKED' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.room_members
    where room_id = v_room.id and user_id = v_uid and status in ('active', 'paused')
  ) then
    raise exception 'ALREADY_MEMBER' using errcode = 'P0001';
  end if;

  if v_room.state = 'over_capacity' then
    raise exception 'ROOM_FULL' using errcode = 'P0001';
  end if;

  v_cap := public.room_cap(v_room.id);
  select count(*) into v_member_count
  from public.room_members
  where room_id = v_room.id and status = 'active';

  if v_member_count >= v_cap then
    raise exception 'ROOM_FULL' using errcode = 'P0001';
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
    'recipient_id', v_host_id,
    'status', 'pending'
  );
end;
$$;

-- 4. respond_to_request (checks capacity under row lock)
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
  v_room record;
  v_joining_user uuid;
  v_member_count integer;
  v_user_room_count integer;
  v_cap integer;
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

  -- ROW LOCK on room to guarantee concurrent join safety (PRD 7.11)
  select * into v_room
  from public.rooms
  where id = v_req.room_id
  for update;

  if not found or v_room.state = 'archived' then
    raise exception 'ROOM_NOT_FOUND' using errcode = 'P0001';
  end if;

  if not public.room_is_usable(v_req.room_id) or v_room.state = 'locked' then
    raise exception 'ROOM_LOCKED' using errcode = 'P0001';
  end if;

  if v_room.state = 'over_capacity' then
    raise exception 'ROOM_FULL' using errcode = 'P0001';
  end if;

  v_cap := public.room_cap(v_req.room_id);

  -- Large room check: rooms above 20 people require host approval for join requests
  if v_req.type = 'join_request' and v_cap > 20 and not exists (
    select 1 from public.room_members where room_id = v_req.room_id and user_id = v_uid and role = 'host'
  ) then
    raise exception 'NOT_AUTHORIZED' using errcode = 'P0001';
  end if;

  -- Capacity check: active members only
  select count(*) into v_member_count
  from public.room_members
  where room_id = v_req.room_id and status = 'active';

  if v_member_count >= v_cap then
    raise exception 'ROOM_FULL' using errcode = 'P0001';
  end if;

  -- Max 3 rooms per user check
  select count(*) into v_user_room_count
  from public.room_members
  where user_id = v_joining_user and status in ('active', 'paused');

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

  perform public.recompute_room_state(v_req.room_id);

  return jsonb_build_object(
    'status', 'accepted',
    'room_id', v_req.room_id,
    'user_id', v_joining_user
  );
end;
$$;

-- 5. join_by_code (checks capacity under row lock)
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
  v_cap integer;
  v_host_id uuid;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  -- ROW LOCK on room
  select * into v_room
  from public.rooms
  where code = upper(trim(p_code)) and state <> 'archived'
  for update;

  if not found then
    raise exception 'ROOM_NOT_FOUND' using errcode = 'P0001';
  end if;

  if not public.room_is_usable(v_room.id) or v_room.state = 'locked' then
    raise exception 'ROOM_LOCKED' using errcode = 'P0001';
  end if;

  select user_id into v_host_id
  from public.room_members
  where room_id = v_room.id and role = 'host' and status in ('active', 'paused')
  limit 1;

  if v_host_id is not null and exists (
    select 1 from public.blocks
    where (blocker_id = v_uid and blocked_id = v_host_id)
       or (blocker_id = v_host_id and blocked_id = v_uid)
  ) then
    raise exception 'USER_BLOCKED' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.room_members
    where room_id = v_room.id and user_id = v_uid and status in ('active', 'paused')
  ) then
    raise exception 'ALREADY_MEMBER' using errcode = 'P0001';
  end if;

  if v_room.state = 'over_capacity' then
    raise exception 'ROOM_FULL' using errcode = 'P0001';
  end if;

  v_cap := public.room_cap(v_room.id);
  select count(*) into v_member_count
  from public.room_members
  where room_id = v_room.id and status = 'active';

  if v_member_count >= v_cap then
    raise exception 'ROOM_FULL' using errcode = 'P0001';
  end if;

  -- Large rooms (PRD 6.8 ROOM-13): For rooms above 20 people, join requests need host approval
  if v_cap > 20 then
    insert into public.room_requests (
      room_id, sender_id, recipient_id, type, status, expires_at
    ) values (
      v_room.id, v_uid, v_host_id, 'join_request', 'pending', now() + interval '14 days'
    );
    return jsonb_build_object(
      'status', 'pending_approval',
      'room_id', v_room.id,
      'name', v_room.name
    );
  end if;

  -- Limits check: 3 rooms per user
  select count(*) into v_user_room_count
  from public.room_members
  where user_id = v_uid and status in ('active', 'paused');

  if v_user_room_count >= 3 then
    raise exception 'MAX_ROOMS_REACHED' using errcode = 'P0001';
  end if;

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

  perform public.recompute_room_state(v_room.id);

  return jsonb_build_object(
    'status', 'joined',
    'room_id', v_room.id,
    'name', v_room.name
  );
end;
$$;

-- 6. Update leave_room, remove_member, transfer_host
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
  where room_id = p_room_id and user_id = v_uid and status in ('active', 'paused');

  if not found then
    raise exception 'NOT_ROOM_MEMBER' using errcode = 'P0001';
  end if;

  update public.room_members
  set status = 'left', updated_at = now()
  where id = v_member.id;

  insert into public.room_events (room_id, user_id, event_type, payload)
  values (p_room_id, v_uid, 'member_left', jsonb_build_object('reason', 'voluntary'));

  -- PRD 6.8 ROOM-4: If host leaves, hosting passes to longest-standing active member
  if v_member.role = 'host' then
    select * into v_next_host
    from public.room_members
    where room_id = p_room_id and status = 'active'
    order by joined_at asc
    limit 1;

    if found then
      update public.room_members
      set role = 'host', updated_at = now()
      where id = v_next_host.id;
    end if;
  end if;

  perform public.recompute_room_state(p_room_id);

  return jsonb_build_object('status', 'left', 'room_id', p_room_id);
end;
$$;

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
  v_target record;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  if p_target_user_id = v_uid then
    raise exception 'CANNOT_REMOVE_SELF' using errcode = 'P0001';
  end if;

  select * into v_caller
  from public.room_members
  where room_id = p_room_id and user_id = v_uid and role = 'host' and status = 'active';

  if not found then
    raise exception 'NOT_AUTHORIZED' using errcode = 'P0001';
  end if;

  select * into v_target
  from public.room_members
  where room_id = p_room_id and user_id = p_target_user_id and status in ('active', 'paused');

  if not found then
    raise exception 'RECIPIENT_NOT_MEMBER' using errcode = 'P0001';
  end if;

  update public.room_members
  set status = 'left', updated_at = now()
  where id = v_target.id;

  insert into public.room_events (room_id, user_id, event_type, payload)
  values (p_room_id, p_target_user_id, 'member_left', jsonb_build_object('reason', 'removed_by_host'));

  perform public.recompute_room_state(p_room_id);

  return jsonb_build_object('status', 'removed', 'room_id', p_room_id, 'user_id', p_target_user_id);
end;
$$;

create or replace function public.transfer_host(
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
  v_target record;
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

  select * into v_target
  from public.room_members
  where room_id = p_room_id and user_id = p_target_user_id and status = 'active';

  if not found then
    raise exception 'RECIPIENT_NOT_MEMBER' using errcode = 'P0001';
  end if;

  update public.room_members set role = 'member', updated_at = now() where id = v_caller.id;
  update public.room_members set role = 'host', updated_at = now() where id = v_target.id;

  return jsonb_build_object('status', 'transferred', 'room_id', p_room_id, 'new_host_id', p_target_user_id);
end;
$$;

-- 7. Update nudge, react, tag_shared_meal to require usable room
create or replace function public.nudge(
  p_room_id uuid,
  p_recipient_id uuid,
  p_message text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_today_start timestamptz;
  v_nudge_count integer;
  v_nudge_id uuid;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  if not public.is_room_member(p_room_id, v_uid) then
    raise exception 'NOT_ROOM_MEMBER' using errcode = 'P0001';
  end if;

  if not public.room_is_usable(p_room_id) then
    raise exception 'ROOM_LOCKED' using errcode = 'P0001';
  end if;

  if not public.is_room_member(p_room_id, p_recipient_id) then
    raise exception 'RECIPIENT_NOT_MEMBER' using errcode = 'P0001';
  end if;

  if length(trim(p_message)) < 1 then
    raise exception 'INVALID_NUDGE_MESSAGE' using errcode = 'P0001';
  end if;

  v_today_start := date_trunc('day', now());
  select count(*) into v_nudge_count
  from public.nudges
  where room_id = p_room_id
    and sender_id = v_uid
    and recipient_id = p_recipient_id
    and created_at >= v_today_start;

  if v_nudge_count >= 2 then
    raise exception 'NUDGE_LIMIT_REACHED' using errcode = 'P0001';
  end if;

  insert into public.nudges (room_id, sender_id, recipient_id, message)
  values (p_room_id, v_uid, p_recipient_id, trim(p_message))
  returning id into v_nudge_id;

  return jsonb_build_object('nudge_id', v_nudge_id, 'status', 'sent');
end;
$$;

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
  v_clean text := lower(trim(p_reaction));
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  if not public.is_room_member(p_room_id, v_uid) then
    raise exception 'NOT_ROOM_MEMBER' using errcode = 'P0001';
  end if;

  if not public.room_is_usable(p_room_id) then
    raise exception 'ROOM_LOCKED' using errcode = 'P0001';
  end if;

  if v_clean not in ('fire', 'clap', 'muscle', 'heart', 'party') then
    raise exception 'INVALID_REACTION' using errcode = 'P0001';
  end if;

  insert into public.reactions (room_id, user_id, event_id, reaction)
  values (p_room_id, v_uid, p_event_id, v_clean)
  on conflict (room_id, user_id, event_id, reaction) do nothing;

  return jsonb_build_object('status', 'reacted', 'reaction', v_clean);
end;
$$;

create or replace function public.tag_shared_meal(
  p_room_id uuid,
  p_food_entry_id uuid,
  p_participant_user_ids uuid[],
  p_default_portion numeric default 1.0
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_entry record;
  v_shared_meal_id uuid;
  v_p_id uuid;
  v_p_count integer := 0;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  if not public.is_room_member(p_room_id, v_uid) then
    raise exception 'NOT_ROOM_MEMBER' using errcode = 'P0001';
  end if;

  if not public.room_is_usable(p_room_id) then
    raise exception 'ROOM_LOCKED' using errcode = 'P0001';
  end if;

  select * into v_entry
  from public.food_entries
  where id = p_food_entry_id and user_id = v_uid and deleted_at is null;

  if not found then
    raise exception 'ENTRY_NOT_FOUND' using errcode = 'P0001';
  end if;

  insert into public.shared_meals (
    room_id, creator_id, source_food_entry_id, food_name, brand,
    portion_display, calories_per_portion, protein_g, carbs_g, fat_g, meal_section
  ) values (
    p_room_id, v_uid, v_entry.id, v_entry.food_name, v_entry.brand,
    v_entry.portion_display, v_entry.calories, v_entry.protein_g, v_entry.carbs_g, v_entry.fat_g, v_entry.meal_section
  )
  returning id into v_shared_meal_id;

  foreach v_p_id in array p_participant_user_ids loop
    if v_p_id <> v_uid and public.is_room_member(p_room_id, v_p_id) then
      insert into public.shared_meal_participants (shared_meal_id, user_id, status)
      values (v_shared_meal_id, v_p_id, 'pending')
      on conflict (shared_meal_id, user_id) do nothing;
      v_p_count := v_p_count + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'shared_meal_id', v_shared_meal_id,
    'participants_count', v_p_count
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 9. GET_ROOM_SNAPSHOT WITH PAGING, SEARCH & LARGE ROOMS (PRD 6.9 RV-4, RV-10)
-- -----------------------------------------------------------------------------
drop function if exists public.get_room_snapshot(uuid);
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

  if not public.room_is_usable(p_room_id) or v_room.state = 'locked' then
    raise exception 'ROOM_LOCKED' using errcode = 'P0001';
  end if;

  -- Total active/paused members count
  select count(*) into v_total_members
  from public.room_members
  where room_id = p_room_id and status in ('active', 'paused');

  v_is_large_room := (v_total_members > 12);
  v_offset := greatest(0, (coalesce(p_page, 1) - 1) * coalesce(p_page_size, 20));

  -- Count total matching search for pagination
  select count(*) into v_total_paged
  from public.room_members rm
  join public.profiles p on p.id = rm.user_id
  where rm.room_id = p_room_id
    and rm.status in ('active', 'paused')
    and (
      p_search is null
      or length(trim(p_search)) = 0
      or p.nickname ilike '%' || trim(p_search) || '%'
      or p.username ilike '%' || trim(p_search) || '%'
      or rm.user_id = v_caller_id
    );

  -- Iterate members (ordered me first, then alphabetically by nickname)
  for v_m in
    select rm.*, p.username, p.nickname, p.avatar_url, p.timezone
    from public.room_members rm
    join public.profiles p on p.id = rm.user_id
    where rm.room_id = p_room_id
      and rm.status in ('active', 'paused')
      and (
        not v_is_large_room
        or p_search is null
        or length(trim(p_search)) = 0
        or p.nickname ilike '%' || trim(p_search) || '%'
        or p.username ilike '%' || trim(p_search) || '%'
        or rm.user_id = v_caller_id
      )
    order by
      case when rm.user_id = v_caller_id then 0 else 1 end,
      lower(p.nickname) asc
    offset (case when v_is_large_room then v_offset else 0 end)
    limit (case when v_is_large_room then coalesce(p_page_size, 20) else 100 end)
  loop
    v_today := (now() at time zone coalesce(v_m.timezone, 'UTC'))::date::text;

    select * into v_sum
    from public.daily_summaries
    where user_id = v_m.user_id and local_date = v_today;

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

    v_sum_pct := v_sum_pct + v_pct;
    v_active_count := v_active_count + 1;

    -- Determine detail vs overview level (PRD 6.9 RV-4, RV-10):
    -- In large rooms (>12 members), overview rows are shown for other members unless selected
    if v_is_large_room and v_m.user_id <> v_caller_id and (p_selected_user_id is null or v_m.user_id <> p_selected_user_id) then
      v_p := v_m.privacy_settings;
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
        'fasting_status', '"locked"'::jsonb,
        'meal_checklist', '"locked"'::jsonb
      );
    elsif v_m.user_id = v_caller_id then
      select
        exists(select 1 from public.food_entries where user_id = v_m.user_id and local_date::text = v_today and meal_section = 'breakfast' and deleted_at is null),
        exists(select 1 from public.food_entries where user_id = v_m.user_id and local_date::text = v_today and meal_section = 'lunch' and deleted_at is null),
        exists(select 1 from public.food_entries where user_id = v_m.user_id and local_date::text = v_today and meal_section = 'dinner' and deleted_at is null),
        exists(select 1 from public.food_entries where user_id = v_m.user_id and local_date::text = v_today and meal_section = 'snacks' and deleted_at is null)
      into v_has_breakfast, v_has_lunch, v_has_dinner, v_has_snacks;

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
      -- Other member (selected or in standard <=12 room)
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
        'username', v_m.username,
        'nickname', v_m.nickname,
        'avatar_url', v_m.avatar_url,
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
      'created_by', v_room.created_by,
      'plan_holder_id', v_room.plan_holder_id,
      'member_cap', v_room.member_cap
    ),
    'caller_id', v_caller_id,
    'members', v_members_json,
    'room_average', jsonb_build_object(
      'goal_completion', case when v_active_count > 0 then round(v_sum_pct / v_active_count, 1) else 0 end,
      'active_members', v_active_count
    ),
    'pagination', case when v_is_large_room then jsonb_build_object(
      'total_count', v_total_paged,
      'page', coalesce(p_page, 1),
      'page_size', coalesce(p_page_size, 20),
      'total_pages', ceil(v_total_paged::numeric / greatest(1, coalesce(p_page_size, 20)))
    ) else null end
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 10. POLICIES UPDATE (ROOM_IS_USABLE ENFORCEMENT)
-- -----------------------------------------------------------------------------
-- Shared meals: only readable in usable rooms
drop policy if exists shared_meals_select on public.shared_meals;
create policy shared_meals_select on public.shared_meals
  for select to authenticated
  using (
    public.is_room_member(room_id, auth.uid())
    and public.room_is_usable(room_id)
  );

-- Room events: only readable in usable rooms
drop policy if exists room_events_select on public.room_events;
create policy room_events_select on public.room_events
  for select to authenticated
  using (
    public.is_room_member(room_id, auth.uid())
    and public.room_is_usable(room_id)
  );

-- Reactions: only readable in usable rooms
drop policy if exists reactions_select on public.reactions;
create policy reactions_select on public.reactions
  for select to authenticated
  using (
    public.is_room_member(room_id, auth.uid())
    and public.room_is_usable(room_id)
  );

-- Nudges: only readable in usable rooms
drop policy if exists nudges_select on public.nudges;
create policy nudges_select on public.nudges
  for select to authenticated
  using (
    (auth.uid() = sender_id or auth.uid() = recipient_id)
    and public.room_is_usable(room_id)
  );
