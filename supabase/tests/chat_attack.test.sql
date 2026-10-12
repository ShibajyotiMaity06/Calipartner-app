-- pgTAP test harness for Phase 8: Room Chat, Attachments, R2 Policies, Offline Idempotency & Safety
begin;
select plan(24);

-- -----------------------------------------------------------------------------
-- 1-7. Verify RLS is enabled on all Phase 8 tables
-- -----------------------------------------------------------------------------
select has_table('public', 'consent_records', 'consent_records table exists');
select table_has_rls('public', 'consent_records', 'RLS is enabled on consent_records');

select has_table('public', 'chat_messages', 'chat_messages table exists');
select table_has_rls('public', 'chat_messages', 'RLS is enabled on chat_messages');

select has_table('public', 'chat_attachments', 'chat_attachments table exists');
select table_has_rls('public', 'chat_attachments', 'RLS is enabled on chat_attachments');

select has_table('public', 'chat_read_state', 'chat_read_state table exists');
select table_has_rls('public', 'chat_read_state', 'RLS is enabled on chat_read_state');

select has_table('public', 'member_mutes', 'member_mutes table exists');
select table_has_rls('public', 'member_mutes', 'RLS is enabled on member_mutes');

select has_table('public', 'chat_room_settings', 'chat_room_settings table exists');
select table_has_rls('public', 'chat_room_settings', 'RLS is enabled on chat_room_settings');

select has_table('public', 'moderation_queue', 'moderation_queue table exists');
select table_has_rls('public', 'moderation_queue', 'RLS is enabled on moderation_queue');

-- -----------------------------------------------------------------------------
-- 8-16. Verify functions exist
-- -----------------------------------------------------------------------------
select has_function('public', 'has_accepted_chat_terms', ARRAY['uuid'], 'has_accepted_chat_terms exists');
select has_function('public', 'accept_chat_terms', ARRAY['text'], 'accept_chat_terms exists');
select has_function('public', 'send_chat_message', ARRAY['uuid', 'text', 'text', 'jsonb'], 'send_chat_message exists');
select has_function('public', 'get_chat_messages', ARRAY['uuid', 'integer', 'timestamptz', 'timestamptz'], 'get_chat_messages exists');
select has_function('public', 'mark_chat_read', ARRAY['uuid', 'uuid'], 'mark_chat_read exists');
select has_function('public', 'get_chat_unread_count', ARRAY['uuid'], 'get_chat_unread_count exists');
select has_function('public', 'delete_own_chat_message', ARRAY['uuid'], 'delete_own_chat_message exists');
select has_function('public', 'report_chat_message', ARRAY['uuid', 'text', 'text'], 'report_chat_message exists');
select has_function('public', 'mute_chat_member', ARRAY['uuid'], 'mute_chat_member exists');
select has_function('public', 'unmute_chat_member', ARRAY['uuid'], 'unmute_chat_member exists');

select * from finish();
rollback;
