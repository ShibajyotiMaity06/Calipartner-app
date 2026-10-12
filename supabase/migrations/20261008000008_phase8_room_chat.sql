-- Phase 8: Room Chat with Images, Attachments, Read State, Realtime,
-- Offline Queue Idempotency, Safety (Mute, Block, Report, Moderation),
-- Terms Consent & Usable/Locked Room Access Control.
-- Complies with PRD 6.10 (CHT-1..CHT-12), 8.2, 8.3, 9 and AGENT_RULES.md.

-- -----------------------------------------------------------------------------
-- 1. CONSENT RECORDS (PRD 6.10 CHT-8, 8.2, 8.3)
-- Required before first message is sent
-- -----------------------------------------------------------------------------
create table if not exists public.consent_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  consent_type text not null check (consent_type in ('chat_terms', 'terms', 'privacy_policy', 'ai_processing', 'partner_finder')),
  version text not null default '1.0',
  metadata jsonb not null default '{}'::jsonb,
  accepted_at timestamptz not null default now(),
  constraint uq_user_consent unique (user_id, consent_type, version)
);

alter table public.consent_records enable row level security;

drop policy if exists consent_records_select_own on public.consent_records;
create policy consent_records_select_own on public.consent_records
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists consent_records_insert_own on public.consent_records;
create policy consent_records_insert_own on public.consent_records
  for insert to authenticated
  with check (auth.uid() = user_id);

create or replace function public.has_accepted_chat_terms(p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.consent_records
    where user_id = p_user_id
      and consent_type in ('chat_terms', 'terms')
  );
$$;

create or replace function public.accept_chat_terms(p_version text default '1.0')
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  insert into public.consent_records (user_id, consent_type, version)
  values (auth.uid(), 'chat_terms', coalesce(p_version, '1.0'))
  on conflict (user_id, consent_type, version) do update
  set accepted_at = now();
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. MEMBER MUTES & CHAT ROOM SETTINGS (PRD 6.8 ROOM-8, 6.10 CHT-8, CHT-9)
-- -----------------------------------------------------------------------------
create table if not exists public.member_mutes (
  user_id uuid not null references auth.users(id) on delete cascade,
  muted_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, muted_user_id),
  check (user_id <> muted_user_id)
);

alter table public.member_mutes enable row level security;

drop policy if exists member_mutes_select_own on public.member_mutes;
create policy member_mutes_select_own on public.member_mutes
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists member_mutes_insert_own on public.member_mutes;
create policy member_mutes_insert_own on public.member_mutes
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists member_mutes_delete_own on public.member_mutes;
create policy member_mutes_delete_own on public.member_mutes
  for delete to authenticated
  using (auth.uid() = user_id);

create table if not exists public.chat_room_settings (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  mute_system_messages boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

alter table public.chat_room_settings enable row level security;

drop policy if exists chat_room_settings_select on public.chat_room_settings;
create policy chat_room_settings_select on public.chat_room_settings
  for select to authenticated
  using (
    auth.uid() = user_id
    and public.is_room_member(room_id, auth.uid())
  );

drop policy if exists chat_room_settings_all on public.chat_room_settings;
create policy chat_room_settings_all on public.chat_room_settings
  for all to authenticated
  using (
    auth.uid() = user_id
    and public.is_room_member(room_id, auth.uid())
  )
  with check (
    auth.uid() = user_id
    and public.is_room_member(room_id, auth.uid())
  );

-- -----------------------------------------------------------------------------
-- 3. CHAT MESSAGES TABLE & POLICIES (PRD 6.10 CHT-1..CHT-12)
-- client_id for idempotency, text <= 2000, room_is_usable check, locked check
-- -----------------------------------------------------------------------------
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  client_id text not null unique,
  room_id uuid not null references public.rooms(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  message_type text not null default 'user' check (message_type in ('user', 'system')),
  system_event_type text check (system_event_type in ('member_joined', 'member_left', 'room_created', 'streak_milestone', null)),
  text text check (text is null or char_length(text) <= 2000),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_chat_messages_room_created
  on public.chat_messages (room_id, created_at desc);

create index if not exists idx_chat_messages_sender
  on public.chat_messages (sender_id);

create index if not exists idx_chat_messages_client_id
  on public.chat_messages (client_id);

alter table public.chat_messages enable row level security;

-- SELECT policy:
-- 1. Must be active/paused member of the room
-- 2. Room must be usable (plan active/trial and not locked/archived)
-- 3. Room must NOT be in 'locked' state ("This room is paused")
-- 4. Sender cannot be blocked by caller
-- 5. Sender cannot be muted by caller
-- 6. System messages not muted by caller
drop policy if exists chat_messages_select on public.chat_messages;
create policy chat_messages_select on public.chat_messages
  for select to authenticated
  using (
    public.is_room_member(room_id, auth.uid())
    and public.room_is_usable(room_id)
    and not exists (
      select 1 from public.rooms r where r.id = room_id and r.state = 'locked'
    )
    and (sender_id is null or not exists (
      select 1 from public.blocks b where b.blocker_id = auth.uid() and b.blocked_id = sender_id
    ))
    and (sender_id is null or not exists (
      select 1 from public.member_mutes m where m.user_id = auth.uid() and m.muted_user_id = sender_id
    ))
    and (message_type <> 'system' or not exists (
      select 1 from public.chat_room_settings s
      where s.room_id = chat_messages.room_id
        and s.user_id = auth.uid()
        and s.mute_system_messages = true
    ))
  );

-- INSERT policy:
-- Sender must be self (or system via security definer), room member, usable room, not locked, not dormant, terms accepted
drop policy if exists chat_messages_insert on public.chat_messages;
create policy chat_messages_insert on public.chat_messages
  for insert to authenticated
  with check (
    auth.uid() = sender_id
    and message_type = 'user'
    and public.is_room_member(room_id, auth.uid())
    and public.room_is_usable(room_id)
    and not exists (
      select 1 from public.rooms r where r.id = room_id and r.state in ('locked', 'dormant', 'archived')
    )
    and public.has_accepted_chat_terms(auth.uid())
    and (text is null or char_length(text) <= 2000)
  );

-- UPDATE policy:
-- Owner can soft-delete their own message by setting deleted_at
drop policy if exists chat_messages_update on public.chat_messages;
create policy chat_messages_update on public.chat_messages
  for update to authenticated
  using (
    auth.uid() = sender_id
    and public.is_room_member(room_id, auth.uid())
    and public.room_is_usable(room_id)
  )
  with check (
    auth.uid() = sender_id
    and deleted_at is not null
  );

-- Direct client DELETE is forbidden; soft-delete only
drop policy if exists chat_messages_delete on public.chat_messages;
create policy chat_messages_delete on public.chat_messages
  for delete to authenticated
  using (false);

-- -----------------------------------------------------------------------------
-- 4. CHAT ATTACHMENTS TABLE & POLICIES (PRD 6.10 CHT-2, CHT-3, CHT-7)
-- Max 5 images per message, max 10MB, allowed types JPEG/PNG/HEIC/WebP
-- -----------------------------------------------------------------------------
create table if not exists public.chat_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  storage_key text not null unique,
  width integer,
  height integer,
  size integer not null check (size > 0 and size <= 10485760), -- max 10 MB (10 * 1024 * 1024)
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/heic', 'image/webp')),
  moderation_status text not null default 'pending' check (moderation_status in ('pending', 'ok', 'blocked')),
  created_at timestamptz not null default now()
);

create index if not exists idx_chat_attachments_message
  on public.chat_attachments (message_id);

alter table public.chat_attachments enable row level security;

drop policy if exists chat_attachments_select on public.chat_attachments;
create policy chat_attachments_select on public.chat_attachments
  for select to authenticated
  using (
    exists (
      select 1 from public.chat_messages m
      where m.id = chat_attachments.message_id
        and public.is_room_member(m.room_id, auth.uid())
        and public.room_is_usable(m.room_id)
        and not exists (
          select 1 from public.rooms r where r.id = m.room_id and r.state = 'locked'
        )
        and (m.sender_id is null or not exists (
          select 1 from public.blocks b where b.blocker_id = auth.uid() and b.blocked_id = m.sender_id
        ))
        and (m.sender_id is null or not exists (
          select 1 from public.member_mutes mu where mu.user_id = auth.uid() and mu.muted_user_id = m.sender_id
        ))
        and m.deleted_at is null
    )
  );

drop policy if exists chat_attachments_insert on public.chat_attachments;
create policy chat_attachments_insert on public.chat_attachments
  for insert to authenticated
  with check (
    exists (
      select 1 from public.chat_messages m
      where m.id = message_id
        and m.sender_id = auth.uid()
        and public.is_room_member(m.room_id, auth.uid())
        and public.room_is_usable(m.room_id)
        and not exists (
          select 1 from public.rooms r where r.id = m.room_id and r.state in ('locked', 'dormant', 'archived')
        )
    )
  );

drop policy if exists chat_attachments_delete on public.chat_attachments;
create policy chat_attachments_delete on public.chat_attachments
  for delete to authenticated
  using (false);

-- -----------------------------------------------------------------------------
-- 5. CHAT READ STATE (PRD 6.10 CHT-6)
-- -----------------------------------------------------------------------------
create table if not exists public.chat_read_state (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_read_message_id uuid references public.chat_messages(id) on delete set null,
  last_read_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

alter table public.chat_read_state enable row level security;

drop policy if exists chat_read_state_select on public.chat_read_state;
create policy chat_read_state_select on public.chat_read_state
  for select to authenticated
  using (
    auth.uid() = user_id
    and public.is_room_member(room_id, auth.uid())
    and public.room_is_usable(room_id)
  );

drop policy if exists chat_read_state_upsert on public.chat_read_state;
create policy chat_read_state_upsert on public.chat_read_state
  for all to authenticated
  using (
    auth.uid() = user_id
    and public.is_room_member(room_id, auth.uid())
    and public.room_is_usable(room_id)
  )
  with check (
    auth.uid() = user_id
    and public.is_room_member(room_id, auth.uid())
    and public.room_is_usable(room_id)
  );

-- -----------------------------------------------------------------------------
-- 6. MODERATION QUEUE (PRD 6.10 CHT-8, 8.3)
-- -----------------------------------------------------------------------------
create table if not exists public.moderation_queue (
  id uuid primary key default gen_random_uuid(),
  attachment_id uuid references public.chat_attachments(id) on delete set null,
  message_id uuid references public.chat_messages(id) on delete cascade,
  reporter_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'flagged')),
  provider text not null default 'stub',
  provider_score numeric,
  flagged_reasons text[] default '{}',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

alter table public.moderation_queue enable row level security;

drop policy if exists moderation_queue_no_client on public.moderation_queue;
create policy moderation_queue_no_client on public.moderation_queue
  for all to anon, authenticated using (false);

-- -----------------------------------------------------------------------------
-- 7. TRIGGERS: RATE LIMITS, CAPACITY, DELETE ATTACHMENTS (PRD 6.10 CHT-7, CHT-11)
-- -----------------------------------------------------------------------------

-- Trigger function: enforce message rate limits (20 msgs/min) and state checks
create or replace function public.trg_chat_messages_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_room record;
begin
  if new.message_type = 'user' and new.sender_id is not null then
    -- Terms check
    if not public.has_accepted_chat_terms(new.sender_id) then
      raise exception 'TERMS_REQUIRED: Terms of use must be accepted before sending a message';
    end if;

    -- Rate limit check: 20 messages per minute
    if not public.check_rate_limit('chat_msg:' || new.sender_id, 20, 60) then
      raise exception 'RATE_LIMIT_EXCEEDED: Maximum 20 messages per minute';
    end if;

    -- Room state check
    select state into v_room
    from public.rooms
    where id = new.room_id;

    if not found or not public.room_is_usable(new.room_id) or v_room.state = 'locked' then
      raise exception 'ROOM_LOCKED: This room is paused';
    end if;

    if v_room.state = 'dormant' then
      raise exception 'ROOM_DORMANT_READ_ONLY: Chat is read-only in dormant rooms';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_chat_messages_before_insert on public.chat_messages;
create trigger trg_chat_messages_before_insert
  before insert on public.chat_messages
  for each row execute function public.trg_chat_messages_before_insert();

-- Trigger function: enforce attachment limit (max 5) and image rate limits (30 images/hour)
create or replace function public.trg_chat_attachments_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
  v_sender_id uuid;
begin
  select sender_id into v_sender_id
  from public.chat_messages
  where id = new.message_id;

  if v_sender_id is not null then
    -- Image rate limit check: 30 images per hour
    if not public.check_rate_limit('chat_img:' || v_sender_id, 30, 3600) then
      raise exception 'RATE_LIMIT_EXCEEDED: Maximum 30 images per hour';
    end if;
  end if;

  -- Max 5 attachments per message
  select count(*) into v_count
  from public.chat_attachments
  where message_id = new.message_id;

  if v_count >= 5 then
    raise exception 'ATTACHMENT_LIMIT_EXCEEDED: Maximum 5 images per message';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_chat_attachments_before_insert on public.chat_attachments;
create trigger trg_chat_attachments_before_insert
  before insert on public.chat_attachments
  for each row execute function public.trg_chat_attachments_before_insert();

-- Trigger function: deleting a message deletes the stored attachment records (PRD CHT-7)
create or replace function public.trg_chat_messages_after_soft_delete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.deleted_at is null and new.deleted_at is not null then
    delete from public.chat_attachments
    where message_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_chat_messages_after_soft_delete on public.chat_messages;
create trigger trg_chat_messages_after_soft_delete
  after update of deleted_at on public.chat_messages
  for each row execute function public.trg_chat_messages_after_soft_delete();

-- -----------------------------------------------------------------------------
-- 8. SECURITY DEFINER FUNCTIONS / RPC API (PRD 6.10 CHT-1..CHT-12)
-- -----------------------------------------------------------------------------

-- Send chat message RPC (Idempotent by client_id)
drop function if exists public.send_chat_message(uuid, text, text, jsonb);
drop function if exists public.send_chat_message(uuid, text, text);
drop function if exists public.send_chat_message(uuid, text);
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

  -- Idempotency check: return existing message if already inserted
  select id, client_id, room_id, sender_id, message_type, system_event_type, text, created_at, deleted_at
  into v_existing
  from public.chat_messages
  where client_id = p_client_id;

  if found then
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

-- Get paginated chat messages RPC (respects 50/page, blocks, mutes, locked room)
drop function if exists public.get_chat_messages(uuid, integer, timestamptz, timestamptz);
drop function if exists public.get_chat_messages(uuid, integer, timestamptz);
drop function if exists public.get_chat_messages(uuid, integer);
drop function if exists public.get_chat_messages(uuid);
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

-- Mark chat read RPC
drop function if exists public.mark_chat_read(uuid, uuid);
drop function if exists public.mark_chat_read(uuid);
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

  insert into public.chat_read_state (room_id, user_id, last_read_message_id, last_read_at)
  values (p_room_id, v_caller_id, p_message_id, v_now)
  on conflict (room_id, user_id) do update
  set last_read_message_id = coalesce(excluded.last_read_message_id, public.chat_read_state.last_read_message_id),
      last_read_at = v_now;
end;
$$;

-- Get unread chat count RPC
drop function if exists public.get_chat_unread_count(uuid);
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

-- Delete own chat message RPC (PRD CHT-7)
drop function if exists public.delete_own_chat_message(uuid);
create or replace function public.delete_own_chat_message(p_message_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_id uuid := auth.uid();
  v_msg record;
begin
  if v_caller_id is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  select sender_id, room_id into v_msg
  from public.chat_messages
  where id = p_message_id;

  if not found then
    raise exception 'MESSAGE_NOT_FOUND';
  end if;

  if v_msg.sender_id <> v_caller_id then
    raise exception 'CANNOT_DELETE_OTHERS: Cannot delete another user message';
  end if;

  -- Soft delete message
  update public.chat_messages
  set deleted_at = now()
  where id = p_message_id;

  -- Delete attachment records (trigger also handles this)
  delete from public.chat_attachments
  where message_id = p_message_id;

  return true;
end;
$$;

-- Report chat message RPC (PRD CHT-8, 8.3)
drop function if exists public.report_chat_message(uuid, text, text);
drop function if exists public.report_chat_message(uuid, text);
create or replace function public.report_chat_message(
  p_message_id uuid,
  p_reason text,
  p_details text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_id uuid := auth.uid();
  v_report_id uuid;
begin
  if v_caller_id is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'INVALID_REASON';
  end if;

  insert into public.reports (
    reporter_id, target_type, target_id, reason, details
  ) values (
    v_caller_id, 'message', p_message_id::text, p_reason, p_details
  ) returning id into v_report_id;

  insert into public.moderation_queue (
    message_id, reporter_id, status, details
  ) values (
    p_message_id, v_caller_id, 'pending', jsonb_build_object('reason', p_reason, 'details', p_details)
  );

  return v_report_id;
end;
$$;

-- Mute / Unmute room member RPC (PRD ROOM-8, CHT-8)
drop function if exists public.mute_chat_member(uuid);
create or replace function public.mute_chat_member(p_target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;
  if auth.uid() = p_target_user_id then
    raise exception 'CANNOT_MUTE_SELF';
  end if;

  insert into public.member_mutes (user_id, muted_user_id)
  values (auth.uid(), p_target_user_id)
  on conflict (user_id, muted_user_id) do nothing;
end;
$$;

drop function if exists public.unmute_chat_member(uuid);
create or replace function public.unmute_chat_member(p_target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  delete from public.member_mutes
  where user_id = auth.uid() and muted_user_id = p_target_user_id;
end;
$$;

-- Set room chat settings (mute system messages) RPC
drop function if exists public.set_room_chat_settings(uuid, boolean);
create or replace function public.set_room_chat_settings(
  p_room_id uuid,
  p_mute_system_messages boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if not public.is_room_member(p_room_id, auth.uid()) then
    raise exception 'NOT_ROOM_MEMBER';
  end if;

  insert into public.chat_room_settings (room_id, user_id, mute_system_messages, updated_at)
  values (p_room_id, auth.uid(), coalesce(p_mute_system_messages, false), now())
  on conflict (room_id, user_id) do update
  set mute_system_messages = excluded.mute_system_messages,
      updated_at = now();
end;
$$;

-- Insert system message helper (PRD CHT-9)
drop function if exists public.insert_system_chat_message(uuid, text, text);
create or replace function public.insert_system_chat_message(
  p_room_id uuid,
  p_event_type text,
  p_text text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_msg_id uuid;
  v_client_id text := 'sys-' || gen_random_uuid()::text;
begin
  insert into public.chat_messages (
    client_id, room_id, sender_id, message_type, system_event_type, text
  ) values (
    v_client_id, p_room_id, null, 'system', p_event_type, p_text
  ) returning id into v_msg_id;

  return v_msg_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 9. REALTIME PUBLICATION SETUP
-- Add chat_messages and chat_read_state to supabase_realtime
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.chat_messages;
    alter publication supabase_realtime add table public.chat_read_state;
  end if;
end;
$$;

alter table public.chat_messages replica identity full;
