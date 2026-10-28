-- Owner correction: Free no longer reads room chat. Preserve other room access.
create or replace function public.caller_has_chat_plan()
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select auth.uid() is not null and public.active_room_tier(auth.uid())<>'free';
$$;
revoke all on function public.caller_has_chat_plan() from public,anon;
grant execute on function public.caller_has_chat_plan() to authenticated;
create policy paid_chat_read on public.chat_messages as restrictive for select to authenticated using(public.caller_has_chat_plan());
create policy paid_chat_read on public.chat_attachments as restrictive for select to authenticated using(public.caller_has_chat_plan());
create policy paid_chat_read on public.chat_read_state as restrictive for select to authenticated using(public.caller_has_chat_plan());
create policy paid_chat_read on public.chat_room_settings as restrictive for select to authenticated using(public.caller_has_chat_plan());
create policy paid_chat_push_read on public.push_notification_queue as restrictive for select to authenticated
using(notification_type<>'chat_message' or public.caller_has_chat_plan());
create or replace function public.get_chat_messages(
  p_room_id uuid,
  p_limit integer default 50,
  p_before_created_at timestamptz default null,
  p_after_created_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_caller_id uuid := auth.uid();
  v_room record;
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 50);
  v_result jsonb;
begin
  if v_caller_id is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if not public.is_room_member(p_room_id, v_caller_id) then
    raise exception 'NOT_ROOM_MEMBER: Access denied';
  end if;

  if public.active_room_tier(auth.uid())='free' then raise exception 'PLUS_REQUIRED'; end if;

  select state into v_room
  from public.rooms
  where id = p_room_id;

  if not found or not public.room_is_usable(p_room_id) or v_room.state = 'locked' then
    raise exception 'ROOM_LOCKED: This room is paused';
  end if;

  select coalesce(
    jsonb_agg(row_data order by (row_data->>'created_at')::timestamptz asc),
    '[]'::jsonb
  ) into v_result
  from (
    select jsonb_build_object(
      'id', m.id,
      'client_id', m.client_id,
      'room_id', m.room_id,
      'sender_id', m.sender_id,
      'sender_nickname', p.nickname,
      'sender_username', p.username,
      'sender_avatar_url', p.avatar_url,
      'message_type', m.message_type,
      'system_event_type', m.system_event_type,
      'text', case when m.deleted_at is not null then '[Message deleted]' else m.text end,
      'created_at', m.created_at,
      'deleted_at', m.deleted_at,
      'attachments', case when m.deleted_at is not null then '[]'::jsonb else
        coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', a.id,
                'message_id', a.message_id,
                'storage_key', a.storage_key,
                'width', a.width,
                'height', a.height,
                'size', a.size,
                'mime_type', a.mime_type,
                'moderation_status', a.moderation_status,
                'created_at', a.created_at
              )
            )
            from public.chat_attachments a
            where a.message_id = m.id
          ),
          '[]'::jsonb
        )
      end
    ) as row_data
    from public.chat_messages m
    left join public.profiles p on p.id = m.sender_id
    where m.room_id = p_room_id
      -- Filter blocked members
      and (m.sender_id is null or not exists (
        select 1 from public.blocks b where b.blocker_id = v_caller_id and b.blocked_id = m.sender_id
      ))
      -- Filter muted members
      and (m.sender_id is null or not exists (
        select 1 from public.member_mutes mu where mu.user_id = v_caller_id and mu.muted_user_id = m.sender_id
      ))
      -- Filter muted system messages
      and (m.message_type <> 'system' or not exists (
        select 1 from public.chat_room_settings s
        where s.room_id = m.room_id and s.user_id = v_caller_id and s.mute_system_messages = true
      ))
      -- Pagination filter
      and (p_before_created_at is null or m.created_at < p_before_created_at)
      and (p_after_created_at is null or m.created_at > p_after_created_at)
    order by m.created_at desc
    limit v_limit
  ) sub;

  return v_result;
end;
$$;

create or replace function public.mark_chat_read(
  p_room_id uuid,
  p_message_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_id uuid := auth.uid();
  v_now timestamptz := now();
begin
  if v_caller_id is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if not public.is_room_member(p_room_id, v_caller_id) or not public.room_is_usable(p_room_id) then
    raise exception 'NOT_ROOM_MEMBER';
  end if;

  if public.active_room_tier(auth.uid())='free' then raise exception 'PLUS_REQUIRED'; end if;

  insert into public.chat_read_state (room_id, user_id, last_read_message_id, last_read_at)
  values (p_room_id, v_caller_id, p_message_id, v_now)
  on conflict (room_id, user_id) do update
  set last_read_message_id = coalesce(excluded.last_read_message_id, public.chat_read_state.last_read_message_id),
      last_read_at = v_now;
end;
$$;

create or replace function public.get_chat_unread_count(p_room_id uuid)
returns integer
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_caller_id uuid := auth.uid();
  v_last_read timestamptz;
  v_count integer;
begin
  if public.active_room_tier(auth.uid())='free' then return 0; end if;
  if v_caller_id is null then
    return 0;
  end if;

  if not public.is_room_member(p_room_id, v_caller_id) or not public.room_is_usable(p_room_id) then
    return 0;
  end if;

  select last_read_at into v_last_read
  from public.chat_read_state
  where room_id = p_room_id and user_id = v_caller_id;

  select count(*) into v_count
  from public.chat_messages m
  where m.room_id = p_room_id
    and m.sender_id <> v_caller_id
    and m.deleted_at is null
    and (v_last_read is null or m.created_at > v_last_read)
    and (m.sender_id is null or not exists (
      select 1 from public.blocks b where b.blocker_id = v_caller_id and b.blocked_id = m.sender_id
    ))
    and (m.sender_id is null or not exists (
      select 1 from public.member_mutes mu where mu.user_id = v_caller_id and mu.muted_user_id = m.sender_id
    ))
    and (m.message_type <> 'system' or not exists (
      select 1 from public.chat_room_settings s
      where s.room_id = m.room_id and s.user_id = v_caller_id and s.mute_system_messages = true
    ));

  return coalesce(v_count, 0);
end;
$$;
create or replace function public.send_chat_message(
  p_room_id uuid,
  p_client_id text,
  p_text text default null,
  p_attachments jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_id uuid := auth.uid();
  v_room record;
  v_existing record;
  v_msg_id uuid;
  v_created_at timestamptz;
  v_att jsonb;
  v_storage_key text;
  v_mime text;
  v_size integer;
  v_width integer;
  v_height integer;
  v_att_count integer;
  v_result jsonb;
begin
  if v_caller_id is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if not public.is_room_member(p_room_id, v_caller_id) then
    raise exception 'NOT_ROOM_MEMBER: You are not an active member of this room';
  end if;

  select state into v_room
  from public.rooms
  where id = p_room_id;

  if not found or not public.room_is_usable(p_room_id) or v_room.state = 'locked' then
    raise exception 'ROOM_LOCKED: This room is paused';
  end if;

  if v_room.state = 'dormant' then
    raise exception 'ROOM_DORMANT_READ_ONLY: Chat is read-only in dormant rooms';
  end if;

  if not public.has_accepted_chat_terms(v_caller_id) then
    raise exception 'TERMS_REQUIRED: Must accept terms before sending';
  end if;

  if public.active_room_tier(v_caller_id)='free' then raise exception 'PLUS_REQUIRED'; end if;

  -- Idempotency check: return existing message if already inserted
  select id, client_id, room_id, sender_id, message_type, system_event_type, text, created_at, deleted_at
  into v_existing
  from public.chat_messages
  where client_id = p_client_id;

  if found then
    if v_existing.sender_id <> v_caller_id or v_existing.room_id <> p_room_id then raise exception 'NOT_AUTHORIZED'; end if;
    return jsonb_build_object(
      'id', v_existing.id,
      'client_id', v_existing.client_id,
      'room_id', v_existing.room_id,
      'sender_id', v_existing.sender_id,
      'message_type', v_existing.message_type,
      'system_event_type', v_existing.system_event_type,
      'text', v_existing.text,
      'created_at', v_existing.created_at,
      'deleted_at', v_existing.deleted_at,
      'attachments', '[]'::jsonb
    );
  end if;

  v_att_count := jsonb_array_length(coalesce(p_attachments, '[]'::jsonb));
  if (p_text is null or char_length(trim(p_text)) = 0) and v_att_count = 0 then
    raise exception 'MESSAGE_EMPTY: Message must contain text or attachments';
  end if;

  if p_text is not null and char_length(p_text) > 2000 then
    raise exception 'MESSAGE_TOO_LONG: Maximum 2000 characters allowed';
  end if;

  if v_att_count > 5 then
    raise exception 'ATTACHMENT_LIMIT_EXCEEDED: Maximum 5 images per message';
  end if;

  -- Insert message
  insert into public.chat_messages (
    client_id, room_id, sender_id, message_type, text
  ) values (
    p_client_id, p_room_id, v_caller_id, 'user', p_text
  )
  returning id, created_at into v_msg_id, v_created_at;

  -- Insert attachments if provided
  if v_att_count > 0 then
    for i in 0 .. (v_att_count - 1) loop
      v_att := p_attachments->i;
      v_storage_key := v_att->>'storage_key';
      if v_storage_key not like 'rooms/' || p_room_id::text || '/messages/' || p_client_id || '/%' then raise exception 'INVALID_STORAGE_KEY'; end if;
      v_mime := v_att->>'mime_type';
      v_size := (v_att->>'size')::integer;
      v_width := (v_att->>'width')::integer;
      v_height := (v_att->>'height')::integer;

      insert into public.chat_attachments (
        message_id, storage_key, width, height, size, mime_type, moderation_status
      ) values (
        v_msg_id, v_storage_key, v_width, v_height, v_size, v_mime, 'pending'
      );
    end loop;
  end if;

  -- Automatically update read state for sender
  insert into public.chat_read_state (room_id, user_id, last_read_message_id, last_read_at)
  values (p_room_id, v_caller_id, v_msg_id, v_created_at)
  on conflict (room_id, user_id) do update
  set last_read_message_id = v_msg_id,
      last_read_at = v_created_at;

  select jsonb_build_object(
    'id', m.id,
    'client_id', m.client_id,
    'room_id', m.room_id,
    'sender_id', m.sender_id,
    'message_type', m.message_type,
    'system_event_type', m.system_event_type,
    'text', m.text,
    'created_at', m.created_at,
    'deleted_at', m.deleted_at,
    'attachments', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', a.id,
            'message_id', a.message_id,
            'storage_key', a.storage_key,
            'width', a.width,
            'height', a.height,
            'size', a.size,
            'mime_type', a.mime_type,
            'moderation_status', a.moderation_status,
            'created_at', a.created_at
          )
        )
        from public.chat_attachments a
        where a.message_id = m.id
      ),
      '[]'::jsonb
    )
  ) into v_result
  from public.chat_messages m
  where m.id = v_msg_id;

  return v_result;
end;
$$;

-- Do not enqueue message previews for Free recipients; existing pending previews are skipped.
create or replace function public.filter_free_chat_push()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.notification_type='chat_message' and public.active_room_tier(new.user_id)='free' then return null; end if;
  return new;
end; $$;
revoke all on function public.filter_free_chat_push() from public,anon,authenticated;
create trigger free_chat_push_gate before insert on public.push_notification_queue for each row execute function public.filter_free_chat_push();
update public.push_notification_queue set status='skipped',skip_reason='PLUS_REQUIRED'
where notification_type='chat_message' and status in ('pending','processing') and public.active_room_tier(user_id)='free';
notify pgrst, 'reload schema';
