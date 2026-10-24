-- TAP-compatible regression, with every fixture rolled back. No production account is modified.
begin;
select '1..5' as tap;
insert into auth.users(id,email) values ('c9210000-0000-4000-8000-000000000001', 'saved-target-query@example.invalid');
insert into public.profiles(id,username,nickname,date_of_birth,sex,height_cm,timezone)
values ('c9210000-0000-4000-8000-000000000001','saved_target_proof','Target proof','1990-01-01','male',180,'Asia/Kolkata');
insert into public.goal_profiles(id,user_id,goal,activity_level,current_weight_kg,weekly_rate_kg,daily_calorie_target,protein_grams,fat_grams,carb_grams,bmr,tdee,effective_from)
values ('c9210000-0000-4000-8000-000000000002','c9210000-0000-4000-8000-000000000001','cut','moderate',83,0.5,2317,166,73,248,1800,2867,now());
insert into public.water_logs(id,user_id,amount_ml,local_date,logged_at)
values ('c9210000-0000-4000-8000-000000000003','c9210000-0000-4000-8000-000000000001',250,to_char(now() at time zone 'Asia/Kolkata','YYYY-MM-DD'),now());
do $assert_summary$
begin
  if (select target_calories from public.daily_summaries where user_id='c9210000-0000-4000-8000-000000000001') is distinct from 2317::numeric then
    raise exception 'Summary did not use the saved same-day target';
  end if;
end;
$assert_summary$;
select case when (select target_calories from public.daily_summaries where user_id='c9210000-0000-4000-8000-000000000001') = 2317
  then 'ok 1 - current-day custom calories are used by summary triggers' else 'not ok 1 - saved calories replaced by fallback' end as tap;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"c9210000-0000-4000-8000-000000000001","role":"authenticated"}';
do $assert_saved_targets$
declare
  v_progress jsonb := public.get_individual_progress('7d');
begin
  if (v_progress->'macros'->>'protein_target_g')::numeric is distinct from 166::numeric then
    raise exception 'Custom protein was not restored';
  end if;
  if (v_progress->'calories'->>'average_target')::numeric is distinct from 2317::numeric then
    raise exception 'Custom calories were not restored on the same local day';
  end if;
end;
$assert_saved_targets$;
select case when (public.get_individual_progress('7d')->'macros'->>'protein_target_g')::numeric = 166
  then 'ok 2 - progress restores custom protein' else 'not ok 2 - progress protein differs from saved target' end as tap;
select case when (public.get_individual_progress('7d')->'calories'->>'average_target')::numeric = 2317
  then 'ok 3 - progress restores custom calories on the same local day' else 'not ok 3 - progress calorie target differs' end as tap;
reset role;
insert into public.remote_config(key,value,description) values ('account_tracking_reset',jsonb_build_object('epoch','test-reset','reset_at',now()-interval '1 second'),'Rollback-only test marker')
on conflict (key) do update set value=excluded.value;
do $reject_old$
begin
  begin
    insert into public.water_logs(id,user_id,amount_ml,local_date,logged_at,created_at)
    values ('c9210000-0000-4000-8000-000000000004','c9210000-0000-4000-8000-000000000001',250,current_date,now(),now()-interval '1 day');
    raise exception 'Pre-reset data was accepted';
  exception when check_violation then null;
  end;
end;
$reject_old$;
select 'ok 4 - stale offline records cannot restore deleted tracking' as tap;
insert into public.water_logs(id,user_id,amount_ml,local_date,logged_at)
values ('c9210000-0000-4000-8000-000000000005','c9210000-0000-4000-8000-000000000001',250,to_char(now() at time zone 'Asia/Kolkata','YYYY-MM-DD'),now());
select 'ok 5 - newly entered tracking remains writable after a reset' as tap;
rollback;
