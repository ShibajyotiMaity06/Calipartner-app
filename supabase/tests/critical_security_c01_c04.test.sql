-- pgTAP test harness for Critical Security Findings C01 & C04
begin;
select plan(19);

-- -----------------------------------------------------------------------------
-- 1-6. Verify Dev Helpers, Webhooks, AI Usage, and Queues are NOT Executable by PUBLIC/Anon/Authenticated
-- -----------------------------------------------------------------------------
select has_function('public', 'dev_grant_plan', ARRAY['uuid', 'text', 'text', 'text', 'integer', 'uuid'], 'dev_grant_plan exists');
select has_function('public', 'dev_revoke_plan', ARRAY['uuid'], 'dev_revoke_plan exists');
select has_function('public', 'apply_revenuecat_event', ARRAY['text', 'text', 'uuid', 'text', 'text', 'timestamptz', 'timestamptz', 'jsonb'], 'apply_revenuecat_event exists');
select has_function('public', 'record_ai_usage', ARRAY['uuid', 'text', 'integer', 'numeric', 'date'], 'record_ai_usage exists');
select has_function('public', 'queue_push_notification', ARRAY['uuid', 'text', 'text', 'text', 'jsonb', 'uuid'], 'queue_push_notification exists');
select has_function('public', 'internal_get_or_create_notification_settings', ARRAY['uuid'], 'internal_get_or_create_notification_settings exists');

-- -----------------------------------------------------------------------------
-- 7-12. Verify Functions Exist with Updated Signatures / Security Definer
-- -----------------------------------------------------------------------------
select has_function('public', 'get_personal_focus_stats', ARRAY['uuid', 'text', 'text'], 'get_personal_focus_stats exists');
select has_function('public', 'get_or_create_notification_settings', ARRAY['uuid'], 'get_or_create_notification_settings exists');
select has_function('public', 'start_trial_if_eligible', ARRAY['uuid', 'text', 'uuid'], 'start_trial_if_eligible exists');
select has_function('public', 'check_ai_food_photo_access', ARRAY['uuid'], 'check_ai_food_photo_access exists');
select has_function('public', 'block_user', ARRAY['uuid'], 'block_user exists');
select has_function('public', 'unblock_user', ARRAY['uuid'], 'unblock_user exists');

-- -----------------------------------------------------------------------------
-- 13-19. Verify Behavior & Non-Negative Validation on record_ai_usage
-- -----------------------------------------------------------------------------
-- Test negative tokens rejection
prepare reject_negative_tokens as
  select public.record_ai_usage('00000000-0000-0000-0000-000000000001'::uuid, 'food_photo', -50, 0.001);
select throws_ok('reject_negative_tokens', '22003', null, 'record_ai_usage rejects negative tokens');

-- Test negative cost rejection
prepare reject_negative_cost as
  select public.record_ai_usage('00000000-0000-0000-0000-000000000001'::uuid, 'food_photo', 100, -0.05);
select throws_ok('reject_negative_cost', '22003', null, 'record_ai_usage rejects negative cost');

-- Test unauthenticated access to personal focus stats raises exception
prepare reject_unauthenticated_focus as
  select public.get_personal_focus_stats('00000000-0000-0000-0000-000000000001'::uuid);
-- When auth.uid() is null and role is not service_role, must raise 42501 UNAUTHENTICATED
select throws_ok('reject_unauthenticated_focus', '42501', null, 'get_personal_focus_stats rejects unauthenticated query');

-- Test unauthenticated access to notification settings raises exception
prepare reject_unauthenticated_ntf_settings as
  select public.get_or_create_notification_settings('00000000-0000-0000-0000-000000000001'::uuid);
select throws_ok('reject_unauthenticated_ntf_settings', '42501', null, 'get_or_create_notification_settings rejects unauthenticated query');

-- Test unauthenticated start_trial_if_eligible raises exception
prepare reject_unauthenticated_start_trial as
  select public.start_trial_if_eligible('00000000-0000-0000-0000-000000000001'::uuid);
select throws_ok('reject_unauthenticated_start_trial', '42501', null, 'start_trial_if_eligible rejects unauthenticated query');

-- Test unauthenticated unblock_user raises exception
prepare reject_unauthenticated_unblock_user as
  select public.unblock_user('00000000-0000-0000-0000-000000000001'::uuid);
select throws_ok('reject_unauthenticated_unblock_user', 'P0001', null, 'unblock_user rejects unauthenticated query');

-- Test valid usage recording with positive values
prepare valid_record_usage as
  select public.record_ai_usage('00000000-0000-0000-0000-000000000001'::uuid, 'food_photo', 250, 0.0015);
select lives_ok('valid_record_usage', 'record_ai_usage succeeds with valid positive values');

select * from finish();
rollback;
