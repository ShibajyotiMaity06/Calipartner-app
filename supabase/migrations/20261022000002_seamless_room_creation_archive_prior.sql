-- Migration: Seamless room creation by automatically archiving prior hosted room when at capacity
-- Avoids PLAN_ALREADY_ATTACHED error blocking squad creation

create or replace function public.create_room(
  p_name text,
  p_device_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_clean_name text;
  v_code text;
  v_room_id uuid;
  v_user_room_count integer;
  v_hosted_room_count integer;
  v_max_hosted integer := 1;
  v_cap integer := 10;
  v_has_active_plan boolean := false;
  v_ent record;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  v_clean_name := trim(p_name);
  if length(v_clean_name) < 1 or length(v_clean_name) > 100 then
    raise exception 'INVALID_ROOM_NAME' using errcode = 'P0001';
  end if;

  -- 1. Automatically archive any previous rooms hosted by v_uid where there are no other active members
  update public.rooms r
  set state = 'archived', updated_at = now()
  where r.plan_holder_id = v_uid
    and r.state in ('active', 'dormant', 'over_capacity')
    and (
      select count(*)
      from public.room_members rm
      where rm.room_id = r.id and rm.status = 'active' and rm.user_id <> v_uid
    ) = 0;

  -- 2. Room membership limit: max 3 rooms joined per user
  select count(*) into v_user_room_count
  from public.room_members
  where user_id = v_uid and status in ('active', 'paused');

  if v_user_room_count >= 3 then
    -- Archive any empty room to free up membership slot
    update public.room_members
    set status = 'left', updated_at = now()
    where user_id = v_uid
      and status = 'active'
      and room_id in (
        select id from public.rooms where plan_holder_id = v_uid and state = 'archived'
      );
  end if;

  -- 3. Check plan and hosted count
  select * into v_ent
  from public.entitlements
  where user_id = v_uid;

  if found and v_ent.tier = 'pro' then
    v_max_hosted := 3;
  else
    v_max_hosted := 1;
  end if;

  select count(*) into v_hosted_room_count
  from public.rooms
  where plan_holder_id = v_uid and state in ('active', 'dormant', 'over_capacity');

  if found and v_ent.status in ('paid', 'grace') and (v_ent.period_end is null or v_ent.period_end > now()) then
    v_has_active_plan := true;

    -- If user is at or above max hosted count, archive oldest empty/previous hosted room so they can seamlessly create new squad
    if v_hosted_room_count >= v_max_hosted then
      update public.rooms
      set state = 'archived', updated_at = now()
      where id in (
        select id from public.rooms
        where plan_holder_id = v_uid and state in ('active', 'dormant', 'over_capacity')
        order by created_at asc
        limit (v_hosted_room_count - v_max_hosted + 1)
      );
    end if;

    v_cap := case when v_ent.tier = 'pro' then 20 else 10 end;
  else
    -- Starts trial if eligible
    if not public.start_trial_if_eligible(v_uid, p_device_hash) then
      -- If trial already started and user is recreating a room, archive old room
      select count(*) into v_hosted_room_count
      from public.rooms
      where plan_holder_id = v_uid and state in ('active', 'dormant', 'over_capacity');

      if v_hosted_room_count > 0 then
        update public.rooms
        set state = 'archived', updated_at = now()
        where plan_holder_id = v_uid and state in ('active', 'dormant', 'over_capacity');
      else
        raise exception 'PLAN_REQUIRED' using errcode = 'P0001';
      end if;
    end if;
    v_cap := coalesce((public.get_remote_config('trial_cap'))::integer, 10);
  end if;

  v_code := public.generate_room_code();

  insert into public.rooms (name, code, state, who_can_invite, created_by, plan_holder_id, member_cap)
  values (v_clean_name, v_code, 'dormant', 'host_only', v_uid, v_uid, v_cap)
  returning id into v_room_id;

  update public.entitlements
  set attached_room_id = v_room_id,
      updated_at = now()
  where user_id = v_uid;

  insert into public.room_members (room_id, user_id, role, status)
  values (v_room_id, v_uid, 'host', 'active');

  return jsonb_build_object(
    'room_id', v_room_id,
    'name', v_clean_name,
    'code', v_code,
    'role', 'host',
    'state', 'dormant'
  );
end;
$$;
