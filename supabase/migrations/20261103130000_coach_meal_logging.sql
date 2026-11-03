-- Explicit user confirmation is the only caller of this RPC. Provider calls never write food.
-- Owner-only RLS remains in force; squad projections expose the same diary records.
create or replace function public.log_coach_meal(p_entries jsonb)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare item jsonb; nutrient text; value numeric; ids uuid[]; result jsonb;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if not exists(select 1 from public.entitlements where user_id=auth.uid() and tier='pro'
    and status in ('paid','grace') and (period_end is null or period_end>now())) then
    raise exception 'UPGRADE_REQUIRED';
  end if;
  if not exists(select 1 from public.consent_records where user_id=auth.uid() and consent_type='ai_processing') then
    raise exception 'CONSENT_REQUIRED';
  end if;
  if jsonb_typeof(p_entries) is distinct from 'array' or jsonb_array_length(p_entries) not between 1 and 20 then raise exception 'INVALID_COACH_MEAL'; end if;
  for item in select * from jsonb_array_elements(p_entries) loop
    if jsonb_typeof(item) is distinct from 'object'
      or exists(select 1 from jsonb_object_keys(item) key where key not in ('id','food_name','meal_section','local_date','quantity','unit','calories','protein','carbs','fat','fiber','sugar','sodium_mg'))
      or length(trim(coalesce(item->>'food_name',''))) not between 1 and 200
      or length(trim(coalesce(item->>'unit',''))) not between 1 and 40
      or coalesce(item->>'meal_section','') not in ('breakfast','lunch','dinner','snacks','extra')
      or (item->>'id') is null or (item->>'local_date') is null
      or (item->>'local_date') !~ '^\d{4}-\d{2}-\d{2}$'
      or (item->>'local_date')::date::text <> item->>'local_date'
    then raise exception 'INVALID_COACH_MEAL'; end if;
    if jsonb_typeof(item->'quantity') is distinct from 'number' or not ((item->>'quantity')::numeric between 0.01 and 100000) then raise exception 'INVALID_COACH_MEAL'; end if;
    foreach nutrient in array array['calories','protein','carbs','fat','fiber','sugar','sodium_mg'] loop
      if jsonb_typeof(item->nutrient) is distinct from 'number' then raise exception 'INVALID_COACH_MEAL'; end if;
      value:=(item->>nutrient)::numeric;
      if value<0 or value>(case nutrient when 'calories' then 10000 when 'sodium_mg' then 99000 when 'fiber' then 1000 else 2000 end) then raise exception 'INVALID_COACH_MEAL'; end if;
    end loop;
    if (item->>'calories')::numeric=0 and ((item->>'protein')::numeric+(item->>'carbs')::numeric+(item->>'fat')::numeric)>0 then raise exception 'INVALID_COACH_MEAL'; end if;
  end loop;
  select array_agg((row.entry->>'id')::uuid) into ids from jsonb_array_elements(p_entries) row(entry);
  if (select count(distinct id) from unnest(ids) id)<>cardinality(ids) then raise exception 'INVALID_COACH_MEAL'; end if;
  insert into public.food_entries(id,user_id,food_id,food_name,meal_section,local_date,quantity,unit,calories,protein,carbs,fat,fiber,sugar,sodium_mg,source)
    select (e->>'id')::uuid,auth.uid(),null,e->>'food_name',e->>'meal_section',(e->>'local_date')::date,
      (e->>'quantity')::numeric,e->>'unit',(e->>'calories')::numeric,(e->>'protein')::numeric,
      (e->>'carbs')::numeric,(e->>'fat')::numeric,(e->>'fiber')::numeric,(e->>'sugar')::numeric,(e->>'sodium_mg')::numeric,'description'
    from jsonb_array_elements(p_entries) e on conflict(id) do nothing;
  select jsonb_agg(to_jsonb(e) order by e.id) into result from public.food_entries e
    where e.id=any(ids) and e.user_id=auth.uid() and e.deleted_at is null;
  if coalesce(jsonb_array_length(result),0)<>cardinality(ids) then raise exception 'SAVE_NOT_ALLOWED'; end if;
  return result;
end; $$;
revoke all on function public.log_coach_meal(jsonb) from public,anon;
grant execute on function public.log_coach_meal(jsonb) to authenticated;
