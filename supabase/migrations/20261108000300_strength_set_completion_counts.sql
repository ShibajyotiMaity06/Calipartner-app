-- Set-based logging records no invented duration. A real completed working set
-- qualifies for workout-count goals; duration-based goals retain their actual minutes.
do $$
declare definition text;
begin
 definition:=pg_get_functiondef('public.challenge_source_days(uuid,date,date,jsonb)'::regprocedure);
 if position('and w.duration_minutes>0' in definition)=0 then raise exception 'CHALLENGE_WORKOUT_SOURCE_CHANGED'; end if;
 definition:=replace(definition,'and w.duration_minutes>0',
  'and (w.duration_minutes>0 or (w.type=''strength'' and exists(select 1 from public.workout_sets s join public.workout_exercises e on e.id=s.workout_exercise_id and e.workout_id=w.id and e.user_id=w.user_id and e.deleted_at is null where s.workout_id=w.id and s.user_id=w.user_id and s.deleted_at is null and s.completed and not s.is_warmup and s.reps>0)))');
 execute definition;
end; $$;
create trigger challenge_strength_sets_changed after insert or update or delete on public.workout_sets for each row execute function public.challenge_log_changed();
create trigger challenge_strength_exercises_changed after insert or update or delete on public.workout_exercises for each row execute function public.challenge_log_changed();
