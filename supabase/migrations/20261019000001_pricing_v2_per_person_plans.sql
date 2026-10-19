-- =============================================================================
-- Migration: 20261019000001_pricing_v2_per_person_plans.sql
-- Description: Pricing v2 overhaul:
--              - Tier & product adjustments: Monthly & Annual only (no quarterly)
--              - Room member caps: Plus = 10, Pro = 20
--              - Hosted room limits: Plus = 1, Pro = 3
--              - 7-day free trial on Plus tier (cap 10)
--              - Feature gating & invitation acceptance requires active plan/trial
--              - AI daily limits: Pro (5 scans/day, 10 coach msgs/day),
--                Free (3 lifetime scans), Plus (0 scans, 0 coach msgs)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. REMOTE CONFIGURATION
-- -----------------------------------------------------------------------------
insert into public.remote_config (key, value, description)
values
  ('room_caps', '{"plus": 10, "pro": 20, "basic": 5, "community": 20}'::jsonb, 'Member caps per room tier'),
  ('trial_length_days', '7'::jsonb, 'Duration of room trial in days'),
  ('trial_cap', '10'::jsonb, 'Member cap during room trial'),
  ('ai_food_photo_caps', '{"trial": 5, "paid_pro": 5, "paid_plus": 0, "free_taste": 3}'::jsonb, 'AI food photo scan limits'),
  ('ai_coach_caps', '{"paid_pro": 10, "paid_plus": 0, "free": 0, "trial": 0}'::jsonb, 'Daily AI coach message limits')
on conflict (key) do update set
  value = excluded.value,
  description = excluded.description,
  updated_at = now();

-- -----------------------------------------------------------------------------
-- 2. ROOM TIER CONFIGURATIONS
-- -----------------------------------------------------------------------------
insert into public.room_tier_configs (tier, member_cap, requires_host_approval)
values
  ('plus', 10, true),
  ('pro', 20, true),
  ('basic', 5, false),
  ('community', 20, true)
on conflict (tier) do update set
  member_cap = excluded.member_cap,
  requires_host_approval = excluded.requires_host_approval;

-- -----------------------------------------------------------------------------
-- 3. ENTITLEMENTS CONSTRAINT UPDATE
-- -----------------------------------------------------------------------------
alter table public.entitlements drop constraint if exists entitlements_tier_check;
alter table public.entitlements
  add constraint entitlements_tier_check
  check (tier in ('free', 'basic', 'plus', 'pro', 'community'));

-- -----------------------------------------------------------------------------
-- 4. HELPER: HAS PLAN OR ACTIVE TRIAL
-- -----------------------------------------------------------------------------
create or replace function public.has_plan_or_active_trial(p_user_id uuid)
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
        (e.status = 'trial' and (e.period_end is not null and e.period_end > now()))
      )
  );
$$;

-- -----------------------------------------------------------------------------
-- 5. START TRIAL IF ELIGIBLE (7-DAY TRIAL ON PLUS TIER, CAP 10)
-- -----------------------------------------------------------------------------
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
  v_trial_days integer;
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

  -- One trial per account
  if found and v_ent.trial_started_at is not null then
    return false;
  end if;

  -- One trial per device
  if p_device_hash is not null and length(trim(p_device_hash)) > 0 then
    select user_id into v_dev_user
    from public.device_trials
    where device_hash = p_device_hash;

    if found and v_dev_user <> p_user_id then
      return false;
    end if;
  end if;

  v_trial_days := coalesce((public.get_remote_config('trial_length_days'))::integer, 7);

  -- Grant 7-day trial on Plus tier (cap 10)
  insert into public.entitlements (
    user_id, tier, period, source, status, attached_room_id, trial_started_at, period_end, updated_at
  ) values (
    p_user_id, 'plus', 'monthly', 'none', 'trial', p_room_id, now(), now() + (v_trial_days || ' days')::interval, now()
  )
  on conflict (user_id) do update set
    tier = 'plus',
    period = 'monthly',
    source = 'none',
    status = 'trial',
    attached_room_id = coalesce(p_room_id, public.entitlements.attached_room_id),
    trial_started_at = coalesce(public.entitlements.trial_started_at, now()),
    period_end = now() + (v_trial_days || ' days')::interval,
    updated_at = now();

  if p_device_hash is not null and length(trim(p_device_hash)) > 0 then
    insert into public.device_trials (device_hash, user_id, trial_started_at)
    values (p_device_hash, p_user_id, now())
    on conflict (device_hash) do nothing;
  end if;

  return true;
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. CAN CREATE ROOM (PRO: UP TO 3 ROOMS, PLUS/TRIAL: UP TO 1 ROOM)
-- -----------------------------------------------------------------------------
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
  v_max_rooms integer := 1;
begin
  if p_user_id is null then
    return false;
  end if;

  select * into v_ent
  from public.entitlements
  where user_id = p_user_id;

  select count(*) into v_hosted_active_count
  from public.rooms
  where plan_holder_id = p_user_id
    and state in ('active', 'dormant', 'over_capacity');

  if found and v_ent.tier = 'pro' then
    v_max_rooms := 3;
  else
    v_max_rooms := 1;
  end if;

  -- Active paid plan
  if found and v_ent.status in ('paid', 'grace') and (v_ent.period_end is null or v_ent.period_end > now()) then
    return v_hosted_active_count < v_max_rooms;
  end if;

  -- Active trial
  if found and v_ent.status = 'trial' and (v_ent.period_end is not null and v_ent.period_end > now()) then
    return v_hosted_active_count < v_max_rooms;
  end if;

  -- Trial eligible (trial not yet started)
  if not found or v_ent.trial_started_at is null then
    return true;
  end if;

  return false;
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. CREATE ROOM WITH NEW CAPS & MULTI-ROOM LIMITS
-- -----------------------------------------------------------------------------
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
  v_hosted_room_count integer;
  v_max_hosted integer := 1;
  v_cap integer := 10;
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

  -- Room membership limit: max 3 rooms joined per user
  select count(*) into v_user_room_count
  from public.room_members
  where user_id = v_uid and status in ('active', 'paused');

  if v_user_room_count >= 3 then
    raise exception 'MAX_ROOMS_REACHED' using errcode = 'P0001';
  end if;

  -- Check plan and hosted count
  select * into v_ent
  from public.entitlements
  where user_id = v_uid;

  if found and v_ent.tier = 'pro' then
    v_max_hosted := 3;
  else
    v_max_hosted := 1;
  end if;

  select count(*) into v_hosted_room_count
  from public.rooms
  where plan_holder_id = v_uid and state in ('active', 'dormant', 'over_capacity');

  if found and v_ent.status in ('paid', 'grace') and (v_ent.period_end is null or v_ent.period_end > now()) then
    v_has_active_plan := true;
    if v_hosted_room_count >= v_max_hosted then
      raise exception 'PLAN_ALREADY_ATTACHED' using errcode = 'P0001';
    end if;

    v_cap := case when v_ent.tier = 'pro' then 20 else 10 end;
  else
    -- Starts trial if eligible
    if not public.start_trial_if_eligible(v_uid, p_device_hash) then
      raise exception 'PLAN_REQUIRED' using errcode = 'P0001';
    end if;
    v_cap := coalesce((public.get_remote_config('trial_cap'))::integer, 10);
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

-- -----------------------------------------------------------------------------
-- 8. JOIN BY CODE (REQUIRES CALLER TO HAVE ACTIVE PLAN OR TRIAL)
-- -----------------------------------------------------------------------------
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

  -- SERVER-SIDE CHECK: User must have active plan or active trial to join
  if not public.has_plan_or_active_trial(v_uid) then
    raise exception 'PLAN_REQUIRED' using errcode = 'P0001';
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

-- -----------------------------------------------------------------------------
-- 9. RESPOND TO REQUEST (REQUIRES ACCEPTING MEMBER TO HAVE ACTIVE PLAN/TRIAL)
-- -----------------------------------------------------------------------------
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

  -- ACCEPT FLOW: Target user must have active plan or trial
  if not public.has_plan_or_active_trial(v_target_user) then
    raise exception 'PLAN_REQUIRED' using errcode = 'P0001';
  end if;

  -- Lock room row for update
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

-- Boolean backward compatibility wrapper for respond_to_request
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
begin
  return public.respond_to_request(
    p_request_id,
    case when p_accept then 'accept' else 'decline' end
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 10. REVENUECAT WEBHOOK MAPPING (MONTHLY & ANNUAL ONLY)
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
  v_tier text := 'plus';
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

  -- 3. Product ID -> tier & period (Plus and Pro, Monthly and Annual)
  if p_product_id is not null then
    if p_product_id ilike '%community%' then
      v_tier := 'community';
    elsif p_product_id ilike '%pro%' then
      v_tier := 'pro';
    elsif p_product_id ilike '%basic%' then
      v_tier := 'basic';
    else
      v_tier := 'plus';
    end if;

    if p_product_id ilike '%annual%' or p_product_id ilike '%yearly%' then
      v_period := 'annual';
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
    when 'CANCELLATION' then v_status := 'paid';
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
    attached_room_id = coalesce(public.entitlements.attached_room_id, excluded.attached_room_id),
    is_unattached = false,
    original_transaction_id = coalesce(excluded.original_transaction_id, public.entitlements.original_transaction_id),
    store_product_id = excluded.store_product_id,
    cancel_at_period_end = excluded.cancel_at_period_end,
    period_end = excluded.period_end,
    billing_issue_detected_at = case when excluded.status = 'grace' then now() else null end,
    last_event_id = excluded.last_event_id,
    last_event_timestamp = excluded.last_event_timestamp,
    updated_at = now();

  -- 8. Record processed event
  insert into public.processed_webhook_events (event_id, event_type, user_id, payload, processed_at)
  values (p_event_id, p_event_type, p_user_id, p_payload, now());

  -- 9. Update room cap and recompute state
  if v_attached_room is not null then
    select coalesce(member_cap, 10) into v_cap
    from public.room_tier_configs
    where tier = v_tier;

    update public.rooms
    set plan_holder_id = p_user_id,
        member_cap = coalesce(v_cap, 10),
        updated_at = now()
    where id = v_attached_room;

    perform public.recompute_room_state(v_attached_room);
  end if;

  return jsonb_build_object(
    'status', 'processed',
    'event_id', p_event_id,
    'user_id', p_user_id,
    'tier', v_tier,
    'subscription_status', v_status
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 11. SERVER-SIDE GATING: AI COACH (PRO TIER ONLY)
-- -----------------------------------------------------------------------------
create or replace function public.check_ai_coach_access(p_user_id uuid)
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
      and e.tier = 'pro'
      and e.status in ('paid', 'grace')
      and (e.period_end is null or e.period_end > now())
  );
$$;

-- -----------------------------------------------------------------------------
-- 12. SERVER-SIDE GATING: AI FOOD PHOTO SCAN ACCESS & LIMITS
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
  v_used integer;
  v_today date;
  v_ent record;
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

  -- 2. Check AI Processing Consent
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

  -- 3. Resolve User Plan & Limits
  v_caps_cfg := public.get_remote_config('ai_food_photo_caps', '{"trial": 5, "paid_pro": 5, "paid_plus": 0, "free_taste": 3}'::jsonb);

  select * into v_ent
  from public.entitlements
  where user_id = p_user_id;

  v_today := (now() at time zone 'utc')::date;

  if found and v_ent.status in ('paid', 'grace') and (v_ent.period_end is null or v_ent.period_end > now()) then
    if v_ent.tier = 'pro' then
      v_user_state := 'paid_pro';
      v_cap := coalesce((v_caps_cfg->>'paid_pro')::integer, 5);

      select coalesce(count, 0) into v_used
      from public.ai_usage
      where user_id = p_user_id and day = v_today and feature = 'food_photo';

      if v_used >= v_cap then
        return jsonb_build_object(
          'allowed', false,
          'code', 'DAILY_LIMIT_REACHED',
          'user_state', v_user_state,
          'used', v_used,
          'cap', v_cap,
          'remaining', 0,
          'message', format('Daily limit of %s photo scans reached for today', v_cap)
        );
      end if;

      return jsonb_build_object(
        'allowed', true,
        'user_state', v_user_state,
        'used', v_used,
        'cap', v_cap,
        'remaining', v_cap - v_used
      );
    else
      -- Plus tier: 0 AI food photo scans
      v_user_state := 'paid_plus';
      return jsonb_build_object(
        'allowed', false,
        'code', 'UPGRADE_REQUIRED',
        'user_state', v_user_state,
        'used', 0,
        'cap', 0,
        'remaining', 0,
        'message', 'AI photo logging is included with the Pro plan'
      );
    end if;
  elsif found and v_ent.status = 'trial' and (v_ent.period_end is not null and v_ent.period_end > now()) then
    v_user_state := 'trial';
    v_cap := coalesce((v_caps_cfg->>'trial')::integer, 5);

    select coalesce(count, 0) into v_used
    from public.ai_usage
    where user_id = p_user_id and day = v_today and feature = 'food_photo';

    if v_used >= v_cap then
      return jsonb_build_object(
        'allowed', false,
        'code', 'DAILY_LIMIT_REACHED',
        'user_state', v_user_state,
        'used', v_used,
        'cap', v_cap,
        'remaining', 0,
        'message', format('Daily limit of %s photo scans reached for today', v_cap)
      );
    end if;

    return jsonb_build_object(
      'allowed', true,
      'user_state', v_user_state,
      'used', v_used,
      'cap', v_cap,
      'remaining', v_cap - v_used
    );
  else
    -- Free tier: 3 lifetime starter taste scans
    v_user_state := 'free';
    v_cap := coalesce((v_caps_cfg->>'free_taste')::integer, 3);

    select coalesce(sum(count), 0) into v_used
    from public.ai_usage
    where user_id = p_user_id and feature = 'food_photo';

    if v_used >= v_cap then
      return jsonb_build_object(
        'allowed', false,
        'code', 'DAILY_LIMIT_REACHED',
        'user_state', v_user_state,
        'used', v_used,
        'cap', v_cap,
        'remaining', 0,
        'message', 'You have used all 3 free photo scans. Upgrade to Pro for 5 daily scans!'
      );
    end if;

    return jsonb_build_object(
      'allowed', true,
      'user_state', v_user_state,
      'used', v_used,
      'cap', v_cap,
      'remaining', v_cap - v_used
    );
  end if;
end;
$$;
