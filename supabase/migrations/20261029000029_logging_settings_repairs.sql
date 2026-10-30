-- Owner-requested repairs: invitation identities are a projection, never profile-table access.
create or replace function public.get_request_identities(p_request_ids uuid[])
returns table(id uuid, username text, nickname text, avatar_url text)
language sql stable security definer set search_path=public,pg_temp as $$
  select distinct p.id, p.username::text, p.nickname, p.avatar_url
  from public.room_requests r
  join public.profiles p on p.id in (r.sender_id,r.recipient_id)
  where r.id=any(p_request_ids)
    and auth.uid() in (r.sender_id,r.recipient_id)
    and not exists(select 1 from public.blocks b where
      (b.blocker_id=auth.uid() and b.blocked_id=p.id)
      or (b.blocked_id=auth.uid() and b.blocker_id=p.id));
$$;
revoke all on function public.get_request_identities(uuid[]) from public,anon;
grant execute on function public.get_request_identities(uuid[]) to authenticated;

alter table public.goal_profiles add column custom_macros boolean not null default false;

create or replace function public.guard_custom_macros()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_sex text; v_previous public.goal_profiles; v_floor integer;
  v_protein numeric; v_fat numeric; v_carbs numeric;
begin
  -- Trusted imports/backfills have no user JWT; owner RLS still rejects anonymous writes.
  if auth.uid() is null then return new; end if;
  select * into v_previous from public.goal_profiles
    where user_id=new.user_id order by effective_from desc limit 1;
  if not new.custom_macros then
    -- The client cannot bypass the paid gate by omitting/clearing the marker.
    -- Preserve historical plans and step/water-only edits with their exact saved macros.
    if (v_previous.daily_calorie_target,v_previous.protein_grams,v_previous.fat_grams,v_previous.carb_grams)
      is not distinct from (new.daily_calorie_target,new.protein_grams,new.fat_grams,new.carb_grams)
    then
      new.custom_macros:=v_previous.custom_macros;
      if not new.custom_macros then return new; end if;
    else
      if new.gym_days is not null then
        v_protein:=round(new.current_weight_kg*2.2);
        v_fat:=round(new.current_weight_kg*1.2);
        v_carbs:=greatest(0,round((new.daily_calorie_target-new.current_weight_kg*19.6)/4));
      else
        v_protein:=round(new.current_weight_kg*case new.goal when 'cut' then 2.0 when 'bulk' then 1.8 else 1.6 end);
        v_fat:=greatest(round(new.daily_calorie_target*0.25/9),round(new.current_weight_kg*0.6));
        v_carbs:=greatest(0,round((new.daily_calorie_target-v_protein*4-round(new.daily_calorie_target*0.25))/4));
      end if;
      if new.protein_grams=v_protein and new.fat_grams=v_fat and abs(new.carb_grams-v_carbs)<=1 then
        return new;
      end if;
      new.custom_macros:=true;
    end if;
  end if;
  -- Replaying an existing override, or changing steps/water, does not require repurchasing.
  if public.active_room_tier(new.user_id) not in ('plus','pro') and not coalesce((
    v_previous.custom_macros and
    (v_previous.daily_calorie_target,v_previous.protein_grams,v_previous.fat_grams,v_previous.carb_grams)
      is not distinct from (new.daily_calorie_target,new.protein_grams,new.fat_grams,new.carb_grams)
  ),false) then raise exception 'PLUS_REQUIRED'; end if;
  select sex into v_sex from public.profiles where id=new.user_id;
  v_floor:=case v_sex when 'male' then 1500 when 'female' then 1200 else 1350 end;
  if new.daily_calorie_target < v_floor or new.daily_calorie_target > 10000
    or new.daily_calorie_target <> new.protein_grams*4+new.carb_grams*4+new.fat_grams*9
    or abs(new.daily_calorie_target-new.tdee)/1100.0 > new.current_weight_kg*0.01
    or (new.goal='cut' and new.input_height_cm is not null and new.current_weight_kg/power(new.input_height_cm/100,2)<18.5)
    or abs(new.weekly_rate_kg-round(abs(new.daily_calorie_target-new.tdee)/1100.0,2))>0.001
    or (new.goal='maintain' and new.daily_calorie_target<>new.tdee)
    or (new.goal='cut' and new.daily_calorie_target>new.tdee)
    or (new.goal='bulk' and new.daily_calorie_target<new.tdee)
  then raise exception 'UNSAFE_MACROS'; end if;
  return new;
end; $$;
revoke all on function public.guard_custom_macros() from public,anon,authenticated;
create trigger a_guard_custom_macros before insert or update on public.goal_profiles
for each row execute function public.guard_custom_macros();

-- Keep the existing calculator validator; custom targets have their own stricter guard above.
do $$
declare definition text;
begin
  select pg_get_functiondef('public.check_gym_plan_safety()'::regprocedure) into definition;
  definition:=replace(definition,'if new.gym_days is null then return new; end if;',
    'if new.gym_days is null or new.custom_macros then return new; end if;');
  execute definition;
end; $$;

notify pgrst, 'reload schema';
