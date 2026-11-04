-- Owner correction: Squad text chat is available at every subscription tier.
-- Preserve membership, usable-room, terms, block/mute, moderation and Pro upload checks.
create or replace function public.caller_has_chat_plan()
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select auth.uid() is not null;
$$;
drop trigger if exists chat_sender_plan_v3 on public.chat_messages;
drop trigger if exists free_chat_push_gate on public.push_notification_queue;

-- Patch only current chat definitions so subsequent privacy/cursor repairs are preserved.
do $$
declare f record; definition text;
begin
 for f in select p.oid,pg_get_functiondef(p.oid) body from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in (
   'get_chat_messages','get_chat_messages_v2','mark_chat_read','get_chat_unread_count','send_chat_message',
   'can_read_chat_typing','set_chat_typing','get_chat_typing','can_read_chat_media','report_chat_message',
   'get_squad_mentions','mark_squad_mention_seen','get_squad_mention_context'
  ) loop
  definition:=regexp_replace(f.body,'if public\.active_room_tier\((auth\.uid\(\)|v_caller_id)\)=''free'' then raise exception ''PLUS_REQUIRED'';\s*end if;','','g');
  definition:=replace(definition,'if public.active_room_tier(auth.uid())=''free'' then return 0; end if;','');
  definition:=replace(definition,' or public.active_room_tier(auth.uid())=''free''','');
  definition:=replace(definition,'and public.active_room_tier(auth.uid())<>''free''','');
  definition:=replace(definition,'and public.active_room_tier(p_user_id)<>''free''','');
  definition:=replace(definition,'paid:=public.active_room_tier(auth.uid())<>''free'';','paid:=true;');
  definition:=replace(definition,'if not public.can_read_chat_typing(p_room_id,auth.uid()) then raise exception ''PLUS_REQUIRED''; end if;','if not public.can_read_chat_typing(p_room_id,auth.uid()) then raise exception ''NOT_AUTHORIZED''; end if;');
  execute definition;
 end loop;
end; $$;
create or replace function public.get_chat_hidden_senders(p_room_id uuid)
returns uuid[] language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
 if not public.is_room_member(p_room_id,auth.uid()) then raise exception 'NOT_ROOM_MEMBER'; end if;
 if not public.room_is_usable(p_room_id) then raise exception 'ROOM_LOCKED'; end if;
 return array(select m.user_id from public.room_members m where m.room_id=p_room_id and not public.chat_sender_visible(p_room_id,m.user_id));
end; $$;

-- A queued preview is re-authorized at dispatch, even after membership/block changes.
create function public.can_deliver_squad_chat_push(p_user_id uuid,p_room_id uuid,p_message_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select public.is_room_member(p_room_id,p_user_id) and public.room_is_usable(p_room_id)
  and exists(select 1 from public.chat_messages m where m.id=p_message_id and m.room_id=p_room_id and m.deleted_at is null
   and not exists(select 1 from public.blocks b where (b.blocker_id=p_user_id and b.blocked_id=m.sender_id) or (b.blocked_id=p_user_id and b.blocker_id=m.sender_id))
   and not exists(select 1 from public.member_mutes mu where mu.user_id=p_user_id and mu.muted_user_id=m.sender_id));
$$;
revoke all on function public.can_deliver_squad_chat_push(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.can_deliver_squad_chat_push(uuid,uuid,uuid) to service_role;
notify pgrst,'reload schema';
