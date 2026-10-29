-- Acknowledgements refer to the last displayed message, not request completion
-- time. Sending a queued message must not acknowledge unseen incoming messages.
do $$
declare f record; v_def text;
begin
  for f in select p.proname,pg_get_functiondef(p.oid) as definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('send_chat_message','get_chat_messages','get_chat_messages_v2') loop
    v_def:=f.definition;
    if f.proname='send_chat_message' then
      v_def:=regexp_replace(v_def,'(?s)  -- Automatically update read state for sender.*?  select jsonb_build_object','  select jsonb_build_object');
      v_def:=replace(v_def,'  -- Idempotency check:', '  perform pg_advisory_xact_lock(hashtextextended(p_client_id,55));' || chr(10) || '  -- Idempotency check:');
    else
      v_def:=replace(v_def,'b.blocker_id = v_caller_id and b.blocked_id = m.sender_id',
        '((b.blocker_id=v_caller_id and b.blocked_id=m.sender_id) or (b.blocked_id=v_caller_id and b.blocker_id=m.sender_id))');
    end if;
    execute v_def;
  end loop;
end; $$;
create or replace function public.mark_chat_read(p_room_id uuid,p_message_id uuid default null)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid; v_time timestamptz;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if not public.is_room_member(p_room_id,auth.uid()) or not public.room_is_usable(p_room_id) then raise exception 'NOT_ROOM_MEMBER'; end if;
  if public.active_room_tier(auth.uid())='free' then raise exception 'PLUS_REQUIRED'; end if;
  select id,created_at into v_id,v_time from public.chat_messages where room_id=p_room_id and (p_message_id is null or id=p_message_id) order by created_at desc,id desc limit 1;
  if v_id is null then
    if p_message_id is not null then raise exception 'MESSAGE_NOT_FOUND'; end if;
    return;
  end if;
  insert into public.chat_read_state(room_id,user_id,last_read_message_id,last_read_at) values(p_room_id,auth.uid(),v_id,v_time)
  on conflict(room_id,user_id) do update set last_read_message_id=excluded.last_read_message_id,last_read_at=excluded.last_read_at
    where (excluded.last_read_at,excluded.last_read_message_id)>(public.chat_read_state.last_read_at,coalesce(public.chat_read_state.last_read_message_id,'00000000-0000-0000-0000-000000000000'::uuid));
end; $$;
create or replace function public.get_chat_unread_count(p_room_id uuid)
returns integer language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_time timestamptz; v_id uuid;
begin
  if auth.uid() is null or not public.is_room_member(p_room_id,auth.uid()) or not public.room_is_usable(p_room_id) or public.active_room_tier(auth.uid())='free' then return 0; end if;
  select coalesce(m.created_at,r.last_read_at),r.last_read_message_id into v_time,v_id from public.chat_read_state r left join public.chat_messages m on m.id=r.last_read_message_id where r.room_id=p_room_id and r.user_id=auth.uid();
  return (select count(*)::integer from public.chat_messages m where m.room_id=p_room_id and m.sender_id is distinct from auth.uid() and m.deleted_at is null
    and (v_time is null or (m.created_at,m.id)>(v_time,coalesce(v_id,'00000000-0000-0000-0000-000000000000'::uuid)))
    and not exists(select 1 from public.blocks b where (b.blocker_id=auth.uid() and b.blocked_id=m.sender_id) or (b.blocked_id=auth.uid() and b.blocker_id=m.sender_id))
    and not exists(select 1 from public.member_mutes mu where mu.user_id=auth.uid() and mu.muted_user_id=m.sender_id)
    and (m.message_type<>'system' or not exists(select 1 from public.chat_room_settings s where s.room_id=m.room_id and s.user_id=auth.uid() and s.mute_system_messages)));
end; $$;
create or replace function public.chat_sender_visible(p_room_id uuid,p_sender_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select public.is_room_member(p_room_id,auth.uid()) and not exists(select 1 from public.blocks b where
    (b.blocker_id=auth.uid() and b.blocked_id=p_sender_id) or (b.blocked_id=auth.uid() and b.blocker_id=p_sender_id))
    and not exists(select 1 from public.member_mutes mu where mu.user_id=auth.uid() and mu.muted_user_id=p_sender_id);
$$;
revoke all on function public.chat_sender_visible(uuid,uuid) from public,anon;
grant execute on function public.chat_sender_visible(uuid,uuid) to authenticated;
create policy chat_current_blocks on public.chat_messages as restrictive for select to authenticated using(public.chat_sender_visible(room_id,sender_id));
create or replace function public.get_chat_hidden_senders(p_room_id uuid)
returns uuid[] language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  if not public.is_room_member(p_room_id,auth.uid()) or public.active_room_tier(auth.uid())='free' then raise exception 'PLUS_REQUIRED'; end if;
  return array(select m.user_id from public.room_members m where m.room_id=p_room_id and not public.chat_sender_visible(p_room_id,m.user_id));
end; $$;
revoke all on function public.get_chat_hidden_senders(uuid) from public,anon;
grant execute on function public.get_chat_hidden_senders(uuid) to authenticated;
create or replace function public.refresh_blocked_rooms()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_one uuid;v_two uuid;
begin
  if tg_table_name='blocks' then
    if tg_op='DELETE' then v_one:=old.blocker_id;v_two:=old.blocked_id;else v_one:=new.blocker_id;v_two:=new.blocked_id;end if;
  else
    if tg_op='DELETE' then v_one:=old.user_id;v_two:=old.muted_user_id;else v_one:=new.user_id;v_two:=new.muted_user_id;end if;
  end if;
  update public.rooms r set updated_at=now() where exists(select 1 from public.room_members a join public.room_members b on b.room_id=a.room_id where a.room_id=r.id and a.user_id=v_one and b.user_id=v_two and a.status<>'left' and b.status<>'left');
  return null;
end; $$;
create trigger blocks_refresh_room after insert or delete on public.blocks for each row execute function public.refresh_blocked_rooms();
create trigger mutes_refresh_room after insert or delete on public.member_mutes for each row execute function public.refresh_blocked_rooms();
revoke all on function public.mark_chat_read(uuid,uuid),public.get_chat_unread_count(uuid) from public,anon;
grant execute on function public.mark_chat_read(uuid,uuid),public.get_chat_unread_count(uuid) to authenticated;
notify pgrst,'reload schema';
