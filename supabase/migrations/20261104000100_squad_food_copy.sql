-- Copy only through the current privacy-checked, paid Squad projection.
create or replace function public.copy_squad_food(p_client_id uuid,p_room_id uuid,p_member_id uuid,p_entry_id uuid,p_meal_section text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare entry public.food_entries; receipt public.room_meal_copies; meals jsonb; zone text;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_client_id is null or p_meal_section not in ('breakfast','lunch','dinner','snacks','extra') or p_meal_section is null then raise exception 'INVALID_INPUT'; end if;
  if p_member_id=auth.uid() then raise exception 'OWN_FOOD'; end if;
  meals:=public.get_squad_member_details(p_room_id,p_member_id)->'meals';
  if not exists(select 1 from jsonb_array_elements(meals) meal cross join lateral jsonb_array_elements(meal->'items') item where item->>'id'=p_entry_id::text) then raise exception 'PRIVACY_DENIED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_client_id::text,44));
  select * into receipt from public.room_meal_copies where id=p_client_id;
  if found then
    if receipt.user_id<>auth.uid() or receipt.room_id<>p_room_id or receipt.source_entry_id<>p_entry_id or receipt.meal_section<>p_meal_section then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return (select to_jsonb(e) from public.food_entries e where e.id=p_client_id and e.user_id=auth.uid());
  end if;
  if exists(select 1 from public.food_entries where id=p_client_id) then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
  select * into entry from public.food_entries where id=p_entry_id and user_id=p_member_id and deleted_at is null for share;
  if not found then raise exception 'ENTRY_NOT_FOUND'; end if;
  select coalesce(timezone,'UTC') into zone from public.profiles where id=auth.uid();
  insert into public.food_entries(id,user_id,food_id,food_name,brand_name,meal_section,quantity,unit,calories,protein,carbs,fat,fiber,sugar,sodium_mg,nutrition_details,logged_at,local_date,source,updated_at)
  values(p_client_id,auth.uid(),null,entry.food_name,entry.brand_name,p_meal_section,entry.quantity,entry.unit,entry.calories,entry.protein,entry.carbs,entry.fat,entry.fiber,entry.sugar,entry.sodium_mg,entry.nutrition_details,now(),(now() at time zone zone)::date,'copy',now());
  insert into public.room_meal_copies(id,user_id,room_id,source_entry_id,meal_section) values(p_client_id,auth.uid(),p_room_id,p_entry_id,p_meal_section);
  return (select to_jsonb(e) from public.food_entries e where e.id=p_client_id);
end; $$;
revoke all on function public.copy_squad_food(uuid,uuid,uuid,uuid,text) from public,anon;
grant execute on function public.copy_squad_food(uuid,uuid,uuid,uuid,text) to authenticated;
