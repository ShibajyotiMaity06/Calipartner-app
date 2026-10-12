-- pgTAP test harness for Phase 9B: Focus Time (Tables, RLS, Functions, Maintenance)
begin;
select plan(28);

-- -----------------------------------------------------------------------------
-- 1-8. Verify RLS is enabled on all Phase 9B tables
-- -----------------------------------------------------------------------------
select has_table('public', 'room_focus_sessions', 'room_focus_sessions table exists');
select table_has_rls('public', 'room_focus_sessions', 'RLS is enabled on room_focus_sessions');

select has_table('public', 'room_focus_participants', 'room_focus_participants table exists');
select table_has_rls('public', 'room_focus_participants', 'RLS is enabled on room_focus_participants');

select has_table('public', 'focus_sessions', 'focus_sessions table exists');
select table_has_rls('public', 'focus_sessions', 'RLS is enabled on focus_sessions');

select has_table('public', 'focus_settings', 'focus_settings table exists');
select table_has_rls('public', 'focus_settings', 'RLS is enabled on focus_settings');

-- -----------------------------------------------------------------------------
-- 9-10. Verify column enhancements on daily_summaries
-- -----------------------------------------------------------------------------
select has_column('public', 'daily_summaries', 'focus_minutes', 'daily_summaries has focus_minutes');

-- -----------------------------------------------------------------------------
-- 11-28. Verify SQL functions exist
-- -----------------------------------------------------------------------------
select has_function('public', 'server_time', 'server_time exists');
select has_function('public', 'recompute_daily_focus_minutes', ARRAY['uuid', 'text'], 'recompute_daily_focus_minutes exists');

select has_function('public', 'start_personal_focus', ARRAY['uuid', 'text', 'text', 'integer'], 'start_personal_focus exists');
select has_function('public', 'pause_personal_focus', ARRAY['uuid'], 'pause_personal_focus exists');
select has_function('public', 'resume_personal_focus', ARRAY['uuid'], 'resume_personal_focus exists');
select has_function('public', 'end_personal_focus', ARRAY['uuid'], 'end_personal_focus exists');

select has_function('public', 'start_room_focus', ARRAY['uuid', 'text', 'text', 'integer'], 'start_room_focus exists');
select has_function('public', 'join_room_focus', ARRAY['uuid'], 'join_room_focus exists');
select has_function('public', 'leave_room_focus', ARRAY['uuid'], 'leave_room_focus exists');
select has_function('public', 'pause_my_room_focus', ARRAY['uuid'], 'pause_my_room_focus exists');
select has_function('public', 'resume_my_room_focus', ARRAY['uuid'], 'resume_my_room_focus exists');
select has_function('public', 'end_room_focus', ARRAY['uuid'], 'end_room_focus exists');
select has_function('public', 'get_room_focus', ARRAY['uuid'], 'get_room_focus exists');

select has_function('public', 'get_personal_focus_stats', ARRAY['uuid', 'text', 'text'], 'get_personal_focus_stats exists');
select has_function('public', 'get_room_weekly_focus_stats', ARRAY['uuid', 'text'], 'get_room_weekly_focus_stats exists');

select has_function('public', 'process_focus_maintenance', 'process_focus_maintenance exists');

-- Verify columns on focus_sessions
select has_column('public', 'focus_sessions', 'paused_seconds', 'focus_sessions has paused_seconds');
select has_column('public', 'focus_sessions', 'source', 'focus_sessions has source');

select * from finish();
rollback;
