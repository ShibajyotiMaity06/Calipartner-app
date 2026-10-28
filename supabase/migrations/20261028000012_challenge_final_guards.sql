-- Occasion timelines use their own configured maximum; shared paid plans still require consent.
do $$ declare definition text;begin
 select pg_get_functiondef('public.challenge_respond_server(uuid,uuid,boolean,jsonb)'::regprocedure) into definition;
 definition:=replace(definition,'c.scope in (''pair'',''occasion'') and c.duration_days', 'c.scope=''pair'' and c.duration_days');
 definition:=replace(definition,' v_limit:=(lim->>case c.scope',E' if c.scope=''occasion'' then\n  if not (lim->>''custom'')::boolean then raise exception ''PLUS_REQUIRED'';end if;\n  if exists(select 1 from public.health_screening where user_id=p_actor and (pregnant_or_breastfeeding or has_diabetes_or_medication or has_eating_disorder_history)) or not exists(select 1 from public.profiles where id=p_actor and date_of_birth<=(now() at time zone timezone)::date-interval ''18 years'') then raise exception ''HEALTH_SCREENING_RESTRICTED'';end if;\n end if;\n v_limit:=(lim->>case c.scope');
 execute definition;
 select pg_get_functiondef('public.challenge_action(uuid,uuid,text,uuid,date,jsonb)'::regprocedure) into definition;
 definition:=replace(definition,' if p_action=''pause'' then',E' if p_action in (''pause'',''cover'',''adjust'') and c.status not in (''active'',''scheduled'') then raise exception ''CHALLENGE_NOT_RUNNING'';end if;\n if p_action=''cover'' and peer.status<>''joined'' then raise exception ''COVER_UNAVAILABLE'';end if;\n if p_action=''pause'' then');
 execute definition;
end;$$;
