-- Authenticated social feed. All cross-user reads go through checked projections.
create table public.feed_rules_acceptances (
  user_id uuid primary key references public.profiles on delete cascade,
  accepted_at timestamptz not null default now()
);
create table public.feed_posts (
  id uuid primary key,
  author_id uuid not null references public.profiles on delete cascade,
  caption text not null check (char_length(caption) <= 1000),
  description text not null check (char_length(description) between 1 and 240),
  media_type text not null check (media_type in ('image/jpeg','image/png','image/webp','video/mp4','video/quicktime','video/webm')),
  audience text not null check (audience in ('community','friends','squads')),
  share_progress boolean not null default false,
  state text not null default 'draft' check (state in ('draft','published','deleted','removed')),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  media_removed_at timestamptz,
  progress_date date,
  storage_key text generated always as ('feed/' || author_id::text || '/' || id::text) stored
);
create index feed_posts_latest on public.feed_posts(published_at desc,id desc) where state='published';
create index feed_posts_author on public.feed_posts(author_id,created_at desc);

create table public.feed_likes (
  post_id uuid references public.feed_posts on delete cascade,
  user_id uuid references public.profiles on delete cascade,
  primary key(post_id,user_id)
);
create table public.feed_comments (
  id uuid primary key,
  post_id uuid not null references public.feed_posts on delete cascade,
  author_id uuid not null references public.profiles on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index feed_comments_post on public.feed_comments(post_id,created_at desc,id desc) where deleted_at is null;
create index feed_comments_author on public.feed_comments(author_id,created_at desc);
create table public.feed_shares (
  id uuid not null,
  post_id uuid not null references public.feed_posts on delete cascade,
  sender_id uuid not null references public.profiles on delete cascade,
  recipient_id uuid not null references public.profiles on delete cascade,
  room_id uuid references public.rooms on delete cascade,
  created_at timestamptz not null default now(),
  primary key(sender_id,id,recipient_id),
  check(sender_id<>recipient_id)
);
create index feed_shares_recipient on public.feed_shares(recipient_id,created_at desc,post_id);
create index feed_shares_sender on public.feed_shares(sender_id,created_at desc);
create table public.feed_reports (
  id uuid primary key,
  post_id uuid not null references public.feed_posts on delete cascade,
  comment_id uuid references public.feed_comments on delete cascade,
  reporter_id uuid not null references public.profiles on delete cascade,
  reason text not null check(reason in ('inappropriate','harassment','spam')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique nulls not distinct (reporter_id,post_id,comment_id)
);
do $$
declare name text;
begin
  foreach name in array array['feed_rules_acceptances','feed_posts','feed_likes','feed_comments','feed_shares','feed_reports'] loop
    execute format('alter table public.%I enable row level security',name);
    execute format('create policy feed_no_direct_access on public.%I for all to authenticated using (false) with check (false)',name);
    execute format('revoke all on table public.%I from public,anon,authenticated',name);
    execute format('grant select,update on table public.%I to service_role',name);
  end loop;
end;
$$;

create function public.feed_ready(p_user uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select p_user is not null and coalesce((select p.date_of_birth <= current_date - interval '18 years' from public.profiles p where p.id=p_user),false);
$$;
create function public.feed_unblocked(p_left uuid,p_right uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select not exists(select 1 from public.blocks
    where (blocker_id=p_left and blocked_id=p_right) or (blocker_id=p_right and blocked_id=p_left));
$$;
create function public.feed_friends(p_left uuid,p_right uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(select 1 from public.friend_requests
    where pair_low=least(p_left,p_right) and pair_high=greatest(p_left,p_right) and status='accepted');
$$;
create function public.feed_room_connection(p_left uuid,p_right uuid,p_room uuid default null)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(select 1 from public.room_members a join public.room_members b using(room_id)
    where a.user_id=p_left and b.user_id=p_right and a.status in ('active','paused')
      and b.status in ('active','paused') and (p_room is null or a.room_id=p_room)
      and public.room_is_usable(a.room_id));
$$;
create function public.feed_can_read(p_post public.feed_posts,p_viewer uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select public.feed_ready(p_viewer) and p_post.state='published'
    and public.feed_unblocked(p_viewer,p_post.author_id)
    and (p_viewer=p_post.author_id or case p_post.audience
      when 'friends' then public.feed_friends(p_viewer,p_post.author_id)
      when 'squads' then public.feed_room_connection(p_viewer,p_post.author_id)
      when 'community' then exists(select 1 from public.profiles p
        left join public.social_profiles s on s.user_id=p.id
        where p.id=p_post.author_id and p.discoverable and coalesce(s.is_public,true))
      else false end);
$$;
create function public.feed_person(p_user uuid)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object('id',id,'nickname',nickname,'username',username)
    from public.profiles where id=p_user;
$$;
create function public.feed_post_json(p_post public.feed_posts,p_viewer uuid)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object('id',p_post.id,'author',public.feed_person(p_post.author_id),
    'caption',p_post.caption,'description',p_post.description,'media_type',p_post.media_type,
    'audience',p_post.audience,'published_at',p_post.published_at,
    'liked',exists(select 1 from public.feed_likes where post_id=p_post.id and user_id=p_viewer),
    'likes',(select count(*) from public.feed_likes where post_id=p_post.id and public.feed_unblocked(p_viewer,user_id)),
    'comments',(select count(*) from public.feed_comments where post_id=p_post.id and deleted_at is null and public.feed_unblocked(p_viewer,author_id)));
$$;
create function public.feed_share_visible(p_share public.feed_shares)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select p_share.recipient_id=auth.uid() and public.feed_unblocked(p_share.sender_id,auth.uid())
    and case when p_share.room_id is null then public.feed_friends(p_share.sender_id,auth.uid())
      else public.feed_room_connection(p_share.sender_id,auth.uid(),p_share.room_id) end;
$$;
create function public.list_feed_posts(p_before timestamptz default null,p_before_id uuid default null,p_author uuid default null,p_shared boolean default false)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  select coalesce(jsonb_agg(public.feed_post_json(x,auth.uid()) order by x.published_at desc,x.id desc),'[]'::jsonb)
    from (select p.* from public.feed_posts p where p.state='published' and public.feed_can_read(p,auth.uid())
      and (p_author is null or p.author_id=p_author)
      and (p_before is null or (p.published_at,p.id)<(p_before,p_before_id))
      and (not p_shared or exists(select 1 from public.feed_shares s where s.post_id=p.id and s.recipient_id=auth.uid() and public.feed_share_visible(s)))
      order by p.published_at desc,p.id desc limit 15) x;
$$;
create function public.get_feed_post(p_post uuid)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  select public.feed_post_json(p,auth.uid()) from public.feed_posts p where id=p_post and public.feed_can_read(p,auth.uid());
$$;
create function public.get_feed_profile(p_user uuid)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  select public.feed_person(p_user) || jsonb_build_object('bio',coalesce(public.social_profile_json(p_user,auth.uid())->>'bio',''))
    where public.feed_ready(auth.uid()) and public.feed_unblocked(p_user,auth.uid())
      and (p_user=auth.uid() or public.social_profile_json(p_user,auth.uid()) is not null
        or exists(select 1 from public.feed_posts p where p.author_id=p_user and public.feed_can_read(p,auth.uid())));
$$;
create function public.get_feed_preferences()
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object(
    'accepted',exists(select 1 from public.feed_rules_acceptances where user_id=p.id),
    'community',p.discoverable and coalesce(s.is_public,true))
    from public.profiles p left join public.social_profiles s on s.user_id=p.id
    where p.id=auth.uid() and public.feed_ready(p.id);
$$;
create function public.accept_feed_rules()
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not public.feed_ready(auth.uid()) then raise exception 'FEED_SIGN_IN'; end if;
  insert into public.feed_rules_acceptances(user_id) values(auth.uid()) on conflict do nothing;
  return true;
end;
$$;
create function public.reserve_feed_post(p_id uuid,p_caption text,p_description text,p_media_type text,p_audience text,p_share_progress boolean)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=auth.uid(); existing public.feed_posts;
begin
  if not public.feed_ready(actor) then raise exception 'FEED_SIGN_IN'; end if;
  if not exists(select 1 from public.feed_rules_acceptances where user_id=actor) then raise exception 'FEED_RULES_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text,500));
  select * into existing from public.feed_posts where id=p_id;
  if found then
    if existing.author_id<>actor or existing.state not in ('draft','published') then raise exception 'FEED_UNAVAILABLE'; end if;
    if (existing.caption,existing.description,existing.media_type,existing.audience,existing.share_progress)
      is distinct from (p_caption,p_description,p_media_type,p_audience,p_share_progress) then raise exception 'FEED_DRAFT_CHANGED'; end if;
    return existing.id;
  end if;
  if p_audience='community' and not coalesce((public.get_feed_preferences()->>'community')::boolean,false) then raise exception 'FEED_PRIVATE_PROFILE'; end if;
  if (select count(*) from public.feed_posts where author_id=actor and created_at>now()-interval '1 hour')>=10 then raise exception 'FEED_LIMIT'; end if;
  insert into public.feed_posts(id,author_id,caption,description,media_type,audience,share_progress)
    values(p_id,actor,p_caption,p_description,p_media_type,p_audience,p_share_progress);
  return p_id;
end;
$$;
create function public.publish_feed_post(p_post uuid,p_actor uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare post public.feed_posts;
begin
  select * into post from public.feed_posts where id=p_post and author_id=p_actor for update;
  if not found or post.state not in ('draft','published') then raise exception 'FEED_UNAVAILABLE'; end if;
  if post.state='published' then return post.id; end if;
  update public.feed_posts set state='published',published_at=now(),
    progress_date=case when post.share_progress then (now() at time zone p.timezone)::date end
    from public.profiles p where feed_posts.id=post.id and p.id=p_actor;
  return post.id;
end;
$$;
create function public.check_feed_moderation_limit(p_actor uuid,p_video boolean)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not public.feed_ready(p_actor) then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_actor::text,503));
  if p_video then return public.check_rate_limit('feed_video:'||p_actor::text,12,3600); end if;
  return public.check_rate_limit('feed_moderation:'||p_actor::text,45,3600);
end;
$$;
create function public.feed_media_for_viewer(p_post uuid,p_viewer uuid)
returns text language sql stable security definer set search_path=public,pg_temp as $$
  select storage_key from public.feed_posts p where id=p_post and public.feed_can_read(p,p_viewer);
$$;
create function public.delete_feed_post(p_post uuid,p_actor uuid)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare key text;
begin
  update public.feed_posts set state='deleted',share_progress=false,progress_date=null
    where id=p_post and author_id=p_actor
    returning case when media_removed_at is null then storage_key else '' end into key;
  return key;
end;
$$;
create function public.set_feed_like(p_post uuid,p_liked boolean)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare post public.feed_posts;
begin
  select * into post from public.feed_posts where id=p_post;
  if not coalesce(public.feed_can_read(post,auth.uid()),false) then raise exception 'FEED_UNAVAILABLE'; end if;
  if p_liked then
    insert into public.feed_likes(post_id,user_id) values(p_post,auth.uid()) on conflict do nothing;
  else
    delete from public.feed_likes where post_id=p_post and user_id=auth.uid();
  end if;
  return public.feed_post_json(post,auth.uid());
end;
$$;
create function public.list_feed_comments(p_post uuid,p_before timestamptz default null,p_before_id uuid default null)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'author',public.feed_person(c.author_id),
    'body',c.body,'created_at',c.created_at) order by c.created_at desc,c.id desc),'[]'::jsonb)
  from (select c.* from public.feed_comments c join public.feed_posts p on p.id=c.post_id
    where p.id=p_post and c.deleted_at is null and public.feed_can_read(p,auth.uid())
      and public.feed_unblocked(c.author_id,auth.uid())
      and (p_before is null or (c.created_at,c.id)<(p_before,p_before_id))
    order by c.created_at desc,c.id desc limit 25) c;
$$;
create function public.feed_comment_status(p_post uuid,p_actor uuid,p_id uuid,p_body text)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare post public.feed_posts; comment public.feed_comments;
begin
  select * into post from public.feed_posts where id=p_post;
  if not coalesce(public.feed_can_read(post,p_actor),false) then raise exception 'FEED_UNAVAILABLE'; end if;
  if not exists(select 1 from public.feed_rules_acceptances where user_id=p_actor) then raise exception 'FEED_RULES_REQUIRED'; end if;
  select * into comment from public.feed_comments where id=p_id;
  if found then
    if (comment.author_id,comment.post_id,comment.body) is distinct from (p_actor,p_post,p_body)
      or comment.deleted_at is not null then raise exception 'FEED_UNAVAILABLE'; end if;
    return true;
  end if;
  if (select count(*) from public.feed_comments where author_id=p_actor and created_at>now()-interval '1 hour')>=30 then raise exception 'FEED_LIMIT'; end if;
  return false;
end;
$$;
create function public.add_feed_comment(p_post uuid,p_actor uuid,p_id uuid,p_body text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_actor::text,501));
  if not public.feed_comment_status(p_post,p_actor,p_id,p_body) then
    insert into public.feed_comments(id,post_id,author_id,body) values(p_id,p_post,p_actor,p_body);
  end if;
  return p_id;
end;
$$;
create function public.delete_feed_comment(p_id uuid)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
  update public.feed_comments set deleted_at=coalesce(deleted_at,now()) where id=p_id and author_id=auth.uid();
  return found;
end;
$$;
create function public.report_feed_content(p_id uuid,p_post uuid,p_comment uuid,p_reason text)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare post public.feed_posts;
begin
  select * into post from public.feed_posts where id=p_post;
  if not coalesce(public.feed_can_read(post,auth.uid()),false) or
    (p_comment is null and post.author_id=auth.uid()) or
    (p_comment is not null and not exists(select 1 from public.feed_comments c where c.id=p_comment and c.post_id=p_post
      and c.deleted_at is null and c.author_id<>auth.uid() and public.feed_unblocked(auth.uid(),c.author_id)))
  then raise exception 'FEED_UNAVAILABLE'; end if;
  if exists(select 1 from public.feed_reports where reporter_id=auth.uid() and post_id=p_post
    and comment_id is not distinct from p_comment) then return true; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,504));
  if (select count(*) from public.feed_reports where reporter_id=auth.uid() and created_at>now()-interval '1 hour')>=20 then
    raise exception 'FEED_LIMIT';
  end if;
  insert into public.feed_reports(id,post_id,comment_id,reporter_id,reason)
    values(p_id,p_post,p_comment,auth.uid(),p_reason)
    on conflict(reporter_id,post_id,comment_id) do nothing;
  return true;
end;
$$;
create function public.resolve_feed_report(p_report uuid,p_remove boolean)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare receipt public.feed_reports; key text;
begin
  select * into receipt from public.feed_reports where id=p_report for update;
  if not found or p_remove is null then raise exception 'FEED_UNAVAILABLE'; end if;
  if p_remove then
    if receipt.comment_id is null then
      update public.feed_posts set state='removed',share_progress=false,progress_date=null
        where id=receipt.post_id and state='published' returning storage_key into key;
    else
      update public.feed_comments set deleted_at=coalesce(deleted_at,now())
        where id=receipt.comment_id;
    end if;
  end if;
  update public.feed_reports set reviewed_at=coalesce(reviewed_at,now()) where id=p_report;
  return jsonb_build_object('reviewed',true,'storage_key',key);
end;
$$;
create function public.feed_share_targets(p_post uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare post public.feed_posts; actor uuid:=auth.uid();
begin
  select * into post from public.feed_posts where id=p_post;
  if not coalesce(public.feed_can_read(post,actor),false) then raise exception 'FEED_UNAVAILABLE'; end if;
  return jsonb_build_object('people',(
    select coalesce(jsonb_agg(public.feed_person(p.id) order by coalesce(p.nickname,p.username),p.id),'[]'::jsonb)
    from public.profiles p where p.id in (
      select case when pair_low=actor then pair_high else pair_low end
        from public.friend_requests where status='accepted' and actor in (pair_low,pair_high)
      union
      select other.user_id from public.room_members own join public.room_members other using(room_id)
        where own.user_id=actor and own.status in ('active','paused') and other.status in ('active','paused')
          and other.user_id<>actor and public.room_is_usable(own.room_id)
    ) and public.feed_unblocked(actor,p.id) and public.feed_can_read(post,p.id)
  ),'squads',(
    select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'name',r.name) order by r.name,r.id),'[]'::jsonb)
    from public.rooms r join public.room_members m on m.room_id=r.id
    where m.user_id=actor and m.status in ('active','paused') and public.room_is_usable(r.id)
      and exists(select 1 from public.room_members other where other.room_id=r.id and other.user_id<>actor and other.status in ('active','paused'))
      and not exists(select 1 from public.room_members other where other.room_id=r.id and other.user_id<>actor
        and other.status in ('active','paused') and not (public.feed_unblocked(actor,other.user_id) and public.feed_can_read(post,other.user_id)))
  ));
end;
$$;
create function public.share_feed_post(p_id uuid,p_post uuid,p_target uuid,p_squad boolean)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare post public.feed_posts; actor uuid:=auth.uid(); targets jsonb; recipients integer; linked_room uuid;
begin
  select * into post from public.feed_posts where id=p_post;
  if not coalesce(public.feed_can_read(post,actor),false) then raise exception 'FEED_UNAVAILABLE'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text,502));
  select count(*) into recipients from public.feed_shares where sender_id=actor and id=p_id;
  if recipients>0 then
    if exists(select 1 from public.feed_shares s where s.sender_id=actor and s.id=p_id and
      (s.post_id<>p_post or (p_squad and s.room_id is distinct from p_target) or (not p_squad and s.recipient_id<>p_target)))
    then raise exception 'FEED_UNAVAILABLE'; end if;
    return recipients;
  end if;
  if (select count(distinct id) from public.feed_shares where sender_id=actor and created_at>now()-interval '1 hour')>=30 then raise exception 'FEED_LIMIT'; end if;
  targets:=public.feed_share_targets(p_post);
  if p_id is null or p_target is null or p_squad is null then raise exception 'FEED_UNAVAILABLE'; end if;
  if p_squad then
    if not (targets->'squads' @> jsonb_build_array(jsonb_build_object('id',p_target))) then raise exception 'FEED_UNAVAILABLE'; end if;
    insert into public.feed_shares(id,post_id,sender_id,recipient_id,room_id)
      select p_id,p_post,actor,user_id,p_target from public.room_members
      where room_id=p_target and user_id<>actor and status in ('active','paused');
    get diagnostics recipients=row_count;
    return recipients;
  end if;
  if not (targets->'people' @> jsonb_build_array(jsonb_build_object('id',p_target))) then raise exception 'FEED_UNAVAILABLE'; end if;
  if not public.feed_friends(actor,p_target) then
    select a.room_id into linked_room from public.room_members a join public.room_members b using(room_id)
      where a.user_id=actor and b.user_id=p_target and a.status in ('active','paused') and b.status in ('active','paused')
        and public.room_is_usable(a.room_id) order by a.room_id limit 1;
    if linked_room is null then raise exception 'FEED_UNAVAILABLE'; end if;
  end if;
  insert into public.feed_shares(id,post_id,sender_id,recipient_id,room_id) values(p_id,p_post,actor,p_target,linked_room);
  return 1;
end;
$$;

-- This projection is available only to the Edge service. It reduces the authorized
-- data to own-goal percentages with the same core calculation used on Home.
create function public.feed_goal_inputs(p_user uuid,p_day date)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  select jsonb_build_object('enabled',tp.enabled,
    'targets',jsonb_build_object('calories',g.daily_calorie_target,'protein',g.protein_grams,'carbs',g.carb_grams,
      'fat',g.fat_grams,'steps',g.step_goal,'water',g.water_ml_goal),
    'values',jsonb_build_object('calories',coalesce(f.calories,0),'protein',coalesce(f.protein,0),
      'carbs',coalesce(f.carbs,0),'fat',coalesce(f.fat,0),'steps',coalesce(a.steps,0),'water',coalesce(w.water,0)))
  from public.profiles p
  left join public.tracking_preferences tp on tp.user_id=p.id
  left join lateral (select * from public.goal_profiles where user_id=p.id
      and effective_from<((p_day+1)::timestamp at time zone p.timezone) and effective_from<=now()
      order by effective_from desc,created_at desc,id desc limit 1) g on true
  left join lateral (select sum(calories) calories,sum(protein) protein,sum(carbs) carbs,sum(fat) fat
      from public.food_entries where user_id=p.id and local_date::text=p_day::text and deleted_at is null) f on true
  left join public.activity_days a on a.user_id=p.id and a.local_date::text=p_day::text and a.deleted_at is null
  left join lateral (select sum(amount_ml) water from public.water_logs where user_id=p.id
      and local_date::text=p_day::text and deleted_at is null) w on true
  where p.id=p_user and p_day<=(now() at time zone p.timezone)::date;
$$;
create function public.feed_compare_inputs(p_post uuid,p_viewer uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare post public.feed_posts;
begin
  select * into post from public.feed_posts where id=p_post;
  if not coalesce(public.feed_can_read(post,p_viewer),false) then raise exception 'FEED_UNAVAILABLE'; end if;
  if public.active_room_tier(p_viewer) not in ('plus','pro') then return jsonb_build_object('status','locked'); end if;
  if not post.share_progress or post.author_id=p_viewer then return jsonb_build_object('status','hidden'); end if;
  return jsonb_build_object('status','ready','date',post.progress_date,
    'you',public.feed_goal_inputs(p_viewer,post.progress_date),
    'author',public.feed_goal_inputs(post.author_id,post.progress_date));
end;
$$;

revoke all on function public.feed_ready(uuid),public.feed_unblocked(uuid,uuid),public.feed_friends(uuid,uuid),
  public.feed_room_connection(uuid,uuid,uuid),public.feed_can_read(public.feed_posts,uuid),public.feed_person(uuid),
  public.feed_post_json(public.feed_posts,uuid),public.feed_share_visible(public.feed_shares),public.feed_goal_inputs(uuid,date)
  from public,anon,authenticated;
revoke all on function public.publish_feed_post(uuid,uuid),public.feed_media_for_viewer(uuid,uuid),public.delete_feed_post(uuid,uuid),
  public.feed_comment_status(uuid,uuid,uuid,text),public.add_feed_comment(uuid,uuid,uuid,text),public.feed_compare_inputs(uuid,uuid),
  public.check_feed_moderation_limit(uuid,boolean),public.resolve_feed_report(uuid,boolean)
  from public,anon,authenticated;
grant execute on function public.publish_feed_post(uuid,uuid),public.feed_media_for_viewer(uuid,uuid),public.delete_feed_post(uuid,uuid),
  public.feed_comment_status(uuid,uuid,uuid,text),public.add_feed_comment(uuid,uuid,uuid,text),public.feed_compare_inputs(uuid,uuid),
  public.check_feed_moderation_limit(uuid,boolean),public.resolve_feed_report(uuid,boolean)
  to service_role;
revoke all on function public.list_feed_posts(timestamptz,uuid,uuid,boolean),public.get_feed_post(uuid),public.get_feed_profile(uuid),
  public.get_feed_preferences(),public.accept_feed_rules(),public.reserve_feed_post(uuid,text,text,text,text,boolean),
  public.set_feed_like(uuid,boolean),public.list_feed_comments(uuid,timestamptz,uuid),public.delete_feed_comment(uuid),
  public.report_feed_content(uuid,uuid,uuid,text),public.feed_share_targets(uuid),public.share_feed_post(uuid,uuid,uuid,boolean)
  from public,anon;
grant execute on function public.list_feed_posts(timestamptz,uuid,uuid,boolean),public.get_feed_post(uuid),public.get_feed_profile(uuid),
  public.get_feed_preferences(),public.accept_feed_rules(),public.reserve_feed_post(uuid,text,text,text,text,boolean),
  public.set_feed_like(uuid,boolean),public.list_feed_comments(uuid,timestamptz,uuid),public.delete_feed_comment(uuid),
  public.report_feed_content(uuid,uuid,uuid,text),public.feed_share_targets(uuid),public.share_feed_post(uuid,uuid,uuid,boolean)
  to authenticated;
