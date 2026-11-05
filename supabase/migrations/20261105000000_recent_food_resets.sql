-- Clearing suggestions is private and never deletes diary records or favourites.
create table public.food_recent_resets (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 cleared_at timestamptz not null default clock_timestamp()
);
create index food_recent_resets_owner_time on public.food_recent_resets(user_id,cleared_at desc);
alter table public.food_recent_resets enable row level security;
revoke all on public.food_recent_resets from public,anon,authenticated;
grant select on public.food_recent_resets to authenticated;
create policy food_recent_resets_own_read on public.food_recent_resets for select to authenticated using(user_id=auth.uid());
create function public.clear_recent_foods(p_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare cleared timestamptz;
begin
 if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
 if p_id is null then raise exception 'INVALID_REQUEST'; end if;
 insert into public.food_recent_resets(id,user_id) values(p_id,auth.uid()) on conflict(id) do nothing;
 if not exists(select 1 from public.food_recent_resets where id=p_id and user_id=auth.uid()) then raise exception 'NOT_AUTHORIZED'; end if;
 select max(cleared_at) into cleared from public.food_recent_resets where user_id=auth.uid();
 return jsonb_build_object('id',p_id,'cleared_at',cleared);
end; $$;
revoke all on function public.clear_recent_foods(uuid) from public,anon;
grant execute on function public.clear_recent_foods(uuid) to authenticated;
create or replace function public.get_food_library() returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
 return jsonb_build_object(
  'foods',coalesce((select jsonb_agg(food order by created_at desc,food_key) from public.food_favorites where user_id=auth.uid()),'[]'::jsonb),
  'searches',coalesce((select jsonb_agg(query order by searched_at desc,query) from (select query,searched_at from public.food_search_history where user_id=auth.uid() order by searched_at desc,query limit 20) q),'[]'::jsonb),
  'recent_foods_cleared_at',(select max(cleared_at) from public.food_recent_resets where user_id=auth.uid()));
end; $$;
notify pgrst,'reload schema';
