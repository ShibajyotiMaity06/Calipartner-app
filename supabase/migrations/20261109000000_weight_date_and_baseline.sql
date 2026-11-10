-- Weight dates follow the owner's stored day, including direct and tracking RPC writes.
create or replace function public.validate_weight_log_date()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare
  zone text;
  parsed date;
begin
  if new.deleted_at is not null then return new; end if;
  select timezone into zone from public.profiles where id = new.user_id;
  begin
    parsed := new.local_date::date;
  exception when others then
    raise exception 'INVALID_WEIGHT_DATE' using errcode = '22007';
  end;
  if new.local_date !~ '^\d{4}-\d{2}-\d{2}$'
    or to_char(parsed, 'YYYY-MM-DD') <> new.local_date
    or parsed > (now() at time zone coalesce(zone, 'UTC'))::date then
    raise exception 'INVALID_WEIGHT_DATE' using errcode = '22007';
  end if;
  return new;
end;
$$;
revoke all on function public.validate_weight_log_date() from public;
create trigger validate_weight_log_date before insert or update on public.weight_logs
for each row execute function public.validate_weight_log_date();

-- Preserve the original onboarding baseline when the first recorded weigh-in is today.
do $$
declare definition text;
begin
  select pg_get_functiondef('public.get_individual_progress(text)'::regprocedure) into definition;
  if position('-- Weight: raw entries and start/current weight' in definition) = 0 then
    raise exception 'Progress baseline patch does not match the current function';
  end if;
  definition := replace(definition,
    'select weight_kg into v_start_weight
  from public.weight_logs
  where user_id = v_uid and deleted_at is null
  order by local_date asc, logged_at asc limit 1;',
    'select coalesce(
      (select current_weight_kg from public.goal_profiles where user_id = v_uid order by effective_from asc, created_at asc limit 1),
      (select weight_kg from public.weight_logs where user_id = v_uid and deleted_at is null order by local_date asc, logged_at asc limit 1)
    ) into v_start_weight;');
  execute definition;
end;
$$;
