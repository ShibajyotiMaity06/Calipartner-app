do $$ declare definition text;begin
 select pg_get_functiondef('public.challenge_create_server(uuid,uuid,uuid,text,integer,uuid[],jsonb,uuid,text,uuid,date,jsonb)'::regprocedure) into definition;
 definition:=replace(definition,' if t.format=''checklist'' and p_options?''tasks'' then',E' if t.format=''checklist'' and p_options?''tasks'' and p_options->''tasks''<>to_jsonb(t.tasks) and not (lim->>''custom'')::boolean then raise exception ''PLUS_REQUIRED'';end if;\n if t.format=''checklist'' and p_options?''tasks'' then');execute definition;
 select pg_get_functiondef('public.challenge_catalog()'::regprocedure) into definition;
 definition:=replace(definition,'''host'',m.role=''host'',''count''','''host'',m.role=''host'',''member_ids'',(select coalesce(jsonb_agg(rm.user_id),''[]'') from public.room_members rm where rm.room_id=r.id and rm.status in (''active'',''paused'')),''count''');execute definition;
end;$$;
