-- CH-3/5/6: atomic occasion plans, user-controlled notifications, bounded worker batches.
create or replace function public.challenge_occasion_server(p_actor uuid,p_id uuid,p_template uuid,p_partner uuid,p_event text,p_date date,p_duration integer,p_targets jsonb,p_private jsonb,p_milestones jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare cfg jsonb;result jsonb;today date;m jsonb;
begin
 select jsonb_object_agg(key,value) into cfg from public.challenge_config;
 select (now() at time zone timezone)::date into today from public.profiles where id=p_actor;
 if not exists(select 1 from jsonb_array_elements_text(cfg->'occasion_event_types') t where t.value=p_event) or p_date<=today or p_date>today+(cfg->>'occasion_max_days')::integer-(cfg->>'recovery_days')::integer then raise exception 'INVALID_OCCASION';end if;
 if (exists(select 1 from public.health_screening where user_id=p_actor and (pregnant_or_breastfeeding or has_diabetes_or_medication or has_eating_disorder_history)) or not exists(select 1 from public.profiles where id=p_actor and date_of_birth<=today-interval '18 years')) then raise exception 'HEALTH_SCREENING_RESTRICTED';end if;
 if exists(select 1 from public.occasion_plans where id=p_id) then
  if not exists(select 1 from public.occasion_plans where id=p_id and creator_id=p_actor and event_type=p_event and event_date=p_date and private_plan=p_private) then raise exception 'IDEMPOTENCY_CONFLICT';end if;
  return jsonb_build_object('id',p_id);
 end if;
 result:=public.challenge_create_server(p_actor,p_id,p_template,'occasion',p_duration,array[p_partner],p_targets);
 update public.challenges set rules_snapshot=rules_snapshot||jsonb_build_object('event_date',p_date,'event_week_days',cfg->'event_week_days','event_week_factor',cfg->'event_week_factor','recovery_days',cfg->'recovery_days') where id=p_id;
 insert into public.occasion_plans(id,creator_id,event_type,event_date,private_plan) values(p_id,p_actor,p_event,p_date,p_private);
 for m in select value from jsonb_array_elements(p_milestones) loop
  insert into public.occasion_milestones(plan_id,week,local_date,habit_factor,private_weight) values(p_id,(m->>'week')::integer,(m->>'date')::date,(m->>'habit_factor')::numeric,(m->>'weight')::numeric);
 end loop;
 return result;
end;$$;
revoke all on function public.challenge_occasion_server(uuid,uuid,uuid,uuid,text,date,integer,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.challenge_occasion_server(uuid,uuid,uuid,uuid,text,date,integer,jsonb,jsonb,jsonb) to service_role;

create or replace function public.challenge_notification_preference(p_id uuid,p_enabled boolean)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.challenge_has_access(p_id) then raise exception 'NOT_CHALLENGE_PARTICIPANT';end if;
 update public.challenge_participants set notify_partner=p_enabled where challenge_id=p_id and user_id=auth.uid();
end;$$;
revoke all on function public.challenge_notification_preference(uuid,boolean) from public,anon;
grant execute on function public.challenge_notification_preference(uuid,boolean) to authenticated;

create or replace function public.challenge_worker_users()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare n integer;r jsonb;last_id uuid;
begin
 select (value#>>'{}')::integer into n from public.challenge_config where key='worker_batch';
 select cursor into last_id from public.challenge_job_config where id;
 select coalesce(jsonb_agg(user_id order by user_id),'[]') into r from (select distinct p.user_id from public.challenge_participants p join public.challenges c on c.id=p.challenge_id where p.status='joined' and c.status in ('scheduled','active') and (last_id is null or p.user_id>last_id) order by p.user_id limit n) batch;
 update public.challenge_job_config set cursor=case when jsonb_array_length(r)<n then null else (r->>(jsonb_array_length(r)-1))::uuid end where id;
 return r;
end;$$;
revoke all on function public.challenge_worker_users() from public,anon,authenticated;
grant execute on function public.challenge_worker_users() to service_role;

-- Do not retain health detail in abandoned invitations or analytics. Deleted actors are anonymous.
create or replace function public.challenge_profile_timezone_changed()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if old.timezone is distinct from new.timezone then
  update public.challenge_participants set tz=new.timezone where user_id=new.id and status='joined';
  insert into public.challenge_dirty_queue(user_id) values(new.id) on conflict(user_id) do update set updated_at=now();
 end if;
 return new;
end;$$;
revoke all on function public.challenge_profile_timezone_changed() from public,anon,authenticated;
create trigger challenge_timezone_update after update of timezone on public.profiles for each row execute function public.challenge_profile_timezone_changed();
