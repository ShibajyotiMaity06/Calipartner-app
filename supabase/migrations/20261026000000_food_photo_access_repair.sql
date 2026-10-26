-- Restore the approved photo access rules without replaying older room migrations.
create or replace function public.check_ai_food_photo_access(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_caller uuid := auth.uid();
  v_ent public.entitlements;
  v_budget jsonb;
  v_caps jsonb;
  v_cost numeric;
  v_zone text;
  v_day date;
  v_used integer := 0;
  v_cap integer;
  v_state text;
begin
  p_user_id := coalesce(p_user_id,v_caller);
  if p_user_id is null or (v_caller is null and coalesce(auth.jwt()->>'role','')<>'service_role') then
    raise exception 'UNAUTHENTICATED' using errcode='42501';
  end if;
  if v_caller is not null and v_caller<>p_user_id then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  v_budget := public.get_remote_config('ai_budgets','{"monthly_budget_usd":100,"food_photo_disabled":false,"ai_disabled":false}'::jsonb);
  if coalesce((v_budget->>'food_photo_disabled')::boolean,false) or coalesce((v_budget->>'ai_disabled')::boolean,false) then
    return jsonb_build_object('allowed',false,'code','FEATURE_DISABLED');
  end if;
  select coalesce(sum(estimated_cost),0) into v_cost from public.ai_usage
    where day >= date_trunc('month',now() at time zone 'UTC')::date - 1;
  if coalesce((v_budget->>'monthly_budget_usd')::numeric,100)>0 and v_cost>=coalesce((v_budget->>'monthly_budget_usd')::numeric,100) then
    return jsonb_build_object('allowed',false,'code','BUDGET_EXCEEDED');
  end if;
  if not exists(select 1 from public.consent_records where user_id=p_user_id and consent_type='ai_processing') then
    return jsonb_build_object('allowed',false,'code','CONSENT_REQUIRED');
  end if;
  select timezone into v_zone from public.profiles where id=p_user_id;
  v_day := (now() at time zone coalesce(v_zone,'UTC'))::date;
  v_caps := public.get_remote_config('ai_food_photo_caps','{"paid_pro":5,"paid_plus":0,"free_taste":3}'::jsonb);
  select * into v_ent from public.entitlements where user_id=p_user_id;
  if found and v_ent.tier='pro' and v_ent.status in ('paid','grace') and (v_ent.period_end is null or v_ent.period_end>now()) then
    v_state := 'paid_pro';
    v_cap := least(5,greatest(0,coalesce((v_caps->>'paid_pro')::integer,5)));
    select coalesce(sum(count),0)::integer into v_used from public.ai_usage
      where user_id=p_user_id and feature='food_photo' and day=v_day;
  elsif found and v_ent.tier='plus' and ((v_ent.status in ('paid','grace') and (v_ent.period_end is null or v_ent.period_end>now())) or (v_ent.status='trial' and v_ent.period_end>now())) then
    return jsonb_build_object('allowed',false,'code','UPGRADE_REQUIRED','user_state','paid_plus','used',0,'cap',0,'remaining',0);
  else
    v_state := 'free_taste';
    v_cap := least(3,greatest(0,coalesce((v_caps->>'free_taste')::integer,3)));
    select coalesce(sum(count),0)::integer into v_used from public.ai_usage
      where user_id=p_user_id and feature='food_photo';
  end if;
  return jsonb_build_object('allowed',v_used<v_cap,'code',case when v_used>=v_cap then 'DAILY_LIMIT_REACHED' else null end,
    'user_state',v_state,'used',v_used,'cap',v_cap,'remaining',greatest(0,v_cap-v_used));
end; $$;
revoke all on function public.check_ai_food_photo_access(uuid) from public,anon;
grant execute on function public.check_ai_food_photo_access(uuid) to authenticated,service_role;

-- Only trusted functions record usage. Serialize photo consumption and recheck the cap.
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
  select timezone into v_zone from public.profiles where id=p_user_id;
  v_day := coalesce(p_day,(now() at time zone coalesce(v_zone,'UTC'))::date);
  insert into public.ai_usage(user_id,day,feature,count,tokens,estimated_cost,created_at,updated_at)
    values(p_user_id,v_day,p_feature,1,coalesce(p_tokens,0),coalesce(p_cost,0),now(),now())
    on conflict(user_id,day,feature) do update set count=public.ai_usage.count+1,
      tokens=public.ai_usage.tokens+excluded.tokens,estimated_cost=public.ai_usage.estimated_cost+excluded.estimated_cost,updated_at=now();
end; $$;
revoke all on function public.record_ai_usage(uuid,text,integer,numeric,date) from public,anon,authenticated;
grant execute on function public.record_ai_usage(uuid,text,integer,numeric,date) to service_role;
