update public.remote_config set value = jsonb_set(value, '{pro}', '9999') where key = 'room_caps';
update public.room_tier_configs set member_cap = 9999 where tier = 'pro';

create or replace function public.hosted_room_limit(p_user_id uuid)
returns integer language sql stable security definer set search_path = public, pg_temp as $$
  select case public.active_room_tier(p_user_id) when 'pro' then 20 when 'plus' then 3 else 1 end;
$$;
create or replace function public.room_cap(p_room_id uuid)
returns integer language sql stable security definer set search_path = public, pg_temp as $$
  select case public.active_room_tier(r.plan_holder_id) when 'pro' then 9999 when 'plus' then 5 else 2 end from public.rooms r where r.id = p_room_id;
$$;
create or replace function public.create_room_v3(p_client_id uuid, p_name text, p_device_hash text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_room public.rooms; v_cap integer; v_count integer;
begin
  if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_client_id is null or p_name is null or length(trim(p_name)) not between 1 and 100 then raise exception 'INVALID_ROOM_NAME'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 31));
  select * into v_room from public.rooms where id = p_client_id;
  if found then
    if v_room.created_by <> v_uid then raise exception 'NOT_AUTHORIZED'; end if;
    return jsonb_build_object('room_id',v_room.id,'name',v_room.name,'code',v_room.code,'role','host','state',v_room.state);
  end if;
  if not public.can_create_room(v_uid) then raise exception 'HOSTED_ROOM_LIMIT'; end if;
  select count(*) into v_count from public.rooms where plan_holder_id = v_uid and state <> 'archived';
  v_cap := case public.active_room_tier(v_uid) when 'pro' then 9999 when 'plus' then 5 else 2 end;
  insert into public.rooms(id,name,code,state,who_can_invite,created_by,plan_holder_id,member_cap,requires_host_plan)
  values(p_client_id,trim(p_name),public.generate_room_code(),'dormant','host_only',v_uid,v_uid,v_cap,v_count > 0) returning * into v_room;
  insert into public.room_members(room_id,user_id,role,status) values(v_room.id,v_uid,'host','active');
  return jsonb_build_object('room_id',v_room.id,'name',v_room.name,'code',v_room.code,'role','host','state',v_room.state);
end; $$;

update public.rooms r set member_cap = public.room_cap(r.id) where public.active_room_tier(r.plan_holder_id) = 'pro' and r.state <> 'archived';

create or replace function public.ai_monthly_access(p_user_id uuid,p_feature text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=auth.uid(); ent public.entitlements; budget jsonb; spent numeric;
  today date; month_start date; used bigint; allowance integer;
begin
  if p_user_id is null or (actor is null and coalesce(auth.jwt()->>'role','')<>'service_role') then raise exception 'UNAUTHENTICATED' using errcode='42501'; end if;
  if actor is not null and actor<>p_user_id then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if p_feature not in ('coach','food_photo') then raise exception 'INVALID_AI_FEATURE'; end if;
  select * into ent from public.entitlements where user_id=p_user_id;
  if not found or ent.tier<>'pro' or ent.status not in ('paid','grace') or (ent.period_end is not null and ent.period_end<=now()) then
    return jsonb_build_object('allowed',false,'code','UPGRADE_REQUIRED','user_state','free_after_trial');
  end if;
  budget:=public.get_remote_config('ai_budgets','{"monthly_budget_usd":100,"ai_disabled":false}'::jsonb);
  if coalesce((budget->>'ai_disabled')::boolean,false) or (p_feature='food_photo' and coalesce((budget->>'food_photo_disabled')::boolean,false)) then
    return jsonb_build_object('allowed',false,'code','FEATURE_DISABLED');
  end if;
  select coalesce(sum(estimated_cost),0) into spent from public.ai_usage where day>=date_trunc('month',now() at time zone 'UTC')::date-1;
  if coalesce((budget->>'monthly_budget_usd')::numeric,100)>0 and spent>=coalesce((budget->>'monthly_budget_usd')::numeric,100) then
    return jsonb_build_object('allowed',false,'code','BUDGET_EXCEEDED');
  end if;
  if p_feature='food_photo' and not exists(select 1 from public.consent_records where user_id=p_user_id and consent_type='ai_processing') then
    return jsonb_build_object('allowed',false,'code','CONSENT_REQUIRED');
  end if;
  select (now() at time zone coalesce(timezone,'UTC'))::date into today from public.profiles where id=p_user_id;
  today:=coalesce(today,(now() at time zone 'UTC')::date);
  month_start:=date_trunc('month',today)::date;
  allowance:=case p_feature when 'food_photo' then 248 else 465 end;
  select coalesce(sum(count),0) into used from public.ai_usage where user_id=p_user_id and feature=p_feature and day>=month_start and day<(month_start+interval '1 month')::date;
  -- No counters/allowances are exposed to ordinary clients.
  return jsonb_build_object('allowed',used<allowance,'code',case when used>=allowance then 'MONTHLY_LIMIT_REACHED' else null end,'user_state','paid_pro');
end; $$;
create or replace function public.begin_ai_request(p_user_id uuid,p_request_id uuid,p_feature text,p_input_hash text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare existing public.ai_requests; access jsonb; today date; month_start date; used bigint; pending bigint; allowance integer; lease uuid;
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if p_user_id is null or p_feature is null or p_input_hash is null or p_request_id is null or p_input_hash !~ '^[a-f0-9]{64}$' or p_feature not in ('coach','food_photo') then raise exception 'INVALID_AI_REQUEST'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text||':ai-requests',72));
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text||':'||p_feature,72));
  access:=public.ai_monthly_access(p_user_id,p_feature);
  if not coalesce((access->>'allowed')::boolean,false) and access->>'code'<>'MONTHLY_LIMIT_REACHED' then return access; end if;
  if not exists(select 1 from public.consent_records where user_id=p_user_id and consent_type='ai_processing') then return jsonb_build_object('code','CONSENT_REQUIRED'); end if;
  select * into existing from public.ai_requests where user_id=p_user_id and request_id=p_request_id for update;
  if found then
    if existing.feature<>p_feature or existing.input_hash<>p_input_hash then return jsonb_build_object('code','REQUEST_CONFLICT'); end if;
    if existing.state='completed' then
      if existing.expires_at>now() and existing.response is not null then return jsonb_build_object('replay',existing.response); end if;
      return jsonb_build_object('code','REQUEST_EXPIRED');
    end if;
    if existing.state='pending' and existing.expires_at>now() then return jsonb_build_object('code','REQUEST_IN_PROGRESS'); end if;
  end if;
  if not coalesce((access->>'allowed')::boolean,false) then return access; end if;
  select (now() at time zone coalesce(timezone,'UTC'))::date into today from public.profiles where id=p_user_id;
  today:=coalesce(today,(now() at time zone 'UTC')::date); month_start:=date_trunc('month',today)::date;
  allowance:=case p_feature when 'food_photo' then 248 else 465 end;
  select coalesce(sum(count),0) into used from public.ai_usage where user_id=p_user_id and feature=p_feature and day>=month_start and day<(month_start+interval '1 month')::date;
  select count(*) into pending from public.ai_requests where user_id=p_user_id and feature=p_feature and state='pending' and expires_at>now() and local_day>=month_start and local_day<(month_start+interval '1 month')::date;
  if used+pending>=allowance then return jsonb_build_object('code','REQUEST_IN_PROGRESS'); end if;
  lease:=gen_random_uuid();
  insert into public.ai_requests(user_id,request_id,feature,input_hash,local_day,state,lease_id,expires_at)
    values(p_user_id,p_request_id,p_feature,p_input_hash,today,'pending',lease,now()+interval '5 minutes')
    on conflict(user_id,request_id) do update set local_day=excluded.local_day,state='pending',lease_id=excluded.lease_id,expires_at=excluded.expires_at,response=null;
  -- Response replay has a short lifetime. Scrub expired payloads without retaining images/prompts.
  update public.ai_requests set response=null where (user_id,request_id) in
    (select user_id,request_id from public.ai_requests where response is not null and expires_at<=now() order by expires_at limit 100 for update skip locked);
  return jsonb_build_object('lease_id',lease);
end; $$;

create or replace function public.finish_ai_request(p_user_id uuid,p_request_id uuid,p_lease_id uuid,p_response jsonb default null,p_tokens integer default 0,p_cost numeric default 0)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare item public.ai_requests; access jsonb; used bigint; month_start date; allowance integer;
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if p_tokens<0 or p_cost<0 or p_cost::text in ('NaN','Infinity','-Infinity') then raise exception 'INVALID_AI_USAGE'; end if;
  select * into item from public.ai_requests where user_id=p_user_id and request_id=p_request_id;
  if not found then return jsonb_build_object('code','REQUEST_EXPIRED'); end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text||':ai-requests',72));
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text||':'||item.feature,72));
  select * into item from public.ai_requests where user_id=p_user_id and request_id=p_request_id for update;
  if p_lease_id is null or item.lease_id<>p_lease_id or item.state<>'pending' or item.expires_at<=now() then return jsonb_build_object('code','REQUEST_EXPIRED'); end if;
  if p_response is null then
    if p_tokens>0 or p_cost>0 then
      insert into public.ai_usage(user_id,day,feature,count,tokens,estimated_cost) values(p_user_id,item.local_day,item.feature,0,p_tokens,p_cost)
        on conflict(user_id,day,feature) do update set tokens=public.ai_usage.tokens+excluded.tokens,estimated_cost=public.ai_usage.estimated_cost+excluded.estimated_cost,updated_at=now();
    end if;
    update public.ai_requests set state='failed' where user_id=p_user_id and request_id=p_request_id;
    return jsonb_build_object('released',true);
  end if;
  access:=public.ai_monthly_access(p_user_id,item.feature);
  if not coalesce((access->>'allowed')::boolean,false) then return access; end if;
  if not exists(select 1 from public.consent_records where user_id=p_user_id and consent_type='ai_processing') then return jsonb_build_object('code','CONSENT_REQUIRED'); end if;
  month_start:=date_trunc('month',item.local_day)::date; allowance:=case item.feature when 'food_photo' then 248 else 465 end;
  select coalesce(sum(count),0) into used from public.ai_usage where user_id=p_user_id and feature=item.feature and day>=month_start and day<(month_start+interval '1 month')::date;
  if used>=allowance then return jsonb_build_object('code','MONTHLY_LIMIT_REACHED'); end if;
  insert into public.ai_usage(user_id,day,feature,count,tokens,estimated_cost) values(p_user_id,item.local_day,item.feature,1,p_tokens,p_cost)
    on conflict(user_id,day,feature) do update set count=public.ai_usage.count+1,tokens=public.ai_usage.tokens+excluded.tokens,estimated_cost=public.ai_usage.estimated_cost+excluded.estimated_cost,updated_at=now();
  update public.ai_requests set state='completed',response=p_response,expires_at=now()+interval '24 hours' where user_id=p_user_id and request_id=p_request_id;
  return jsonb_build_object('saved',true);
end; $$;

create or replace function public.sponsor_room(p_room_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_room public.rooms; v_count integer; v_tier text;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,31));
  select * into v_room from public.rooms where id=p_room_id for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if not public.is_room_member(p_room_id,auth.uid()) then raise exception 'NOT_ROOM_MEMBER'; end if;
  if v_room.state='archived' or (v_room.locked_at is not null and v_room.locked_at <= now()-interval '30 days') or (v_room.locked_at is null and not public.room_is_usable(p_room_id) and exists(select 1 from public.entitlements where user_id=v_room.plan_holder_id and period_end<=now()-interval '30 days')) then raise exception 'ROOM_ARCHIVED'; end if;
  -- A former host retry must not displace a successful takeover.
  if v_room.plan_holder_id <> auth.uid() and v_room.state <> 'locked' and public.room_is_usable(p_room_id) then raise exception 'ROOM_NOT_LOCKED'; end if;
  v_tier:=public.active_room_tier(auth.uid());
  if v_tier='free' then raise exception 'PLAN_REQUIRED'; end if;
  select count(*) into v_count from public.room_members where room_id=p_room_id and status in ('active','paused','locked');
  if v_count > (case when v_tier='pro' then 9999 else 5 end) then raise exception 'ROOM_FULL'; end if;
  if v_room.plan_holder_id <> auth.uid() and not public.can_create_room(auth.uid()) then raise exception 'HOSTED_ROOM_LIMIT'; end if;
  update public.room_members set role=case when user_id=auth.uid() then 'host' else 'member' end,updated_at=now() where room_id=p_room_id;
  update public.rooms set plan_holder_id=auth.uid(),state=case when v_count>=2 then 'active' else 'dormant' end,locked_at=null,updated_at=now() where id=p_room_id;
  perform public.recompute_room_state(p_room_id);
  return jsonb_build_object('status','sponsored','room_id',p_room_id,'plan_holder_id',auth.uid(),'member_cap',public.room_cap(p_room_id));
end; $$;

create or replace function public.transfer_host(p_room_id uuid,p_target_user_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.rooms; v_count integer;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_target_user_id::text,31));
  select * into r from public.rooms where id=p_room_id for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if not exists(select 1 from public.room_members where room_id=p_room_id and user_id=auth.uid() and role='host' and status<>'left') then raise exception 'NOT_AUTHORIZED'; end if;
  if not public.is_room_member(p_room_id,p_target_user_id) then raise exception 'NOT_ROOM_MEMBER'; end if;
  if r.plan_holder_id=p_target_user_id then return jsonb_build_object('status','transferred','room_id',p_room_id); end if;
  if not public.can_create_room(p_target_user_id) then raise exception 'HOSTED_ROOM_LIMIT'; end if;
  select count(*) into v_count from public.room_members where room_id=p_room_id and status<>'left';
  if v_count > (case public.active_room_tier(p_target_user_id) when 'pro' then 9999 when 'plus' then 5 else 2 end) then raise exception 'PLAN_REQUIRED'; end if;
  update public.room_members set role=case when user_id=p_target_user_id then 'host' else 'member' end where room_id=p_room_id;
  update public.rooms set plan_holder_id=p_target_user_id where id=p_room_id;
  perform public.recompute_room_state(p_room_id);
  return jsonb_build_object('status','transferred','room_id',p_room_id,'new_host_id',p_target_user_id);
end; $$;

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
  v_cap:=case public.active_room_tier(auth.uid()) when 'pro' then 9999 when 'plus' then 5 else 2 end;
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

do $migration$
declare
  definition text := pg_get_functiondef('public.reserve_web_checkout(uuid,uuid,text,text,text)'::regprocedure);
  legacy_guard text := 'if p_product_key in (''plus_monthly'',''pro_monthly'')';
begin
  if position(legacy_guard in definition) = 0 then raise exception 'UNEXPECTED_WEB_RESERVATION'; end if;
  execute replace(definition, legacy_guard,
    'if p_product_key not in (''pro_annual'',''pro_semiannual'',''pro_quarterly'')');
end;
$migration$;
