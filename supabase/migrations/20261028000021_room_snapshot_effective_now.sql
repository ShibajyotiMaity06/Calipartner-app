-- A plan confirmed this morning is effective immediately, not tomorrow.
do $$
declare f record;
begin
  for f in select pg_get_functiondef(p.oid) as definition from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='get_room_snapshot'
  loop
    execute replace(replace(replace(f.definition,'effective_from <= v_today::date','effective_from <= now()'),
      '''user_id'', v_m.user_id,','''user_id'', v_m.user_id, ''is_self'', v_m.user_id=v_caller_id,'),
      'v_sum_pct := v_sum_pct + v_pct;' || chr(10) || '    v_active_count := v_active_count + 1;',
      'if v_m.user_id=v_caller_id or (public.active_room_tier(v_caller_id)<>''free'' and coalesce((v_m.privacy_settings->>''share_goal_completion'')::boolean,true)) then' || chr(10) ||
      '      v_sum_pct := v_sum_pct + v_pct; v_active_count := v_active_count + 1;' || chr(10) || '    end if;');
  end loop;
end; $$;
notify pgrst,'reload schema';
