-- Owner-approved: Free 1x2, Plus 3x5, Pro 5x20. Individual feature gates remain unchanged.
create or replace function public.hosted_room_limit(p_user_id uuid)
returns integer language sql stable security definer set search_path=public,pg_temp as $$
  select case public.active_room_tier(p_user_id) when 'pro' then 5 when 'plus' then 3 else 1 end;
$$;

create table public.social_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  bio text not null default '' check(char_length(bio)<=240),
  training_style text not null default '' check(char_length(training_style)<=80),
  instagram_handle text not null default '' check(instagram_handle='' or instagram_handle ~ '^[A-Za-z0-9_.]{1,30}$'),
  website_url text not null default '' check(char_length(website_url)<=2048 and (website_url='' or website_url ~ '^https://[A-Za-z0-9][A-Za-z0-9.-]*(:[0-9]{1,5})?([/?#][^[:space:]]*)?$')),
  is_public boolean not null default false,
  mutation_id uuid not null,
  edited_at timestamptz not null,
  updated_at timestamptz not null default now()
);
alter table public.social_profiles enable row level security;
create policy social_profiles_no_direct_access on public.social_profiles for all to authenticated using(false) with check(false);

-- Private connections. The separate send ledger retains quota when a recipient deletes their account.
create table public.friend_requests (
  id uuid primary key,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  pair_low uuid generated always as (least(sender_id,recipient_id)) stored,
  pair_high uuid generated always as (greatest(sender_id,recipient_id)) stored,
  status text not null default 'pending' check(status in ('pending','accepted','declined','cancelled','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(sender_id<>recipient_id)
);
create unique index friend_requests_one_open_pair on public.friend_requests(pair_low,pair_high) where status in ('pending','accepted');
create index friend_requests_sender_created on public.friend_requests(sender_id,created_at desc);
create index friend_requests_recipient_status on public.friend_requests(recipient_id,status,created_at desc);
alter table public.friend_requests enable row level security;
create policy friend_requests_no_direct_access on public.friend_requests for all to authenticated using(false) with check(false);

create table public.friend_request_sends (
  id uuid primary key,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index friend_request_sends_sender_created on public.friend_request_sends(sender_id,created_at desc);
alter table public.friend_request_sends enable row level security;
create policy friend_request_sends_no_direct_access on public.friend_request_sends for all to authenticated using(false) with check(false);

-- Internal projection: never serializes email, age, place, body data or tracking values.
create or replace function public.social_profile_json(p_target uuid,p_viewer uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare p public.profiles; s public.social_profiles; r public.friend_requests; v_visible boolean;
begin
  if p_viewer is null then return null; end if;
  if exists(select 1 from public.blocks where (blocker_id=p_viewer and blocked_id=p_target) or (blocked_id=p_viewer and blocker_id=p_target)) then return null; end if;
  select * into p from public.profiles where id=p_target;
  if not found then return null; end if;
  select * into r from public.friend_requests where pair_low=least(p_viewer,p_target) and pair_high=greatest(p_viewer,p_target) and status in ('pending','accepted') limit 1;
  if not p.discoverable and p_target<>p_viewer and r.id is null then return null; end if;
  select * into s from public.social_profiles where user_id=p_target;
  v_visible := p_target=p_viewer or coalesce(s.is_public,false);
  return jsonb_build_object('id',p.id,'username',p.username,'nickname',p.nickname,'avatar_url',p.avatar_url,
    'is_public',coalesce(s.is_public,false),'edited_at',case when p_target=p_viewer then s.edited_at else null end,
    'bio',case when v_visible then coalesce(s.bio,'') else '' end,
    'training_style',case when v_visible then coalesce(s.training_style,'') else '' end,
    'instagram_handle',case when v_visible then coalesce(s.instagram_handle,'') else '' end,
    'website_url',case when v_visible then coalesce(s.website_url,'') else '' end,
    'relationship',case when p_target=p_viewer then 'self' when r.status='accepted' then 'friends' when r.sender_id=p_viewer then 'outgoing' when r.recipient_id=p_viewer then 'incoming' else 'none' end,
    'request_id',r.id);
end; $$;
revoke all on function public.social_profile_json(uuid,uuid) from public,anon,authenticated;

create or replace function public.get_social_profile(p_user_id uuid,p_actor_id uuid default auth.uid())
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_result jsonb;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if auth.uid() is distinct from p_actor_id then raise exception 'NOT_AUTHORIZED'; end if;
  if not public.check_rate_limit('social_profile:'||auth.uid()::text,60,60) then raise exception 'RATE_LIMITED'; end if;
  v_result:=public.social_profile_json(p_user_id,auth.uid());
  if v_result is null then raise exception 'PROFILE_UNAVAILABLE'; end if;
  return v_result;
end; $$;
create or replace function public.search_social_profiles(p_query text,p_actor_id uuid default auth.uid())
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_query text:=lower(regexp_replace(trim(coalesce(p_query,'')),'^@','')); v_result jsonb;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if auth.uid() is distinct from p_actor_id then raise exception 'NOT_AUTHORIZED'; end if;
  if v_query !~ '^[a-z0-9_.]{3,20}$' then return '[]'::jsonb; end if;
  if not public.check_rate_limit('social_search:'||auth.uid()::text,30,60) then raise exception 'RATE_LIMITED'; end if;
  select coalesce(jsonb_agg(profile order by username),'[]'::jsonb) into v_result from (
    select p.username,public.social_profile_json(p.id,auth.uid()) as profile
    from public.profiles p where p.id<>auth.uid() and p.discoverable
      and left(lower(p.username::text),length(v_query))=v_query
      and not exists(select 1 from public.blocks where (blocker_id=auth.uid() and blocked_id=p.id) or (blocked_id=auth.uid() and blocker_id=p.id))
    order by p.username limit 10
  ) found;
  return v_result;
end; $$;
create or replace function public.get_friend_request_quota(p_actor_id uuid default auth.uid())
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_count integer; v_first timestamptz; v_premium boolean;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if auth.uid() is distinct from p_actor_id then raise exception 'NOT_AUTHORIZED'; end if;
  select count(*) into v_count from public.friend_request_sends where sender_id=auth.uid() and created_at>now()-interval '7 days';
  select created_at into v_first from public.friend_request_sends where sender_id=auth.uid() and created_at>now()-interval '7 days' order by created_at desc offset 2 limit 1;
  v_premium:=public.active_room_tier(auth.uid()) in ('plus','pro');
  return jsonb_build_object('premium',v_premium,'sent',v_count,'remaining',case when v_premium then null else greatest(0,3-v_count) end,'resets_at',case when not v_premium and v_count>=3 then v_first+interval '7 days' else null end);
end; $$;

create or replace function public.set_social_profile(p_actor_id uuid,p_mutation_id uuid,p_edited_at timestamptz,p_bio text,p_training_style text,p_instagram_handle text,p_website_url text,p_is_public boolean)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null or auth.uid() is distinct from p_actor_id then raise exception 'NOT_AUTHORIZED'; end if;
  if p_mutation_id is null or p_edited_at is null or p_edited_at>now()+interval '5 minutes' or p_is_public is null then raise exception 'INVALID_PROFILE'; end if;
  insert into public.social_profiles(user_id,bio,training_style,instagram_handle,website_url,is_public,mutation_id,edited_at)
  values(auth.uid(),trim(coalesce(p_bio,'')),trim(coalesce(p_training_style,'')),regexp_replace(trim(coalesce(p_instagram_handle,'')),'^@',''),trim(coalesce(p_website_url,'')),p_is_public,p_mutation_id,p_edited_at)
  on conflict(user_id) do update set bio=excluded.bio,training_style=excluded.training_style,instagram_handle=excluded.instagram_handle,website_url=excluded.website_url,is_public=excluded.is_public,mutation_id=excluded.mutation_id,edited_at=excluded.edited_at,updated_at=now()
  where public.social_profiles.edited_at<excluded.edited_at;
  return public.social_profile_json(auth.uid(),auth.uid());
end; $$;

create or replace function public.send_friend_request(p_actor_id uuid,p_request_id uuid,p_recipient_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.friend_requests; v_count integer;
begin
  if auth.uid() is null or auth.uid() is distinct from p_actor_id then raise exception 'NOT_AUTHORIZED'; end if;
  if p_request_id is null or p_recipient_id is null or p_recipient_id=auth.uid() then raise exception 'INVALID_RECIPIENT'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,51));
  perform pg_advisory_xact_lock(hashtextextended(least(auth.uid(),p_recipient_id)::text||greatest(auth.uid(),p_recipient_id)::text,52));
  select * into r from public.friend_requests where id=p_request_id;
  if found then
    if r.sender_id<>auth.uid() or r.recipient_id<>p_recipient_id then raise exception 'NOT_AUTHORIZED'; end if;
    return jsonb_build_object('request_id',r.id,'status',r.status);
  end if;
  if exists(select 1 from public.friend_request_sends where id=p_request_id) then raise exception 'INVALID_REQUEST_ID'; end if;
  if not exists(select 1 from public.profiles where id=p_recipient_id and discoverable) or exists(select 1 from public.blocks where (blocker_id=auth.uid() and blocked_id=p_recipient_id) or (blocked_id=auth.uid() and blocker_id=p_recipient_id)) then raise exception 'PROFILE_UNAVAILABLE'; end if;
  select * into r from public.friend_requests where pair_low=least(auth.uid(),p_recipient_id) and pair_high=greatest(auth.uid(),p_recipient_id) and status in ('pending','accepted') limit 1;
  if found then return jsonb_build_object('request_id',r.id,'status',r.status); end if;
  select count(*) into v_count from public.friend_request_sends where sender_id=auth.uid() and created_at>now()-interval '7 days';
  if v_count>=3 and public.active_room_tier(auth.uid()) not in ('plus','pro') then raise exception 'FRIEND_WEEKLY_LIMIT'; end if;
  if not public.check_rate_limit('friend_send:'||auth.uid()::text,20,60) then raise exception 'RATE_LIMITED'; end if;
  insert into public.friend_requests(id,sender_id,recipient_id) values(p_request_id,auth.uid(),p_recipient_id);
  insert into public.friend_request_sends(id,sender_id) values(p_request_id,auth.uid());
  return jsonb_build_object('request_id',p_request_id,'status','pending');
end; $$;

create or replace function public.respond_friend_request(p_actor_id uuid,p_request_id uuid,p_action text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.friend_requests; v_status text;
begin
  if auth.uid() is null or auth.uid() is distinct from p_actor_id then raise exception 'NOT_AUTHORIZED'; end if;
  select * into r from public.friend_requests where id=p_request_id for update;
  if not found or auth.uid() not in (r.sender_id,r.recipient_id) then raise exception 'NOT_AUTHORIZED'; end if;
  case p_action
    when 'accept' then if auth.uid()<>r.recipient_id then raise exception 'NOT_AUTHORIZED'; end if; v_status:='accepted';
    when 'decline' then if auth.uid()<>r.recipient_id then raise exception 'NOT_AUTHORIZED'; end if; v_status:='declined';
    when 'cancel' then if auth.uid()<>r.sender_id then raise exception 'NOT_AUTHORIZED'; end if; v_status:='cancelled';
    when 'remove' then v_status:='removed';
    else raise exception 'INVALID_ACTION';
  end case;
  if r.status=v_status then return jsonb_build_object('request_id',r.id,'status',r.status); end if;
  if (p_action='remove' and r.status<>'accepted') or (p_action<>'remove' and r.status<>'pending') then raise exception 'REQUEST_NOT_PENDING'; end if;
  if p_action='accept' and exists(select 1 from public.blocks where (blocker_id=r.sender_id and blocked_id=r.recipient_id) or (blocked_id=r.sender_id and blocker_id=r.recipient_id)) then raise exception 'PROFILE_UNAVAILABLE'; end if;
  update public.friend_requests set status=v_status,updated_at=now() where id=r.id;
  return jsonb_build_object('request_id',r.id,'status',v_status);
end; $$;
create or replace function public.get_friend_inbox(p_actor_id uuid default auth.uid())
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_incoming jsonb;v_outgoing jsonb;v_friends jsonb;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if auth.uid() is distinct from p_actor_id then raise exception 'NOT_AUTHORIZED'; end if;
  select coalesce(jsonb_agg(public.social_profile_json(sender_id,auth.uid()) order by created_at desc),'[]'::jsonb) into v_incoming from public.friend_requests r where recipient_id=auth.uid() and status='pending' and public.social_profile_json(sender_id,auth.uid()) is not null;
  select coalesce(jsonb_agg(public.social_profile_json(recipient_id,auth.uid()) order by created_at desc),'[]'::jsonb) into v_outgoing from public.friend_requests r where sender_id=auth.uid() and status='pending' and public.social_profile_json(recipient_id,auth.uid()) is not null;
  select coalesce(jsonb_agg(public.social_profile_json(case when sender_id=auth.uid() then recipient_id else sender_id end,auth.uid()) order by created_at desc),'[]'::jsonb) into v_friends from public.friend_requests r where auth.uid() in (sender_id,recipient_id) and status='accepted' and public.social_profile_json(case when sender_id=auth.uid() then recipient_id else sender_id end,auth.uid()) is not null;
  return jsonb_build_object('incoming',v_incoming,'outgoing',v_outgoing,'friends',v_friends,'quota',public.get_friend_request_quota());
end; $$;

revoke all on function public.get_social_profile(uuid,uuid),public.search_social_profiles(text,uuid),public.get_friend_request_quota(uuid),public.get_friend_inbox(uuid),public.set_social_profile(uuid,uuid,timestamptz,text,text,text,text,boolean),public.send_friend_request(uuid,uuid,uuid),public.respond_friend_request(uuid,uuid,text) from public,anon;
grant execute on function public.get_social_profile(uuid,uuid),public.search_social_profiles(text,uuid),public.get_friend_request_quota(uuid),public.get_friend_inbox(uuid),public.set_social_profile(uuid,uuid,timestamptz,text,text,text,text,boolean),public.send_friend_request(uuid,uuid,uuid),public.respond_friend_request(uuid,uuid,text) to authenticated;

-- Blocked connections stay removed when a user later unblocks.
create or replace function public.block_friend_connection()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(least(new.blocker_id,new.blocked_id)::text||greatest(new.blocker_id,new.blocked_id)::text,52));
  update public.friend_requests set status=case when status='accepted' then 'removed' else 'cancelled' end,updated_at=now()
  where pair_low=least(new.blocker_id,new.blocked_id) and pair_high=greatest(new.blocker_id,new.blocked_id) and status in ('pending','accepted');
  return new;
end; $$;
create trigger friend_connection_blocked after insert on public.blocks for each row execute function public.block_friend_connection();

create or replace function public.block_social_profile(p_actor_id uuid,p_target_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null or auth.uid() is distinct from p_actor_id then raise exception 'NOT_AUTHORIZED'; end if;
  return public.block_user(p_target_id);
end; $$;
create or replace function public.report_social_profile(p_actor_id uuid,p_report_id uuid,p_target_id uuid,p_reason text,p_details text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.reports;
begin
  if auth.uid() is null or auth.uid() is distinct from p_actor_id then raise exception 'NOT_AUTHORIZED'; end if;
  if p_target_id is null or p_target_id=auth.uid() or p_report_id is null or p_reason is null or char_length(trim(p_reason)) not between 1 and 100 or char_length(coalesce(p_details,''))>2000 then raise exception 'INVALID_REPORT'; end if;
  select * into r from public.reports where id=p_report_id;
  if found then
    if r.reporter_id<>auth.uid() or r.target_id<>p_target_id::text then raise exception 'NOT_AUTHORIZED'; end if;
    return jsonb_build_object('report_id',r.id,'status','reported');
  end if;
  if not public.check_rate_limit('social_report:'||auth.uid()::text,20,3600) then raise exception 'RATE_LIMITED'; end if;
  insert into public.reports(id,reporter_id,target_type,target_id,reason,details) values(p_report_id,auth.uid(),'user',p_target_id::text,trim(p_reason),p_details);
  return jsonb_build_object('report_id',p_report_id,'status','reported');
end; $$;
revoke all on function public.block_social_profile(uuid,uuid),public.report_social_profile(uuid,uuid,uuid,text,text) from public,anon;
grant execute on function public.block_social_profile(uuid,uuid),public.report_social_profile(uuid,uuid,uuid,text,text) to authenticated;
