-- Plan meals use server-owned snapshots; request IDs make acknowledged retries safe.
create table public.weekly_meal_actions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null,
  entry_count integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.weekly_meal_actions enable row level security;
create policy weekly_meal_actions_private on public.weekly_meal_actions
  for all to authenticated using(false) with check(false);
revoke all on public.weekly_meal_actions from public,anon,authenticated;
grant all on public.weekly_meal_actions to service_role;

create function public.log_weekly_plan_meal(
  p_id uuid,p_plan_id uuid,p_revision integer,p_day integer,p_meal integer,p_section text
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare
  plan public.personal_weekly_plans;
  previous public.weekly_meal_actions;
  payload jsonb:=jsonb_build_array('log',p_plan_id,p_revision,p_day,p_meal,p_section);
  meal jsonb;
  zone text;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_id is null or p_plan_id is null or p_revision is null or p_revision<1 or p_day is null or p_day not between 0 and 6 or p_meal is null or p_meal<0
    or p_section is null or p_section not in ('breakfast','lunch','dinner','snacks') then
    raise exception 'INVALID_MEAL';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
  select * into previous from public.weekly_meal_actions where id=p_id;
  if found then
    if previous.user_id<>auth.uid() or previous.payload<>payload then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return p_id;
  end if;
  select * into plan from public.personal_weekly_plans where user_id=auth.uid() and id=p_plan_id for share;
  if not found or plan.revision<>p_revision then raise exception 'PLAN_CHANGED'; end if;
  if p_day>0 and not public.has_purchased_weekly_plan_access(auth.uid()) then raise exception 'PURCHASED_PLUS_REQUIRED'; end if;
  meal:=plan.content->'days'->p_day->'meals'->p_meal;
  if meal is null or jsonb_typeof(meal)<>'object' then raise exception 'INVALID_MEAL'; end if;
  select timezone into zone from public.profiles where id=auth.uid();
  if zone is null then raise exception 'TIMEZONE_REQUIRED'; end if;
  insert into public.food_entries(id,user_id,meal_section,quantity,unit,calories,protein,carbs,fat,
    fiber,sugar,sodium_mg,food_name,local_date,source,nutrition_details)
  values(p_id,auth.uid(),p_section,1,meal->>'portion',(meal->>'calories')::numeric,
    (meal->>'protein')::numeric,(meal->>'carbs')::numeric,(meal->>'fat')::numeric,
    0,0,0,meal->>'name',(now() at time zone zone)::date,'recipe',
    '{"not_provided":["fiber","sugar","sodium_mg"]}'::jsonb);
  insert into public.weekly_meal_actions(id,user_id,payload) values(p_id,auth.uid(),payload);
  return p_id;
end; $$;
revoke all on function public.log_weekly_plan_meal(uuid,uuid,integer,integer,integer,text) from public,anon;
grant execute on function public.log_weekly_plan_meal(uuid,uuid,integer,integer,integer,text) to authenticated;

create function public.swap_weekly_plan_meal(
  p_id uuid,p_plan_id uuid,p_revision integer,p_day integer,p_meal integer,p_option integer
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  plan public.personal_weekly_plans;
  previous public.weekly_meal_actions;
  payload jsonb:=jsonb_build_array('swap',p_plan_id,p_revision,p_day,p_meal,p_option);
  meal jsonb;
  replacement jsonb;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_id is null or p_plan_id is null or p_revision is null or p_revision<1 or p_day is null or p_day not between 0 and 6 or p_meal is null or p_meal<0
    or p_option is null or p_option<0 then raise exception 'INVALID_MEAL'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
  select * into previous from public.weekly_meal_actions where id=p_id;
  if found then
    if previous.user_id<>auth.uid() or previous.payload<>payload then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return public.get_personal_weekly_plan();
  end if;
  if not public.has_purchased_weekly_plan_access(auth.uid()) then raise exception 'PURCHASED_PLUS_REQUIRED'; end if;
  select * into plan from public.personal_weekly_plans where user_id=auth.uid() and id=p_plan_id for update;
  if not found or plan.revision<>p_revision then raise exception 'PLAN_CHANGED'; end if;
  meal:=plan.content->'days'->p_day->'meals'->p_meal;
  replacement:=meal->'alternatives'->p_option;
  if replacement is null or jsonb_typeof(replacement)<>'object' then raise exception 'INVALID_MEAL'; end if;
  replacement:=replacement||jsonb_build_object('alternatives',
    ((meal->'alternatives')-p_option)||jsonb_build_array(meal-'alternatives'));
  update public.personal_weekly_plans set
    content=jsonb_set(content,array['days',p_day::text,'meals',p_meal::text],replacement),
    revision=revision+1,updated_at=now() where user_id=auth.uid();
  insert into public.weekly_meal_actions(id,user_id,payload) values(p_id,auth.uid(),payload);
  return public.get_personal_weekly_plan();
end; $$;
revoke all on function public.swap_weekly_plan_meal(uuid,uuid,integer,integer,integer,integer) from public,anon;
grant execute on function public.swap_weekly_plan_meal(uuid,uuid,integer,integer,integer,integer) to authenticated;

create function public.repeat_previous_day_meal(p_id uuid,p_target_date date,p_section text)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare
  previous public.weekly_meal_actions;
  payload jsonb:=jsonb_build_array('repeat',p_target_date,p_section);
  total integer;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_id is null or p_target_date is null or p_section is null
    or p_section not in ('breakfast','lunch','dinner','snacks','extra') then raise exception 'INVALID_MEAL'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
  select * into previous from public.weekly_meal_actions where id=p_id;
  if found then
    if previous.user_id<>auth.uid() or previous.payload<>payload then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return previous.entry_count;
  end if;
  insert into public.food_entries(id,user_id,food_id,meal_section,quantity,unit,calories,protein,carbs,fat,
    fiber,sugar,sodium_mg,food_name,brand_name,local_date,source,nutrition_details)
  select md5(p_id::text||entry.id::text)::uuid,auth.uid(),food_id,p_section,quantity,unit,calories,protein,carbs,fat,
    fiber,sugar,sodium_mg,food_name,brand_name,p_target_date,'copy',nutrition_details
  from public.food_entries entry where user_id=auth.uid() and local_date=p_target_date-1
    and meal_section=p_section and deleted_at is null;
  get diagnostics total=row_count;
  insert into public.weekly_meal_actions(id,user_id,payload,entry_count) values(p_id,auth.uid(),payload,total);
  return total;
end; $$;
revoke all on function public.repeat_previous_day_meal(uuid,date,text) from public,anon;
grant execute on function public.repeat_previous_day_meal(uuid,date,text) to authenticated;
notify pgrst,'reload schema';
