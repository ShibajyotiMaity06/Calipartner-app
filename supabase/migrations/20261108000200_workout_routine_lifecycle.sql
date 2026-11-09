-- Owner-approved weekly workout routine, durable AI rebuild allowance and idempotent edits.
create table public.workout_plans (
 user_id uuid primary key references auth.users(id) on delete cascade,
 id uuid not null unique,
 preferences jsonb not null,
 content jsonb not null,
 revision integer not null default 1,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.workout_plan_builds (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('initial','rebuild')),
 tier text not null check(tier in ('free','plus','pro')),
 preferences jsonb not null,
 state text not null check(state in ('pending','complete','failed')),
 lease uuid not null default gen_random_uuid(),
 attempts integer not null default 1,
 source_revision integer not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 completed_at timestamptz
);
create index workout_plan_builds_owner on public.workout_plan_builds(user_id,completed_at);
create table public.workout_plan_edits (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 payload jsonb not null,
 created_at timestamptz not null default now()
);
alter table public.workout_plans enable row level security;
alter table public.workout_plan_builds enable row level security;
alter table public.workout_plan_edits enable row level security;
create policy workout_plans_no_direct_access on public.workout_plans for all to authenticated using(false) with check(false);
create policy workout_plan_builds_no_direct_access on public.workout_plan_builds for all to authenticated using(false) with check(false);
create policy workout_plan_edits_no_direct_access on public.workout_plan_edits for all to authenticated using(false) with check(false);
revoke all on public.workout_plans,public.workout_plan_builds,public.workout_plan_edits from anon,authenticated;
grant all on public.workout_plans,public.workout_plan_builds,public.workout_plan_edits to service_role;

create function public.workout_plan_tier(p_user_id uuid)
returns text language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce((select tier from public.entitlements where user_id=p_user_id and tier in ('plus','pro') and status='paid' and (period_end is null or period_end>now()) order by case tier when 'pro' then 0 else 1 end limit 1),'free');
$$;
revoke all on function public.workout_plan_tier(uuid) from public,anon,authenticated;

create function public.valid_workout_routine(p_content jsonb)
returns boolean language plpgsql immutable set search_path=public,pg_temp as $$
declare d jsonb; e jsonb; s jsonb; index integer:=0;
begin
 if jsonb_typeof(p_content->'days') is distinct from 'array' or jsonb_array_length(p_content->'days')<>7 then return false; end if;
 for d in select value from jsonb_array_elements(p_content->'days') loop
  if (d->>'day')::integer<>index or jsonb_typeof(d->'day') is distinct from 'number' or (d->>'day')::numeric<>index
   or jsonb_typeof(d->'title') is distinct from 'string' or length(trim(coalesce(d->>'title','')))=0 or length(d->>'title')>100
   or jsonb_typeof(d->'minutes') is distinct from 'number' or (d->>'minutes')::numeric not between 0 and 90 or (d->>'minutes')::numeric<>trunc((d->>'minutes')::numeric)
   or jsonb_typeof(d->'exercises') is distinct from 'array' or jsonb_array_length(d->'exercises')>8 then return false; end if;
  if (select count(*)<>count(distinct value->>'id') from jsonb_array_elements(d->'exercises')) then return false; end if;
  for e in select value from jsonb_array_elements(d->'exercises') loop
   if jsonb_typeof(e->'id') is distinct from 'string' or jsonb_typeof(e->'name') is distinct from 'string' or jsonb_typeof(e->'equipment') is distinct from 'string'
    or length(trim(coalesce(e->>'id','')))=0 or length(e->>'id')>100 or length(trim(coalesce(e->>'name','')))=0 or length(e->>'name')>100
    or not coalesce(e->>'equipment'=any(array['bodyweight','dumbbell','barbell','bench','band','pullup','cable','legpress','treadmill','bike']),false)
    or jsonb_typeof(e->'targetSets') is distinct from 'array' or jsonb_array_length(e->'targetSets') not between 1 and 20 then return false; end if;
   for s in select value from jsonb_array_elements(e->'targetSets') loop
    if jsonb_typeof(s->'reps') is distinct from 'number' or (s->>'reps')::numeric not between 1 and 100 or (s->>'reps')::numeric<>trunc((s->>'reps')::numeric)
     or jsonb_typeof(s->'weightKg') is distinct from 'number' or (s->>'weightKg')::numeric not between 0 and 1000 then return false; end if;
   end loop;
  end loop;
  index:=index+1;
 end loop;
 return true;
exception when others then return false;
end; $$;
revoke all on function public.valid_workout_routine(jsonb) from public,anon,authenticated;
alter table public.workout_plans add constraint workout_plan_content_valid check(public.valid_workout_routine(content));

create function public.get_workout_plan()
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare plan public.workout_plans; tier text; used integer; last_build timestamptz; next_build timestamptz; prefs jsonb;
begin
 if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
 tier:=public.workout_plan_tier(auth.uid());
 select * into plan from public.workout_plans where user_id=auth.uid();
 select count(*),max(completed_at) into used,last_build from public.workout_plan_builds where user_id=auth.uid() and kind='rebuild' and state='complete';
 if tier='pro' and last_build is not null then next_build:=last_build+interval '6 months'; end if;
 if tier<>'free' then
  prefs:=plan.preferences;
  if prefs is null then select preferences-'plan_scope' into prefs from public.personal_weekly_plans where user_id=auth.uid(); end if;
 end if;
 return jsonb_build_object('id',plan.id,'revision',coalesce(plan.revision,0),'full_access',tier<>'free','tier',tier,
  'preferences',prefs,'needs_initial',tier<>'free' and plan.id is null and prefs is not null,
  'days',case when tier<>'free' and plan.id is not null then plan.content->'days' else '[]'::jsonb end,
  'rebuilds_used',used,'can_rebuild',plan.id is not null and (tier='plus' and used=0 or tier='pro' and (next_build is null or next_build<=now())),
  'next_rebuild_at',next_build);
end; $$;
revoke all on function public.get_workout_plan() from public,anon;
grant execute on function public.get_workout_plan() to authenticated;

create function public.reserve_workout_plan(p_user_id uuid,p_id uuid,p_preferences jsonb,p_initial boolean)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare plan public.workout_plans; request public.workout_plan_builds; tier text; last_build timestamptz; used integer; next_lease uuid:=gen_random_uuid(); original jsonb;
begin
 if p_user_id is null or p_id is null or p_initial is null or jsonb_typeof(p_preferences) is distinct from 'object' then raise exception 'INVALID_WORKOUT_PLAN'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,188));
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,190));
 if not exists(select 1 from public.consent_records where user_id=p_user_id and consent_type='ai_processing') then raise exception 'CONSENT_REQUIRED'; end if;
 if exists(select 1 from public.remote_config where key='ai_budgets' and coalesce((value->>'ai_disabled')::boolean,false)) then raise exception 'PLAN_UNAVAILABLE'; end if;
 select * into request from public.workout_plan_builds where id=p_id;
 if found then
  if request.user_id<>p_user_id or request.preferences<>p_preferences or request.kind<>(case when p_initial then 'initial' else 'rebuild' end) then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
  if request.state='complete' then return jsonb_build_object('cached',true); end if;
  if request.state='pending' and request.updated_at>now()-interval '4 minutes' then raise exception 'PLAN_BUSY'; end if;
  if request.attempts>=3 and request.updated_at>now()-interval '1 day' then raise exception 'PLAN_RATE_LIMITED'; end if;
 end if;
 tier:=public.workout_plan_tier(p_user_id);
 select * into plan from public.workout_plans where user_id=p_user_id;
 if p_initial then
  if plan.id is not null then raise exception 'INITIAL_PLAN_EXISTS'; end if;
  select preferences-'plan_scope' into original from public.personal_weekly_plans where user_id=p_user_id;
  if original is null or original<>p_preferences then raise exception 'ONBOARDING_REQUIRED'; end if;
 else
  if tier='free' then raise exception 'PURCHASED_PLUS_REQUIRED'; end if;
  if plan.id is null then raise exception 'ONBOARDING_REQUIRED'; end if;
  select count(*),max(completed_at) into used,last_build from public.workout_plan_builds where user_id=p_user_id and kind='rebuild' and state='complete';
  if tier='plus' and used>0 then raise exception 'WORKOUT_LIFETIME_LIMIT'; end if;
  if tier='pro' and last_build is not null and last_build+interval '6 months'>now() then raise exception 'WORKOUT_COOLDOWN'; end if;
 end if;
 if exists(select 1 from public.workout_plan_builds where user_id=p_user_id and id<>p_id and state='pending' and updated_at>now()-interval '4 minutes') then raise exception 'PLAN_BUSY'; end if;
 if request.id is null and (select count(*) from public.workout_plan_builds where user_id=p_user_id and created_at>now()-interval '1 day')>=5 then raise exception 'PLAN_RATE_LIMITED'; end if;
 insert into public.workout_plan_builds(id,user_id,kind,tier,preferences,state,lease,source_revision)
 values(p_id,p_user_id,case when p_initial then 'initial' else 'rebuild' end,tier,p_preferences,'pending',next_lease,coalesce(plan.revision,0))
 on conflict(id) do update set state='pending',lease=next_lease,attempts=case when workout_plan_builds.updated_at<=now()-interval '1 day' then 1 else workout_plan_builds.attempts+1 end,source_revision=excluded.source_revision,tier=excluded.tier,updated_at=now();
 return jsonb_build_object('cached',false,'lease',next_lease);
end; $$;
revoke all on function public.reserve_workout_plan(uuid,uuid,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.reserve_workout_plan(uuid,uuid,jsonb,boolean) to service_role;

create function public.finish_workout_plan(p_user_id uuid,p_id uuid,p_lease uuid,p_content jsonb)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare request public.workout_plan_builds; revision integer; tier text; used integer; last_build timestamptz;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,188));
 select * into request from public.workout_plan_builds where id=p_id and user_id=p_user_id for update;
 if not found or request.lease<>p_lease or request.state<>'pending' or request.updated_at<=now()-interval '4 minutes' then raise exception 'PLAN_STALE'; end if;
 if p_content is null then update public.workout_plan_builds set state='failed',updated_at=now() where id=p_id; return; end if;
 if not public.valid_workout_routine(p_content) then raise exception 'INVALID_WORKOUT_PLAN'; end if;
 if not exists(select 1 from public.consent_records where user_id=p_user_id and consent_type='ai_processing') then raise exception 'CONSENT_REQUIRED'; end if;
 select p.revision into revision from public.workout_plans p where user_id=p_user_id;
 if coalesce(revision,0)<>request.source_revision then raise exception 'PLAN_STALE'; end if;
 if request.kind='rebuild' then
  tier:=public.workout_plan_tier(p_user_id);
  if tier='free' then raise exception 'PURCHASED_PLUS_REQUIRED'; end if;
  select count(*),max(completed_at) into used,last_build from public.workout_plan_builds where user_id=p_user_id and kind='rebuild' and state='complete';
  if tier='plus' and used>0 then raise exception 'WORKOUT_LIFETIME_LIMIT'; end if;
  if tier='pro' and last_build is not null and last_build+interval '6 months'>now() then raise exception 'WORKOUT_COOLDOWN'; end if;
 end if;
 insert into public.workout_plans(user_id,id,preferences,content) values(p_user_id,p_id,request.preferences,p_content)
 on conflict(user_id) do update set id=excluded.id,preferences=excluded.preferences,content=excluded.content,revision=workout_plans.revision+1,updated_at=now();
 update public.workout_plan_builds set state='complete',completed_at=now(),updated_at=now() where id=p_id;
end; $$;
revoke all on function public.finish_workout_plan(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.finish_workout_plan(uuid,uuid,uuid,jsonb) to service_role;

create function public.edit_workout_plan(p_id uuid,p_plan_id uuid,p_revision integer,p_content jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare payload jsonb; previous public.workout_plan_edits; plan public.workout_plans;
begin
 if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
 if public.workout_plan_tier(auth.uid())='free' then raise exception 'PURCHASED_PLUS_REQUIRED'; end if;
 if p_id is null or not public.valid_workout_routine(p_content) then raise exception 'INVALID_WORKOUT_PLAN'; end if;
 payload:=jsonb_build_object('plan_id',p_plan_id,'revision',p_revision,'content',p_content);
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,188));
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,189));
 select * into previous from public.workout_plan_edits where id=p_id;
 if found then
  if previous.user_id<>auth.uid() or previous.payload<>payload then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
  return public.get_workout_plan();
 end if;
 select * into plan from public.workout_plans where user_id=auth.uid() for update;
 if not found or plan.id<>p_plan_id or plan.revision is distinct from p_revision then raise exception 'PLAN_STALE'; end if;
 update public.workout_plans set content=p_content,revision=revision+1,updated_at=now() where user_id=auth.uid();
 insert into public.workout_plan_edits(id,user_id,payload) values(p_id,auth.uid(),payload);
 return public.get_workout_plan();
end; $$;
revoke all on function public.edit_workout_plan(uuid,uuid,integer,jsonb) from public,anon;
grant execute on function public.edit_workout_plan(uuid,uuid,integer,jsonb) to authenticated;

-- Legacy food-plan generation/edits cannot replace workouts or bypass rebuild allowances.
-- Once a dedicated routine exists, older weekly-plan surfaces project that routine too.
create function public.preserve_workout_routine_in_food_plan()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare routine jsonb; days jsonb; day jsonb; chosen integer; zone text;
begin
 select content->'days' into routine from public.workout_plans where user_id=new.user_id;
 if routine is null then return new; end if;
 select timezone into zone from public.profiles where id=new.user_id;
 days:='[]'::jsonb;
 for day in select value from jsonb_array_elements(new.content->'days') loop
  chosen:=case when jsonb_array_length(new.content->'days')=1 then (extract(isodow from now() at time zone coalesce(zone,'UTC'))::integer-1) else (day->>'day')::integer end;
  day:=jsonb_set(day,'{workout}',jsonb_build_object('title',routine->chosen->>'title','minutes',routine->chosen->'minutes','exercises',
   (select coalesce(jsonb_agg(jsonb_build_object('name',e->>'name','equipment',e->>'equipment','sets',jsonb_array_length(e->'targetSets'),'reps',e->'targetSets'->0->'reps','rest_seconds',60)),'[]'::jsonb) from jsonb_array_elements(routine->chosen->'exercises') e)));
  days:=days||jsonb_build_array(day);
 end loop;
 new.content:=jsonb_set(new.content,'{days}',days);
 return new;
end; $$;
revoke all on function public.preserve_workout_routine_in_food_plan() from public,anon,authenticated;
create trigger preserve_workout_routine before insert or update of content on public.personal_weekly_plans for each row execute function public.preserve_workout_routine_in_food_plan();

create function public.refresh_legacy_workout_projection()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 update public.personal_weekly_plans set content=content,revision=revision+1 where user_id=new.user_id;
 return new;
end; $$;
revoke all on function public.refresh_legacy_workout_projection() from public,anon,authenticated;
create trigger refresh_legacy_workout_projection after insert or update on public.workout_plans for each row execute function public.refresh_legacy_workout_projection();
notify pgrst,'reload schema';
