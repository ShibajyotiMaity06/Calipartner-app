-- pgTAP test harness for Phase 11: AI Food-Photo Logging, Consent Tracking, Usage Table, Daily Caps & Budget Switch
begin;
select plan(28);

-- -----------------------------------------------------------------------------
-- 1-4. Verify Tables & RLS on Phase 11 Tables
-- -----------------------------------------------------------------------------
select has_table('public', 'ai_usage', 'ai_usage table exists');
select table_has_rls('public', 'ai_usage', 'RLS is enabled on ai_usage');

select has_table('public', 'consent_records', 'consent_records table exists');
select table_has_rls('public', 'consent_records', 'RLS is enabled on consent_records');

-- -----------------------------------------------------------------------------
-- 5-11. Verify ai_usage Table Columns
-- -----------------------------------------------------------------------------
select has_column('public', 'ai_usage', 'id', 'ai_usage has id');
select has_column('public', 'ai_usage', 'user_id', 'ai_usage has user_id');
select has_column('public', 'ai_usage', 'day', 'ai_usage has day');
select has_column('public', 'ai_usage', 'feature', 'ai_usage has feature');
select has_column('public', 'ai_usage', 'count', 'ai_usage has count');
select has_column('public', 'ai_usage', 'tokens', 'ai_usage has tokens');
select has_column('public', 'ai_usage', 'estimated_cost', 'ai_usage has estimated_cost');

-- -----------------------------------------------------------------------------
-- 12-16. Verify SQL Functions Exist
-- -----------------------------------------------------------------------------
select has_function('public', 'get_ai_food_photo_user_state', ARRAY['uuid'], 'get_ai_food_photo_user_state exists');
select has_function('public', 'has_ai_processing_consent', ARRAY['uuid'], 'has_ai_processing_consent exists');
select has_function('public', 'accept_ai_processing_consent', ARRAY['text'], 'accept_ai_processing_consent exists');
select has_function('public', 'record_ai_usage', ARRAY['uuid', 'text', 'integer', 'numeric', 'date'], 'record_ai_usage exists');
select has_function('public', 'check_ai_food_photo_access', ARRAY['uuid'], 'check_ai_food_photo_access exists');

-- -----------------------------------------------------------------------------
-- 17-20. Verify Remote Configuration Seeds
-- -----------------------------------------------------------------------------
select is(
  (public.get_remote_config('ai_food_photo_caps')->>'trial')::text,
  '3',
  'Remote config ai_food_photo_caps.trial is 3'
);

select is(
  (public.get_remote_config('ai_food_photo_caps')->>'paid')::text,
  '15',
  'Remote config ai_food_photo_caps.paid is 15'
);

select is(
  (public.get_remote_config('ai_food_photo_caps')->>'free_after_trial')::text,
  '0',
  'Remote config ai_food_photo_caps.free_after_trial is 0'
);

select is(
  (public.get_remote_config('ai_budget')->>'monthly_budget_usd')::text,
  '100',
  'Remote config ai_budget.monthly_budget_usd is 100'
);

-- -----------------------------------------------------------------------------
-- 21-28. Functional Server-Side Consent, Cap & Budget Checks
-- -----------------------------------------------------------------------------
do $$
declare
  u_test uuid := '99999999-9999-9999-9999-999999999991'::uuid;
  v_res jsonb;
begin
  if exists (select 1 from information_schema.tables where table_schema = 'auth' and table_name = 'users') then
    insert into auth.users (id, email) values (u_test, 'aiphototester@example.com')
    on conflict (id) do nothing;
  end if;

  -- 21: User without consent returns CONSENT_REQUIRED
  v_res := public.check_ai_food_photo_access(u_test);
  perform is(
    (v_res->>'code')::text,
    'CONSENT_REQUIRED',
    'User without consent record is rejected with CONSENT_REQUIRED'
  );

  -- Grant consent
  insert into public.consent_records (user_id, consent_type, version, accepted_at)
  values (u_test, 'ai_processing', '1.0', now())
  on conflict (user_id, consent_type, version) do update set accepted_at = now();

  -- 22: User without entitlement is free_after_trial (cap = 0 -> DAILY_LIMIT_REACHED)
  v_res := public.check_ai_food_photo_access(u_test);
  perform is(
    (v_res->>'code')::text,
    'DAILY_LIMIT_REACHED',
    'Free user with cap=0 is rejected with DAILY_LIMIT_REACHED'
  );

  -- Set trial entitlement (cap 3)
  insert into public.entitlements (user_id, plan, source, status, period_end, trial_started_at)
  values (u_test, 'free', 'none', 'trial', now() + interval '3 days', now())
  on conflict (user_id) do update set status = 'trial', period_end = now() + interval '3 days';

  -- 23: Trial user access is allowed with cap = 3, used = 0
  v_res := public.check_ai_food_photo_access(u_test);
  perform is(
    (v_res->>'allowed')::text,
    'true',
    'Trial user with consent is allowed access'
  );

  perform is(
    (v_res->>'cap')::text,
    '3',
    'Trial user daily cap is 3'
  );

  -- Record 3 uses to hit cap
  perform public.record_ai_usage(u_test, 'food_photo', 200, 0.001);
  perform public.record_ai_usage(u_test, 'food_photo', 200, 0.001);
  perform public.record_ai_usage(u_test, 'food_photo', 200, 0.001);

  -- 25: Now cap is reached -> DAILY_LIMIT_REACHED
  v_res := public.check_ai_food_photo_access(u_test);
  perform is(
    (v_res->>'code')::text,
    'DAILY_LIMIT_REACHED',
    'Trial user at 3/3 daily cap is rejected with DAILY_LIMIT_REACHED'
  );

  -- Upgrade to Paid (cap 15)
  update public.entitlements
  set status = 'paid', plan = 'monthly', period_end = now() + interval '30 days'
  where user_id = u_test;

  -- 26: Paid user now has remaining allowance (3 used, 12 remaining out of 15)
  v_res := public.check_ai_food_photo_access(u_test);
  perform is(
    (v_res->>'cap')::text,
    '15',
    'Paid user daily cap is 15'
  );
  perform is(
    (v_res->>'remaining')::text,
    '12',
    'Paid user has 12 scans remaining'
  );

  -- 28: Test global budget switch disable
  update public.remote_config
  set value = jsonb_set(value, '{food_photo_disabled}', 'true'::jsonb)
  where key = 'ai_budget';

  v_res := public.check_ai_food_photo_access(u_test);
  perform is(
    (v_res->>'code')::text,
    'FEATURE_DISABLED',
    'Kill switch gracefully disables feature with FEATURE_DISABLED'
  );

  -- Restore config
  update public.remote_config
  set value = jsonb_set(value, '{food_photo_disabled}', 'false'::jsonb)
  where key = 'ai_budget';
end $$;

select * from finish();
rollback;
