-- Phase 9: Notifications, Devices & Settings (PRD 6.12, 6.20 FST-6, 7.1)
-- Devices table, registration, refresh, unregister, stale token cleanup
-- Notification settings: per-type toggles, quiet hours, per-room chat mute, hide previews
-- Push notification queue, FCM HTTP v1 support, batching, token error removal
-- Triggers for: nudges, partner workout/food (privacy-enforced, NO calories),
-- requests/invites, chat (with viewing check & hide previews), streak at risk,
-- weekly summary, trial ending, subscription lapse hooks, room state change hooks.

-- -----------------------------------------------------------------------------
-- 1. DEVICES TABLE & MANAGEMENT (PRD 6.12, 7.1)
-- -----------------------------------------------------------------------------
create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fcm_token text not null unique,
  platform text not null check (platform in ('android', 'ios', 'web')),
  app_version text,
  device_id text,
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_devices_user_id on public.devices (user_id);
create index if not exists idx_devices_last_seen on public.devices (last_seen);
create index if not exists idx_devices_fcm_token on public.devices (fcm_token);

alter table public.devices enable row level security;

drop policy if exists devices_select_own on public.devices;
create policy devices_select_own on public.devices
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists devices_insert_own on public.devices;
create policy devices_insert_own on public.devices
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists devices_update_own on public.devices;
create policy devices_update_own on public.devices
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists devices_delete_own on public.devices;
create policy devices_delete_own on public.devices
  for delete to authenticated
  using (auth.uid() = user_id);

-- Register or refresh device token
create or replace function public.register_device(
  p_fcm_token text,
  p_platform text,
  p_app_version text default null,
  p_device_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_device_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if p_fcm_token is null or length(trim(p_fcm_token)) < 16 then
    raise exception 'INVALID_FCM_TOKEN';
  end if;

  if p_platform not in ('android', 'ios', 'web') then
    raise exception 'INVALID_PLATFORM';
  end if;

  -- Upsert: if token exists (even under old user), assign to current user and refresh last_seen
  insert into public.devices (
    user_id,
    fcm_token,
    platform,
    app_version,
    device_id,
    last_seen,
    updated_at
  )
  values (
    v_user_id,
    trim(p_fcm_token),
    p_platform,
    p_app_version,
    p_device_id,
    now(),
    now()
  )
  on conflict (fcm_token) do update
  set
    user_id = v_user_id,
    platform = excluded.platform,
    app_version = coalesce(excluded.app_version, public.devices.app_version),
    device_id = coalesce(excluded.device_id, public.devices.device_id),
    last_seen = now(),
    updated_at = now()
  returning id into v_device_id;

  return v_device_id;
end;
$$;

-- Unregister device token on sign out
create or replace function public.unregister_device(p_fcm_token text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  delete from public.devices
  where fcm_token = trim(p_fcm_token)
    and user_id = v_user_id;

  return found;
end;
$$;

-- Stale token cleanup (called by cron or Edge Function)
create or replace function public.cleanup_stale_devices(p_days_stale int default 60)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_deleted int;
begin
  delete from public.devices
  where last_seen < now() - (coalesce(p_days_stale, 60) || ' days')::interval;

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

-- Remove invalid tokens identified by FCM HTTP v1 response (UNREGISTERED, etc.)
create or replace function public.remove_invalid_device_tokens(p_tokens text[])
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count int;
begin
  if p_tokens is null or array_length(p_tokens, 1) is null then
    return 0;
  end if;

  delete from public.devices
  where fcm_token = any(p_tokens);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. NOTIFICATION SETTINGS (PRD 6.12 NTF-1, NTF-2, NTF-3, 6.20 FST-6)
-- -----------------------------------------------------------------------------
create table if not exists public.notification_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  -- Per-type push toggles
  nudge_enabled boolean not null default true,
  partner_activity_enabled boolean not null default true,
  room_requests_enabled boolean not null default true,
  chat_messages_enabled boolean not null default true,
  streak_reminders_enabled boolean not null default true,
  weekly_summary_enabled boolean not null default true,
  trial_reminders_enabled boolean not null default true,
  billing_alerts_enabled boolean not null default true,
  -- Per-type local reminder toggles
  meal_reminders_enabled boolean not null default true,
  water_reminders_enabled boolean not null default true,
  weigh_in_reminders_enabled boolean not null default true,
  fasting_reminders_enabled boolean not null default true,
  -- Global pause
  pause_all boolean not null default false,
  -- Quiet hours (local time)
  quiet_hours_enabled boolean not null default false,
  quiet_hours_start time not null default '22:00',
  quiet_hours_end time not null default '07:00',
  -- Previews (hide chat previews)
  hide_previews boolean not null default false,
  -- Local reminder scheduling preferences
  meal_times jsonb not null default '{"breakfast": "08:30", "lunch": "13:00", "dinner": "20:00"}'::jsonb,
  water_interval_hours int not null default 2,
  water_start_time time not null default '08:00',
  water_end_time time not null default '20:00',
  weigh_in_day_of_week int not null default 1, -- 1 = Monday
  weigh_in_time time not null default '08:00',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notification_settings enable row level security;

drop policy if exists notification_settings_select_own on public.notification_settings;
create policy notification_settings_select_own on public.notification_settings
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists notification_settings_insert_own on public.notification_settings;
create policy notification_settings_insert_own on public.notification_settings
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists notification_settings_update_own on public.notification_settings;
create policy notification_settings_update_own on public.notification_settings
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Fetch or initialize default settings
create or replace function public.get_or_create_notification_settings(p_user_id uuid default null)
returns public.notification_settings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid;
  v_row public.notification_settings;
begin
  v_uid := coalesce(p_user_id, auth.uid());
  if v_uid is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  select * into v_row from public.notification_settings where user_id = v_uid;
  if not found then
    insert into public.notification_settings (user_id)
    values (v_uid)
    on conflict (user_id) do update set updated_at = now()
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. PER-ROOM CHAT MUTE (PRD 6.12 NTF-2)
-- Extend chat_room_settings from Phase 8 with mute_chat column & helper
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'chat_room_settings'
      and column_name = 'mute_chat'
  ) then
    alter table public.chat_room_settings add column mute_chat boolean not null default false;
  end if;
end $$;

create or replace function public.set_room_chat_mute(p_room_id uuid, p_muted boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if not public.is_room_member(p_room_id, v_uid) then
    raise exception 'NOT_ROOM_MEMBER';
  end if;

  insert into public.chat_room_settings (room_id, user_id, mute_chat, updated_at)
  values (p_room_id, v_uid, coalesce(p_muted, false), now())
  on conflict (room_id, user_id) do update
  set mute_chat = coalesce(p_muted, false), updated_at = now();
end;
$$;

create or replace function public.is_room_chat_muted(p_room_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select coalesce(
    (select mute_chat from public.chat_room_settings where room_id = p_room_id and user_id = p_user_id),
    false
  );
$$;

-- -----------------------------------------------------------------------------
-- 4. PUSH NOTIFICATION QUEUE (PRD 6.12, Edge Function send-push)
-- -----------------------------------------------------------------------------
create table if not exists public.push_notification_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null check (
    notification_type in (
      'nudge',
      'partner_workout',
      'partner_food',
      'room_invitation',
      'room_join_request',
      'room_request_accepted',
      'chat_message',
      'streak_at_risk',
      'weekly_summary',
      'trial_ending',
      'subscription_lapse',
      'room_state_change',
      'focus_session'
    )
  ),
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed', 'skipped')),
  skip_reason text,
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists idx_push_queue_status_created
  on public.push_notification_queue (status, created_at);

create index if not exists idx_push_queue_user_id
  on public.push_notification_queue (user_id);

alter table public.push_notification_queue enable row level security;

-- Users may view their own notification history
drop policy if exists push_queue_select_own on public.push_notification_queue;
create policy push_queue_select_own on public.push_notification_queue
  for select to authenticated
  using (auth.uid() = user_id);

-- Disallow client direct inserts/updates; only triggers and service role write to queue
drop policy if exists push_queue_no_client_mod on public.push_notification_queue;
create policy push_queue_no_client_mod on public.push_notification_queue
  for insert to authenticated
  with check (false);

-- -----------------------------------------------------------------------------
-- 5. QUIET HOURS & CHAT ACTIVE VIEWING HELPERS
-- -----------------------------------------------------------------------------

-- Checks if the user is currently in their quiet hours window based on stored timezone
create or replace function public.is_in_quiet_hours(p_user_id uuid)
returns boolean
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_settings public.notification_settings;
  v_tz text;
  v_local_time time;
begin
  select * into v_settings from public.notification_settings where user_id = p_user_id;
  if not found or not v_settings.quiet_hours_enabled then
    return false;
  end if;

  select timezone into v_tz from public.profiles where id = p_user_id;
  v_tz := coalesce(v_tz, 'UTC');

  -- Convert current UTC time to user's local time
  begin
    v_local_time := (now() at time zone v_tz)::time;
  exception when others then
    v_local_time := (now() at time zone 'UTC')::time;
  end;

  if v_settings.quiet_hours_start < v_settings.quiet_hours_end then
    -- Daytime window (e.g. 13:00 to 15:00)
    return v_local_time >= v_settings.quiet_hours_start and v_local_time < v_settings.quiet_hours_end;
  else
    -- Overnight window (e.g. 22:00 to 07:00)
    return v_local_time >= v_settings.quiet_hours_start or v_local_time < v_settings.quiet_hours_end;
  end if;
end;
$$;

-- Check if recipient is actively viewing the chat room right now
-- (last_read_at within the last 30 seconds)
create or replace function public.is_user_viewing_chat(p_room_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.chat_read_state
    where room_id = p_room_id
      and user_id = p_user_id
      and last_read_at >= now() - interval '30 seconds'
  );
$$;

-- Generic Queue Helper with validation of settings, mutes, quiet hours, and previews
create or replace function public.queue_push_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_data jsonb default '{}'::jsonb,
  p_room_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_settings public.notification_settings;
  v_status text := 'pending';
  v_skip_reason text := null;
  v_sanitized_body text := p_body;
  v_sanitized_title text := p_title;
  v_device_count int;
  v_queue_id uuid;
begin
  -- 1. Ensure settings exist
  v_settings := public.get_or_create_notification_settings(p_user_id);

  -- 2. Pause All check
  if v_settings.pause_all then
    v_status := 'skipped';
    v_skip_reason := 'pause_all';
  end if;

  -- 3. Per-type toggle check
  if v_status = 'pending' then
    case p_type
      when 'nudge' then
        if not v_settings.nudge_enabled then v_status := 'skipped'; v_skip_reason := 'type_disabled'; end if;
      when 'partner_workout', 'partner_food' then
        if not v_settings.partner_activity_enabled then v_status := 'skipped'; v_skip_reason := 'type_disabled'; end if;
      when 'room_invitation', 'room_join_request', 'room_request_accepted' then
        if not v_settings.room_requests_enabled then v_status := 'skipped'; v_skip_reason := 'type_disabled'; end if;
      when 'chat_message' then
        if not v_settings.chat_messages_enabled then v_status := 'skipped'; v_skip_reason := 'type_disabled'; end if;
      when 'streak_at_risk' then
        if not v_settings.streak_reminders_enabled then v_status := 'skipped'; v_skip_reason := 'type_disabled'; end if;
      when 'weekly_summary' then
        if not v_settings.weekly_summary_enabled then v_status := 'skipped'; v_skip_reason := 'type_disabled'; end if;
      when 'trial_ending' then
        if not v_settings.trial_reminders_enabled then v_status := 'skipped'; v_skip_reason := 'type_disabled'; end if;
      when 'subscription_lapse', 'room_state_change' then
        if not v_settings.billing_alerts_enabled then v_status := 'skipped'; v_skip_reason := 'type_disabled'; end if;
      else
        null;
    end case;
  end if;

  -- 4. Per-room chat mute
  if v_status = 'pending' and p_type = 'chat_message' and p_room_id is not null then
    if public.is_room_chat_muted(p_room_id, p_user_id) then
      v_status := 'skipped';
      v_skip_reason := 'room_chat_muted';
    end if;
  end if;

  -- 5. Active chat viewing check
  if v_status = 'pending' and p_type = 'chat_message' and p_room_id is not null then
    if public.is_user_viewing_chat(p_room_id, p_user_id) then
      v_status := 'skipped';
      v_skip_reason := 'currently_viewing_chat';
    end if;
  end if;

  -- 6. Quiet hours check
  if v_status = 'pending' and public.is_in_quiet_hours(p_user_id) then
    v_status := 'skipped';
    v_skip_reason := 'quiet_hours';
  end if;

  -- 7. Devices check
  if v_status = 'pending' then
    select count(*) into v_device_count from public.devices where user_id = p_user_id;
    if v_device_count = 0 then
      v_status := 'skipped';
      v_skip_reason := 'no_devices';
    end if;
  end if;

  -- 8. Privacy sanitization (PRD 6.12 NTF-3: Never include another person's calories)
  -- Strip any kcal numbers or nutritional patterns from body
  v_sanitized_body := regexp_replace(v_sanitized_body, '\m\d+(\.\d+)?\s*(kcal|calories|cals)\M', 'logged meal', 'gi');

  -- Hide previews for chat if enabled
  if p_type = 'chat_message' and v_settings.hide_previews then
    v_sanitized_title := coalesce(p_data->>'roomName', 'New Message');
    v_sanitized_body := 'New message received';
  end if;

  -- 9. Insert into queue
  insert into public.push_notification_queue (
    user_id,
    notification_type,
    title,
    body,
    data,
    status,
    skip_reason,
    created_at
  )
  values (
    p_user_id,
    p_type,
    v_sanitized_title,
    v_sanitized_body,
    coalesce(p_data, '{}'::jsonb),
    v_status,
    v_skip_reason,
    now()
  )
  returning id into v_queue_id;

  return v_queue_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. TRIGGERS FOR REALTIME EVENTS
-- -----------------------------------------------------------------------------

-- A. Nudge received trigger
create or replace function public.trg_nudges_after_insert_push()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sender_nick text;
  v_room_name text;
begin
  -- Check blocks
  if exists (select 1 from public.blocks where blocker_id = NEW.recipient_id and blocked_id = NEW.sender_id) then
    return NEW;
  end if;

  -- Check member mute
  if exists (select 1 from public.member_mutes where user_id = NEW.recipient_id and muted_user_id = NEW.sender_id) then
    return NEW;
  end if;

  select nickname into v_sender_nick from public.profiles where id = NEW.sender_id;
  v_sender_nick := coalesce(v_sender_nick, 'Your partner');

  select name into v_room_name from public.rooms where id = NEW.room_id;

  perform public.queue_push_notification(
    p_user_id := NEW.recipient_id,
    p_type := 'nudge',
    p_title := v_sender_nick || ' sent you a nudge',
    p_body := coalesce(NEW.message, v_sender_nick || ' is cheering you on today!'),
    p_data := jsonb_build_object(
      'type', 'nudge',
      'roomId', NEW.room_id,
      'nudgeId', NEW.id,
      'url', '/room'
    ),
    p_room_id := NEW.room_id
  );

  return NEW;
end;
$$;

drop trigger if exists trg_nudges_push on public.nudges;
create trigger trg_nudges_push
  after insert on public.nudges
  for each row
  execute function public.trg_nudges_after_insert_push();

-- B. Partner Workout Completed trigger (respects room privacy, member mutes, never calories/weights)
create or replace function public.trg_workouts_after_insert_push()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sender_nick text;
  v_member record;
begin
  select nickname into v_sender_nick from public.profiles where id = NEW.user_id;
  v_sender_nick := coalesce(v_sender_nick, 'Your partner');

  -- Notify active/paused members across all common usable rooms
  for v_member in (
    select rm.room_id, rm.user_id as recipient_id, sender_rm.privacy_settings as sender_privacy
    from public.room_members rm
    join public.room_members sender_rm on sender_rm.room_id = rm.room_id and sender_rm.user_id = NEW.user_id
    join public.rooms r on r.id = rm.room_id
    where rm.user_id <> NEW.user_id
      and rm.status in ('active', 'paused')
      and sender_rm.status in ('active', 'paused')
      and r.state not in ('locked', 'archived')
      and public.room_is_usable(rm.room_id)
  ) loop
    -- Check privacy: share_workouts must be true
    if coalesce((v_member.sender_privacy->>'share_workouts')::boolean, true) then
      -- Check blocks and mutes
      if not exists (select 1 from public.blocks where blocker_id = v_member.recipient_id and blocked_id = NEW.user_id)
         and not exists (select 1 from public.member_mutes where user_id = v_member.recipient_id and muted_user_id = NEW.user_id) then
        perform public.queue_push_notification(
          p_user_id := v_member.recipient_id,
          p_type := 'partner_workout',
          p_title := v_sender_nick || ' finished a workout!',
          p_body := case
            when NEW.title is not null and length(trim(NEW.title)) > 0 then v_sender_nick || ' completed: ' || NEW.title
            else v_sender_nick || ' completed their workout today!'
          end,
          p_data := jsonb_build_object(
            'type', 'partner_workout',
            'roomId', v_member.room_id,
            'workoutId', NEW.id,
            'url', '/room'
          ),
          p_room_id := v_member.room_id
        );
      end if;
    end if;
  end loop;

  return NEW;
end;
$$;

drop trigger if exists trg_workouts_push on public.workouts;
create trigger trg_workouts_push
  after insert on public.workouts
  for each row
  execute function public.trg_workouts_after_insert_push();

-- C. Room Request / Invitation Trigger
create or replace function public.trg_room_requests_push()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sender_nick text;
  v_room_name text;
  v_host_id uuid;
begin
  select name, host_id into v_room_name, v_host_id from public.rooms where id = NEW.room_id;
  v_room_name := coalesce(v_room_name, 'a room');

  select nickname into v_sender_nick from public.profiles where id = NEW.sender_id;
  v_sender_nick := coalesce(v_sender_nick, 'Someone');

  if TG_OP = 'INSERT' then
    if NEW.type = 'invitation' and NEW.recipient_id is not null then
      -- User was invited
      perform public.queue_push_notification(
        p_user_id := NEW.recipient_id,
        p_type := 'room_invitation',
        p_title := 'Room Invitation',
        p_body := v_sender_nick || ' invited you to join ' || v_room_name || '!',
        p_data := jsonb_build_object(
          'type', 'room_invitation',
          'roomId', NEW.room_id,
          'requestId', NEW.id,
          'url', '/room/requests'
        ),
        p_room_id := NEW.room_id
      );
    elsif NEW.type = 'join_request' and v_host_id is not null then
      -- User requested to join room, notify host
      perform public.queue_push_notification(
        p_user_id := v_host_id,
        p_type := 'room_join_request',
        p_title := 'Join Request',
        p_body := v_sender_nick || ' requested to join ' || v_room_name || '.',
        p_data := jsonb_build_object(
          'type', 'room_join_request',
          'roomId', NEW.room_id,
          'requestId', NEW.id,
          'url', '/room/requests'
        ),
        p_room_id := NEW.room_id
      );
    end if;

  elsif TG_OP = 'UPDATE' and OLD.status = 'pending' and NEW.status = 'accepted' then
    if NEW.type = 'invitation' then
      -- Recipient accepted, notify inviter
      select nickname into v_sender_nick from public.profiles where id = NEW.recipient_id;
      v_sender_nick := coalesce(v_sender_nick, 'Your partner');
      perform public.queue_push_notification(
        p_user_id := NEW.sender_id,
        p_type := 'room_request_accepted',
        p_title := 'Invitation Accepted',
        p_body := v_sender_nick || ' joined ' || v_room_name || '!',
        p_data := jsonb_build_object(
          'type', 'room_request_accepted',
          'roomId', NEW.room_id,
          'requestId', NEW.id,
          'url', '/room'
        ),
        p_room_id := NEW.room_id
      );
    elsif NEW.type = 'join_request' then
      -- Host accepted, notify requester (sender_id)
      perform public.queue_push_notification(
        p_user_id := NEW.sender_id,
        p_type := 'room_request_accepted',
        p_title := 'Request Accepted',
        p_body := 'You were accepted into ' || v_room_name || '!',
        p_data := jsonb_build_object(
          'type', 'room_request_accepted',
          'roomId', NEW.room_id,
          'requestId', NEW.id,
          'url', '/room'
        ),
        p_room_id := NEW.room_id
      );
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_room_requests_push on public.room_requests;
create trigger trg_room_requests_push
  after insert or update on public.room_requests
  for each row
  execute function public.trg_room_requests_push();

-- D. Chat Message Push Trigger (respects mute, active viewing, hide previews, usable room)
create or replace function public.trg_chat_messages_after_insert_push()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sender_nick text;
  v_room_name text;
  v_member record;
begin
  -- Only push for user messages (system messages can be muted and do not need external push)
  if NEW.message_type <> 'user' or NEW.sender_id is null then
    return NEW;
  end if;

  select name into v_room_name from public.rooms where id = NEW.room_id;
  v_room_name := coalesce(v_room_name, 'Room');

  select nickname into v_sender_nick from public.profiles where id = NEW.sender_id;
  v_sender_nick := coalesce(v_sender_nick, 'Member');

  -- Find all room members with access (active/paused, NOT left, removed, locked)
  for v_member in (
    select rm.user_id as recipient_id
    from public.room_members rm
    join public.rooms r on r.id = rm.room_id
    where rm.room_id = NEW.room_id
      and rm.user_id <> NEW.sender_id
      and rm.status in ('active', 'paused')
      and r.state not in ('locked', 'archived')
      and public.room_is_usable(NEW.room_id)
  ) loop
    -- Check blocks
    if not exists (select 1 from public.blocks where blocker_id = v_member.recipient_id and blocked_id = NEW.sender_id)
       and not exists (select 1 from public.member_mutes where user_id = v_member.recipient_id and muted_user_id = NEW.sender_id) then
      perform public.queue_push_notification(
        p_user_id := v_member.recipient_id,
        p_type := 'chat_message',
        p_title := v_sender_nick || ' in ' || v_room_name,
        p_body := substring(coalesce(NEW.text, 'Sent an image') from 1 for 100),
        p_data := jsonb_build_object(
          'type', 'chat_message',
          'roomId', NEW.room_id,
          'messageId', NEW.id,
          'roomName', v_room_name,
          'url', '/room'
        ),
        p_room_id := NEW.room_id
      );
    end if;
  end loop;

  return NEW;
end;
$$;

drop trigger if exists trg_chat_messages_push on public.chat_messages;
create trigger trg_chat_messages_push
  after insert on public.chat_messages
  for each row
  execute function public.trg_chat_messages_after_insert_push();

-- -----------------------------------------------------------------------------
-- 7. SCHEDULED JOBS: STREAK AT RISK, WEEKLY SUMMARY, TRIAL ENDING
-- -----------------------------------------------------------------------------

-- Streak at risk check: runs in the evening (19:00 - 22:00 in user's timezone)
create or replace function public.process_streak_at_risk_notifications()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user record;
  v_count int := 0;
  v_local_time time;
  v_local_date text;
begin
  for v_user in (
    select s.user_id, s.current_streak, p.timezone
    from public.user_streaks s
    join public.profiles p on p.id = s.user_id
    where s.current_streak > 0
  ) loop
    begin
      v_local_time := (now() at time zone coalesce(v_user.timezone, 'UTC'))::time;
      v_local_date := to_char(now() at time zone coalesce(v_user.timezone, 'UTC'), 'YYYY-MM-DD');
    exception when others then
      v_local_time := (now() at time zone 'UTC')::time;
      v_local_date := to_char(now() at time zone 'UTC', 'YYYY-MM-DD');
    end;

    -- Check if local time is evening (19:30 to 22:00)
    if v_local_time >= '19:30'::time and v_local_time <= '22:00'::time then
      -- Check if user has NOT logged yet today
      if not exists (
        select 1 from public.daily_summaries
        where user_id = v_user.user_id
          and local_date = v_local_date
          and logged_day = true
      ) then
        -- Avoid queuing multiple streak warnings on the same day
        if not exists (
          select 1 from public.push_notification_queue
          where user_id = v_user.user_id
            and notification_type = 'streak_at_risk'
            and created_at >= (now() - interval '18 hours')
        ) then
          perform public.queue_push_notification(
            p_user_id := v_user.user_id,
            p_type := 'streak_at_risk',
            p_title := 'Keep your streak alive!',
            p_body := 'You have a ' || v_user.current_streak || '-day streak. Log before midnight to keep it going!',
            p_data := jsonb_build_object('type', 'streak_at_risk', 'url', '/today')
          );
          v_count := v_count + 1;
        end if;
      end if;
    end if;
  end loop;

  return v_count;
end;
$$;

-- Weekly summary check: runs Monday morning (08:00 - 10:30 local time)
create or replace function public.process_weekly_summary_notifications()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user record;
  v_count int := 0;
  v_local_dow int;
  v_local_time time;
begin
  for v_user in (
    select id as user_id, timezone from public.profiles
  ) loop
    begin
      v_local_dow := extract(isodow from now() at time zone coalesce(v_user.timezone, 'UTC'))::int;
      v_local_time := (now() at time zone coalesce(v_user.timezone, 'UTC'))::time;
    exception when others then
      v_local_dow := extract(isodow from now() at time zone 'UTC')::int;
      v_local_time := (now() at time zone 'UTC')::time;
    end;

    -- Monday = 1
    if v_local_dow = 1 and v_local_time >= '08:00'::time and v_local_time <= '10:30'::time then
      if not exists (
        select 1 from public.push_notification_queue
        where user_id = v_user.user_id
          and notification_type = 'weekly_summary'
          and created_at >= (now() - interval '3 days')
      ) then
        perform public.queue_push_notification(
          p_user_id := v_user.user_id,
          p_type := 'weekly_summary',
          p_title := 'Your Weekly Summary is ready',
          p_body := 'Check out your consistency score and how your week went.',
          p_data := jsonb_build_object('type', 'weekly_summary', 'url', '/progress')
        );
        v_count := v_count + 1;
      end if;
    end if;
  end loop;

  return v_count;
end;
$$;

-- Trial ending check (days 2 and 3 of trial)
create or replace function public.process_trial_ending_notifications()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ent record;
  v_count int := 0;
  v_hours_left numeric;
begin
  for v_ent in (
    select user_id, period_end
    from public.entitlements
    where status = 'trial'
      and period_end is not null
      and period_end > now()
  ) loop
    v_hours_left := extract(epoch from (v_ent.period_end - now())) / 3600.0;

    -- Day 2: between 24 and 48 hours left
    if v_hours_left <= 48 and v_hours_left > 24 then
      if not exists (
        select 1 from public.push_notification_queue
        where user_id = v_ent.user_id
          and notification_type = 'trial_ending'
          and created_at >= (now() - interval '24 hours')
      ) then
        perform public.queue_push_notification(
          p_user_id := v_ent.user_id,
          p_type := 'trial_ending',
          p_title := '1 day left on your room trial',
          p_body := 'Keep your room and partner chat active by choosing a plan.',
          p_data := jsonb_build_object('type', 'trial_ending', 'url', '/me')
        );
        v_count := v_count + 1;
      end if;
    -- Day 3: under 24 hours left
    elsif v_hours_left <= 24 and v_hours_left > 0 then
      if not exists (
        select 1 from public.push_notification_queue
        where user_id = v_ent.user_id
          and notification_type = 'trial_ending'
          and created_at >= (now() - interval '18 hours')
      ) then
        perform public.queue_push_notification(
          p_user_id := v_ent.user_id,
          p_type := 'trial_ending',
          p_title := 'Your room trial ends today',
          p_body := 'Subscribe to keep sharing progress with your partner.',
          p_data := jsonb_build_object('type', 'trial_ending', 'url', '/me')
        );
        v_count := v_count + 1;
      end if;
    end if;
  end loop;

  return v_count;
end;
$$;

-- -----------------------------------------------------------------------------
-- 8. HOOKS FOR PHASE 10 (SUBSCRIPTION LAPSE & ROOM STATE CHANGES)
-- -----------------------------------------------------------------------------
create or replace function public.queue_subscription_lapse_notification(
  p_user_id uuid,
  p_reason text default 'renewal_failed'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return public.queue_push_notification(
    p_user_id := p_user_id,
    p_type := 'subscription_lapse',
    p_title := 'Subscription Alert',
    p_body := 'There was an issue renewing your room plan. Tap to resolve and keep your room active.',
    p_data := jsonb_build_object('type', 'subscription_lapse', 'reason', p_reason, 'url', '/me')
  );
end;
$$;

create or replace function public.queue_room_state_notification(
  p_room_id uuid,
  p_state text
)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member record;
  v_room_name text;
  v_count int := 0;
  v_title text;
  v_body text;
begin
  select name into v_room_name from public.rooms where id = p_room_id;
  v_room_name := coalesce(v_room_name, 'Your room');

  if p_state = 'locked' then
    v_title := 'Room Paused';
    v_body := v_room_name || ' has been paused because the trial or plan ended.';
  elsif p_state = 'over_capacity' then
    v_title := 'Room Over Capacity';
    v_body := v_room_name || ' has more members than its plan allows. Host can upgrade or adjust members.';
  else
    v_title := 'Room Status Changed';
    v_body := v_room_name || ' status is now ' || p_state || '.';
  end if;

  for v_member in (
    select user_id from public.room_members where room_id = p_room_id and status in ('active', 'paused')
  ) loop
    perform public.queue_push_notification(
      p_user_id := v_member.user_id,
      p_type := 'room_state_change',
      p_title := v_title,
      p_body := v_body,
      p_data := jsonb_build_object('type', 'room_state_change', 'roomId', p_room_id, 'state', p_state, 'url', '/room'),
      p_room_id := p_room_id
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;
