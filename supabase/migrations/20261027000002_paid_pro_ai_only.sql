-- Owner instruction: no AI trials or free scans. Only paid Pro unlocks AI.
create or replace function public.check_ai_food_photo_access(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_caller uuid := auth.uid();
  v_ent public.entitlements;
  v_budget jsonb;
  v_caps jsonb;
  v_cost numeric;
  v_zone text;
  v_day date;
  v_used integer := 0;
  v_cap integer;
  v_state text;
begin
  p_user_id := coalesce(p_user_id,v_caller);
  if p_user_id is null or (v_caller is null and coalesce(auth.jwt()->>'role','')<>'service_role') then
    raise exception 'UNAUTHENTICATED' using errcode='42501';
  end if;
  if v_caller is not null and v_caller<>p_user_id then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  select * into v_ent from public.entitlements where user_id=p_user_id;
  if not found or v_ent.tier<>'pro' or v_ent.status not in ('paid','grace') or (v_ent.period_end is not null and v_ent.period_end<=now()) then
    return jsonb_build_object('allowed',false,'code','UPGRADE_REQUIRED','user_state',case when v_ent.tier='plus' then 'paid_plus' else 'free_after_trial' end,'used',0,'cap',0,'remaining',0);
  end if;
  v_budget := public.get_remote_config('ai_budgets','{"monthly_budget_usd":100,"food_photo_disabled":false,"ai_disabled":false}'::jsonb);
  if coalesce((v_budget->>'food_photo_disabled')::boolean,false) or coalesce((v_budget->>'ai_disabled')::boolean,false) then
    return jsonb_build_object('allowed',false,'code','FEATURE_DISABLED');
  end if;
  select coalesce(sum(estimated_cost),0) into v_cost from public.ai_usage
    where day >= date_trunc('month',now() at time zone 'UTC')::date - 1;
  if coalesce((v_budget->>'monthly_budget_usd')::numeric,100)>0 and v_cost>=coalesce((v_budget->>'monthly_budget_usd')::numeric,100) then
    return jsonb_build_object('allowed',false,'code','BUDGET_EXCEEDED');
  end if;
  if not exists(select 1 from public.consent_records where user_id=p_user_id and consent_type='ai_processing') then
    return jsonb_build_object('allowed',false,'code','CONSENT_REQUIRED');
  end if;
  select timezone into v_zone from public.profiles where id=p_user_id;
  v_day := (now() at time zone coalesce(v_zone,'UTC'))::date;
  v_caps := public.get_remote_config('ai_food_photo_caps','{"paid_pro":5,"paid_plus":0,"free_taste":0,"trial":0,"free_after_trial":0}'::jsonb);
  v_state := 'paid_pro';
  v_cap := least(5,greatest(0,coalesce((v_caps->>'paid_pro')::integer,5)));
  select coalesce(sum(count),0)::integer into v_used from public.ai_usage where user_id=p_user_id and feature='food_photo' and day=v_day;
  return jsonb_build_object('allowed',v_used<v_cap,'code',case when v_used>=v_cap then 'DAILY_LIMIT_REACHED' else null end,
    'user_state',v_state,'used',v_used,'cap',v_cap,'remaining',greatest(0,v_cap-v_used));
end; $$;
revoke all on function public.check_ai_food_photo_access(uuid) from public,anon;
grant execute on function public.check_ai_food_photo_access(uuid) to authenticated,service_role;


-- Eliminate the retired starter allowance even in cached/default configuration.
insert into public.remote_config(key,value) values('ai_food_photo_caps','{"paid_pro":5,"paid_plus":0,"free_taste":0,"trial":0,"free_after_trial":0}'::jsonb)
on conflict(key) do update set value=excluded.value;


-- Preserve provider trial status instead of converting trial receipts to paid.
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
  v_trial_start timestamptz;
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

  -- A store trial is never evidence of a Pro purchase. Only seven-day Plus
  -- monthly/annual trials can unlock access; expired/revoked events stay lapsed.
  if upper(coalesce(p_payload->'event'->>'period_type','')) = 'TRIAL' and v_status <> 'lapsed' then
    if v_tier <> 'plus' or p_product_id !~* 'plus_(monthly|annual|yearly)$' then
      v_status := 'lapsed';
      v_period_end := now();
    else
      v_trial_start := coalesce(to_timestamp((p_payload->'event'->>'purchased_at_ms')::numeric / 1000), p_event_timestamp);
      v_status := 'trial';
      v_period_end := least(coalesce(v_period_end, v_trial_start + interval '7 days'), v_trial_start + interval '7 days');
    end if;
  end if;

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

  -- Evaluate the old expiration before overwriting it with a renewal. This
  -- preserves the 30-day deadline even if scheduled maintenance was delayed.
  if v_current_ent.period_end is not null and v_current_ent.period_end<=now() then
    perform public.recompute_room_state(id) from public.rooms where plan_holder_id=p_user_id and state<>'archived';
    select * into v_current_ent from public.entitlements where user_id=p_user_id;
  end if;

  -- 6. Attach hosted room automatically if not yet attached
  v_attached_room := v_current_ent.attached_room_id;
  if v_attached_room is null and v_status in ('paid', 'grace') then
    select id into v_hosted_room
    from public.rooms
    where plan_holder_id = p_user_id
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
    last_event_id, last_event_timestamp, trial_started_at, updated_at
  ) values (
    p_user_id, v_tier, v_period, v_source, v_status,
    v_attached_room, false, (p_payload->'event'->>'original_transaction_id'),
    p_product_id, (p_event_type = 'CANCELLATION'), v_period_end,
    p_event_id, p_event_timestamp, v_trial_start, now()
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
    trial_started_at = coalesce(public.entitlements.trial_started_at, excluded.trial_started_at),
    updated_at = now();

  -- 8. Record processed event
  insert into public.processed_webhook_events (event_id, event_type, user_id, payload, processed_at)
  values (p_event_id, p_event_type, p_user_id, p_payload, now());

  -- An individual subscription covers every room currently hosted by this user.
  perform public.recompute_room_state(id) from public.rooms where plan_holder_id=p_user_id and state<>'archived';

  return jsonb_build_object(
    'status', 'processed',
    'event_id', p_event_id,
    'user_id', p_user_id,
    'tier', v_tier,
    'subscription_status', v_status
  );
end;
$$;


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

  v_trial_days := 7; -- Exact owner policy, never a remotely extended trial.

  -- Grant 7-day trial on Plus tier
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

update public.remote_config set value='7'::jsonb where key='trial_length_days';

-- Repair only the latest verified trial receipts previously classified as paid.
update public.entitlements e set
  status = case when e.tier = 'plus' then 'trial' else 'lapsed' end,
  trial_started_at = coalesce(e.trial_started_at, to_timestamp((w.payload->'event'->>'purchased_at_ms')::numeric / 1000), w.processed_at),
  period_end = case when e.tier = 'plus' then least(e.period_end, coalesce(to_timestamp((w.payload->'event'->>'purchased_at_ms')::numeric / 1000), w.processed_at) + interval '7 days') else now() end,
  updated_at = now()
from public.processed_webhook_events w
where e.last_event_id = w.event_id and e.status in ('paid','grace')
  and upper(coalesce(w.payload->'event'->>'period_type','')) = 'TRIAL';
