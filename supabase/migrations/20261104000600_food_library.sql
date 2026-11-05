-- Private, acknowledged food favourites and search queries. Never changes diary history.
create table public.food_favorites (
 user_id uuid not null references auth.users(id) on delete cascade,
 food_key text not null check(length(food_key) between 1 and 512),
 food jsonb not null check(jsonb_typeof(food)='object' and octet_length(food::text)<=50000),
 created_at timestamptz not null default now(),
 primary key(user_id,food_key)
);
create table public.food_search_history (
 user_id uuid not null references auth.users(id) on delete cascade,
 query text not null check(length(query) between 2 and 100),
 searched_at timestamptz not null default now(),
 primary key(user_id,query)
);
alter table public.food_favorites enable row level security;
alter table public.food_search_history enable row level security;
revoke all on public.food_favorites,public.food_search_history from public,anon;
grant select,insert,update,delete on public.food_favorites,public.food_search_history to authenticated;
create policy food_favorites_select on public.food_favorites for select to authenticated using(user_id=auth.uid());
create policy food_favorites_insert on public.food_favorites for insert to authenticated with check(user_id=auth.uid() and (food->>'owner_id' is null or food->>'owner_id'=auth.uid()::text));
create policy food_favorites_update on public.food_favorites for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid() and (food->>'owner_id' is null or food->>'owner_id'=auth.uid()::text));
create policy food_favorites_delete on public.food_favorites for delete to authenticated using(user_id=auth.uid());
create policy food_search_history_select on public.food_search_history for select to authenticated using(user_id=auth.uid());
create policy food_search_history_insert on public.food_search_history for insert to authenticated with check(user_id=auth.uid());
create policy food_search_history_update on public.food_search_history for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy food_search_history_delete on public.food_search_history for delete to authenticated using(user_id=auth.uid());

create function public.get_food_library() returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
 return jsonb_build_object(
  'foods',coalesce((select jsonb_agg(food order by created_at desc,food_key) from public.food_favorites where user_id=auth.uid()),'[]'::jsonb),
  'searches',coalesce((select jsonb_agg(query order by searched_at desc,query) from (select query,searched_at from public.food_search_history where user_id=auth.uid() order by searched_at desc,query limit 20) q),'[]'::jsonb));
end; $$;
create function public.set_food_favorite(p_food_key text,p_food jsonb,p_favorite boolean) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
 if p_favorite is null or p_food_key is null or length(p_food_key) not between 1 and 512 then raise exception 'INVALID_FOOD'; end if;
 if p_favorite then
  if p_food is null or jsonb_typeof(p_food)<>'object' or octet_length(p_food::text)>50000 or nullif(trim(p_food->>'name'),'') is null then raise exception 'INVALID_FOOD'; end if;
  if p_food->>'owner_id' is not null and p_food->>'owner_id'<>auth.uid()::text then raise exception 'NOT_AUTHORIZED'; end if;
  insert into public.food_favorites(user_id,food_key,food) values(auth.uid(),p_food_key,p_food)
   on conflict(user_id,food_key) do update set food=excluded.food;
 else delete from public.food_favorites where user_id=auth.uid() and food_key=p_food_key;
 end if;
 return jsonb_build_object('food_key',p_food_key,'favorite',p_favorite);
end; $$;
create function public.record_food_search(p_query text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare q text:=lower(trim(p_query));
begin
 if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
 if q is null or length(q) not between 2 and 100 then raise exception 'INVALID_QUERY'; end if;
 insert into public.food_search_history(user_id,query) values(auth.uid(),q) on conflict(user_id,query) do update set searched_at=now();
 delete from public.food_search_history where user_id=auth.uid() and query not in (select query from public.food_search_history where user_id=auth.uid() order by searched_at desc,query limit 20);
 return jsonb_build_object('query',q);
end; $$;
create function public.clear_food_search_history() returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
 delete from public.food_search_history where user_id=auth.uid();
 return jsonb_build_object('cleared',true);
end; $$;
revoke all on function public.get_food_library(),public.set_food_favorite(text,jsonb,boolean),public.record_food_search(text),public.clear_food_search_history() from public,anon;
grant execute on function public.get_food_library(),public.set_food_favorite(text,jsonb,boolean),public.record_food_search(text),public.clear_food_search_history() to authenticated;
