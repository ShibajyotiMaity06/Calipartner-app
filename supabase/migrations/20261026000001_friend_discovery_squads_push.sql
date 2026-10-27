-- Owner request, 26 October: free goal discovery, real friends, squad invitations.
-- Only the existing privacy-safe projection crosses the RPC boundary.
create or replace function public.browse_social_profiles(
  p_goal text default null, p_query text default '', p_after text default '',
  p_random boolean default false, p_actor_id uuid default auth.uid()
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_query text:=lower(regexp_replace(trim(coalesce(p_query,'')),'^@','')); v_result jsonb;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if auth.uid() is distinct from p_actor_id then raise exception 'NOT_AUTHORIZED'; end if;
  if p_goal is not null and p_goal not in ('bulk','cut','maintain') then raise exception 'INVALID_GOAL'; end if;
  if v_query<>'' and v_query !~ '^[a-z0-9_.]{1,20}$' then raise exception 'INVALID_QUERY'; end if;
  if not public.check_rate_limit('social_browse:'||auth.uid()::text,60,60) then raise exception 'RATE_LIMITED'; end if;
  select coalesce(jsonb_agg(profile order by sort_key,username),'[]'::jsonb) into v_result from (
    select p.username, case when p_random then random() else 0 end as sort_key,
      public.social_profile_json(p.id,auth.uid()) as profile
    from public.profiles p
    where p.id<>auth.uid() and p.discoverable
      and not exists(select 1 from public.blocks where (blocker_id=auth.uid() and blocked_id=p.id) or (blocked_id=auth.uid() and blocker_id=p.id))
      and (v_query='' or position(v_query in lower(p.username::text))>0)
      and (v_query<>'' or p_goal is null or (select g.goal from public.goal_profiles g where g.user_id=p.id and g.effective_from<=now() order by g.effective_from desc,g.id desc limit 1)=p_goal)
      and (p_random or lower(p.username::text)>lower(coalesce(p_after,'')))
    order by sort_key,p.username limit (case when p_random then 1 else 30 end)
  ) found;
  return v_result;
end; $$;
revoke all on function public.browse_social_profiles(text,text,text,boolean,uuid) from public,anon;
grant execute on function public.browse_social_profiles(text,text,text,boolean,uuid) to authenticated;

-- Creation and friend invitations commit together; room UUID makes network retries safe.
-- Friendship never implies consent to share health data: recipients accept a room invite.
create or replace function public.create_squad_with_friends(p_client_id uuid,p_name text,p_friend_ids uuid[])
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_room jsonb; v_friend uuid; v_cap integer;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,31));
  -- A retry returns the original result, without re-sending invitations.
  if exists(select 1 from public.rooms where id=p_client_id) then
    return public.create_room_v3(p_client_id,p_name,null);
  end if;
  v_cap:=case public.active_room_tier(auth.uid()) when 'pro' then 20 when 'plus' then 5 else 2 end;
  if coalesce(cardinality(p_friend_ids),0)<1 then raise exception 'FRIEND_REQUIRED'; end if;
  if cardinality(p_friend_ids)>v_cap-1 then raise exception 'ROOM_FULL'; end if;
  if (select count(distinct id) from unnest(p_friend_ids) id)<>cardinality(p_friend_ids) then raise exception 'INVALID_FRIENDS'; end if;
  foreach v_friend in array p_friend_ids loop
    if not exists(select 1 from public.friend_requests where pair_low=least(auth.uid(),v_friend) and pair_high=greatest(auth.uid(),v_friend) and status='accepted')
      or exists(select 1 from public.blocks where (blocker_id=auth.uid() and blocked_id=v_friend) or (blocked_id=auth.uid() and blocker_id=v_friend)) then raise exception 'PROFILE_UNAVAILABLE'; end if;
  end loop;
  if not public.check_rate_limit('squad_invites:'||auth.uid()::text,10,3600) then raise exception 'RATE_LIMITED'; end if;
  v_room:=public.create_room_v3(p_client_id,p_name,null);
  foreach v_friend in array p_friend_ids loop
    insert into public.room_requests(room_id,sender_id,recipient_id,type,status,expires_at)
    values((v_room->>'room_id')::uuid,auth.uid(),v_friend,'invitation','pending',now()+interval '14 days');
  end loop;
  return v_room;
end; $$;
revoke all on function public.create_squad_with_friends(uuid,text,uuid[]) from public,anon;
grant execute on function public.create_squad_with_friends(uuid,text,uuid[]) to authenticated;

-- Reuse the existing request notification channel, including opt-out, pause and quiet hours.
create or replace function public.friend_request_push()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_op='INSERT' and new.status='pending' then
    perform public.queue_push_notification(new.recipient_id,'room_invitation','New friend request',
      'Someone sent you a friend request.',jsonb_build_object('url','/friends','kind','friend_request','requestId',new.id));
  elsif tg_op='UPDATE' and old.status='pending' and new.status='accepted' then
    perform public.queue_push_notification(new.sender_id,'room_request_accepted','Friend request accepted',
      'Your friend request was accepted.',jsonb_build_object('url','/friends','kind','friend_accepted','requestId',new.id));
  end if;
  return new;
end; $$;
revoke all on function public.friend_request_push() from public,anon,authenticated;
create trigger friend_request_push after insert or update on public.friend_requests for each row execute function public.friend_request_push();
