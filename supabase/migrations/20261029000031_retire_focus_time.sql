-- Owner correction: retire Focus Time everywhere while preserving historical records privately.
-- Remove client and worker access; no historical table or committed migration is deleted.
do $$ declare f record; t text; begin
  for f in select p.oid::regprocedure signature from pg_proc p
    where p.pronamespace='public'::regnamespace and p.proname like '%focus%'
  loop
    execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
  end loop;
  foreach t in array array['focus_sessions','focus_settings','room_focus_sessions','room_focus_participants'] loop
    execute format('revoke all on table public.%I from anon,authenticated,service_role',t);
    if exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
      execute format('alter publication supabase_realtime drop table public.%I',t);
    end if;
  end loop;
  if to_regclass('cron.job') is not null then
    execute $job$select cron.unschedule(jobid) from cron.job
      where jobname='process_focus_maintenance_job' or command like '%process_focus_maintenance%'$job$;
  end if;
end; $$;

drop trigger if exists challenge_source_changed on public.focus_sessions;

-- Preserve the pre-retirement privacy validator internally, so all other privacy rules stay exact.
do $$ declare definition text; begin
  select pg_get_functiondef('public.default_privacy_settings()'::regprocedure) into definition;
  execute replace(definition,'public.default_privacy_settings(','public.legacy_privacy_defaults(');
  select pg_get_functiondef('public.sanitize_privacy_settings(jsonb)'::regprocedure) into definition;
  execute replace(definition,'public.sanitize_privacy_settings(','public.legacy_privacy_sanitize(');
end; $$;
revoke all on function public.legacy_privacy_defaults() from public,anon,authenticated,service_role;
revoke all on function public.legacy_privacy_sanitize(jsonb) from public,anon,authenticated,service_role;
create or replace function public.default_privacy_settings()
returns jsonb language sql immutable security definer set search_path=public,pg_temp as $$
  select public.legacy_privacy_defaults()-array['share_focus_status','share_focus_label','focus_status','focus_label'];
$$;
create or replace function public.sanitize_privacy_settings(p_settings jsonb)
returns jsonb language sql immutable security definer set search_path=public,pg_temp as $$
  select public.legacy_privacy_sanitize(p_settings)-array['share_focus_status','share_focus_label','focus_status','focus_label'];
$$;
update public.room_members set privacy_settings=privacy_settings-array['share_focus_status','share_focus_label','focus_status','focus_label']
  where privacy_settings ?| array['share_focus_status','share_focus_label','focus_status','focus_label'];

-- Retired metrics are unavailable to new challenges; old challenges stay archived and unexposed.
update public.challenge_templates set active=false where 'focus_minutes'=any(tasks);
update public.challenges set status='cancelled',updated_at=now()
  where rules_snapshot->'tasks' ? 'focus_minutes' and status in ('invited','scheduled','active');
update public.challenge_config set value=jsonb_set(value,'{metrics}',(value->'metrics')-'focus_minutes') where key='rules';
do $$ declare definition text; begin
  select pg_get_functiondef('public.challenge_has_access(uuid)'::regprocedure) into definition;
  definition:=replace(definition,'where p.challenge_id=p_id and p.user_id=auth.uid()',
    'where p.challenge_id=p_id and not (c.rules_snapshot->''tasks'' ? ''focus_minutes'') and p.user_id=auth.uid()');
  execute definition;

  select pg_get_functiondef('public.challenge_catalog()'::regprocedure) into definition;
  definition:=replace(definition,'from public.challenge_texts)',
    'from public.challenge_texts where key not like ''template.focus-%'')');
  execute definition;

  select pg_get_functiondef('public.challenge_home()'::regprocedure) into definition;
  definition:=replace(definition,'where p.user_id=auth.uid() and p.status not in',
    'where p.user_id=auth.uid() and not (c.rules_snapshot->''tasks'' ? ''focus_minutes'') and p.status not in');
  execute definition;

  select pg_get_functiondef('public.challenge_maintenance()'::regprocedure) into definition;
  definition:=replace(definition,'where p.status in (''joined'',''completed'',''finished'') and p.start_date',
    'where not (c.rules_snapshot->''tasks'' ? ''focus_minutes'') and p.status in (''joined'',''completed'',''finished'') and p.start_date');
  definition:=replace(definition,'where r.sent_at is null and s.starts_at',
    'where not (''focus_minutes''=any(t.tasks)) and r.sent_at is null and s.starts_at');
  execute definition;

  select pg_get_functiondef('public.challenge_notify(uuid,uuid,text,text,jsonb)'::regprocedure) into definition;
  definition:=replace(definition,'if exists(select 1 from public.challenge_notifications where event_key=p_key)',
    'if exists(select 1 from public.challenges where id=p_id and rules_snapshot->''tasks'' ? ''focus_minutes'') then return false; end if; if exists(select 1 from public.challenge_notifications where event_key=p_key)');
  execute definition;

  select pg_get_functiondef('public.challenge_snapshot(uuid)'::regprocedure) into definition;
  definition:=replace(definition,'select * into c from public.challenges where id=p_id;',
    'select * into c from public.challenges where id=p_id; if c.rules_snapshot->''tasks'' ? ''focus_minutes'' then raise exception ''CHALLENGE_RETIRED''; end if;');
  execute definition;

  select pg_get_functiondef('public.challenge_engine_input(uuid,uuid)'::regprocedure) into definition;
  definition:=replace(definition,'where p.user_id=p_user and p.status=''joined''',
    'where p.user_id=p_user and not (c.rules_snapshot->''tasks'' ? ''focus_minutes'') and p.status=''joined''');
  execute definition;

  select pg_get_functiondef('public.challenge_source_days(uuid,date,date,jsonb)'::regprocedure) into definition;
  definition:=regexp_replace(definition,'''focus_minutes'',\(select[^\n]+public\.focus_sessions[^\n]+\),\s*','','g');
  definition:=replace(definition,'''focus_minutes'',''timer'',','');
  if definition like '%public.focus_sessions%' then raise exception 'Retired source still present'; end if;
  execute definition;
end; $$;

create or replace function public.skip_retired_activity_push()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  if new.notification_type='focus_session' or exists(select 1 from public.challenges c
    where c.rules_snapshot->'tasks' ? 'focus_minutes' and position('challenge='||c.id::text in coalesce(new.data->>'url',''))>0)
  then new.status:='skipped'; new.skip_reason:='FEATURE_RETIRED'; end if;
  return new;
end; $$;
revoke all on function public.skip_retired_activity_push() from public,anon,authenticated;
create trigger skip_retired_activity_push before insert or update on public.push_notification_queue
for each row execute function public.skip_retired_activity_push();
update public.push_notification_queue set status='skipped',skip_reason='FEATURE_RETIRED'
  where status in ('pending','processing') and (notification_type='focus_session' or exists(select 1 from public.challenges c
    where c.rules_snapshot->'tasks' ? 'focus_minutes' and position('challenge='||c.id::text in coalesce(data->>'url',''))>0));

notify pgrst,'reload schema';
