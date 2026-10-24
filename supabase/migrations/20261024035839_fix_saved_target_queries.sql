-- Fix live goal queries without applying the older migration that purges memberships.
-- Keep existing function ACLs, privacy filtering, entitlement checks and safety calculations.
do $repair_targets$
declare
  v_function record;
  v_definition text;
  v_owner text;
begin
  for v_function in
    select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
      and p.proname in ('recompute_daily_summary', 'get_individual_progress', 'get_room_snapshot', 'get_room_progress')
  loop
    v_definition := pg_get_functiondef(v_function.oid);
    -- Preserve the record/output alias expected by the existing functions.
    v_definition := regexp_replace(v_definition,
      '\mselect\s+target_calories([,\s])',
      'select daily_calorie_target as target_calories\1', 'gi');

    if v_function.proname = 'recompute_daily_summary' then
      v_definition := replace(v_definition, 'effective_from <= p_local_date::date',
        'effective_from < ((p_local_date::date + 1)::timestamp at time zone coalesce((select timezone from public.profiles where id = p_user_id), ''UTC''))');
    else
      v_owner := case when v_function.proname = 'get_individual_progress' then 'v_uid' else 'v_m.user_id' end;
      v_definition := regexp_replace(v_definition, '\meffective_from\s*<=\s*v_today(::date)?',
        'effective_from < ((v_today::date + 1)::timestamp at time zone coalesce((select timezone from public.profiles where id = ' || v_owner || '), ''UTC''))', 'g');
    end if;
    execute v_definition;
  end loop;
end;
$repair_targets$;
