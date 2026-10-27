-- Some hosted projects still have the historical boolean RPC. Replace only that signature.
do $$
begin
  if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='check_ai_coach_access' and pg_get_function_identity_arguments(p.oid)='p_user_id uuid' and p.prorettype='boolean'::regtype) then
    drop function public.check_ai_coach_access(uuid);
  end if;
end; $$;

-- Audit the approved plan matrix without replaying older migrations.
create or replace function public.check_ai_coach_access(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_caller uuid:=auth.uid(); v_ent public.entitlements; v_zone text; v_day date;
  v_used integer:=0; v_budget jsonb; v_cost numeric;
begin
  p_user_id:=coalesce(p_user_id,v_caller);
  if p_user_id is null or (v_caller is null and coalesce(auth.jwt()->>'role','')<>'service_role') then raise exception 'UNAUTHENTICATED' using errcode='42501'; end if;
  if v_caller is not null and v_caller<>p_user_id then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  select * into v_ent from public.entitlements where user_id=p_user_id;
  if not found or v_ent.tier<>'pro' or v_ent.status not in ('paid','grace') or (v_ent.period_end is not null and v_ent.period_end<=now()) then
    return jsonb_build_object('allowed',false,'code','UPGRADE_REQUIRED','reason','pro_required');
  end if;
  v_budget:=public.get_remote_config('ai_budgets','{"monthly_budget_usd":100,"ai_disabled":false}'::jsonb);
  if coalesce((v_budget->>'ai_disabled')::boolean,false) then return jsonb_build_object('allowed',false,'code','FEATURE_DISABLED'); end if;
  select coalesce(sum(estimated_cost),0) into v_cost from public.ai_usage where day>=date_trunc('month',now() at time zone 'UTC')::date-1;
  if coalesce((v_budget->>'monthly_budget_usd')::numeric,100)>0 and v_cost>=coalesce((v_budget->>'monthly_budget_usd')::numeric,100) then return jsonb_build_object('allowed',false,'code','BUDGET_EXCEEDED'); end if;
  select timezone into v_zone from public.profiles where id=p_user_id;
  v_day:=(now() at time zone coalesce(v_zone,'UTC'))::date;
  select coalesce(sum(count),0)::integer into v_used from public.ai_usage where user_id=p_user_id and feature='coach' and day=v_day;
  return jsonb_build_object('allowed',v_used<10,'code',case when v_used>=10 then 'DAILY_LIMIT_REACHED' else null end,'reason','pro_plan','used',v_used,'cap',10,'remaining',greatest(0,10-v_used));
end; $$;
revoke all on function public.check_ai_coach_access(uuid) from public,anon;
grant execute on function public.check_ai_coach_access(uuid) to authenticated,service_role;

-- New fasting activity is paid. History, ending a fast and deleting personal data remain available.
create or replace function public.enforce_paid_fasting()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if coalesce(auth.jwt()->>'role','')='service_role' then return new; end if;
  if public.active_room_tier(new.user_id)='free' then
    if tg_table_name='fasting_settings' then
      if new.enabled then raise exception 'PLUS_REQUIRED'; end if;
    elsif tg_op='INSERT' then raise exception 'PLUS_REQUIRED';
    elsif new.status='active' and old.status<>'active' then raise exception 'PLUS_REQUIRED';
    end if;
  end if;
  return new;
end; $$;
create trigger fasting_settings_paid_access before insert or update on public.fasting_settings for each row execute function public.enforce_paid_fasting();
create trigger fasting_sessions_paid_access before insert or update on public.fasting_sessions for each row execute function public.enforce_paid_fasting();

-- Catalog policy applies even when a client calls PostgREST directly.
create or replace function public.is_starter_recipe(p_recipe_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(select 1 from (select id from public.recipes where status='published' and deleted_at is null order by created_at,id limit 10) starter where starter.id=p_recipe_id);
$$;
revoke all on function public.is_starter_recipe(uuid) from public,anon;
grant execute on function public.is_starter_recipe(uuid) to authenticated,service_role;
create or replace function public.can_read_recipe(p_recipe_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select auth.uid() is not null and (public.active_room_tier(auth.uid()) in ('plus','pro') or public.is_starter_recipe(p_recipe_id));
$$;
revoke all on function public.can_read_recipe(uuid) from public,anon;
grant execute on function public.can_read_recipe(uuid) to authenticated,service_role;
alter policy recipes_select_published on public.recipes using(status='published' and deleted_at is null and public.can_read_recipe(id));

create or replace function public.record_ai_usage(p_user_id uuid,p_feature text,p_tokens integer default 0,p_cost numeric default 0,p_day date default null)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_day date; v_zone text; v_access jsonb;
begin
  if p_user_id is null or p_feature is null then raise exception 'INVALID_ARGUMENTS'; end if;
  if coalesce(p_tokens,0)<0 or coalesce(p_cost,0)<0 or p_cost::text in ('NaN','Infinity','-Infinity') then
    raise exception 'INVALID_AI_USAGE' using errcode='22003';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text||':'||p_feature,72));
  if p_feature='food_photo' then
    v_access := public.check_ai_food_photo_access(p_user_id);
    if not coalesce((v_access->>'allowed')::boolean,false) then
      raise exception 'AI_PHOTO_ACCESS_DENIED: %',v_access->>'code';
    end if;
  end if;
  if p_feature='coach' then
    v_access := public.check_ai_coach_access(p_user_id);
    if not coalesce((v_access->>'allowed')::boolean,false) then raise exception 'AI_COACH_ACCESS_DENIED: %',v_access->>'code'; end if;
  end if;
  select timezone into v_zone from public.profiles where id=p_user_id;
  v_day := coalesce(p_day,(now() at time zone coalesce(v_zone,'UTC'))::date);
  insert into public.ai_usage(user_id,day,feature,count,tokens,estimated_cost,created_at,updated_at)
    values(p_user_id,v_day,p_feature,1,coalesce(p_tokens,0),coalesce(p_cost,0),now(),now())
    on conflict(user_id,day,feature) do update set count=public.ai_usage.count+1,
      tokens=public.ai_usage.tokens+excluded.tokens,estimated_cost=public.ai_usage.estimated_cost+excluded.estimated_cost,updated_at=now();
end; $$;
revoke all on function public.record_ai_usage(uuid,text,integer,numeric,date) from public,anon,authenticated;
grant execute on function public.record_ai_usage(uuid,text,integer,numeric,date) to service_role;
