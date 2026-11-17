-- New social profiles are visible to authenticated viewers by default. Explicit opt-outs remain.
alter table public.social_profiles alter column is_public set default true;
do $$
declare definition text;
begin
  select pg_get_functiondef('public.social_profile_json(uuid,uuid)'::regprocedure) into definition;
  if position('coalesce(s.is_public,false)' in definition) = 0 then raise exception 'Unexpected social projection'; end if;
  execute replace(definition, 'coalesce(s.is_public,false)', 'coalesce(s.is_public,true)');
end;
$$;
revoke all on function public.social_profile_json(uuid,uuid) from public, anon, authenticated;

-- Preserve the established stored-zone/private projection, with a complete All-history start.
do $$
declare definition text; old_range text := $old$select coalesce(min(local_date::date), v_today - interval '29 days')
    into v_start_date
    from public.daily_summaries
    where user_id = v_uid;$old$;
begin
  select pg_get_functiondef('public.get_individual_progress(text)'::regprocedure) into definition;
  definition := replace(definition, chr(13), '');
  old_range := replace(old_range, chr(13), '');
  if position(old_range in definition) = 0 then raise exception 'Unexpected progress range'; end if;
  definition := replace(definition, old_range, $new$select coalesce(min(day), v_today) into v_start_date from (
    select local_date::date as day from public.daily_summaries where user_id=v_uid
    union all select local_date::date from public.weight_logs where user_id=v_uid and deleted_at is null
    union all select local_date::date from public.workouts where user_id=v_uid and deleted_at is null
  ) history where day <= v_today;$new$);
  execute definition;
end;
$$;
alter function public.get_individual_progress(text) rename to get_individual_progress_before_launch_refresh;
revoke all on function public.get_individual_progress_before_launch_refresh(text) from public, anon, authenticated;

create function public.get_individual_progress(p_range text default '30d')
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  actor uuid := auth.uid(); result jsonb; first_day date; last_day date;
  sessions integer; duration numeric; strength_sets jsonb; macros jsonb; daily_sessions jsonb;
begin
  if actor is null then raise exception 'UNAUTHENTICATED'; end if;
  if p_range is null or p_range not in ('7d','30d','90d','6m','1y','all') then raise exception 'INVALID_RANGE'; end if;
  result := public.get_individual_progress_before_launch_refresh(p_range);
  first_day := (result->>'start_date')::date;
  last_day := (result->>'end_date')::date;
  -- Count sessions before joining sets: a session with many sets still counts once.
  select count(*),coalesce(sum(duration_minutes),0) into sessions,duration
  from public.workouts where user_id=actor and deleted_at is null and local_date::date between first_day and last_day;
  select coalesce(jsonb_agg(jsonb_build_object(
    'exercise_id',we.exercise_id,'exercise_name',we.exercise_name,'date',w.local_date,
    'weight_kg',ws.weight_kg,'reps',ws.reps
  ) order by w.local_date,ws.set_number),'[]'::jsonb) into strength_sets
  from public.workout_sets ws
  join public.workouts w on w.id=ws.workout_id and w.user_id=actor and w.deleted_at is null
  join public.workout_exercises we on we.id=ws.workout_exercise_id and we.workout_id=w.id and we.user_id=actor and we.deleted_at is null
  where ws.user_id=actor and ws.deleted_at is null and ws.completed and not ws.is_warmup and ws.reps>0
    and w.local_date::date between first_day and last_day;
  select coalesce(jsonb_agg(jsonb_build_object('date',local_date,'sessions',n) order by local_date),'[]'::jsonb) into daily_sessions from (
    select local_date,count(*) n from public.workouts where user_id=actor and deleted_at is null and local_date::date between first_day and last_day group by local_date
  ) days;
  result := jsonb_set(result,'{workouts}',(result->'workouts') || jsonb_build_object(
    'daily_sessions',daily_sessions,'total_workouts',sessions,'total_duration_minutes',duration,
    'sessions_per_week',round(sessions*7.0/greatest(1,last_day-first_day+1),1),
    'total_strength_sets',jsonb_array_length(strength_sets),'strength_sets',strength_sets
  ));
  -- Food averages use days with intake rather than including unrelated step/water-only rows.
  select jsonb_build_object('food_days',count(*),'protein_goal_days',count(*) filter(where protein >= (result->'macros'->>'protein_target_g')::numeric), 'protein_avg_g',coalesce(round(avg(protein),1),0),
    'carbs_avg_g',coalesce(round(avg(carbs),1),0),'fat_avg_g',coalesce(round(avg(fat),1),0)) into macros
  from public.daily_summaries where user_id=actor and calories>0 and local_date::date between first_day and last_day;
  return jsonb_set(result,'{macros}',(result->'macros') || macros);
end;
$$;
revoke all on function public.get_individual_progress(text) from public,anon;
grant execute on function public.get_individual_progress(text) to authenticated;
