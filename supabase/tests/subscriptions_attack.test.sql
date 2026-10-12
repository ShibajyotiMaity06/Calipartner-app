-- pgTAP test harness for Phase 10: Subscriptions, Paywalls, Entitlements, Webhooks & State Engine
begin;
select plan(35);

-- -----------------------------------------------------------------------------
-- 1-6. Verify Tables & RLS on Phase 10 Tables
-- -----------------------------------------------------------------------------
select has_table('public', 'remote_config', 'remote_config table exists');
select table_has_rls('public', 'remote_config', 'RLS is enabled on remote_config');

select has_table('public', 'processed_webhook_events', 'processed_webhook_events table exists');
select table_has_rls('public', 'processed_webhook_events', 'RLS is enabled on processed_webhook_events');

select has_table('public', 'entitlements', 'entitlements table exists');
select table_has_rls('public', 'entitlements', 'RLS is enabled on entitlements');

-- -----------------------------------------------------------------------------
-- 7-15. Verify Entitlements Column Extensions (Dodo / Store / Reconciliation Shape)
-- -----------------------------------------------------------------------------
select has_column('public', 'entitlements', 'is_unattached', 'entitlements has is_unattached');
select has_column('public', 'entitlements', 'original_transaction_id', 'entitlements has original_transaction_id');
select has_column('public', 'entitlements', 'store_product_id', 'entitlements has store_product_id');
select has_column('public', 'entitlements', 'cancel_at_period_end', 'entitlements has cancel_at_period_end');
select has_column('public', 'entitlements', 'billing_issue_detected_at', 'entitlements has billing_issue_detected_at');
select has_column('public', 'entitlements', 'dodo_customer_id', 'entitlements has dodo_customer_id');
select has_column('public', 'entitlements', 'dodo_subscription_id', 'entitlements has dodo_subscription_id');
select has_column('public', 'entitlements', 'last_event_id', 'entitlements has last_event_id');
select has_column('public', 'entitlements', 'last_event_timestamp', 'entitlements has last_event_timestamp');

-- -----------------------------------------------------------------------------
-- 16-25. Verify SQL Functions Exist
-- -----------------------------------------------------------------------------
select has_function('public', 'get_remote_config', ARRAY['text', 'jsonb'], 'get_remote_config exists');
select has_function('public', 'reconcile_room_subscriptions', ARRAY['uuid'], 'reconcile_room_subscriptions exists');
select has_function('public', 'room_cap', ARRAY['uuid'], 'room_cap exists');
select has_function('public', 'room_is_usable', ARRAY['uuid'], 'room_is_usable exists');
select has_function('public', 'recompute_room_state', ARRAY['uuid'], 'recompute_room_state exists');
select has_function('public', 'sponsor_room', ARRAY['uuid'], 'sponsor_room exists');
select has_function('public', 'join_by_code', ARRAY['text'], 'join_by_code exists');
select has_function('public', 'apply_revenuecat_event', ARRAY['text', 'text', 'uuid', 'text', 'text', 'timestamptz', 'timestamptz', 'jsonb'], 'apply_revenuecat_event exists');
select has_function('public', 'process_room_lifecycle_cron', 'process_room_lifecycle_cron exists');
select has_function('public', 'check_ai_coach_access', ARRAY['uuid'], 'check_ai_coach_access exists');

-- -----------------------------------------------------------------------------
-- 26-29. Verify Remote Configuration Seeds
-- -----------------------------------------------------------------------------
select is(
  (public.get_remote_config('trial_length_days'))::text,
  '3',
  'Remote config trial_length_days defaults to 3'
);

select is(
  (public.get_remote_config('trial_cap'))::text,
  '5',
  'Remote config trial_cap defaults to 5'
);

select is(
  (public.get_remote_config('community_tier_enabled'))::text,
  'false',
  'Remote config community_tier_enabled defaults to false'
);

select is(
  (public.get_remote_config('room_caps')->>'pro')::text,
  '50',
  'Remote config room_caps.pro is 50'
);

-- -----------------------------------------------------------------------------
-- 30-35. Functional Server-Side Entitlement & Webhook Attacks
-- -----------------------------------------------------------------------------
do $$
declare
  u_attacker uuid := '88888888-8888-8888-8888-888888888888'::uuid;
  v_res jsonb;
begin
  if exists (select 1 from information_schema.tables where table_schema = 'auth' and table_name = 'users') then
    insert into auth.users (id, email) values (u_attacker, 'attacker@example.com')
    on conflict (id) do nothing;
  end if;

  insert into public.profiles (id, username, nickname, date_of_birth, sex, height_cm)
  values (u_attacker, 'attacker_p10', 'Attacker', current_date - interval '25 years', 'other', 170)
  on conflict (id) do nothing;

  -- Default free user without plan
  insert into public.entitlements (user_id, tier, period, source, status, period_end)
  values (u_attacker, 'basic', 'monthly', 'none', 'lapsed', now() - interval '1 day')
  on conflict (user_id) do update set status = 'lapsed', period_end = now() - interval '1 day';
end;
$$;

-- 30. AI Coach Attack: User without paid plan cannot access AI Coach
select is(
  public.check_ai_coach_access('88888888-8888-8888-8888-888888888888'::uuid),
  false,
  'Attacker without active plan is rejected from AI coach'
);

-- 31. Partner Finder Attack: User without paid plan cannot access Partner Finder
select is(
  public.check_partner_finder_access('88888888-8888-8888-8888-888888888888'::uuid),
  false,
  'Attacker without active plan is rejected from Partner Finder'
);

-- 32. Webhook Application: Apply Initial Purchase for Attacker -> Granted Pro tier
select lives_ok(
  $$
    select public.apply_revenuecat_event(
      'evt-test-1',
      'INITIAL_PURCHASE',
      '88888888-8888-8888-8888-888888888888'::uuid,
      'pro_annual',
      'app_store',
      now() + interval '365 days',
      now(),
      '{"event": {"id": "evt-test-1"}}'::jsonb
    );
  $$,
  'Applying RevenueCat INITIAL_PURCHASE succeeds'
);

-- 33. Paid plan granted -> Now has access to AI coach
select is(
  public.check_ai_coach_access('88888888-8888-8888-8888-888888888888'::uuid),
  true,
  'Paid plan holder gains AI coach access'
);

-- 34. Webhook Idempotency: Replaying duplicate event ID returns already_processed
select is(
  (
    select (public.apply_revenuecat_event(
      'evt-test-1',
      'INITIAL_PURCHASE',
      '88888888-8888-8888-8888-888888888888'::uuid,
      'pro_annual',
      'app_store',
      now() + interval '365 days',
      now(),
      '{"event": {"id": "evt-test-1"}}'::jsonb
    ))->>'status'
  ),
  'already_processed',
  'Duplicate webhook event ID is detected and safely ignored'
);

-- 35. Webhook Revocation / Refund: Removes access immediately
select lives_ok(
  $$
    select public.apply_revenuecat_event(
      'evt-refund-1',
      'REVOCATION',
      '88888888-8888-8888-8888-888888888888'::uuid,
      'pro_annual',
      'app_store',
      now() - interval '1 second',
      now() + interval '10 seconds',
      '{"event": {"id": "evt-refund-1"}}'::jsonb
    );
  $$,
  'Applying refund REVOCATION event succeeds'
);

select is(
  public.check_ai_coach_access('88888888-8888-8888-8888-888888888888'::uuid),
  false,
  'Refunded user loses access to AI coach immediately'
);

select * from finish();
rollback;
