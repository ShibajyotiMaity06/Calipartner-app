-- Privacy updates are patches. Sanitizing a partial document reset unrelated switches.
create or replace function public.set_privacy(p_room_id uuid,p_privacy_settings jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare settings jsonb;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  select privacy_settings into settings from public.room_members
    where room_id=p_room_id and user_id=auth.uid() and status in ('active','locked','paused') for update;
  if not found then raise exception 'NOT_ROOM_MEMBER'; end if;
  settings:=public.sanitize_privacy_settings(coalesce(settings,'{}'::jsonb)||coalesce(p_privacy_settings,'{}'::jsonb));
  update public.room_members set privacy_settings=settings,updated_at=now() where room_id=p_room_id and user_id=auth.uid();
  return settings;
end; $$;
revoke all on function public.set_privacy(uuid,jsonb) from public,anon;
grant execute on function public.set_privacy(uuid,jsonb) to authenticated;

-- This projection is the only peer meal reader. Never grant peer access to food_entries.
create or replace function public.get_room_meals_today(p_room_id uuid,p_member_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare privacy jsonb; zone text;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if public.active_room_tier(auth.uid())='free' then raise exception 'PLUS_REQUIRED'; end if;
  if not public.is_room_member(p_room_id,auth.uid()) or not public.is_room_member(p_room_id,p_member_id) then raise exception 'NOT_ROOM_MEMBER'; end if;
  if not public.room_is_usable(p_room_id) then raise exception 'ROOM_LOCKED'; end if;
  if exists(select 1 from public.blocks where (blocker_id=auth.uid() and blocked_id=p_member_id) or (blocked_id=auth.uid() and blocker_id=p_member_id)) then raise exception 'USER_BLOCKED'; end if;
  select m.privacy_settings,coalesce(p.timezone,'UTC') into privacy,zone from public.room_members m join public.profiles p on p.id=m.user_id where m.room_id=p_room_id and m.user_id=p_member_id;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'food_name',e.food_name,'meal_section',e.meal_section,'quantity',e.quantity,'unit',e.unit,'local_date',e.local_date,
    'can_copy',coalesce((privacy->>'share_calories_macros')::boolean,false)) order by e.logged_at,e.id),'[]'::jsonb)
    from public.food_entries e where e.user_id=p_member_id and e.deleted_at is null
      and e.local_date::text=(now() at time zone zone)::date::text
      and (p_member_id=auth.uid() or privacy->>'share_meals'='always'
        or (privacy->>'share_meals'='per_meal' and exists(select 1 from public.shared_meals s join public.shared_meal_participants part on part.shared_meal_id=s.id where s.source_food_entry_id=e.id and s.room_id=p_room_id and part.user_id=auth.uid() and part.status in ('pending','accepted')))));
end; $$;
revoke all on function public.get_room_meals_today(uuid,uuid) from public,anon;
grant execute on function public.get_room_meals_today(uuid,uuid) to authenticated;

create table public.room_meal_copies (
  id uuid primary key references public.food_entries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  source_entry_id uuid not null references public.food_entries(id) on delete cascade,
  meal_section text not null,
  created_at timestamptz not null default now()
);
alter table public.room_meal_copies enable row level security;
create policy room_meal_copies_read_own on public.room_meal_copies for select to authenticated using(user_id=auth.uid());
revoke all on public.room_meal_copies from anon,authenticated;
grant select on public.room_meal_copies to authenticated;

create or replace function public.copy_room_meal(p_client_id uuid,p_room_id uuid,p_member_id uuid,p_entry_id uuid,p_meal_section text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare entry public.food_entries; receipt public.room_meal_copies; meals jsonb; zone text;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_client_id is null or p_meal_section not in ('breakfast','lunch','dinner','snacks','extra') or p_meal_section is null then raise exception 'INVALID_INPUT'; end if;
  meals:=public.get_room_meals_today(p_room_id,p_member_id);
  if not exists(select 1 from jsonb_array_elements(meals) meal where meal->>'id'=p_entry_id::text and (meal->>'can_copy')::boolean) then raise exception 'PRIVACY_DENIED'; end if;
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
revoke all on function public.copy_room_meal(uuid,uuid,uuid,uuid,text) from public,anon;
grant execute on function public.copy_room_meal(uuid,uuid,uuid,uuid,text) to authenticated;
notify pgrst,'reload schema';
