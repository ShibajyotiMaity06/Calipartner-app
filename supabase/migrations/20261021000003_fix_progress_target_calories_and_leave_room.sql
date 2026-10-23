-- Migration: Fix target_calories column on goal_profiles, update leave_room, and reset room for shibajyoti.maity06@gmail.com

-- 1. Add target_calories column to goal_profiles if not present
alter table public.goal_profiles add column if not exists target_calories integer;
update public.goal_profiles set target_calories = daily_calorie_target where target_calories is null;

-- Trigger to keep target_calories synchronized with daily_calorie_target
create or replace function public.sync_goal_profiles_target_calories()
returns trigger
language plpgsql
as $$
begin
  if NEW.target_calories is null then
    NEW.target_calories := NEW.daily_calorie_target;
  end if;
  if NEW.daily_calorie_target is null then
    NEW.daily_calorie_target := NEW.target_calories;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_sync_goal_profiles_target_calories on public.goal_profiles;
create trigger trg_sync_goal_profiles_target_calories
  before insert or update on public.goal_profiles
  for each row execute function public.sync_goal_profiles_target_calories();

-- 2. Update current_goal_profiles view to include target_calories
create or replace view public.current_goal_profiles as
select distinct on (user_id)
  id,
  user_id,
  goal,
  activity_level,
  current_weight_kg,
  body_fat_percentage,
  weekly_rate_kg,
  target_weight_kg,
  target_date,
  daily_calorie_target,
  coalesce(target_calories, daily_calorie_target) as target_calories,
  protein_grams,
  fat_grams,
  carb_grams,
  bmr,
  tdee,
  step_goal,
  water_ml_goal,
  effective_from,
  confirmed_at,
  recompute_reason,
  created_at
from public.goal_profiles
order by user_id, effective_from desc;

-- 3. Robust leave_room that works when room is locked or paused
create or replace function public.leave_room(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_member record;
  v_next_host record;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  select * into v_member
  from public.room_members
  where room_id = p_room_id and user_id = v_uid and status in ('active', 'paused', 'locked');

  if not found then
    return jsonb_build_object('status', 'left', 'room_id', p_room_id);
  end if;

  update public.room_members
  set status = 'left', updated_at = now()
  where id = v_member.id;

  insert into public.room_events (room_id, user_id, event_type, payload)
  values (p_room_id, v_uid, 'member_left', jsonb_build_object('reason', 'voluntary'));

  -- PRD 6.8 ROOM-4: If host leaves, hosting passes to longest-standing active member
  if v_member.role = 'host' then
    select * into v_next_host
    from public.room_members
    where room_id = p_room_id and status = 'active'
    order by joined_at asc
    limit 1;

    if found then
      update public.room_members
      set role = 'host', updated_at = now()
      where id = v_next_host.id;
    end if;
  end if;

  perform public.recompute_room_state(p_room_id);

  return jsonb_build_object('status', 'left', 'room_id', p_room_id);
end;
$$;

-- 4. Purge stale room memberships and set nickname for shibajyoti.maity06@gmail.com
do $$
declare
  v_shiba_id uuid;
begin
  select id into v_shiba_id from auth.users where email = 'shibajyoti.maity06@gmail.com';
  if v_shiba_id is not null then
    -- Clean room memberships
    delete from public.room_members where user_id = v_shiba_id;
    -- Clean orphan empty rooms
    delete from public.rooms where id not in (select distinct room_id from public.room_members);
    -- Clean requests
    delete from public.room_requests where sender_id = v_shiba_id or recipient_id = v_shiba_id;
    -- Set nickname to Maity
    update public.profiles set nickname = 'Maity' where id = v_shiba_id;
  end if;
end;
$$;
