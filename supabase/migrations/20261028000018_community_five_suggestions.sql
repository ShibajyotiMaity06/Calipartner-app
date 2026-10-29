-- Owner request, 28 October: five suggestions with the viewer's current goal;
-- further discovery requires a username. Keep the existing privacy projection.
create or replace function public.browse_social_profiles(
  p_goal text default null, p_query text default '', p_after text default '',
  p_random boolean default false, p_actor_id uuid default auth.uid()
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_query text:=lower(regexp_replace(trim(coalesce(p_query,'')),'^@',''));
  v_goal text;
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if auth.uid() is distinct from p_actor_id then raise exception 'NOT_AUTHORIZED'; end if;
  if p_goal is not null and p_goal not in ('bulk','cut','maintain') then raise exception 'INVALID_GOAL'; end if;
  if v_query<>'' and v_query !~ '^[a-z0-9_.]{1,20}$' then raise exception 'INVALID_QUERY'; end if;
  if not public.check_rate_limit('social_browse:'||auth.uid()::text,60,60) then raise exception 'RATE_LIMITED'; end if;
  select g.goal into v_goal from public.goal_profiles g
    where g.user_id=auth.uid() and g.effective_from<=now()
    order by g.effective_from desc,g.id desc limit 1;
  -- An old client cannot page through the entire user base without a query.
  if v_query='' and coalesce(p_after,'')<>'' then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(profile order by sort_key,username),'[]'::jsonb) into v_result from (
    select p.username, case when p_random then random() else 0 end as sort_key,
      public.social_profile_json(p.id,auth.uid()) as profile
    from public.profiles p
    where p.id<>auth.uid() and p.discoverable
      and not exists(select 1 from public.blocks where (blocker_id=auth.uid() and blocked_id=p.id) or (blocked_id=auth.uid() and blocker_id=p.id))
      and (v_query='' or position(v_query in lower(p.username::text))>0)
      and (v_query<>'' or (select g.goal from public.goal_profiles g where g.user_id=p.id and g.effective_from<=now() order by g.effective_from desc,g.id desc limit 1)=v_goal)
      and (p_random or lower(p.username::text)>lower(coalesce(p_after,'')))
    order by sort_key,p.username limit (case when p_random then 1 when v_query='' then 5 else 30 end)
  ) found;
  return v_result;
end; $$;
revoke all on function public.browse_social_profiles(text,text,text,boolean,uuid) from public,anon;
grant execute on function public.browse_social_profiles(text,text,text,boolean,uuid) to authenticated;
