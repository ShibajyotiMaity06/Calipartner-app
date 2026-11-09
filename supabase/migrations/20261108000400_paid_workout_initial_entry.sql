-- Older purchased accounts can enter workout setup directly even if they never
-- saved an AI onboarding plan. Existing successful history is never reset.
create or replace function public.get_workout_plan()
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare plan public.workout_plans; tier text; used integer; last_build timestamptz; next_build timestamptz; prefs jsonb; can_initialize boolean;
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
 can_initialize:=tier<>'free' and plan.id is null and prefs is null and not exists(select 1 from public.workout_plan_builds where user_id=auth.uid() and state='complete');
 return jsonb_build_object('id',plan.id,'revision',coalesce(plan.revision,0),'full_access',tier<>'free','tier',tier,
  'preferences',prefs,'needs_initial',tier<>'free' and plan.id is null and prefs is not null,
  'days',case when tier<>'free' and plan.id is not null then plan.content->'days' else '[]'::jsonb end,
  'rebuilds_used',used,'can_rebuild',can_initialize or (plan.id is not null and (tier='plus' and used=0 or tier='pro' and (next_build is null or next_build<=now()))),
  'next_rebuild_at',next_build);
end; $$;
revoke all on function public.get_workout_plan() from public,anon;
grant execute on function public.get_workout_plan() to authenticated;

do $$
declare definition text;
begin
 definition:=pg_get_functiondef('public.reserve_workout_plan(uuid,uuid,jsonb,boolean)'::regprocedure);
 if position('if plan.id is not null then raise exception ''INITIAL_PLAN_EXISTS''; end if;' in definition)=0
  or position('if original is null or original<>p_preferences then raise exception ''ONBOARDING_REQUIRED''; end if;' in definition)=0 then raise exception 'WORKOUT_RESERVATION_CHANGED'; end if;
 definition:=replace(definition,'if plan.id is not null then raise exception ''INITIAL_PLAN_EXISTS''; end if;',
  'if plan.id is not null or exists(select 1 from public.workout_plan_builds where user_id=p_user_id and state=''complete'') then raise exception ''INITIAL_PLAN_EXISTS''; end if;');
 definition:=replace(definition,'if original is null or original<>p_preferences then raise exception ''ONBOARDING_REQUIRED''; end if;',
  'if (original is null and tier=''free'') or (original is not null and original<>p_preferences) then raise exception ''ONBOARDING_REQUIRED''; end if;');
 execute definition;
end; $$;
notify pgrst,'reload schema';
