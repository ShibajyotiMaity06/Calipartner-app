-- =============================================================================
-- Migration: 20261020000001_fix_critical_security_findings.sql
-- Fixes Critical security findings C01, C02 (database portion), and C04
-- from CaliPartner Security and Release Review
-- =============================================================================

-- =============================================================================
-- 1. FIX C01: REVOKE PUBLIC PRIVILEGES FROM DEV HELPERS
-- =============================================================================
revoke execute on function public.dev_grant_plan(uuid, text, text, text, integer, uuid) from public, anon, authenticated;
revoke execute on function public.dev_grant_premium(uuid, integer) from public, anon, authenticated;
revoke execute on function public.dev_revoke_plan(uuid) from public, anon, authenticated;
revoke execute on function public.dev_revoke_premium(uuid) from public, anon, authenticated;
revoke execute on function public.dev_expire_trial(uuid) from public, anon, authenticated;

grant execute on function public.dev_grant_plan(uuid, text, text, text, integer, uuid) to service_role, postgres;
grant execute on function public.dev_grant_premium(uuid, integer) to service_role, postgres;
grant execute on function public.dev_revoke_plan(uuid) to service_role, postgres;
grant execute on function public.dev_revoke_premium(uuid) to service_role, postgres;
grant execute on function public.dev_expire_trial(uuid) to service_role, postgres;

-- =============================================================================
-- 2. FIX C01: RESTRICT REVENUECAT WEBHOOK RPC EXECUTION & ENFORCE PERIOD END
-- =============================================================================
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
  v_period_end timestamptz := p_period_end;
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

  -- Safe fallback: Never leave period_end as null for active paid subscriptions
  if v_status in ('paid', 'grace') and v_period_end is null then
    v_period_end := now() + case when v_period = 'annual' then interval '365 days' else interval '30 days' end;
  end if;

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
    p_product_id, (p_event_type = 'CANCELLATION'), v_period_end,
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

revoke execute on function public.apply_revenuecat_event(text, text, uuid, text, text, timestamptz, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.apply_revenuecat_event(text, text, uuid, text, text, timestamptz, timestamptz, jsonb) to service_role, postgres;

-- =============================================================================
-- 3. FIX C01: ATOMIC AI USAGE RECORDING — REJECT NEGATIVE USAGE & RESTRICT ACCESS
-- =============================================================================
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
    raise exception 'INVALID_ARGUMENTS' using errcode = 'P0001';
  end if;

  -- Enforce non-negative usage to prevent budget corruption attacks
  if coalesce(p_tokens, 0) < 0 or coalesce(p_cost, 0) < 0 then
    raise exception 'INVALID_USAGE: Tokens and cost must be non-negative' using errcode = '22003';
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

revoke execute on function public.record_ai_usage(uuid, text, integer, numeric, date) from public, anon, authenticated;
grant execute on function public.record_ai_usage(uuid, text, integer, numeric, date) to service_role, postgres;

-- =============================================================================
-- 4. FIX C01 & C04: INTERNAL NOTIFICATION SETTINGS & RESTRICT QUEUE HELPERS
-- =============================================================================

-- Internal helper: accessible only to backend / triggers
create or replace function public.internal_get_or_create_notification_settings(p_user_id uuid)
returns public.notification_settings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.notification_settings;
begin
  if p_user_id is null then
    raise exception 'INVALID_ARGUMENTS: user_id cannot be null' using errcode = 'P0001';
  end if;

  select * into v_row from public.notification_settings where user_id = p_user_id;
  if not found then
    insert into public.notification_settings (user_id)
    values (p_user_id)
    on conflict (user_id) do update set updated_at = now()
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

revoke execute on function public.internal_get_or_create_notification_settings(uuid) from public, anon, authenticated;
grant execute on function public.internal_get_or_create_notification_settings(uuid) to service_role, postgres;

-- Public helper: enforces that authenticated callers can ONLY access their own settings
create or replace function public.get_or_create_notification_settings(p_user_id uuid default null)
returns public.notification_settings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller uuid := auth.uid();
  v_uid uuid;
begin
  if v_caller is null then
    if current_user in ('service_role', 'postgres', 'supabase_admin') and p_user_id is not null then
      v_uid := p_user_id;
    else
      raise exception 'UNAUTHENTICATED' using errcode = '42501';
    end if;
  else
    if p_user_id is not null and p_user_id <> v_caller then
      raise exception 'FORBIDDEN: You cannot access another user''s notification settings' using errcode = '42501';
    end if;
    v_uid := v_caller;
  end if;

  return public.internal_get_or_create_notification_settings(v_uid);
end;
$$;

grant execute on function public.get_or_create_notification_settings(uuid) to authenticated, service_role, postgres;
revoke execute on function public.get_or_create_notification_settings(uuid) from anon, public;

-- Update queue_push_notification to use internal_get_or_create_notification_settings
create or replace function public.queue_push_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_data jsonb default '{}'::jsonb,
  p_room_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_settings public.notification_settings;
  v_status text := 'pending';
  v_skip_reason text := null;
  v_sanitized_body text := p_body;
  v_sanitized_title text := p_title;
  v_device_count int;
  v_queue_id uuid;
begin
  if p_user_id is null then
    raise exception 'INVALID_ARGUMENTS: recipient user_id required' using errcode = 'P0001';
  end if;

  -- 1. Ensure settings exist via internal helper
  v_settings := public.internal_get_or_create_notification_settings(p_user_id);

  -- 2. Pause All check
  if v_settings.pause_all then
    v_status := 'skipped';
    v_skip_reason := 'pause_all';
  end if;

  -- 3. Per-type toggle check
  if v_status = 'pending' then
    case p_type
      when 'nudge' then
        if not v_settings.nudge_enabled then v_status := 'skipped'; v_skip_reason := 'type_disabled'; end if;
      when 'partner_workout', 'partner_food' then
        if not v_settings.partner_activity_enabled then v_status := 'skipped'; v_skip_reason := 'type_disabled'; end if;
      when 'room_invitation', 'room_join_request', 'room_request_accepted' then
        if not v_settings.room_requests_enabled then v_status := 'skipped'; v_skip_reason := 'type_disabled'; end if;
      when 'chat_message' then
        if not v_settings.chat_messages_enabled then v_status := 'skipped'; v_skip_reason := 'type_disabled'; end if;
      when 'streak_at_risk' then
        if not v_settings.streak_reminders_enabled then v_status := 'skipped'; v_skip_reason := 'type_disabled'; end if;
      when 'weekly_summary' then
        if not v_settings.weekly_summary_enabled then v_status := 'skipped'; v_skip_reason := 'type_disabled'; end if;
      when 'trial_ending' then
        if not v_settings.trial_reminders_enabled then v_status := 'skipped'; v_skip_reason := 'type_disabled'; end if;
      when 'subscription_lapse', 'room_state_change' then
        if not v_settings.billing_alerts_enabled then v_status := 'skipped'; v_skip_reason := 'type_disabled'; end if;
      else
        null;
    end case;
  end if;

  -- 4. Per-room chat mute
  if v_status = 'pending' and p_type = 'chat_message' and p_room_id is not null then
    if public.is_room_chat_muted(p_room_id, p_user_id) then
      v_status := 'skipped';
      v_skip_reason := 'room_chat_muted';
    end if;
  end if;

  -- 5. Active chat viewing check
  if v_status = 'pending' and p_type = 'chat_message' and p_room_id is not null then
    if public.is_user_viewing_chat(p_room_id, p_user_id) then
      v_status := 'skipped';
      v_skip_reason := 'currently_viewing_chat';
    end if;
  end if;

  -- 6. Quiet hours check
  if v_status = 'pending' and public.is_in_quiet_hours(p_user_id) then
    v_status := 'skipped';
    v_skip_reason := 'quiet_hours';
  end if;

  -- 7. Devices check
  if v_status = 'pending' then
    select count(*) into v_device_count from public.devices where user_id = p_user_id;
    if v_device_count = 0 then
      v_status := 'skipped';
      v_skip_reason := 'no_devices';
    end if;
  end if;

  -- 8. Privacy sanitization (PRD 6.12 NTF-3: Never include another person's calories)
  v_sanitized_body := regexp_replace(v_sanitized_body, '\m\d+(\.\d+)?\s*(kcal|calories|cals)\M', 'logged meal', 'gi');

  -- Hide previews for chat if enabled
  if p_type = 'chat_message' and v_settings.hide_previews then
    v_sanitized_title := coalesce(p_data->>'roomName', 'New Message');
    v_sanitized_body := 'New message received';
  end if;

  -- 9. Insert into queue
  insert into public.push_notification_queue (
    user_id,
    notification_type,
    title,
    body,
    data,
    status,
    skip_reason,
    created_at
  )
  values (
    p_user_id,
    p_type,
    v_sanitized_title,
    v_sanitized_body,
    coalesce(p_data, '{}'::jsonb),
    v_status,
    v_skip_reason,
    now()
  )
  returning id into v_queue_id;

  return v_queue_id;
end;
$$;

-- Revoke queue and maintenance helpers from public / client roles
revoke execute on function public.queue_push_notification(uuid, text, text, text, jsonb, uuid) from public, anon, authenticated;
revoke execute on function public.queue_subscription_lapse_notification(uuid, text) from public, anon, authenticated;
revoke execute on function public.queue_room_state_notification(uuid, text) from public, anon, authenticated;
revoke execute on function public.process_trial_ending_notifications() from public, anon, authenticated;
revoke execute on function public.process_streak_at_risk_notifications() from public, anon, authenticated;
revoke execute on function public.process_weekly_summary_notifications() from public, anon, authenticated;
revoke execute on function public.cleanup_stale_devices(integer) from public, anon, authenticated;
revoke execute on function public.process_focus_maintenance() from public, anon, authenticated;
revoke execute on function public.process_room_lifecycle_cron() from public, anon, authenticated;

grant execute on function public.queue_push_notification(uuid, text, text, text, jsonb, uuid) to service_role, postgres;
grant execute on function public.queue_subscription_lapse_notification(uuid, text) to service_role, postgres;
grant execute on function public.queue_room_state_notification(uuid, text) to service_role, postgres;
grant execute on function public.process_trial_ending_notifications() to service_role, postgres;
grant execute on function public.process_streak_at_risk_notifications() to service_role, postgres;
grant execute on function public.process_weekly_summary_notifications() to service_role, postgres;
grant execute on function public.cleanup_stale_devices(integer) to service_role, postgres;
grant execute on function public.process_focus_maintenance() to service_role, postgres;
grant execute on function public.process_room_lifecycle_cron() to service_role, postgres;

-- =============================================================================
-- 5. FIX C01: TRIAL START AUTHORIZATION CHECK
-- =============================================================================
create or replace function public.start_trial_if_eligible(
  p_user_id uuid default null,
  p_device_hash text default null,
  p_room_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_target_user uuid;
  v_ent record;
  v_dev_user uuid;
  v_trial_days integer;
begin
  if v_uid is not null then
    -- Authenticated caller: cannot start trial for someone else
    if p_user_id is not null and p_user_id <> v_uid then
      raise exception 'FORBIDDEN: You cannot start a trial for another user' using errcode = '42501';
    end if;
    v_target_user := v_uid;
  else
    if current_user in ('service_role', 'postgres', 'supabase_admin') and p_user_id is not null then
      v_target_user := p_user_id;
    else
      raise exception 'UNAUTHENTICATED' using errcode = '42501';
    end if;
  end if;

  select * into v_ent
  from public.entitlements
  where user_id = v_target_user
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

    if found and v_dev_user <> v_target_user then
      return false;
    end if;
  end if;

  v_trial_days := coalesce((public.get_remote_config('trial_length_days'))::integer, 7);

  -- Grant 7-day trial on Plus tier (cap 10)
  insert into public.entitlements (
    user_id, tier, period, source, status, attached_room_id, trial_started_at, period_end, updated_at
  ) values (
    v_target_user, 'plus', 'monthly', 'none', 'trial', p_room_id, now(), now() + (v_trial_days || ' days')::interval, now()
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
    values (p_device_hash, v_target_user, now())
    on conflict (device_hash) do nothing;
  end if;

  return true;
end;
$$;

grant execute on function public.start_trial_if_eligible(uuid, text, uuid) to authenticated, service_role, postgres;
revoke execute on function public.start_trial_if_eligible(uuid, text, uuid) from anon, public;

-- =============================================================================
-- 6. FIX C04: SECURE PERSONAL FOCUS STATISTICS FUNCTION
-- =============================================================================
create or replace function public.get_personal_focus_stats(
  p_user_id uuid default null,
  p_start_date text default null,
  p_end_date text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller uuid := auth.uid();
  v_uid uuid;
  v_tz text := 'UTC';
  v_settings public.focus_settings;
  v_goal_mins int;
  v_streak_min int;
  v_total_mins int := 0;
  v_longest_mins int := 0;
  v_daily jsonb := '[]'::jsonb;
  v_labels jsonb := '[]'::jsonb;
begin
  if v_caller is null then
    -- Anonymous / unauthenticated caller cannot inspect statistics
    if current_user in ('service_role', 'postgres', 'supabase_admin') and p_user_id is not null then
      v_uid := p_user_id;
    else
      raise exception 'UNAUTHENTICATED' using errcode = '42501';
    end if;
  else
    -- Authenticated caller: strictly forbidden to read another user's personal focus statistics
    if p_user_id is not null and p_user_id <> v_caller then
      raise exception 'FORBIDDEN: You cannot view another user''s personal focus statistics' using errcode = '42501';
    end if;
    v_uid := v_caller;
  end if;

  select coalesce(timezone, 'UTC') into v_tz from public.profiles where id = v_uid;

  -- Settings
  select * into v_settings from public.focus_settings where user_id = v_uid;
  v_goal_mins := coalesce(v_settings.weekly_goal_minutes, 300);
  v_streak_min := coalesce(v_settings.streak_minimum_minutes, 25);

  -- Daily breakdown
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'local_date', ldate,
      'focus_minutes', mins,
      'session_count', scount
    ) order by ldate
  ), '[]'::jsonb) into v_daily
  from (
    select
      to_char(started_at at time zone v_tz, 'YYYY-MM-DD') as ldate,
      coalesce(sum(
        greatest(0, round((extract(epoch from (ended_at - started_at)) - paused_seconds) / 60))
      ), 0)::int as mins,
      count(*)::int as scount
    from public.focus_sessions
    where user_id = v_uid
      and status in ('ended', 'auto_ended')
      and ended_at is not null
      and (p_start_date is null or to_char(started_at at time zone v_tz, 'YYYY-MM-DD') >= p_start_date)
      and (p_end_date is null or to_char(started_at at time zone v_tz, 'YYYY-MM-DD') <= p_end_date)
    group by to_char(started_at at time zone v_tz, 'YYYY-MM-DD')
  ) d;

  -- Total minutes
  select coalesce(sum(
    greatest(0, round((extract(epoch from (ended_at - started_at)) - paused_seconds) / 60))
  ), 0)::int into v_total_mins
  from public.focus_sessions
  where user_id = v_uid
    and status in ('ended', 'auto_ended')
    and ended_at is not null
    and (p_start_date is null or to_char(started_at at time zone v_tz, 'YYYY-MM-DD') >= p_start_date)
    and (p_end_date is null or to_char(started_at at time zone v_tz, 'YYYY-MM-DD') <= p_end_date);

  -- Longest session
  select coalesce(max(
    greatest(0, round((extract(epoch from (ended_at - started_at)) - paused_seconds) / 60))
  ), 0)::int into v_longest_mins
  from public.focus_sessions
  where user_id = v_uid
    and status in ('ended', 'auto_ended')
    and ended_at is not null
    and (p_start_date is null or to_char(started_at at time zone v_tz, 'YYYY-MM-DD') >= p_start_date)
    and (p_end_date is null or to_char(started_at at time zone v_tz, 'YYYY-MM-DD') <= p_end_date);

  -- Breakdown by label
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'label', coalesce(label, 'Unlabeled'),
      'minutes', mins
    ) order by mins desc
  ), '[]'::jsonb) into v_labels
  from (
    select
      label,
      coalesce(sum(
        greatest(0, round((extract(epoch from (ended_at - started_at)) - paused_seconds) / 60))
      ), 0)::int as mins
    from public.focus_sessions
    where user_id = v_uid
      and status in ('ended', 'auto_ended')
      and ended_at is not null
      and (p_start_date is null or to_char(started_at at time zone v_tz, 'YYYY-MM-DD') >= p_start_date)
      and (p_end_date is null or to_char(started_at at time zone v_tz, 'YYYY-MM-DD') <= p_end_date)
    group by label
  ) l;

  return jsonb_build_object(
    'total_focus_minutes', v_total_mins,
    'weekly_goal_minutes', v_goal_mins,
    'goal_completion_percent', case when v_goal_mins > 0 then least(100, round((v_total_mins::numeric / v_goal_mins::numeric) * 100))::int else 0 end,
    'daily_breakdown', v_daily,
    'label_breakdown', v_labels,
    'longest_session_minutes', v_longest_mins
  );
end;
$$;

grant execute on function public.get_personal_focus_stats(uuid, text, text) to authenticated, service_role, postgres;
revoke execute on function public.get_personal_focus_stats(uuid, text, text) from anon, public;

-- =============================================================================
-- 7. AUDIT AI & PARTNER ACCESS CHECK RPCs FOR STRANGER QUERIES
-- =============================================================================
create or replace function public.check_ai_food_photo_access(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller uuid := auth.uid();
  v_budget_cfg jsonb;
  v_monthly_budget numeric;
  v_food_photo_disabled boolean;
  v_ai_disabled boolean;
  v_current_month_cost numeric;
  v_has_consent boolean;
  v_ent record;
  v_user_state text := 'free_taste';
  v_used integer := 0;
  v_cap integer := 3;
  v_caps_cfg jsonb;
  v_today date;
begin
  if v_caller is not null and p_user_id is not null and p_user_id <> v_caller then
    raise exception 'FORBIDDEN: You cannot check another user''s AI access' using errcode = '42501';
  end if;

  if p_user_id is null then
    p_user_id := coalesce(v_caller, auth.uid());
  end if;

  if p_user_id is null then
    raise exception 'UNAUTHENTICATED' using errcode = '42501';
  end if;

  -- 1. Check Global Budget & Feature Kill Switch
  v_budget_cfg := public.get_remote_config('ai_budgets', '{"monthly_budget_usd": 100.0, "food_photo_disabled": false, "ai_disabled": false}'::jsonb);
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
    -- Free / Taste: Lifetime limit of 3 free scans
    v_user_state := 'free_taste';
    v_cap := coalesce((v_caps_cfg->>'free_taste')::integer, 3);

    select coalesce(sum(count), 0)::integer into v_used
    from public.ai_usage
    where user_id = p_user_id and feature = 'food_photo';

    if v_used >= v_cap then
      return jsonb_build_object(
        'allowed', false,
        'code', 'UPGRADE_REQUIRED',
        'user_state', v_user_state,
        'used', v_used,
        'cap', v_cap,
        'remaining', 0,
        'message', 'Free taste limit reached. Upgrade to Pro for daily AI photo logging.'
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

create or replace function public.check_ai_coach_access(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller uuid := auth.uid();
  v_ent record;
begin
  if v_caller is not null and p_user_id is not null and p_user_id <> v_caller then
    raise exception 'FORBIDDEN: You cannot check another user''s AI access' using errcode = '42501';
  end if;

  if p_user_id is null then
    p_user_id := coalesce(v_caller, auth.uid());
  end if;

  if p_user_id is null then
    raise exception 'UNAUTHENTICATED' using errcode = '42501';
  end if;

  select * into v_ent
  from public.entitlements
  where user_id = p_user_id;

  if found and v_ent.status in ('paid', 'grace') and (v_ent.period_end is null or v_ent.period_end > now()) then
    if v_ent.tier = 'pro' then
      return jsonb_build_object('allowed', true, 'reason', 'pro_plan');
    else
      return jsonb_build_object('allowed', false, 'reason', 'pro_required');
    end if;
  end if;

  if found and v_ent.status = 'trial' and (v_ent.period_end is not null and v_ent.period_end > now()) then
    return jsonb_build_object('allowed', true, 'reason', 'active_trial');
  end if;

  return jsonb_build_object('allowed', false, 'reason', 'no_active_plan');
end;
$$;

create or replace function public.check_partner_finder_access(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller uuid := auth.uid();
  v_ent record;
begin
  if v_caller is not null and p_user_id is not null and p_user_id <> v_caller then
    raise exception 'FORBIDDEN: You cannot check another user''s access' using errcode = '42501';
  end if;

  if p_user_id is null then
    p_user_id := coalesce(v_caller, auth.uid());
  end if;

  if p_user_id is null then
    raise exception 'UNAUTHENTICATED' using errcode = '42501';
  end if;

  select * into v_ent
  from public.entitlements
  where user_id = p_user_id;

  if found and v_ent.status in ('paid', 'grace') and (v_ent.period_end is null or v_ent.period_end > now()) then
    if v_ent.tier in ('plus', 'pro') then
      return jsonb_build_object('allowed', true, 'reason', 'active_plan');
    end if;
  end if;

  if found and v_ent.status = 'trial' and (v_ent.period_end is not null and v_ent.period_end > now()) then
    return jsonb_build_object('allowed', true, 'reason', 'active_trial');
  end if;

  return jsonb_build_object('allowed', false, 'reason', 'paid_plan_required');
end;
$$;
