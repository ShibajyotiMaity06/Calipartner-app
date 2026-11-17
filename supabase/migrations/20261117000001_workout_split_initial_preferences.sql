-- A purchased first routine can use explicit split preferences instead of the old
-- onboarding snapshot. Retain lifetime history, leases, consent and retry guards.
do $$
declare definition text; old_guard text;
begin
 old_guard := 'if (original is null and tier=''free'') or (original is not null and original<>p_preferences) then raise exception ''ONBOARDING_REQUIRED''; end if;';
 definition := pg_get_functiondef('public.reserve_workout_plan(uuid,uuid,jsonb,boolean)'::regprocedure);
 if position(old_guard in definition)=0 then raise exception 'WORKOUT_RESERVATION_CHANGED'; end if;
 definition := replace(definition,old_guard,
  'if (original is null and tier=''free'') or (original is not null and original<>p_preferences and (tier=''free'' or not (p_preferences ? ''workout_split''))) then raise exception ''ONBOARDING_REQUIRED''; end if;');
 if position('tier:=public.workout_plan_tier(p_user_id);' in definition)=0 then raise exception 'WORKOUT_TIER_CHANGED'; end if;
 definition := replace(definition,'tier:=public.workout_plan_tier(p_user_id);',
  'tier:=public.workout_plan_tier(p_user_id);
 if p_preferences ? ''workout_split'' and tier=''free'' then raise exception ''PURCHASED_PLUS_REQUIRED''; end if;');
 execute definition;
 definition := pg_get_functiondef('public.finish_workout_plan(uuid,uuid,uuid,jsonb)'::regprocedure);
 if position('if request.kind=''rebuild'' then' in definition)=0 then raise exception 'WORKOUT_FINISH_CHANGED'; end if;
 definition := replace(definition,'if request.kind=''rebuild'' then',
  'if request.kind=''initial'' and request.preferences ? ''workout_split'' and public.workout_plan_tier(p_user_id)=''free'' then raise exception ''PURCHASED_PLUS_REQUIRED''; end if;
 if request.kind=''rebuild'' then');
 execute definition;
end; $$;
notify pgrst,'reload schema';
