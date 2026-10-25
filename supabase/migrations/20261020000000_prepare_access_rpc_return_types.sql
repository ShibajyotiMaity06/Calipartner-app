-- Fresh replay fix: the next historical migration changes these access RPCs
-- from boolean to jsonb. PostgreSQL requires dropping the old signatures first.
-- Already-upgraded databases are untouched. The next migration restores grants.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as signature from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname in ('check_ai_coach_access','check_partner_finder_access')
      and pg_get_function_identity_arguments(p.oid)='p_user_id uuid'
      and p.prorettype='boolean'::regtype
  loop
    execute format('drop function %s',f.signature);
  end loop;
end; $$;
