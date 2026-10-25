-- Owner-approved rooms v3. New migration only; historical migrations are immutable.
-- Personal tracking data is never deleted by room lifecycle cleanup.
alter table public.rooms add column requires_host_plan boolean not null default false;
alter table public.rooms alter column member_cap set default 2;
update public.remote_config set value = '{"free":2,"basic":2,"plus":5,"pro":20,"community":20}'::jsonb where key = 'room_caps';
update public.remote_config set value = '5'::jsonb where key = 'trial_cap';
update public.room_tier_configs set member_cap = case tier when 'plus' then 5 when 'pro' then 20 when 'community' then 20 else 2 end;

create or replace function public.active_room_tier(p_user_id uuid)
returns text language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select e.tier from public.entitlements e where e.user_id = p_user_id
    and e.tier in ('plus','pro') and (
      (e.status in ('paid','grace') and (e.period_end is null or e.period_end > now()))
      or (e.status = 'trial' and e.tier = 'plus' and e.period_end > now())
    )), 'free');
$$;
create or replace function public.hosted_room_limit(p_user_id uuid)
returns integer language sql stable security definer set search_path = public, pg_temp as $$
  select case public.active_room_tier(p_user_id) when 'pro' then 5 when 'plus' then 2 else 1 end;
$$;
create or replace function public.can_create_room(p_user_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select p_user_id is not null and (select count(*) from public.rooms where plan_holder_id = p_user_id and state <> 'archived') < public.hosted_room_limit(p_user_id);
$$;
create or replace function public.room_cap(p_room_id uuid)
returns integer language sql stable security definer set search_path = public, pg_temp as $$
  select case public.active_room_tier(r.plan_holder_id) when 'pro' then 20 when 'plus' then 5 else 2 end from public.rooms r where r.id = p_room_id;
$$;
create or replace function public.room_is_usable(p_room_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select r.state not in ('locked','archived')
    and (not r.requires_host_plan or public.active_room_tier(r.plan_holder_id) <> 'free')
    and (select count(*) from public.room_members m where m.room_id = r.id and m.status in ('active','paused','locked')) <= public.room_cap(r.id)
    and (select count(*) from public.rooms other where other.plan_holder_id = r.plan_holder_id and other.state <> 'archived' and (other.created_at, other.id) <= (r.created_at, r.id)) <= public.hosted_room_limit(r.plan_holder_id)
    from public.rooms r where r.id = p_room_id), false);
$$;

-- Plans now belong to individuals, so no member's subscription is unattached.
update public.entitlements set is_unattached=false where is_unattached=true;

-- A free room never consumes a trial. Serialize all creation attempts per host.
create or replace function public.create_room_v3(p_client_id uuid, p_name text, p_device_hash text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_room public.rooms; v_cap integer; v_count integer;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_client_id is null or p_name is null or length(trim(p_name)) not between 1 and 100 then raise exception 'INVALID_ROOM_NAME'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 31));
  select * into v_room from public.rooms where id = p_client_id;
  if found then
    if v_room.created_by <> v_uid then raise exception 'NOT_AUTHORIZED'; end if;
    return jsonb_build_object('room_id',v_room.id,'name',v_room.name,'code',v_room.code,'role','host','state',v_room.state);
  end if;
  if not public.can_create_room(v_uid) then raise exception 'HOSTED_ROOM_LIMIT'; end if;
  select count(*) into v_count from public.rooms where plan_holder_id = v_uid and state <> 'archived';
  v_cap := case public.active_room_tier(v_uid) when 'pro' then 20 when 'plus' then 5 else 2 end;
  insert into public.rooms(id,name,code,state,who_can_invite,created_by,plan_holder_id,member_cap,requires_host_plan)
  values(p_client_id,trim(p_name),public.generate_room_code(),'dormant','host_only',v_uid,v_uid,v_cap,v_count > 0) returning * into v_room;
  insert into public.room_members(room_id,user_id,role,status) values(v_room.id,v_uid,'host','active');
  return jsonb_build_object('room_id',v_room.id,'name',v_room.name,'code',v_room.code,'role','host','state',v_room.state);
end; $$;
create or replace function public.create_room(p_name text, p_device_hash text default null)
returns jsonb language sql security definer set search_path = public, pg_temp as $$
  select public.create_room_v3(gen_random_uuid(), p_name, p_device_hash);
$$;

create or replace function public.recompute_room_state(p_room_id uuid)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare v_room public.rooms; v_count integer; v_cap integer; v_rank integer; v_freeze timestamptz; v_state text;
begin
  select * into v_room from public.rooms where id = p_room_id for update;
  if not found then return null; end if;
  if v_room.state = 'archived' then return 'archived'; end if;
  -- The deadline also applies when a late renewal arrives before cron has run.
  if v_room.locked_at is not null and v_room.locked_at <= now() - interval '30 days' then
    delete from public.rooms where id = p_room_id;
    return 'deleted';
  end if;
  select count(*) into v_count from public.room_members where room_id = p_room_id and status in ('active','paused','locked');
  select count(*) into v_rank from public.rooms where plan_holder_id = v_room.plan_holder_id and state <> 'archived' and (created_at,id) <= (v_room.created_at,v_room.id);
  v_cap := public.room_cap(p_room_id);
  if (v_room.requires_host_plan and public.active_room_tier(v_room.plan_holder_id) = 'free') or v_count > v_cap or v_rank > public.hosted_room_limit(v_room.plan_holder_id) then
    select least(now(), coalesce(period_end,now())) into v_freeze from public.entitlements where user_id = v_room.plan_holder_id;
    v_freeze := coalesce(v_room.locked_at,v_freeze,now());
    if v_freeze <= now() - interval '30 days' then
      delete from public.rooms where id = p_room_id;
      return 'deleted';
    end if;
    update public.rooms set state='locked',locked_at=v_freeze,updated_at=now() where id=p_room_id and (state is distinct from 'locked' or locked_at is distinct from v_freeze);
    return 'locked';
  end if;
  v_state := case when v_count >= 2 then 'active' else 'dormant' end;
  update public.rooms set state=v_state, member_cap=v_cap, locked_at=null, over_capacity_at=null,
    requires_host_plan=(requires_host_plan or v_count > 2 or v_rank > 1),
    dormant_at=case when v_state='dormant' then coalesce(dormant_at,now()) else null end, updated_at=now()
  where id=p_room_id and (state is distinct from v_state or member_cap is distinct from v_cap or locked_at is not null or over_capacity_at is not null or requires_host_plan is distinct from (requires_host_plan or v_count>2 or v_rank>1));
  return v_state;
end; $$;

-- Internal admission function shared by both code joins and accepted invitations.
create or replace function public.admit_room_member_v3(p_room_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_room public.rooms; v_count integer;
begin
  select * into v_room from public.rooms where id=p_room_id for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if exists(select 1 from public.room_members where room_id=p_room_id and user_id=p_user_id and status in ('active','paused','locked')) then return; end if;
  if not public.room_is_usable(p_room_id) then raise exception 'ROOM_LOCKED'; end if;
  if exists(select 1 from public.blocks b join public.room_members m on m.room_id=p_room_id and m.status <> 'left'
    where (b.blocker_id=p_user_id and b.blocked_id=m.user_id) or (b.blocked_id=p_user_id and b.blocker_id=m.user_id)) then raise exception 'USER_BLOCKED'; end if;
  select count(*) into v_count from public.room_members where room_id=p_room_id and status in ('active','paused','locked');
  if v_count >= public.room_cap(p_room_id) then raise exception 'ROOM_FULL'; end if;
  insert into public.room_members(room_id,user_id,role,status) values(p_room_id,p_user_id,'member','active')
  on conflict(room_id,user_id) do update set status='active',joined_at=now(),updated_at=now();
  if v_count >= 2 then update public.rooms set requires_host_plan=true where id=p_room_id; end if;
  perform public.recompute_room_state(p_room_id);
end; $$;
revoke all on function public.admit_room_member_v3(uuid,uuid) from public,anon,authenticated;

create or replace function public.join_by_code(p_code text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_room public.rooms;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  select * into v_room from public.rooms where code=upper(trim(p_code)) for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  perform public.admit_room_member_v3(v_room.id,auth.uid());
  return jsonb_build_object('status','joined','room_id',v_room.id,'name',v_room.name);
end; $$;
drop function public.join_by_code(text,text);
create or replace function public.join_by_code(p_code text, p_device_hash text)
returns jsonb language sql security definer set search_path = public, pg_temp as $$ select public.join_by_code(p_code); $$;

create or replace function public.respond_to_request(p_request_id uuid,p_action text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_req public.room_requests; v_target uuid;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_action not in ('accept','decline') or p_action is null then raise exception 'INVALID_ACTION'; end if;
  select * into v_req from public.room_requests where id=p_request_id for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  if v_req.type='invitation' then
    if v_req.recipient_id <> auth.uid() then raise exception 'NOT_AUTHORIZED'; end if;
    v_target:=auth.uid();
  else
    if not exists(select 1 from public.room_members where room_id=v_req.room_id and user_id=auth.uid() and role='host' and status='active') then raise exception 'NOT_AUTHORIZED'; end if;
    v_target:=v_req.sender_id;
  end if;
  if v_req.status = 'accepted' and p_action='accept' then return jsonb_build_object('status','accepted','room_id',v_req.room_id); end if;
  if v_req.status <> 'pending' then raise exception 'REQUEST_NOT_FOUND'; end if;
  if v_req.expires_at <= now() then raise exception 'REQUEST_EXPIRED'; end if;
  if p_action='accept' then perform public.admit_room_member_v3(v_req.room_id,v_target); end if;
  update public.room_requests set status=case when p_action='accept' then 'accepted' else 'declined' end,responded_at=now() where id=p_request_id;
  return jsonb_build_object('status',case when p_action='accept' then 'accepted' else 'declined' end,'room_id',v_req.room_id);
end; $$;

-- Sponsorship now transfers hosting. Lock host quota and room before checking either.
create or replace function public.sponsor_room(p_room_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_room public.rooms; v_count integer; v_tier text;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,31));
  select * into v_room from public.rooms where id=p_room_id for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if not public.is_room_member(p_room_id,auth.uid()) then raise exception 'NOT_ROOM_MEMBER'; end if;
  if v_room.state='archived' or (v_room.locked_at is not null and v_room.locked_at <= now()-interval '30 days') or (v_room.locked_at is null and not public.room_is_usable(p_room_id) and exists(select 1 from public.entitlements where user_id=v_room.plan_holder_id and period_end<=now()-interval '30 days')) then raise exception 'ROOM_ARCHIVED'; end if;
  -- A former host retry must not displace a successful takeover.
  if v_room.plan_holder_id <> auth.uid() and v_room.state <> 'locked' and public.room_is_usable(p_room_id) then raise exception 'ROOM_NOT_LOCKED'; end if;
  v_tier:=public.active_room_tier(auth.uid());
  if v_tier='free' then raise exception 'PLAN_REQUIRED'; end if;
  select count(*) into v_count from public.room_members where room_id=p_room_id and status in ('active','paused','locked');
  if v_count > (case when v_tier='pro' then 20 else 5 end) then raise exception 'ROOM_FULL'; end if;
  if v_room.plan_holder_id <> auth.uid() and not public.can_create_room(auth.uid()) then raise exception 'HOSTED_ROOM_LIMIT'; end if;
  update public.room_members set role=case when user_id=auth.uid() then 'host' else 'member' end,updated_at=now() where room_id=p_room_id;
  update public.rooms set plan_holder_id=auth.uid(),state=case when v_count>=2 then 'active' else 'dormant' end,locked_at=null,updated_at=now() where id=p_room_id;
  perform public.recompute_room_state(p_room_id);
  return jsonb_build_object('status','sponsored','room_id',p_room_id,'plan_holder_id',auth.uid(),'member_cap',public.room_cap(p_room_id));
end; $$;

create or replace function public.process_room_lifecycle_cron()
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare r record; v_deleted integer:=0;
begin
  for r in select id from public.rooms where state <> 'archived' loop
    if public.recompute_room_state(r.id)='deleted' then v_deleted:=v_deleted+1; end if;
  end loop;
  return jsonb_build_object('deleted',v_deleted);
end; $$;
revoke all on function public.process_room_lifecycle_cron() from public,anon,authenticated;
grant execute on function public.process_room_lifecycle_cron() to service_role;

-- Database triggers enforce sender entitlements for RPCs and direct table writes.
create or replace function public.enforce_chat_sender_plan_v3()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.message_type='user' and public.active_room_tier(new.sender_id)='free' then raise exception 'PLUS_REQUIRED'; end if;
  return new;
end; $$;
create trigger chat_sender_plan_v3 before insert on public.chat_messages for each row execute function public.enforce_chat_sender_plan_v3();
create or replace function public.enforce_chat_media_plan_v3()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not exists(select 1 from public.chat_messages m where m.id=new.message_id and public.active_room_tier(m.sender_id)='pro') then raise exception 'PRO_REQUIRED'; end if;
  return new;
end; $$;
create trigger chat_media_plan_v3 before insert on public.chat_attachments for each row execute function public.enforce_chat_media_plan_v3();
alter table public.chat_attachments drop constraint if exists chat_attachments_mime_type_check;
alter table public.chat_attachments add constraint chat_attachments_mime_type_check check (mime_type in ('image/jpeg','image/png','image/heic','image/webp','video/mp4','video/quicktime','video/webm'));

-- Existing data receives conservative requirements; free pairs remain available.
update public.rooms r set requires_host_plan=(
  (select count(*) from public.room_members m where m.room_id=r.id and m.status in ('active','paused','locked')) > 2
  or (select count(*) from public.rooms x where x.plan_holder_id=r.plan_holder_id and x.state<>'archived' and (x.created_at,x.id)<=(r.created_at,r.id))>1
);
-- No bulk lifecycle deletion in the migration; the scheduled maintenance owns cleanup.

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

create or replace function public.apply_revenuecat_event(
  p_event_id text,
  p_event_type text,
  p_user_id uuid,
  p_product_id text,
  p_store text,
  p_period_end timestamptz,
  p_event_timestamp timestamptz,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tier text := 'plus';
  v_period text := 'monthly';
  v_status text := 'paid';
  v_source text := 'apple';
  v_current_ent record;
  v_attached_room uuid;
  v_hosted_room uuid;
  v_cap integer;
  v_period_end timestamptz := p_period_end;
begin
  if p_event_id is null or p_event_type is null or p_user_id is null then
    raise exception 'INVALID_WEBHOOK_PARAMETERS' using errcode = 'P0001';
  end if;

  -- 1. Idempotency check
  if exists (select 1 from public.processed_webhook_events where event_id = p_event_id) then
    return jsonb_build_object('status', 'already_processed', 'event_id', p_event_id);
  end if;

  -- 2. Store mapping
  if p_store ilike '%play%' or p_store ilike '%google%' then
    v_source := 'google';
  elsif p_store ilike '%dodo%' then
    v_source := 'dodo';
  else
    v_source := 'apple';
  end if;

  -- 3. Product ID -> tier & period (Plus and Pro, Monthly and Annual)
  if p_product_id is not null then
    if p_product_id ilike '%community%' then
      v_tier := 'community';
    elsif p_product_id ilike '%pro%' then
      v_tier := 'pro';
    elsif p_product_id ilike '%basic%' then
      v_tier := 'basic';
    else
      v_tier := 'plus';
    end if;

    if p_product_id ilike '%annual%' or p_product_id ilike '%yearly%' then
      v_period := 'annual';
    else
      v_period := 'monthly';
    end if;
  end if;

  -- 4. Status mapping
  case p_event_type
    when 'INITIAL_PURCHASE' then v_status := 'paid';
    when 'RENEWAL' then v_status := 'paid';
    when 'PRODUCT_CHANGE' then v_status := 'paid';
    when 'UNCANCELLATION' then v_status := 'paid';
    when 'SUBSCRIPTION_EXTENDED' then v_status := 'paid';
    when 'BILLING_ISSUE' then v_status := 'grace';
    when 'CANCELLATION' then v_status := 'paid';
    when 'EXPIRATION' then v_status := 'lapsed';
    when 'REVOCATION' then v_status := 'lapsed';
    else v_status := 'paid';
  end case;

  -- Safe fallback: Never leave period_end as null for active paid subscriptions
  if v_status in ('paid', 'grace') and v_period_end is null then
    v_period_end := now() + case when v_period = 'annual' then interval '365 days' else interval '30 days' end;
  end if;

  -- 5. Out-of-order check
  select * into v_current_ent
  from public.entitlements
  where user_id = p_user_id
  for update;

  if found and v_current_ent.last_event_timestamp is not null then
    if p_event_timestamp < v_current_ent.last_event_timestamp then
      insert into public.processed_webhook_events (event_id, event_type, user_id, payload, processed_at)
      values (p_event_id, p_event_type, p_user_id, p_payload, now());

      return jsonb_build_object(
        'status', 'skipped_older_event',
        'event_id', p_event_id,
        'current_timestamp', v_current_ent.last_event_timestamp
      );
    end if;
  end if;

  -- Evaluate the old expiration before overwriting it with a renewal. This
  -- preserves the 30-day deadline even if scheduled maintenance was delayed.
  if v_current_ent.period_end is not null and v_current_ent.period_end<=now() then
    perform public.recompute_room_state(id) from public.rooms where plan_holder_id=p_user_id and state<>'archived';
    select * into v_current_ent from public.entitlements where user_id=p_user_id;
  end if;

  -- 6. Attach hosted room automatically if not yet attached
  v_attached_room := v_current_ent.attached_room_id;
  if v_attached_room is null and v_status in ('paid', 'grace') then
    select id into v_hosted_room
    from public.rooms
    where plan_holder_id = p_user_id
      and state in ('active', 'dormant', 'over_capacity', 'locked')
    order by created_at asc
    limit 1;

    if found then
      v_attached_room := v_hosted_room;
    end if;
  end if;

  -- 7. Upsert entitlements table
  insert into public.entitlements (
    user_id, tier, period, source, status,
    attached_room_id, is_unattached, original_transaction_id,
    store_product_id, cancel_at_period_end, period_end,
    last_event_id, last_event_timestamp, updated_at
  ) values (
    p_user_id, v_tier, v_period, v_source, v_status,
    v_attached_room, false, (p_payload->'event'->>'original_transaction_id'),
    p_product_id, (p_event_type = 'CANCELLATION'), v_period_end,
    p_event_id, p_event_timestamp, now()
  )
  on conflict (user_id) do update set
    tier = excluded.tier,
    period = excluded.period,
    source = excluded.source,
    status = excluded.status,
    attached_room_id = coalesce(public.entitlements.attached_room_id, excluded.attached_room_id),
    is_unattached = false,
    original_transaction_id = coalesce(excluded.original_transaction_id, public.entitlements.original_transaction_id),
    store_product_id = excluded.store_product_id,
    cancel_at_period_end = excluded.cancel_at_period_end,
    period_end = excluded.period_end,
    billing_issue_detected_at = case when excluded.status = 'grace' then now() else null end,
    last_event_id = excluded.last_event_id,
    last_event_timestamp = excluded.last_event_timestamp,
    updated_at = now();

  -- 8. Record processed event
  insert into public.processed_webhook_events (event_id, event_type, user_id, payload, processed_at)
  values (p_event_id, p_event_type, p_user_id, p_payload, now());

  -- An individual subscription covers every room currently hosted by this user.
  perform public.recompute_room_state(id) from public.rooms where plan_holder_id=p_user_id and state<>'archived';

  return jsonb_build_object(
    'status', 'processed',
    'event_id', p_event_id,
    'user_id', p_user_id,
    'tier', v_tier,
    'subscription_status', v_status
  );
end;
$$;

revoke all on function public.create_room_v3(uuid,text,text) from public,anon;
grant execute on function public.create_room_v3(uuid,text,text) to authenticated;
revoke all on function public.active_room_tier(uuid), public.hosted_room_limit(uuid) from public,anon;
grant execute on function public.active_room_tier(uuid), public.hosted_room_limit(uuid) to authenticated,service_role;

create or replace function public.get_room_snapshot(
  p_room_id uuid,
  p_selected_user_id uuid default null,
  p_search text default null,
  p_page integer default 1,
  p_page_size integer default 20
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_id uuid := auth.uid();
  v_caller_member record;
  v_room record;
  v_m record;
  v_prof record;
  v_today text;
  v_sum record;
  v_has_breakfast boolean;
  v_has_lunch boolean;
  v_has_dinner boolean;
  v_has_snacks boolean;
  v_members_json jsonb := '[]'::jsonb;
  v_member_metrics jsonb;
  v_checklist jsonb;
  v_streak_val jsonb;
  v_goal_comp_val jsonb;
  v_steps_val jsonb;
  v_water_val jsonb;
  v_workout_val jsonb;
  v_cal_val jsonb;
  v_macros_val jsonb;
  v_weight_val jsonb;
  v_weight_prog_val jsonb;
  v_fasting_val jsonb;
  v_p jsonb;
  v_goal_prof record;
  v_target_kcal numeric := 2000;
  v_pct numeric := 0;
  v_total_members integer;
  v_active_count integer := 0;
  v_sum_pct numeric := 0;
  v_is_large_room boolean := false;
  v_offset integer;
  v_total_paged integer;
  v_fasting_status_text text;
begin
  if v_caller_id is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  select * into v_caller_member
  from public.room_members
  where room_id = p_room_id and user_id = v_caller_id;

  if not found or v_caller_member.status = 'left' then
    raise exception 'NOT_ROOM_MEMBER' using errcode = 'P0001';
  end if;

  p_page_size := greatest(1,least(coalesce(p_page_size,20),50));
  p_page := greatest(1,coalesce(p_page,1));
  -- Recompute room state
  perform public.recompute_room_state(p_room_id);

  select * into v_room
  from public.rooms
  where id = p_room_id;

  if not found or v_room.state = 'archived' then
    raise exception 'ROOM_ARCHIVED' using errcode = 'P0001';
  end if;

  -- User's local date for today
  select coalesce((now() at time zone coalesce(p.timezone, 'UTC'))::date::text, current_date::text)
  into v_today
  from public.profiles p where p.id = v_caller_id;

  select count(*) into v_total_members
  from public.room_members
  where room_id = p_room_id and status in ('active', 'locked', 'paused');

  v_is_large_room := (v_total_members > 12);

  v_offset := (greatest(1, p_page) - 1) * p_page_size;

  -- Count total matching members for pagination
  select count(*) into v_total_paged
  from public.room_members rm
  join public.profiles p on p.id = rm.user_id
  where rm.room_id = p_room_id and rm.status in ('active', 'locked', 'paused')
    and (p_search is null or p.username ilike '%' || p_search || '%' or p.nickname ilike '%' || p_search || '%');

  for v_m in
    select
      rm.user_id,
      rm.role,
      rm.status,
      rm.privacy_settings,
      p.username,
      p.nickname,
      p.avatar_url,
      p.timezone
    from public.room_members rm
    join public.profiles p on p.id = rm.user_id
    where rm.room_id = p_room_id and rm.status in ('active', 'locked', 'paused')
      and (p_search is null or p.username ilike '%' || p_search || '%' or p.nickname ilike '%' || p_search || '%')
    order by
      case when rm.user_id = v_caller_id then 0 else 1 end,
      p.nickname asc
    limit p_page_size offset v_offset
  loop
    -- Each person's day uses their own stored time zone.
    v_today := (now() at time zone coalesce(v_m.timezone,'UTC'))::date::text;
    if v_m.user_id <> v_caller_id and exists(select 1 from public.blocks where (blocker_id=v_caller_id and blocked_id=v_m.user_id) or (blocked_id=v_caller_id and blocker_id=v_m.user_id)) then continue; end if;
    select * into v_sum
    from public.daily_summaries
    where user_id = v_m.user_id and local_date::text = v_today;

    select target_calories into v_target_kcal
    from public.goal_profiles
    where user_id = v_m.user_id and effective_from <= v_today::date
    order by effective_from desc limit 1;

    v_target_kcal := coalesce(v_target_kcal, 2000);

    if v_target_kcal > 0 and v_sum.calories is not null then
      v_pct := round((v_sum.calories / v_target_kcal) * 100);
    else
      v_pct := 0;
    end if;

    v_sum_pct := v_sum_pct + v_pct;
    v_active_count := v_active_count + 1;

    -- Determine detail vs overview level (PRD 6.9 RV-4, RV-10)
    if v_is_large_room and v_m.user_id <> v_caller_id and (p_selected_user_id is null or v_m.user_id <> p_selected_user_id) then
      v_p := v_m.privacy_settings;

      -- Check fasting status for overview
      if coalesce((v_p->>'share_fasting')::boolean, false) then
        if exists(select 1 from public.fasting_sessions where user_id = v_m.user_id and status = 'active') then
          v_fasting_val := '"fasting_now"'::jsonb;
        elsif exists(select 1 from public.fasting_sessions where user_id = v_m.user_id and local_date = v_today::date and status = 'completed') then
          v_fasting_val := '"completed_today"'::jsonb;
        else
          v_fasting_val := '"none"'::jsonb;
        end if;
      else
        v_fasting_val := '"locked"'::jsonb;
      end if;

      v_member_metrics := jsonb_build_object(
        'status', v_m.status,
        'overview', true,
        'logged_today', case when coalesce((v_p->>'share_streak')::boolean, true) then to_jsonb(coalesce(v_sum.logged_day, false)) else '"locked"'::jsonb end,
        'goal_completion', case when coalesce((v_p->>'share_goal_completion')::boolean, true) then to_jsonb(v_pct) else '"locked"'::jsonb end,
        'steps', case when coalesce((v_p->>'share_steps')::boolean, true) then to_jsonb(coalesce(v_sum.steps, 0)) else '"locked"'::jsonb end,
        'water_ml', '"locked"'::jsonb,
        'workout_status', case when coalesce((v_p->>'share_workouts')::boolean, true) then jsonb_build_object('worked_out', (coalesce(v_sum.workout_minutes, 0) > 0), 'duration_minutes', coalesce(v_sum.workout_minutes, 0)) else '"locked"'::jsonb end,
        'calories', '"locked"'::jsonb,
        'macros', '"locked"'::jsonb,
        'weight_kg', '"locked"'::jsonb,
        'weight_progress', '"locked"'::jsonb,
        'fasting_status', v_fasting_val,
        'meal_checklist', '"locked"'::jsonb
      );
    elsif v_m.user_id = v_caller_id then
      select
        exists(select 1 from public.food_entries where user_id = v_m.user_id and local_date::text = v_today and meal_section = 'breakfast' and deleted_at is null),
        exists(select 1 from public.food_entries where user_id = v_m.user_id and local_date::text = v_today and meal_section = 'lunch' and deleted_at is null),
        exists(select 1 from public.food_entries where user_id = v_m.user_id and local_date::text = v_today and meal_section = 'dinner' and deleted_at is null),
        exists(select 1 from public.food_entries where user_id = v_m.user_id and local_date::text = v_today and meal_section = 'snacks' and deleted_at is null)
      into v_has_breakfast, v_has_lunch, v_has_dinner, v_has_snacks;

      -- Caller always sees their own actual fasting status
      if exists(select 1 from public.fasting_sessions where user_id = v_m.user_id and status = 'active') then
        v_fasting_val := '"fasting_now"'::jsonb;
      elsif exists(select 1 from public.fasting_sessions where user_id = v_m.user_id and local_date = v_today::date and status = 'completed') then
        v_fasting_val := '"completed_today"'::jsonb;
      else
        v_fasting_val := '"none"'::jsonb;
      end if;

      v_member_metrics := jsonb_build_object(
        'status', v_m.status,
        'logged_today', coalesce(v_sum.logged_day, false),
        'goal_completion', v_pct,
        'steps', coalesce(v_sum.steps, 0),
        'water_ml', coalesce(v_sum.water_ml, 0),
        'workout_status', jsonb_build_object('worked_out', (coalesce(v_sum.workout_minutes, 0) > 0), 'duration_minutes', coalesce(v_sum.workout_minutes, 0)),
        'calories', coalesce(v_sum.calories, 0),
        'macros', jsonb_build_object('protein', coalesce(v_sum.protein, 0), 'carbs', coalesce(v_sum.carbs, 0), 'fat', coalesce(v_sum.fat, 0),'fiber',(select coalesce(sum(fiber),0) from public.food_entries where user_id=v_m.user_id and local_date::text=v_today and deleted_at is null)),
        'weight_kg', v_sum.weight_kg,
        'weight_progress', 0,
        'fasting_status', v_fasting_val,
        'meal_checklist', jsonb_build_object('breakfast', v_has_breakfast, 'lunch', v_has_lunch, 'dinner', v_has_dinner, 'snacks', v_has_snacks)
      );
    else
      -- Other member (selected or standard <= 12 room)
      v_p := v_m.privacy_settings;

      select
        exists(select 1 from public.food_entries where user_id = v_m.user_id and local_date::text = v_today and meal_section = 'breakfast' and deleted_at is null),
        exists(select 1 from public.food_entries where user_id = v_m.user_id and local_date::text = v_today and meal_section = 'lunch' and deleted_at is null),
        exists(select 1 from public.food_entries where user_id = v_m.user_id and local_date::text = v_today and meal_section = 'dinner' and deleted_at is null),
        exists(select 1 from public.food_entries where user_id = v_m.user_id and local_date::text = v_today and meal_section = 'snacks' and deleted_at is null)
      into v_has_breakfast, v_has_lunch, v_has_dinner, v_has_snacks;

      if coalesce((v_p->>'share_streak')::boolean, true) then
        v_streak_val := to_jsonb(coalesce(v_sum.logged_day, false));
      else
        v_streak_val := '"locked"'::jsonb;
      end if;

      if coalesce((v_p->>'share_goal_completion')::boolean, true) then
        v_goal_comp_val := to_jsonb(v_pct);
      else
        v_goal_comp_val := '"locked"'::jsonb;
      end if;

      if coalesce((v_p->>'share_steps')::boolean, true) then
        v_steps_val := to_jsonb(coalesce(v_sum.steps, 0));
      else
        v_steps_val := '"locked"'::jsonb;
      end if;

      if coalesce((v_p->>'share_water')::boolean, true) then
        v_water_val := to_jsonb(coalesce(v_sum.water_ml, 0));
      else
        v_water_val := '"locked"'::jsonb;
      end if;

      if coalesce((v_p->>'share_workouts')::boolean, true) then
        v_workout_val := jsonb_build_object('worked_out', (coalesce(v_sum.workout_minutes, 0) > 0), 'duration_minutes', coalesce(v_sum.workout_minutes, 0));
      else
        v_workout_val := '"locked"'::jsonb;
      end if;

      if coalesce((v_p->>'share_calories_macros')::boolean, false) then
        v_cal_val := to_jsonb(coalesce(v_sum.calories, 0));
        v_macros_val := jsonb_build_object('protein', coalesce(v_sum.protein, 0), 'carbs', coalesce(v_sum.carbs, 0), 'fat', coalesce(v_sum.fat, 0),'fiber',(select coalesce(sum(fiber),0) from public.food_entries where user_id=v_m.user_id and local_date::text=v_today and deleted_at is null));
      else
        v_cal_val := '"locked"'::jsonb;
        v_macros_val := '"locked"'::jsonb;
      end if;

      if coalesce((v_p->>'share_weight_number')::boolean, false) then
        v_weight_val := to_jsonb(v_sum.weight_kg);
      else
        v_weight_val := '"locked"'::jsonb;
      end if;

      if coalesce((v_p->>'share_weight_progress')::boolean, false) then
        v_weight_prog_val := to_jsonb(0);
      else
        v_weight_prog_val := '"locked"'::jsonb;
      end if;

      -- PRD 6.20 FST-9: Fasting is hidden by default; user may opt in to share "fasting now / completed today"
      if coalesce((v_p->>'share_fasting')::boolean, false) then
        if exists(select 1 from public.fasting_sessions where user_id = v_m.user_id and status = 'active') then
          v_fasting_val := '"fasting_now"'::jsonb;
        elsif exists(select 1 from public.fasting_sessions where user_id = v_m.user_id and local_date = v_today::date and status = 'completed') then
          v_fasting_val := '"completed_today"'::jsonb;
        else
          v_fasting_val := '"none"'::jsonb;
        end if;
      else
        v_fasting_val := '"locked"'::jsonb;
      end if;

      if coalesce(v_p->>'share_meals', 'never') <> 'never' then
        v_checklist := jsonb_build_object('breakfast', v_has_breakfast, 'lunch', v_has_lunch, 'dinner', v_has_dinner, 'snacks', v_has_snacks);
      else
        v_checklist := '"locked"'::jsonb;
      end if;

      v_member_metrics := jsonb_build_object(
        'status', v_m.status,
        'logged_today', v_streak_val,
        'goal_completion', v_goal_comp_val,
        'steps', v_steps_val,
        'water_ml', v_water_val,
        'workout_status', v_workout_val,
        'calories', v_cal_val,
        'macros', v_macros_val,
        'weight_kg', v_weight_val,
        'weight_progress', v_weight_prog_val,
        'fasting_status', v_fasting_val,
        'meal_checklist', v_checklist
      );
    end if;

    if v_m.user_id <> v_caller_id then
      -- Free recipients get only the basic nutrition and check-in fields.
      if public.active_room_tier(v_caller_id)='free' then
        v_member_metrics := v_member_metrics || jsonb_build_object(
          'steps','locked','water_ml','locked','weight_kg','locked','weight_progress','locked',
          'fasting_status','locked','meal_checklist','locked');
        if jsonb_typeof(v_member_metrics->'workout_status')='object' then
          v_member_metrics := jsonb_set(v_member_metrics,'{workout_status,duration_minutes}','"locked"'::jsonb);
        end if;
      end if;
      if coalesce((v_m.privacy_settings->>'share_calories_macros')::boolean,false) then
        v_member_metrics := jsonb_set(v_member_metrics,'{macros}', jsonb_build_object(
          'protein',coalesce(v_sum.protein,0),'carbs',coalesce(v_sum.carbs,0),
          'fiber',(select coalesce(sum(fiber),0) from public.food_entries where user_id=v_m.user_id and local_date::text=v_today and deleted_at is null)));
      end if;
    end if;
    if v_room.state='locked' then
      select jsonb_object_agg(key,case when key='status' then value else '"locked"'::jsonb end) into v_member_metrics from jsonb_each(v_member_metrics);
    end if;
    v_members_json := v_members_json || jsonb_build_object(
      'user_id', v_m.user_id,
      'username', v_m.username,
      'nickname', v_m.nickname,
      'avatar_url', v_m.avatar_url,
      'role', v_m.role,
      'status', v_m.status,
      'metrics', v_member_metrics
    );
  end loop;

  return jsonb_build_object(
    'caller_id',v_caller_id,
    'room', jsonb_build_object(
      'id', v_room.id,
      'name', v_room.name,
      'state', v_room.state,
      'code', v_room.code,
      'plan_holder_id',v_room.plan_holder_id,
      'member_cap',public.room_cap(p_room_id),
      'who_can_invite',v_room.who_can_invite,
      'created_by',v_room.created_by,
      'created_at',v_room.created_at,
      'updated_at',v_room.updated_at,
      'locked_at',v_room.locked_at,
      'host_id', (select user_id from public.room_members where room_id=p_room_id and role='host' and status<>'left' limit 1),
      'total_members', v_total_members,
      'is_large_room', v_is_large_room,
      'average_goal_completion', null
    ),
    'members', v_members_json,
    'pagination', jsonb_build_object(
      'page', p_page,
      'page_size', p_page_size,
      'total_count', v_total_paged
    )
  );
end;
$$;
