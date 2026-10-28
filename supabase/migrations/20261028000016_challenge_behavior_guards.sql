insert into public.challenge_config(key,value) values('cheer_daily_limit','5');
do $$ declare definition text;begin
 select pg_get_functiondef('public.challenge_action(uuid,uuid,text,uuid,date,jsonb)'::regprocedure) into definition;
 definition:=replace(definition,' if p_action=''nudge'' and',E' if p_action=''cheer'' and (select count(*) from public.challenge_events where challenge_id=p_id and actor_id=auth.uid() and type=''cheer'' and (created_at at time zone p.tz)::date=v_today)>=(cfg->>''cheer_daily_limit'')::integer then raise exception ''CHEER_LIMIT'';end if;\n if p_action=''nudge'' and');execute definition;
 select pg_get_functiondef('public.challenge_commit_results(uuid,uuid,jsonb,jsonb)'::regprocedure) into definition;
 definition:=replace(definition,'then case when exists(select 1 from public.challenge_participants where challenge_id=p_id and status=''completed'') then ''completed'' else ''finished'' end when start_date', 'then case when c.rules_snapshot->>''format''=''coop'' and exists(select 1 from public.challenge_participants where challenge_id=p_id and status=''finished'') then ''finished'' when exists(select 1 from public.challenge_participants where challenge_id=p_id and status=''completed'') then ''completed'' else ''finished'' end when start_date');execute definition;
 select pg_get_functiondef('public.challenge_occasion_server(uuid,uuid,uuid,uuid,text,date,integer,jsonb,jsonb,jsonb)'::regprocedure) into definition;
 definition:=replace(definition,'p_targets);','p_targets,p_options=>jsonb_build_object(''tasks'',coalesce(p_private->''tasks'',(select to_jsonb(tasks) from public.challenge_templates where id=p_template))));');
 definition:=replace(definition,'private_plan=p_private','private_plan-''tasks''=p_private-''tasks'' and (not private_plan?''tasks'' or private_plan->''tasks''=p_private->''tasks'')');execute definition;
end;$$;
