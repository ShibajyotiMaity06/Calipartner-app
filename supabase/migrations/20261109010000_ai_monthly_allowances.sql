-- Owner: calendar-month allowances replace the old per-day AI limits.
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
  allowance:=case p_feature when 'food_photo' then 300 else 900 end;
  select coalesce(sum(count),0) into used from public.ai_usage where user_id=p_user_id and feature=p_feature and day>=month_start and day<(month_start+interval '1 month')::date;
  -- No counters/allowances are exposed to ordinary clients.
  return jsonb_build_object('allowed',used<allowance,'code',case when used>=allowance then 'MONTHLY_LIMIT_REACHED' else null end,'user_state','paid_pro');
end; $$;
revoke all on function public.ai_monthly_access(uuid,text) from public,anon,authenticated;
grant execute on function public.ai_monthly_access(uuid,text) to service_role;
create or replace function public.check_ai_coach_access(p_user_id uuid)
returns jsonb language sql security definer set search_path=public,pg_temp as $$ select public.ai_monthly_access(coalesce(p_user_id,auth.uid()),'coach'); $$;
create or replace function public.check_ai_food_photo_access(p_user_id uuid)
returns jsonb language sql security definer set search_path=public,pg_temp as $$ select public.ai_monthly_access(coalesce(p_user_id,auth.uid()),'food_photo'); $$;
revoke all on function public.check_ai_coach_access(uuid),public.check_ai_food_photo_access(uuid) from public,anon;
grant execute on function public.check_ai_coach_access(uuid),public.check_ai_food_photo_access(uuid) to authenticated,service_role;

create table public.ai_requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  feature text not null check(feature in ('coach','food_photo')),
  input_hash text not null,
  local_day date not null,
  state text not null check(state in ('pending','completed','failed')),
  lease_id uuid not null,
  expires_at timestamptz not null,
  response jsonb,
  created_at timestamptz not null default now(),
  primary key(user_id,request_id)
);
alter table public.ai_requests enable row level security;
create policy ai_requests_no_client_access on public.ai_requests for all to authenticated,anon using(false) with check(false);
create policy ai_requests_service on public.ai_requests for all to service_role using(true) with check(true);
revoke all on public.ai_requests from anon,authenticated;
create index ai_requests_pending on public.ai_requests(user_id,feature,local_day,expires_at) where state='pending';
create index ai_requests_expiry on public.ai_requests(expires_at) where response is not null;

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
  allowance:=case p_feature when 'food_photo' then 300 else 900 end;
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
  month_start:=date_trunc('month',item.local_day)::date; allowance:=case item.feature when 'food_photo' then 300 else 900 end;
  select coalesce(sum(count),0) into used from public.ai_usage where user_id=p_user_id and feature=item.feature and day>=month_start and day<(month_start+interval '1 month')::date;
  if used>=allowance then return jsonb_build_object('code','MONTHLY_LIMIT_REACHED'); end if;
  insert into public.ai_usage(user_id,day,feature,count,tokens,estimated_cost) values(p_user_id,item.local_day,item.feature,1,p_tokens,p_cost)
    on conflict(user_id,day,feature) do update set count=public.ai_usage.count+1,tokens=public.ai_usage.tokens+excluded.tokens,estimated_cost=public.ai_usage.estimated_cost+excluded.estimated_cost,updated_at=now();
  update public.ai_requests set state='completed',response=p_response,expires_at=now()+interval '24 hours' where user_id=p_user_id and request_id=p_request_id;
  return jsonb_build_object('saved',true);
end; $$;
revoke all on function public.begin_ai_request(uuid,uuid,text,text),public.finish_ai_request(uuid,uuid,uuid,jsonb,integer,numeric) from public,anon,authenticated;
grant execute on function public.begin_ai_request(uuid,uuid,text,text),public.finish_ai_request(uuid,uuid,uuid,jsonb,integer,numeric) to service_role;
