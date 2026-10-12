-- pgTAP test harness for Phase 9: Notifications, Devices, RLS, Quiet Hours, Mutes & Token Cleanup
begin;
select plan(24);

-- -----------------------------------------------------------------------------
-- 1-6. Verify RLS is enabled on all Phase 9 tables
-- -----------------------------------------------------------------------------
select has_table('public', 'devices', 'devices table exists');
select table_has_rls('public', 'devices', 'RLS is enabled on devices');

select has_table('public', 'notification_settings', 'notification_settings table exists');
select table_has_rls('public', 'notification_settings', 'RLS is enabled on notification_settings');

select has_table('public', 'push_notification_queue', 'push_notification_queue table exists');
select table_has_rls('public', 'push_notification_queue', 'RLS is enabled on push_notification_queue');

-- -----------------------------------------------------------------------------
-- 7-18. Verify functions exist
-- -----------------------------------------------------------------------------
select has_function('public', 'register_device', ARRAY['text', 'text', 'text', 'text'], 'register_device exists');
select has_function('public', 'unregister_device', ARRAY['text'], 'unregister_device exists');
select has_function('public', 'cleanup_stale_devices', ARRAY['integer'], 'cleanup_stale_devices exists');
select has_function('public', 'remove_invalid_device_tokens', ARRAY['text[]'], 'remove_invalid_device_tokens exists');

select has_function('public', 'get_or_create_notification_settings', ARRAY['uuid'], 'get_or_create_notification_settings exists');
select has_function('public', 'set_room_chat_mute', ARRAY['uuid', 'boolean'], 'set_room_chat_mute exists');
select has_function('public', 'is_room_chat_muted', ARRAY['uuid', 'uuid'], 'is_room_chat_muted exists');

select has_function('public', 'is_in_quiet_hours', ARRAY['uuid'], 'is_in_quiet_hours exists');
select has_function('public', 'is_user_viewing_chat', ARRAY['uuid', 'uuid'], 'is_user_viewing_chat exists');
select has_function('public', 'queue_push_notification', ARRAY['uuid', 'text', 'text', 'text', 'jsonb', 'uuid'], 'queue_push_notification exists');

select has_function('public', 'process_streak_at_risk_notifications', 'process_streak_at_risk_notifications exists');
select has_function('public', 'process_weekly_summary_notifications', 'process_weekly_summary_notifications exists');
select has_function('public', 'process_trial_ending_notifications', 'process_trial_ending_notifications exists');
select has_function('public', 'queue_subscription_lapse_notification', ARRAY['uuid', 'text'], 'queue_subscription_lapse_notification exists');
select has_function('public', 'queue_room_state_notification', ARRAY['uuid', 'text'], 'queue_room_state_notification exists');

-- -----------------------------------------------------------------------------
-- 19-24. Verify columns exist on chat_room_settings & devices
-- -----------------------------------------------------------------------------
select has_column('public', 'chat_room_settings', 'mute_chat', 'chat_room_settings has mute_chat');
select has_column('public', 'devices', 'fcm_token', 'devices has fcm_token');
select has_column('public', 'devices', 'last_seen', 'devices has last_seen');

select * from finish();
rollback;
