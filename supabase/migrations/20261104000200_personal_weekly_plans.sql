-- Full plan payloads never leave SQL for Free or trial users. No base-table client access.
create table public.personal_weekly_plans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  id uuid not null unique,
  preferences jsonb not null,
  content jsonb not null check(jsonb_typeof(content->'days')='array' and jsonb_array_length(content->'days')=7),
  revision integer not null default 1,
  updated_at timestamptz not null default now()
);
create table public.weekly_plan_requests (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  preferences jsonb not null,
  state text not null check(state in ('pending','complete','failed')),
  lease uuid not null default gen_random_uuid(),
  attempts integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index weekly_plan_requests_owner on public.weekly_plan_requests(user_id,created_at);
alter table public.personal_weekly_plans enable row level security;
alter table public.weekly_plan_requests enable row level security;
create policy personal_weekly_plans_no_direct_access on public.personal_weekly_plans for all to authenticated using(false) with check(false);
create policy weekly_plan_requests_no_direct_access on public.weekly_plan_requests for all to authenticated using(false) with check(false);
revoke all on public.personal_weekly_plans,public.weekly_plan_requests from anon,authenticated;
grant all on public.personal_weekly_plans,public.weekly_plan_requests to service_role;

create function public.has_purchased_weekly_plan_access(p_user_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.entitlements where user_id=p_user_id and tier in ('plus','pro') and status='paid' and (period_end is null or period_end>now()));
$$;
revoke all on function public.has_purchased_weekly_plan_access(uuid) from public,anon,authenticated;
grant execute on function public.has_purchased_weekly_plan_access(uuid) to service_role;

create function public.get_personal_weekly_plan()
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare plan public.personal_weekly_plans; paid boolean;
begin
 if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
 select * into plan from public.personal_weekly_plans where user_id=auth.uid();
 if not found then return null; end if;
 paid:=public.has_purchased_weekly_plan_access(auth.uid());
 return jsonb_build_object('id',plan.id,'preferences',plan.preferences,'revision',plan.revision,'full_access',paid,
  'days',case when paid then plan.content->'days' else jsonb_build_array(plan.content->'days'->0) end,
  'workout_tips',case when paid then plan.content->'workout_tips' else '[]'::jsonb end,
  'diet_tips',case when paid then plan.content->'diet_tips' else '[]'::jsonb end);
end; $$;
revoke all on function public.get_personal_weekly_plan() from public,anon;
grant execute on function public.get_personal_weekly_plan() to authenticated;

-- A service-only reservation limits provider spend and gives retries a stable identity.
create function public.reserve_weekly_plan(p_user_id uuid,p_id uuid,p_preferences jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare request public.weekly_plan_requests; next_lease uuid:=gen_random_uuid(); zone text;
begin
 if p_id is null or p_user_id is null or jsonb_typeof(p_preferences)<>'object' then raise exception 'INVALID_PLAN'; end if;
 if not exists(select 1 from public.consent_records where user_id=p_user_id and consent_type='ai_processing') then raise exception 'CONSENT_REQUIRED'; end if;
 if exists(select 1 from public.remote_config where key='ai_budgets' and coalesce((value->>'ai_disabled')::boolean,false)) then raise exception 'PLAN_UNAVAILABLE'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,79));
 select * into request from public.weekly_plan_requests where id=p_id;
 if found then
  if request.user_id<>p_user_id or request.preferences<>p_preferences then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
  if request.state='complete' then return jsonb_build_object('cached',true); end if;
  if request.state='pending' and request.updated_at>now()-interval '3 minutes' then raise exception 'PLAN_BUSY'; end if;
  if request.attempts>=3 then raise exception 'PLAN_LIMIT_REACHED'; end if;
  update public.weekly_plan_requests set state='pending',lease=next_lease,attempts=attempts+1,updated_at=now() where id=p_id;
 else
  select coalesce(timezone,'UTC') into zone from public.profiles where id=p_user_id;
  if (select count(*) from public.weekly_plan_requests where user_id=p_user_id and (created_at at time zone zone)::date=(now() at time zone zone)::date)>=2 then raise exception 'PLAN_LIMIT_REACHED'; end if;
  if exists(select 1 from public.weekly_plan_requests where user_id=p_user_id and state='pending' and updated_at>now()-interval '3 minutes') then raise exception 'PLAN_BUSY'; end if;
  insert into public.weekly_plan_requests(id,user_id,preferences,state,lease) values(p_id,p_user_id,p_preferences,'pending',next_lease);
 end if;
 return jsonb_build_object('cached',false,'lease',next_lease);
end; $$;
revoke all on function public.reserve_weekly_plan(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.reserve_weekly_plan(uuid,uuid,jsonb) to service_role;

create function public.finish_weekly_plan(p_user_id uuid,p_id uuid,p_lease uuid,p_content jsonb)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare request public.weekly_plan_requests;
begin
 select * into request from public.weekly_plan_requests where id=p_id and user_id=p_user_id for update;
 if not found or request.lease<>p_lease or request.state<>'pending' then raise exception 'PLAN_STALE'; end if;
 if p_content is null then
  update public.weekly_plan_requests set state='failed',updated_at=now() where id=p_id;
  return;
 end if;
 if not exists(select 1 from public.consent_records where user_id=p_user_id and consent_type='ai_processing') then raise exception 'CONSENT_REQUIRED'; end if;
 insert into public.personal_weekly_plans(user_id,id,preferences,content) values(p_user_id,p_id,request.preferences,p_content)
 on conflict(user_id) do update set id=excluded.id,preferences=excluded.preferences,content=excluded.content,revision=personal_weekly_plans.revision+1,updated_at=now();
 update public.weekly_plan_requests set state='complete',updated_at=now() where id=p_id;
end; $$;
revoke all on function public.finish_weekly_plan(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.finish_weekly_plan(uuid,uuid,uuid,jsonb) to service_role;

create table public.weekly_routine_edits (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 payload jsonb not null,
 created_at timestamptz not null default now()
);
alter table public.weekly_routine_edits enable row level security;
create policy weekly_routine_edits_no_direct_access on public.weekly_routine_edits for all to authenticated using(false) with check(false);
revoke all on public.weekly_routine_edits from anon,authenticated;
grant all on public.weekly_routine_edits to service_role;

create function public.edit_weekly_routine(p_id uuid,p_plan_id uuid,p_revision integer,p_day integer,p_exercises jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare plan public.personal_weekly_plans; edit public.weekly_routine_edits; payload jsonb; item jsonb;
begin
 if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
 if not public.has_purchased_weekly_plan_access(auth.uid()) then raise exception 'PURCHASED_PLUS_REQUIRED'; end if;
 if p_id is null or p_day is null or p_day not between 0 and 6 or jsonb_typeof(p_exercises) is distinct from 'array' or jsonb_array_length(p_exercises)>8 then raise exception 'INVALID_PLAN'; end if;
 payload:=jsonb_build_object('plan',p_plan_id,'revision',p_revision,'day',p_day,'exercises',p_exercises);
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,80));
 select * into edit from public.weekly_routine_edits where id=p_id;
 if found then
  if edit.user_id<>auth.uid() or edit.payload<>payload then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
  return public.get_personal_weekly_plan();
 end if;
 select * into plan from public.personal_weekly_plans where user_id=auth.uid() and id=p_plan_id for update;
 if not found or plan.revision is distinct from p_revision then raise exception 'PLAN_STALE'; end if;
 for item in select value from jsonb_array_elements(p_exercises) loop
  if jsonb_typeof(item) is distinct from 'object' or length(trim(coalesce(item->>'name','')))=0 or length(item->>'name')>100
   or jsonb_typeof(item->'sets') is distinct from 'number' or (item->>'sets')::numeric not between 1 and 5 or (item->>'sets')::numeric<>trunc((item->>'sets')::numeric)
   or jsonb_typeof(item->'reps') is distinct from 'number' or (item->>'reps')::numeric not between 5 and 30 or (item->>'reps')::numeric<>trunc((item->>'reps')::numeric)
   or jsonb_typeof(item->'rest_seconds') is distinct from 'number' or (item->>'rest_seconds')::numeric not between 30 and 180 or (item->>'rest_seconds')::numeric<>trunc((item->>'rest_seconds')::numeric)
   or not coalesce(plan.preferences->'equipment' ? (item->>'equipment'),false)
   or item-array['name','equipment','sets','reps','rest_seconds']<>'{}'::jsonb then raise exception 'INVALID_PLAN'; end if;
 end loop;
 update public.personal_weekly_plans set content=jsonb_set(content,array['days',p_day::text,'workout','exercises'],p_exercises),revision=revision+1,updated_at=now() where user_id=auth.uid();
 insert into public.weekly_routine_edits(id,user_id,payload) values(p_id,auth.uid(),payload);
 return public.get_personal_weekly_plan();
end; $$;
revoke all on function public.edit_weekly_routine(uuid,uuid,integer,integer,jsonb) from public,anon;
grant execute on function public.edit_weekly_routine(uuid,uuid,integer,integer,jsonb) to authenticated;
notify pgrst,'reload schema';
