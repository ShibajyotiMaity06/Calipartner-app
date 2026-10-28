-- Pending/accepted room snapshots must use the canonical goal target column.
-- Some hosted projects do not have the historical target_calories compatibility alias.
do $$
declare f record;
begin
  for f in
    select pg_get_functiondef(p.oid) as definition
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='get_room_snapshot'
  loop
    if position('select target_calories into v_target_kcal' in f.definition)>0 then
      execute replace(f.definition,'select target_calories into v_target_kcal','select daily_calorie_target into v_target_kcal');
    end if;
  end loop;
end; $$;
notify pgrst, 'reload schema';
