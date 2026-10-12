-- =============================================================================
-- Migration: 20261008000012_phase10_subscriptions_paywall_entitlements.sql
-- Description: Phase 10 - Subscriptions, Webhooks, Remote Config,
--              Multi-subscription Reconciliation, Capacity Row-Locking,
--              and Server-side Entitlement Enforcement (PRD 6.8, 6.18, 7.1, 7.6, 7.11)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. REMOTE CONFIG TABLE (PRD 6.8 ROOM-1, 6.18 SUB-2, 7.11)
-- -----------------------------------------------------------------------------
create table if not exists public.remote_config (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now()
);

alter table public.remote_config enable row level security;

drop policy if exists remote_config_select on public.remote_config;
create policy remote_config_select on public.remote_config
  for select to authenticated, anon
  using (true);

drop policy if exists remote_config_no_client_write on public.remote_config;
create policy remote_config_no_client_write on public.remote_config
  for all to authenticated, anon
  using (false)
  with check (false);

-- Seed remote configuration defaults
insert into public.remote_config (key, value, description)
values
  ('room_caps', '{"basic": 5, "plus": 20, "pro": 50, "community": 100}'::jsonb, 'Member caps per room tier'),
  ('trial_length_days', '3'::jsonb, 'Duration of room trial in days'),
  ('trial_cap', '5'::jsonb, 'Member cap during room trial'),
  ('community_tier_enabled', 'false'::jsonb, 'Flag to enable community tier products (51-100 members)')
on conflict (key) do update set
  value = excluded.value,
  description = excluded.description,
  updated_at = now();

create or replace function public.get_remote_config(p_key text, p_default jsonb default null)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_val jsonb;
begin
  select value into v_val from public.remote_config where key = p_key;
  if found then
    return v_val;
  end if;
  return p_default;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. ALTER ENTITLEMENTS TABLE (PRD 6.18 SUB-1, SUB-12, SUB-19, 7.11)
-- -----------------------------------------------------------------------------
alter table public.entitlements
  add column if not exists is_unattached boolean not null default false,
  add column if not exists original_transaction_id text,
  add column if not exists store_product_id text,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists billing_issue_detected_at timestamptz,
  add column if not exists dodo_customer_id text,
  add column if not exists dodo_subscription_id text,
  add column if not exists last_event_id text,
  add column if not exists last_event_timestamp timestamptz;

create index if not exists idx_entitlements_unattached on public.entitlements (is_unattached);
create index if not exists idx_entitlements_status_period on public.entitlements (status, period_end);

-- -----------------------------------------------------------------------------
-- 3. PROCESSED WEBHOOK EVENTS TABLE (IDEMPOTENCY & AUDIT)
-- -----------------------------------------------------------------------------
create table if not exists public.processed_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_id text unique not null,
  event_type text not null,
  user_id uuid references auth.users(id) on delete set null,
  payload jsonb not null,
  processed_at timestamptz not null default now()
);

alter table public.processed_webhook_events enable row level security;

drop policy if exists processed_webhook_events_no_client_read on public.processed_webhook_events;
create policy processed_webhook_events_no_client_read on public.processed_webhook_events
  for all to authenticated, anon
  using (false)
  with check (false);

create index if not exists idx_processed_webhook_events_user on public.processed_webhook_events (user_id);

-- -----------------------------------------------------------------------------
-- 4. MULTI-SUBSCRIPTION ROOM RECONCILIATION (PRD 7.11)
-- "When two people both pay for the same room, the higher tier counts and the
-- other subscription is shown in Me as unattached with a prompt to cancel it."
-- -----------------------------------------------------------------------------
create or replace function public.reconcile_room_subscriptions(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_winner record;
  v_other record;
  v_cap integer;
begin
  if p_room_id is null then
    return;
  end if;

  -- Pick winning active subscription attached to this room:
  -- Rank: Pro (3) > Plus (2) > Basic (1)
  -- Then latest period_end, then oldest created_at
  select *
  into v_winner
  from public.entitlements
  where attached_room_id = p_room_id
    and status in ('paid', 'grace')
    and (period_end is null or period_end > now())
  order by
    case tier
      when 'community' then 4
      when 'pro' then 3
      when 'plus' then 2
      else 1
    end desc,
    coalesce(period_end, '9999-12-31'::timestamptz) desc,
    created_at asc
  limit 1;

  if found then
    -- Winner is attached and active
    update public.entitlements
    set is_unattached = false,
        updated_at = now()
    where user_id = v_winner.user_id;

    -- Update room plan holder and member cap
    select coalesce(member_cap, 5) into v_cap
    from public.room_tier_configs
    where tier = v_winner.tier;

    update public.rooms
    set plan_holder_id = v_winner.user_id,
        member_cap = coalesce(v_cap, 5),
        updated_at = now()
    where id = p_room_id;

    -- Flag any other subscriptions attached to this room as unattached
    update public.entitlements
    set is_unattached = true,
        updated_at = now()
    where attached_room_id = p_room_id
      and user_id <> v_winner.user_id;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. ROOM CAPACITY HELPER (PRD 6.8 ROOM-1, 7.11)
-- -----------------------------------------------------------------------------
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
  v_caps_json jsonb;
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
        -- Check remote config first
        v_caps_json := public.get_remote_config('room_caps');
        if v_caps_json is not null and v_caps_json ? v_tier then
          return (v_caps_json->>v_tier)::integer;
        end if;

        select member_cap into v_cap
        from public.room_tier_configs
        where tier = v_tier;
        return coalesce(v_cap, 5);
      elsif v_status = 'trial' and (v_period_end is not null and v_period_end > now()) then
        return coalesce((public.get_remote_config('trial_cap'))::integer, 5);
      end if;
    end if;
  end if;

  select coalesce(member_cap, 5) into v_cap
  from public.rooms
  where id = p_room_id;

  return coalesce(v_cap, 5);
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. ROOM IS USABLE HELPER (PRD 7.1, 7.6)
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 7. RECOMPUTE ROOM STATE ENGINE (PRD 7.6, 7.11)
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
  if p_room_id is null then
    return null;
  end if;

  -- 1. Reconcile any duplicate subscriptions on this room
  perform public.reconcile_room_subscriptions(p_room_id);

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

  -- 2. Check plan holder entitlement
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

  -- 3. If plan ended and nobody sponsors it -> Locked (or Archived if locked > 90 days)
  if not v_has_active_plan then
    if v_room.locked_at is not null and v_room.locked_at < (now() - interval '90 days') then
      v_new_state := 'archived';
      update public.rooms
      set state = 'archived',
          archived_at = coalesce(archived_at, now()),
          updated_at = now()
      where id = p_room_id;
    else
      v_new_state := 'locked';
      update public.rooms
      set state = 'locked',
          locked_at = coalesce(locked_at, now()),
          updated_at = now()
      where id = p_room_id;

      if v_room.state <> 'locked' then
        perform public.queue_room_state_change_notification(p_room_id, 'locked');
      end if;
    end if;
    return v_new_state;
  end if;

  -- 4. Plan is active: count active members
  select count(*) into v_member_count
  from public.room_members
  where room_id = p_room_id and status = 'active';

  v_cap := public.room_cap(p_room_id);

  -- 5. Capacity checks (PRD 7.6):
  -- Downgrade/expiry leaving count above cap -> Over capacity (7 days), then Locked
  if v_member_count > v_cap then
    if v_room.over_capacity_at is not null and v_room.over_capacity_at < (now() - interval '7 days') then
      v_new_state := 'locked';
      update public.rooms
      set state = 'locked',
          locked_at = coalesce(locked_at, now()),
          updated_at = now()
      where id = p_room_id;

      if v_room.state <> 'locked' then
        perform public.queue_room_state_change_notification(p_room_id, 'locked');
      end if;
      return v_new_state;
    else
      v_new_state := 'over_capacity';
      update public.rooms
      set state = 'over_capacity',
          over_capacity_at = coalesce(over_capacity_at, now()),
          locked_at = null,
          updated_at = now()
      where id = p_room_id;

      if v_room.state <> 'over_capacity' then
        perform public.queue_room_state_change_notification(p_room_id, 'over_capacity');
      end if;
      return v_new_state;
    end if;
  end if;

  -- 6. Within capacity: Active (>=2) or Dormant (<2)
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

-- -----------------------------------------------------------------------------
-- 8. SPONSOR ROOM (PRD 6.8 ROOM-11, 6.18 SUB-8)
-- "Any member can press Keep this room going, buy a plan and become the
-- plan holder without becoming the host."
-- -----------------------------------------------------------------------------
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
  v_room record;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  select * into v_room from public.rooms where id = p_room_id;
  if not found then
    raise exception 'ROOM_NOT_FOUND' using errcode = 'P0001';
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

  -- Attach caller's plan to this room
  update public.entitlements
  set attached_room_id = p_room_id,
      is_unattached = false,
      updated_at = now()
  where user_id = v_uid;

  -- Reconcile in case room already had another subscription
  perform public.reconcile_room_subscriptions(p_room_id);

  -- Recompute room state
  perform public.recompute_room_state(p_room_id);

  select * into v_room from public.rooms where id = p_room_id;

  return jsonb_build_object(
    'status', 'sponsored',
    'room_id', p_room_id,
    'plan_holder_id', v_room.plan_holder_id,
    'state', v_room.state,
    'member_cap', v_room.member_cap
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 9. JOINING FUNCTIONS WITH ROW LOCKING & STRICT ERROR CODES (PRD 6.8 ROOM-12, 7.11)
-- Row lock prevents concurrent joins from ever exceeding the cap!
-- Return ROOM_FULL, ROOM_LOCKED, ROOM_ARCHIVED as clear error codes.
-- -----------------------------------------------------------------------------

-- 9a. join_by_code
create or replace function public.join_by_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_clean_code text := upper(trim(p_code));
  v_room record;
  v_existing_member record;
  v_active_count integer;
  v_cap integer;
  v_joined_count integer;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  if v_clean_code is null or length(v_clean_code) = 0 then
    raise exception 'INVALID_CODE' using errcode = 'P0001';
  end if;

  -- Check max 3 rooms per user (ROOM-5)
  select count(*) into v_joined_count
  from public.room_members
  where user_id = v_uid and status in ('active', 'paused');

  if v_joined_count >= 3 then
    raise exception 'MAX_ROOMS_REACHED' using errcode = 'P0001';
  end if;

  -- ROW LOCK: Select room for update so concurrent joins cannot race
  select * into v_room
  from public.rooms
  where code = v_clean_code
  for update;

  if not found then
    raise exception 'ROOM_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_room.state = 'archived' then
    raise exception 'ROOM_ARCHIVED' using errcode = 'P0001';
  end if;

  if v_room.state = 'locked' or not public.room_is_usable(v_room.id) then
    raise exception 'ROOM_LOCKED' using errcode = 'P0001';
  end if;

  if v_room.state = 'over_capacity' then
    raise exception 'ROOM_FULL' using errcode = 'P0001';
  end if;

  -- Check membership
  select * into v_existing_member
  from public.room_members
  where room_id = v_room.id and user_id = v_uid;

  if found and v_existing_member.status = 'active' then
    return jsonb_build_object(
      'status', 'already_joined',
      'room_id', v_room.id,
      'member_id', v_existing_member.id
    );
  end if;

  -- Capacity check with lock held
  select count(*) into v_active_count
  from public.room_members
  where room_id = v_room.id and status = 'active';

  v_cap := public.room_cap(v_room.id);

  if v_active_count >= v_cap then
    raise exception 'ROOM_FULL' using errcode = 'P0001';
  end if;

  -- Insert or reactivate member
  if found then
    update public.room_members
    set status = 'active',
        joined_at = now(),
        updated_at = now()
    where id = v_existing_member.id;
  else
    insert into public.room_members (
      room_id, user_id, role, status, joined_at
    ) values (
      v_room.id, v_uid, 'member', 'active', now()
    );
  end if;

  insert into public.room_events (room_id, user_id, event_type, payload)
  values (v_room.id, v_uid, 'member_joined', jsonb_build_object('method', 'code'));

  perform public.recompute_room_state(v_room.id);

  return jsonb_build_object(
    'status', 'joined',
    'room_id', v_room.id
  );
end;
$$;

-- 9b. respond_to_request (Accepting an invitation or join request)
create or replace function public.respond_to_request(
  p_request_id uuid,
  p_action text
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
  v_active_count integer;
  v_cap integer;
  v_target_user uuid;
  v_joined_count integer;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  if p_action not in ('accept', 'decline') then
    raise exception 'INVALID_ACTION' using errcode = 'P0001';
  end if;

  select * into v_req
  from public.room_requests
  where id = p_request_id and status = 'pending'
  for update;

  if not found then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_req.expires_at < now() then
    update public.room_requests set status = 'expired', updated_at = now() where id = p_request_id;
    raise exception 'REQUEST_EXPIRED' using errcode = 'P0001';
  end if;

  -- Authorization check
  if v_req.request_type = 'invitation' then
    if v_req.recipient_id <> v_uid then
      raise exception 'UNAUTHORIZED' using errcode = 'P0001';
    end if;
    v_target_user := v_uid;
  else -- 'join_request'
    if not exists (
      select 1 from public.room_members
      where room_id = v_req.room_id and user_id = v_uid and role = 'host' and status = 'active'
    ) then
      raise exception 'HOST_ONLY' using errcode = 'P0001';
    end if;
    v_target_user := v_req.sender_id;
  end if;

  if p_action = 'decline' then
    update public.room_requests
    set status = 'declined', updated_at = now()
    where id = p_request_id;

    return jsonb_build_object('status', 'declined');
  end if;

  -- ACCEPT FLOW: Lock room row for update
  select * into v_room
  from public.rooms
  where id = v_req.room_id
  for update;

  if not found then
    raise exception 'ROOM_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_room.state = 'archived' then
    raise exception 'ROOM_ARCHIVED' using errcode = 'P0001';
  end if;

  if v_room.state = 'locked' or not public.room_is_usable(v_room.id) then
    raise exception 'ROOM_LOCKED' using errcode = 'P0001';
  end if;

  if v_room.state = 'over_capacity' then
    raise exception 'ROOM_FULL' using errcode = 'P0001';
  end if;

  -- Check max 3 rooms per user (ROOM-5)
  select count(*) into v_joined_count
  from public.room_members
  where user_id = v_target_user and status in ('active', 'paused');

  if v_joined_count >= 3 then
    raise exception 'MAX_ROOMS_REACHED' using errcode = 'P0001';
  end if;

  -- Capacity check with lock held
  select count(*) into v_active_count
  from public.room_members
  where room_id = v_room.id and status = 'active';

  v_cap := public.room_cap(v_room.id);

  if v_active_count >= v_cap then
    raise exception 'ROOM_FULL' using errcode = 'P0001';
  end if;

  -- Mark request accepted
  update public.room_requests
  set status = 'accepted', updated_at = now()
  where id = p_request_id;

  -- Insert or reactivate member
  insert into public.room_members (
    room_id, user_id, role, status, joined_at
  ) values (
    v_room.id, v_target_user, 'member', 'active', now()
  )
  on conflict (room_id, user_id) do update set
    status = 'active',
    joined_at = now(),
    updated_at = now();

  insert into public.room_events (room_id, user_id, event_type, payload)
  values (v_room.id, v_target_user, 'member_joined', jsonb_build_object('method', v_req.request_type));

  perform public.recompute_room_state(v_room.id);

  return jsonb_build_object(
    'status', 'accepted',
    'room_id', v_room.id,
    'user_id', v_target_user
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 10. WEBHOOK APPLICATION PROCEDURE (PRD 6.18 SUB-12, 7.11)
-- -----------------------------------------------------------------------------
create or replace function public.apply_revenuecat_event(
  p_event_id text,
  p_event_type text,
  p_user_id uuid,
  p_product_id text,
  p_store text,
  p_period_end timestamptz,
  p_event_timestamp timestamptz,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tier text := 'basic';
  v_period text := 'monthly';
  v_status text := 'paid';
  v_source text := 'apple';
  v_current_ent record;
  v_attached_room uuid;
  v_hosted_room uuid;
  v_cap integer;
begin
  if p_event_id is null or p_event_type is null or p_user_id is null then
    raise exception 'INVALID_WEBHOOK_PARAMETERS' using errcode = 'P0001';
  end if;

  -- 1. Idempotency check
  if exists (select 1 from public.processed_webhook_events where event_id = p_event_id) then
    return jsonb_build_object('status', 'already_processed', 'event_id', p_event_id);
  end if;

  -- 2. Store mapping
  if p_store ilike '%play%' or p_store ilike '%google%' then
    v_source := 'google';
  elsif p_store ilike '%dodo%' then
    v_source := 'dodo';
  else
    v_source := 'apple';
  end if;

  -- 3. Product ID -> tier & period
  if p_product_id is not null then
    if p_product_id ilike '%community%' then
      v_tier := 'community';
    elsif p_product_id ilike '%pro%' then
      v_tier := 'pro';
    elsif p_product_id ilike '%plus%' then
      v_tier := 'plus';
    else
      v_tier := 'basic';
    end if;

    if p_product_id ilike '%annual%' or p_product_id ilike '%yearly%' then
      v_period := 'annual';
    elsif p_product_id ilike '%quarterly%' or p_product_id ilike '%three_month%' or p_product_id ilike '%3month%' then
      v_period := 'quarterly';
    else
      v_period := 'monthly';
    end if;
  end if;

  -- 4. Status mapping
  case p_event_type
    when 'INITIAL_PURCHASE' then v_status := 'paid';
    when 'RENEWAL' then v_status := 'paid';
    when 'PRODUCT_CHANGE' then v_status := 'paid';
    when 'UNCANCELLATION' then v_status := 'paid';
    when 'SUBSCRIPTION_EXTENDED' then v_status := 'paid';
    when 'BILLING_ISSUE' then v_status := 'grace';
    when 'CANCELLATION' then
      -- remains paid until period_end
      v_status := 'paid';
    when 'EXPIRATION' then v_status := 'lapsed';
    when 'REVOCATION' then v_status := 'lapsed';
    else v_status := 'paid';
  end case;

  -- 5. Out-of-order check
  select * into v_current_ent
  from public.entitlements
  where user_id = p_user_id
  for update;

  if found and v_current_ent.last_event_timestamp is not null then
    if p_event_timestamp < v_current_ent.last_event_timestamp then
      -- Incoming event is older than current state! Record audit but skip state overwrite
      insert into public.processed_webhook_events (event_id, event_type, user_id, payload, processed_at)
      values (p_event_id, p_event_type, p_user_id, p_payload, now());

      return jsonb_build_object(
        'status', 'skipped_older_event',
        'event_id', p_event_id,
        'current_timestamp', v_current_ent.last_event_timestamp
      );
    end if;
  end if;

  -- 6. Attach hosted room automatically if not yet attached
  v_attached_room := v_current_ent.attached_room_id;
  if v_attached_room is null and v_status in ('paid', 'grace') then
    select id into v_hosted_room
    from public.rooms
    where created_by = p_user_id
      and state in ('active', 'dormant', 'over_capacity', 'locked')
    order by created_at asc
    limit 1;

    if found then
      v_attached_room := v_hosted_room;
    end if;
  end if;

  -- 7. Upsert entitlements table
  insert into public.entitlements (
    user_id, tier, period, source, status,
    attached_room_id, is_unattached, original_transaction_id,
    store_product_id, cancel_at_period_end, period_end,
    last_event_id, last_event_timestamp, updated_at
  ) values (
    p_user_id, v_tier, v_period, v_source, v_status,
    v_attached_room, false, (p_payload->'event'->>'original_transaction_id'),
    p_product_id, (p_event_type = 'CANCELLATION'), p_period_end,
    p_event_id, p_event_timestamp, now()
  )
  on conflict (user_id) do update set
    tier = excluded.tier,
    period = excluded.period,
    source = excluded.source,
    status = excluded.status,
    attached_room_id = coalesce(excluded.attached_room_id, public.entitlements.attached_room_id),
    is_unattached = false,
    original_transaction_id = coalesce(excluded.original_transaction_id, public.entitlements.original_transaction_id),
    store_product_id = excluded.store_product_id,
    cancel_at_period_end = excluded.cancel_at_period_end,
    period_end = excluded.period_end,
    last_event_id = excluded.last_event_id,
    last_event_timestamp = excluded.last_event_timestamp,
    updated_at = now();

  -- 8. If attached to a room, reconcile and recompute room state
  if v_attached_room is not null then
    select coalesce(member_cap, 5) into v_cap
    from public.room_tier_configs
    where tier = v_tier;

    update public.rooms
    set plan_holder_id = p_user_id,
        member_cap = coalesce(v_cap, 5),
        updated_at = now()
    where id = v_attached_room;

    perform public.reconcile_room_subscriptions(v_attached_room);
    perform public.recompute_room_state(v_attached_room);
  end if;

  -- 9. Record event in idempotency table
  insert into public.processed_webhook_events (
    event_id, event_type, user_id, payload, processed_at
  ) values (
    p_event_id, p_event_type, p_user_id, p_payload, now()
  );

  -- 10. Notification hook for subscription lapse or billing issue
  if v_status = 'lapsed' or p_event_type in ('BILLING_ISSUE', 'EXPIRATION', 'REVOCATION') then
    perform public.queue_subscription_lapse_notification(p_user_id, p_event_type);
  end if;

  return jsonb_build_object(
    'status', 'applied',
    'event_id', p_event_id,
    'user_id', p_user_id,
    'tier', v_tier,
    'entitlement_status', v_status
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 11. SCHEDULED LIFECYCLE MAINTENANCE JOB (PRD 7.6)
-- -----------------------------------------------------------------------------
create or replace function public.process_room_lifecycle_cron()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_over_cap_count integer := 0;
  v_expired_count integer := 0;
  v_locked_archived integer := 0;
  v_dormant_archived integer := 0;
  r record;
begin
  -- 1. Over capacity > 7 days -> Lock
  for r in
    select id from public.rooms
    where state = 'over_capacity'
      and over_capacity_at is not null
      and over_capacity_at < (now() - interval '7 days')
  loop
    perform public.recompute_room_state(r.id);
    v_over_cap_count := v_over_cap_count + 1;
  end loop;

  -- 2. Expired plan holders -> Recompute
  for r in
    select r.id
    from public.rooms r
    join public.entitlements e on e.user_id = r.plan_holder_id
    where r.state in ('active', 'dormant', 'over_capacity')
      and e.period_end is not null
      and e.period_end <= now()
  loop
    perform public.recompute_room_state(r.id);
    v_expired_count := v_expired_count + 1;
  end loop;

  -- 3. Locked > 90 days -> Archive
  for r in
    select id from public.rooms
    where state = 'locked'
      and locked_at is not null
      and locked_at < (now() - interval '90 days')
  loop
    perform public.recompute_room_state(r.id);
    v_locked_archived := v_locked_archived + 1;
  end loop;

  -- 4. Dormant > 30 days -> Archive
  for r in
    select id from public.rooms
    where state = 'dormant'
      and dormant_at is not null
      and dormant_at < (now() - interval '30 days')
  loop
    perform public.recompute_room_state(r.id);
    v_dormant_archived := v_dormant_archived + 1;
  end loop;

  return jsonb_build_object(
    'over_capacity_locked', v_over_cap_count,
    'expired_recomputed', v_expired_count,
    'locked_archived', v_locked_archived,
    'dormant_archived', v_dormant_archived
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 12. SERVER-SIDE ENFORCEMENT: AI COACH & FINDER GATING (PRD 6.18 SUB-16)
-- AI Coach and Partner Finder require an active Paid or Grace plan.
-- No trial for these two. Room members who are not plan holders are rejected.
-- -----------------------------------------------------------------------------
create or replace function public.check_ai_coach_access(p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select public.has_plan(p_user_id);
$$;

create or replace function public.check_partner_finder_access(p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select public.has_plan(p_user_id);
$$;
