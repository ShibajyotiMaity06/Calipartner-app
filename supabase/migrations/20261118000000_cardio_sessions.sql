create table public.cardio_sessions (
  workout_id uuid primary key references public.workouts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('running', 'cycling', 'steps')),
  local_date text not null check (length(local_date) = 10),
  started_at timestamptz not null,
  duration_seconds integer not null check (duration_seconds > 0),
  distance_m integer check (distance_m >= 0),
  step_count integer check (step_count > 0),
  target integer not null check (target > 0),
  estimated_calories integer check (estimated_calories >= 0),
  check (
    (mode = 'steps' and step_count is not null)
    or (mode in ('running', 'cycling') and step_count is null and distance_m is not null and distance_m > 0 and target >= 1000)
  )
);

alter table public.cardio_sessions enable row level security;
create index cardio_sessions_history on public.cardio_sessions (user_id, mode, started_at desc);
revoke all on public.cardio_sessions from public, anon, authenticated;
grant select, insert on public.cardio_sessions to authenticated;
grant select on public.cardio_sessions to service_role;

create policy cardio_sessions_read on public.cardio_sessions
  for select to authenticated using (
    user_id = (select auth.uid())
    and exists (select 1 from public.workouts w where w.id = workout_id and w.deleted_at is null)
  );
create policy cardio_sessions_insert on public.cardio_sessions
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.workouts w
      where w.id = workout_id and w.user_id = (select auth.uid())
        and w.deleted_at is null and w.local_date = cardio_sessions.local_date
        and w.type = case when mode = 'cycling' then 'cardio' else 'walk_run' end
    )
  );
create function public.save_cardio_session(p_changes jsonb, p_session jsonb, p_daily jsonb default null)
returns void language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  session public.cardio_sessions;
  reading_source text := p_daily->>'source';
begin
  select * into session from jsonb_populate_record(null::public.cardio_sessions, p_session);
  if auth.uid() is null or session.user_id is distinct from auth.uid() then
    raise exception 'NOT_AUTHORIZED';
  end if;
  perform public.save_tracking_changes(p_changes);
  insert into public.cardio_sessions select session.*
  on conflict (workout_id) do nothing;

  -- Replay the same session safely without replacing a newer daily reading.
  if found and session.mode = 'steps' then
    if reading_source is null or reading_source not in ('health_platform', 'pedometer') then
      raise exception 'INVALID_STEP_READING';
    end if;
    insert into public.activity_days as day (user_id, local_date, steps, distance_m, source)
    values (session.user_id, session.local_date, (p_daily->>'steps')::integer,
      (p_daily->>'distance_m')::numeric, reading_source)
    on conflict (user_id, local_date) do update set
      steps = case when day.source = excluded.source and excluded.source = 'pedometer'
        then greatest(day.steps, excluded.steps) else excluded.steps end,
      distance_m = case when day.source = excluded.source and excluded.source = 'pedometer'
        then greatest(day.distance_m, excluded.distance_m)
        when day.source <> excluded.source then coalesce(nullif(excluded.distance_m, 0), day.distance_m)
        else excluded.distance_m end,
      source = excluded.source,
      updated_at = now(),
      deleted_at = null
    where day.deleted_at is not null or day.source <> 'health_platform' or excluded.source = 'health_platform';
  end if;
end;
$$;
revoke execute on function public.save_cardio_session(jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.save_cardio_session(jsonb, jsonb, jsonb) to authenticated;

-- Earlier manual sessions have no saved target, step count, or calorie estimate.
create view public.cardio_history with (security_invoker = true) as
select workout_id, user_id, mode, local_date, started_at, duration_seconds,
  distance_m::numeric, step_count, target, estimated_calories
from public.cardio_sessions
union all
select w.id, w.user_id,
  case when lower(w.name) in ('cycling', 'cycling (outdoor gps)') then 'cycling'
    when lower(w.name) = 'walking session' then 'steps' else 'running' end,
  w.local_date, coalesce(w.start_time, w.created_at),
  coalesce(nullif(metrics.duration, 0), w.duration_minutes * 60)::integer,
  nullif(metrics.distance, 0), null::integer, null::integer, null::integer
from public.workouts w
left join lateral (
  select sum(s.duration_seconds) as duration, sum(s.distance_meters) as distance
  from public.workout_sets s where s.workout_id = w.id and s.deleted_at is null and s.completed
) metrics on true
where w.deleted_at is null and w.type in ('cardio', 'walk_run')
  and lower(w.name) in ('running', 'running (outdoor gps)', 'cycling', 'cycling (outdoor gps)', 'walking session')
  and not exists (select 1 from public.cardio_sessions c where c.workout_id = w.id);

revoke all on public.cardio_history from public, anon, authenticated;
grant select on public.cardio_history to authenticated, service_role;
