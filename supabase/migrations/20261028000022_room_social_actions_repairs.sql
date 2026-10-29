-- Existing room actions: real event IDs, safe retries, trusted meal snapshots.
create or replace function public.room_event_visible(p_room_id uuid,p_user_id uuid,p_event_type text)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select public.is_room_member(p_room_id,auth.uid()) and public.room_is_usable(p_room_id)
    and not exists(select 1 from public.blocks where (blocker_id=auth.uid() and blocked_id=p_user_id) or (blocked_id=auth.uid() and blocker_id=p_user_id))
    and (p_event_type in ('member_joined','member_left') or exists(
      select 1 from public.room_members m where m.room_id=p_room_id and m.user_id=p_user_id and m.status<>'left'
        and (p_user_id=auth.uid() or case p_event_type
          when 'meal_logged' then coalesce(m.privacy_settings->>'share_meals','never')<>'never' and coalesce((m.privacy_settings->>'share_calories_macros')::boolean,false)
          when 'workout_finished' then coalesce((m.privacy_settings->>'share_workouts')::boolean,true)
          when 'goal_reached' then coalesce((m.privacy_settings->>'share_goal_completion')::boolean,true)
          when 'streak_milestone' then coalesce((m.privacy_settings->>'share_streak')::boolean,true)
          else false end)));
$$;
revoke all on function public.room_event_visible(uuid,uuid,text) from public,anon;
grant execute on function public.room_event_visible(uuid,uuid,text) to authenticated;
create policy room_events_current_privacy on public.room_events as restrictive for select to authenticated
using(public.room_event_visible(room_id,user_id,event_type));

create or replace function public.send_room_nudge_v2(p_client_id uuid,p_room_id uuid,p_recipient_id uuid,p_message text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare n public.nudges; v_zone text; v_day_start timestamptz;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if public.active_room_tier(auth.uid())='free' then raise exception 'PLUS_REQUIRED'; end if;
  if not public.is_room_member(p_room_id,auth.uid()) or not public.is_room_member(p_room_id,p_recipient_id) then raise exception 'NOT_ROOM_MEMBER'; end if;
  if not public.room_is_usable(p_room_id) then raise exception 'ROOM_LOCKED'; end if;
  if p_recipient_id=auth.uid() then raise exception 'CANNOT_NUDGE_SELF'; end if;
  if exists(select 1 from public.blocks where (blocker_id=auth.uid() and blocked_id=p_recipient_id) or (blocked_id=auth.uid() and blocker_id=p_recipient_id)) then raise exception 'USER_BLOCKED'; end if;
  if p_message is null or length(trim(p_message)) not between 1 and 160 then raise exception 'INVALID_NUDGE_MESSAGE'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_recipient_id::text,42));
  select * into n from public.nudges where id=p_client_id;
  if found then
    if n.sender_id<>auth.uid() or n.room_id<>p_room_id or n.recipient_id<>p_recipient_id or n.message<>trim(p_message) then raise exception 'NOT_AUTHORIZED'; end if;
    return jsonb_build_object('status','sent','nudge_id',n.id);
  end if;
  select coalesce(timezone,'UTC') into v_zone from public.profiles where id=auth.uid();
  v_day_start:=date_trunc('day',now() at time zone v_zone) at time zone v_zone;
  if (select count(*) from public.nudges where room_id=p_room_id and sender_id=auth.uid() and recipient_id=p_recipient_id and created_at>=v_day_start)>=2 then raise exception 'NUDGE_LIMIT_REACHED'; end if;
  insert into public.nudges(id,room_id,sender_id,recipient_id,message) values(p_client_id,p_room_id,auth.uid(),p_recipient_id,trim(p_message));
  return jsonb_build_object('status','sent','nudge_id',p_client_id);
end; $$;
revoke all on function public.send_room_nudge_v2(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.send_room_nudge_v2(uuid,uuid,uuid,text) to authenticated;

create or replace function public.react_to_room_member(p_room_id uuid,p_target_user_id uuid,p_reaction text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_event uuid;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if public.active_room_tier(auth.uid())='free' then raise exception 'PLUS_REQUIRED'; end if;
  if not public.is_room_member(p_room_id,auth.uid()) or not public.is_room_member(p_room_id,p_target_user_id) then raise exception 'NOT_ROOM_MEMBER'; end if;
  if not public.room_is_usable(p_room_id) then raise exception 'ROOM_LOCKED'; end if;
  if exists(select 1 from public.blocks where (blocker_id=auth.uid() and blocked_id=p_target_user_id) or (blocked_id=auth.uid() and blocker_id=p_target_user_id)) then raise exception 'USER_BLOCKED'; end if;
  select id into v_event from public.room_events where room_id=p_room_id and user_id=p_target_user_id and public.room_event_visible(room_id,user_id,event_type) order by created_at desc,id desc limit 1;
  if v_event is null then raise exception 'NO_SHARED_ACTIVITY'; end if;
  return public.react(p_room_id,v_event,p_reaction);
end; $$;
revoke all on function public.react_to_room_member(uuid,uuid,text) from public,anon;
grant execute on function public.react_to_room_member(uuid,uuid,text) to authenticated;

alter table public.shared_meals add column if not exists source_food_entry_id uuid references public.food_entries(id) on delete set null;
create or replace function public.share_room_meal(p_client_id uuid,p_room_id uuid,p_food_entry_id uuid,p_participant_user_ids uuid[])
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare e public.food_entries; s public.shared_meals; v_target uuid;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if public.active_room_tier(auth.uid())='free' then raise exception 'PLUS_REQUIRED'; end if;
  if not public.is_room_member(p_room_id,auth.uid()) then raise exception 'NOT_ROOM_MEMBER'; end if;
  if not public.room_is_usable(p_room_id) then raise exception 'ROOM_LOCKED'; end if;
  if not exists(select 1 from public.room_members where room_id=p_room_id and user_id=auth.uid() and coalesce(privacy_settings->>'share_meals','never')<>'never' and coalesce((privacy_settings->>'share_calories_macros')::boolean,false)) then raise exception 'PRIVACY_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_client_id::text,43));
  select * into s from public.shared_meals where id=p_client_id;
  if found then
    if s.creator_id<>auth.uid() or s.room_id<>p_room_id or s.source_food_entry_id is distinct from p_food_entry_id then raise exception 'NOT_AUTHORIZED'; end if;
    return jsonb_build_object('status','created','shared_meal_id',s.id);
  end if;
  if coalesce(cardinality(p_participant_user_ids),0) not between 1 and 19 then raise exception 'INVALID_PARTICIPANTS'; end if;
  foreach v_target in array p_participant_user_ids loop
    if v_target=auth.uid() or not public.is_room_member(p_room_id,v_target) then raise exception 'NOT_ROOM_MEMBER'; end if;
    if exists(select 1 from public.blocks where (blocker_id=auth.uid() and blocked_id=v_target) or (blocked_id=auth.uid() and blocker_id=v_target)) then raise exception 'USER_BLOCKED'; end if;
  end loop;
  select * into e from public.food_entries where id=p_food_entry_id and user_id=auth.uid() and deleted_at is null;
  if not found then raise exception 'ENTRY_NOT_FOUND'; end if;
  insert into public.shared_meals(id,room_id,creator_id,source_food_entry_id,food_id,food_name,meal_section,original_quantity,unit,calories,protein,carbs,fat,fiber,sugar,sodium_mg)
  values(p_client_id,p_room_id,auth.uid(),e.id,e.food_id,e.food_name,e.meal_section,e.quantity,e.unit,e.calories,e.protein,e.carbs,e.fat,e.fiber,e.sugar,e.sodium_mg);
  insert into public.shared_meal_participants(shared_meal_id,user_id,status) select p_client_id,target,'pending' from unnest(p_participant_user_ids) target on conflict(shared_meal_id,user_id) do nothing;
  update public.rooms set updated_at=now() where id=p_room_id;
  return jsonb_build_object('status','created','shared_meal_id',p_client_id);
end; $$;
revoke all on function public.share_room_meal(uuid,uuid,uuid,uuid[]) from public,anon;
grant execute on function public.share_room_meal(uuid,uuid,uuid,uuid[]) to authenticated;

create or replace function public.get_pending_room_meals(p_room_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not public.is_room_member(p_room_id,auth.uid()) then raise exception 'NOT_ROOM_MEMBER'; end if;
  if not public.room_is_usable(p_room_id) then raise exception 'ROOM_LOCKED'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'sender_name',p.nickname,'food_name',s.food_name,'calories',s.calories,'protein_g',s.protein,'carbs_g',s.carbs,'fat_g',s.fat,'meal_section',s.meal_section,'quantity',s.original_quantity,'unit',s.unit) order by s.created_at),'[]'::jsonb)
    from public.shared_meal_participants part join public.shared_meals s on s.id=part.shared_meal_id
    join public.profiles p on p.id=s.creator_id join public.room_members m on m.room_id=s.room_id and m.user_id=s.creator_id and m.status<>'left'
    where part.user_id=auth.uid() and part.status='pending' and s.room_id=p_room_id
      and coalesce(m.privacy_settings->>'share_meals','always')<>'never' and coalesce((m.privacy_settings->>'share_calories_macros')::boolean,true)
      and not exists(select 1 from public.blocks b where (b.blocker_id=auth.uid() and b.blocked_id=s.creator_id) or (b.blocked_id=auth.uid() and b.blocker_id=s.creator_id)));
end; $$;
revoke all on function public.get_pending_room_meals(uuid) from public,anon;
grant execute on function public.get_pending_room_meals(uuid) to authenticated;

do $$
declare f record; v_def text;
begin
  for f in select p.oid,p.proname,pg_get_functiondef(p.oid) as definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('respond_shared_meal','react','tag_shared_meal') loop
    if f.proname='tag_shared_meal' then
      -- Retired callers supplied nutrition or referenced a schema that never existed.
      execute format('revoke all on function %s from public,anon,authenticated',f.oid::regprocedure);
    elsif f.proname='react' then
      v_def:=replace(f.definition,'insert into public.reactions', 'if not exists(select 1 from public.room_events where id=p_event_id and room_id=p_room_id and public.room_event_visible(room_id,user_id,event_type)) then raise exception ''NO_SHARED_ACTIVITY''; end if;'||chr(10)||'  insert into public.reactions');
      execute v_def;
    else
      v_def:=replace(f.definition,' and status = ''pending''','');
      v_def:=replace(v_def,'  if not p_accept then',
        '  if not public.is_room_member(v_meal.room_id,v_uid) or not public.is_room_member(v_meal.room_id,v_meal.creator_id) then raise exception ''NOT_ROOM_MEMBER''; end if;'||chr(10)||
        '  if not public.room_is_usable(v_meal.room_id) then raise exception ''ROOM_LOCKED''; end if;'||chr(10)||
        '  if not exists(select 1 from public.room_members where room_id=v_meal.room_id and user_id=v_meal.creator_id and coalesce(privacy_settings->>''share_meals'',''always'')<>''never'' and coalesce((privacy_settings->>''share_calories_macros'')::boolean,true)) then raise exception ''PRIVACY_DENIED''; end if;'||chr(10)||
        '  if exists(select 1 from public.blocks where (blocker_id=v_uid and blocked_id=v_meal.creator_id) or (blocked_id=v_uid and blocker_id=v_meal.creator_id)) then raise exception ''USER_BLOCKED''; end if;'||chr(10)||
        '  if v_participant.status<>''pending'' then return jsonb_build_object(''status'',v_participant.status,''diary_entry_id'',v_participant.created_diary_entry_id); end if;'||chr(10)||
        '  if not p_accept then');
      execute replace(v_def,'v_entry_id := gen_random_uuid();','v_entry_id := v_participant.id;');
    end if;
  end loop;
end; $$;
create or replace function public.get_blocked_room_profiles()
returns table(id uuid,username text,nickname text)
language sql stable security definer set search_path=public,pg_temp as $$
  select p.id,p.username::text,p.nickname from public.blocks b join public.profiles p on p.id=b.blocked_id
  where b.blocker_id=auth.uid() order by b.created_at desc;
$$;
revoke all on function public.get_blocked_room_profiles() from public,anon;
grant execute on function public.get_blocked_room_profiles() to authenticated;
notify pgrst,'reload schema';
