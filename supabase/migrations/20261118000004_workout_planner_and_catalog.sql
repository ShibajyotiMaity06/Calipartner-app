-- A manually assembled week uses the same private routine, revision and retry log.
-- Manual saves never consume or reset AI build history.
create function public.save_custom_workout_plan(p_id uuid,p_plan_id uuid,p_revision integer,p_content jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=auth.uid(); payload jsonb; previous public.workout_plan_edits; plan public.workout_plans;
begin
 if actor is null then raise exception 'UNAUTHENTICATED'; end if;
 if public.workout_plan_tier(actor)='free' then raise exception 'PURCHASED_PLUS_REQUIRED'; end if;
 if p_id is null or not public.valid_workout_routine(p_content) or not exists(
  select 1 from jsonb_array_elements(p_content->'days') d where jsonb_array_length(d->'exercises')>0
 ) then raise exception 'INVALID_WORKOUT_PLAN'; end if;
 payload:=jsonb_build_object('kind','custom','plan_id',p_plan_id,'revision',p_revision,'content',p_content);
 perform pg_advisory_xact_lock(hashtextextended(actor::text,188));
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,189));
 select * into previous from public.workout_plan_edits where id=p_id;
 if found then
  if previous.user_id<>actor or previous.payload<>payload then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
  return public.get_workout_plan();
 end if;
 select * into plan from public.workout_plans where user_id=actor for update;
 if plan.id is distinct from p_plan_id or coalesce(plan.revision,0) is distinct from p_revision then
  raise exception 'PLAN_STALE';
 end if;
 if plan.id is null then
  insert into public.workout_plans(user_id,id,preferences,content)
  values(actor,p_id,'{}'::jsonb,p_content);
 else
  update public.workout_plans set content=p_content,revision=revision+1,updated_at=now() where user_id=actor;
 end if;
 insert into public.workout_plan_edits(id,user_id,payload) values(p_id,actor,payload);
 return public.get_workout_plan();
end; $$;
revoke all on function public.save_custom_workout_plan(uuid,uuid,integer,jsonb) from public,anon;
grant execute on function public.save_custom_workout_plan(uuid,uuid,integer,jsonb) to authenticated;

-- A standalone first AI build starts the Pro cooldown. An imported or initial
-- onboarding plan still carries the immediate post-onboarding rebuild.
create function public.last_workout_ai_rebuild(p_user_id uuid)
returns timestamptz language sql stable set search_path=public,pg_temp as $$
 select max(b.completed_at)
 from public.workout_plan_builds b
 where b.user_id=p_user_id and b.state='complete' and (
  b.kind='rebuild' or (
   b.kind='initial' and (
    b.preferences ? 'ai_workout_split' or (b.tier<>'free' and not exists(
     select 1 from public.weekly_plan_requests p
     where p.user_id=b.user_id and p.state='complete' and p.created_at<=b.created_at
      and p.preferences-'plan_scope'=b.preferences
    ))
   )
  )
 );
$$;
revoke all on function public.last_workout_ai_rebuild(uuid) from public,anon,authenticated;

do $$
declare definition text; identity regprocedure; old_uses text;
begin
 foreach identity in array array[
  'public.get_workout_plan()'::regprocedure,
  'public.reserve_workout_plan(uuid,uuid,jsonb,boolean)'::regprocedure,
  'public.finish_workout_plan(uuid,uuid,uuid,jsonb)'::regprocedure
 ] loop
  definition:=pg_get_functiondef(identity);
  if position('max(completed_at)' in definition)=0 then raise exception 'WORKOUT_COOLDOWN_CHANGED'; end if;
  old_uses:=case when identity='public.get_workout_plan()'::regprocedure then 'auth.uid()' else 'p_user_id' end;
  definition:=replace(definition,'max(completed_at)','public.last_workout_ai_rebuild('||old_uses||')');
  definition:=replace(definition,'p_preferences ? ''workout_split''','(p_preferences ? ''workout_split'' or p_preferences ? ''ai_workout_split'')');
  definition:=replace(definition,'request.preferences ? ''workout_split''','(request.preferences ? ''workout_split'' or request.preferences ? ''ai_workout_split'')');
  if identity='public.get_workout_plan()'::regprocedure then
   definition:=replace(definition,'prefs:=plan.preferences;', 'prefs:=nullif(plan.preferences,''{}''::jsonb);');
   definition:=replace(definition,'plan.id is null and prefs is null and not exists','plan.id is null and not exists');
  end if;
  execute definition;
 end loop;
 definition:=pg_get_functiondef('public.valid_workout_routine(jsonb)'::regprocedure);
 if position('''legpress'',''treadmill''' in definition)=0 then raise exception 'WORKOUT_EQUIPMENT_CHANGED'; end if;
 execute replace(definition,'''legpress'',''treadmill''','''legpress'',''machine'',''treadmill''');
end; $$;

-- Existing library IDs are kept. Add missing shared entries with stable seed IDs.
update public.exercises
set name='Skull Crushers',updated_at=now()
where id='00000000-0000-0000-0000-000000000127' and owner_id is null
 and not exists(select 1 from public.exercises where owner_id is null and deleted_at is null and lower(name)='skull crushers');
insert into public.exercises(id,name,muscle_group,equipment,type,attribution)
select item.id::uuid,item.name,item.muscle_group,item.equipment,'strength','CaliPartner Open Exercise Library (CC-BY-4.0)'
from (values
 ('a6111800-0000-4000-8000-000000000001','Smith Machine Bench Press','chest','machine'),
 ('a6111800-0000-4000-8000-000000000002','Smith Machine Squat','legs','machine'),
 ('a6111800-0000-4000-8000-000000000003','Seated Chest Press','chest','machine'),
 ('a6111800-0000-4000-8000-000000000004','Pec Deck Machine','chest','machine'),
 ('a6111800-0000-4000-8000-000000000005','Skull Crushers','arms','barbell'),
 ('a6111800-0000-4000-8000-000000000006','Incline Bench Press','chest','barbell'),
 ('a6111800-0000-4000-8000-000000000007','Decline Bench Press','chest','barbell')
) as item(id,name,muscle_group,equipment)
where not exists (
 select 1 from public.exercises e where e.owner_id is null and e.deleted_at is null and
 lower(e.name)=lower(item.name)
)
on conflict(id) do nothing;
notify pgrst,'reload schema';
