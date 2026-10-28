-- CH-2/4: trusted server writes; auth-bound reads project only consented fields.
create or replace function public.challenge_create_server(p_actor uuid,p_id uuid,p_template uuid,p_scope text,p_duration integer,p_partners uuid[],p_targets jsonb,p_room uuid default null,p_title text default null,p_forfeit uuid default null,p_start date default null,p_options jsonb default '{}')
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare t public.challenge_templates; c public.challenges; cfg jsonb; lim jsonb; rules jsonb; u uuid; task text; target numeric; v_today date; v_limit integer; v_count integer; v_tasks text[]; v_existing uuid[]; v_tz text;
begin
 if p_actor is null then raise exception 'UNAUTHENTICATED'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_actor::text,73));
 select * into c from public.challenges where id=p_id;
 if found then
   select array_agg(user_id order by user_id) into v_existing from public.challenge_participants where challenge_id=p_id and user_id<>p_actor;
   if c.creator_id is distinct from p_actor or c.template_id<>p_template or c.scope<>p_scope or c.duration_days<>p_duration or c.room_id is distinct from p_room or c.forfeit_id is distinct from p_forfeit or coalesce(c.custom_title,'')<>coalesce(nullif(trim(p_title),''),'') or coalesce(v_existing,'{}')<>array(select x from unnest(coalesce(p_partners,'{}')) x order by x) then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
   return jsonb_build_object('id',p_id);
 end if;
 select jsonb_object_agg(key,value) into cfg from public.challenge_config;
 lim:=public.challenge_plan_config(p_actor);
 select * into t from public.challenge_templates where id=p_template and active;
 if not found then raise exception 'TEMPLATE_UNAVAILABLE'; end if;
 if p_scope not in ('solo','pair','room','season','occasion') or (p_scope<>'occasion' and not p_scope=any(t.scope_options)) then raise exception 'INVALID_SCOPE'; end if;
 if p_duration is null or p_duration<=0 or (p_scope<>'occasion' and not p_duration=any(t.duration_options)) or (p_scope='occasion' and p_duration>(cfg->>'occasion_max_days')::integer) then raise exception 'INVALID_DURATION'; end if;
 if p_scope not in ('season','occasion') and p_duration>(lim->>'duration_max')::integer then raise exception 'PLUS_REQUIRED'; end if;
 if p_scope='occasion' and not (lim->>'custom')::boolean then raise exception 'PLUS_REQUIRED'; end if;
 if t.plan_required='pro' and public.active_room_tier(p_actor)<>'pro' then raise exception 'PRO_REQUIRED'; end if;
 if t.plan_required='plus' and public.active_room_tier(p_actor)='free' then raise exception 'PLUS_REQUIRED'; end if;
 if t.season_id is not null and not exists(select 1 from public.challenge_seasons where id=t.season_id and starts_at<=now() and ends_at>now()) then raise exception 'SEASON_NOT_OPEN';end if;
 if p_scope='season' then
   if t.season_id is null or not exists(select 1 from public.challenge_seasons where id=t.season_id and starts_at<=now() and ends_at>now()) then raise exception 'SEASON_NOT_OPEN'; end if;
   if cardinality(p_partners)>0 then raise exception 'INVALID_PARTICIPANTS'; end if;
 end if;
 if p_scope in ('solo','season') and coalesce(cardinality(p_partners),0)<>0 then raise exception 'INVALID_PARTICIPANTS'; end if;
 if p_scope in ('pair','occasion') and coalesce(cardinality(p_partners),0)<>1 then raise exception 'PARTNER_REQUIRED'; end if;
 if p_scope='room' then
   if p_room is null or not exists(select 1 from public.room_members where room_id=p_room and user_id=p_actor and role='host' and status='active') or not public.room_is_usable(p_room) then raise exception 'HOST_REQUIRED'; end if;
   if public.active_room_tier(p_actor)='free' then raise exception 'PLUS_REQUIRED'; end if;
   if coalesce(cardinality(p_partners),0)<2 then raise exception 'ROOM_CHALLENGE_NEEDS_GROUP'; end if;
 end if;
 if cardinality(p_partners)<>(select count(distinct x) from unnest(p_partners) x) or p_actor=any(p_partners) then raise exception 'INVALID_PARTICIPANTS'; end if;
 foreach u in array coalesce(p_partners,'{}') loop
   if p_scope='room' then
     if not public.is_room_member(p_room,u) then raise exception 'NOT_ROOM_MEMBER'; end if;
   elsif not exists(select 1 from public.friend_requests where status='accepted' and pair_low=least(p_actor,u) and pair_high=greatest(p_actor,u)) and not exists(select 1 from public.room_members a join public.room_members b on a.room_id=b.room_id where a.user_id=p_actor and b.user_id=u and a.status<>'left' and b.status<>'left') then raise exception 'PARTNER_CONSENT_REQUIRED'; end if;
   if exists(select 1 from public.blocks where (blocker_id=p_actor and blocked_id=u) or (blocked_id=p_actor and blocker_id=u)) then raise exception 'USER_BLOCKED'; end if;
 end loop;
 v_limit:=(lim->>case p_scope when 'pair' then 'pair_limit' when 'season' then 'season_limit' when 'room' then 'room_limit' else 'solo_limit' end)::integer;
 select count(*) into v_count from public.challenges x join public.challenge_participants p on p.challenge_id=x.id where p.user_id=p_actor and p.status in ('invited','joined') and x.status in ('invited','scheduled','active') and x.scope=p_scope;
 if v_count>=v_limit then raise exception 'CHALLENGE_LIMIT'; end if;
 if p_title is not null and length(trim(p_title))>0 then
   if not (lim->>'custom')::boolean then raise exception 'PLUS_REQUIRED'; end if;
   if length(trim(p_title))>(cfg->>'title_max_length')::integer or p_title~*'(weight.?loss|lose.{0,12}(kg|pound)|calorie|fasting|burn.{0,8}cal|\$|₹|cash|money)' then raise exception 'UNSAFE_CHALLENGE'; end if;
 end if;
 if p_forfeit is not null and (t.format<>'duel' or not (lim->>'forfeits')::boolean or not exists(select 1 from public.forfeit_cards where id=p_forfeit and active)) then raise exception 'FORFEIT_UNAVAILABLE'; end if;
 select timezone into v_tz from public.profiles where id=p_actor;
 if v_tz is null then raise exception 'PROFILE_REQUIRED'; end if;
 v_today:=(now() at time zone v_tz)::date;
 if p_start is not null and (p_start<v_today+1 or p_start>v_today+(cfg->>'max_start_delay_days')::integer) then raise exception 'INVALID_START_DATE'; end if;
 v_tasks:=t.tasks;
 if t.format='checklist' and p_options?'tasks' then
   select array_agg(value) into v_tasks from jsonb_array_elements_text(p_options->'tasks');
   if cardinality(v_tasks)<(cfg->>'checklist_min')::integer or cardinality(v_tasks)>(cfg->>'checklist_max')::integer or cardinality(v_tasks)<>(select count(distinct x) from unnest(v_tasks) x) then raise exception 'INVALID_TASKS'; end if;
 end if;
 rules:=(cfg->'rules')||t.rule_overrides||jsonb_build_object('format',t.format,'tasks',to_jsonb(v_tasks),'duration_days',p_duration,'pass_days',coalesce((t.rule_overrides->>'pass_days')::integer,p_duration),'weekly_days',coalesce((t.rule_overrides->>'weekly_days')::integer,p_duration),'allow_manual',t.allow_manual,'title_key',t.title_key,'desc_key',t.desc_key,'icon_key',t.icon_key,'chapters',t.chapters,'season_id',t.season_id,'requested_start',coalesce(p_start,v_today+1),'same_target',coalesce((p_options->>'same_target')::boolean,false));
 if coalesce((p_options->>'same_target')::boolean,false) then rules:=rules||jsonb_build_object('same_targets',p_targets);end if;
 if (p_options?'rest_weekdays' or p_options?'allow_manual') and not (lim->>'custom')::boolean then raise exception 'PLUS_REQUIRED';end if;
 if p_options?'rest_weekdays' then
  if exists(select 1 from jsonb_array_elements_text(p_options->'rest_weekdays') d where not (cfg->'rest_weekday_options')?d.value) then raise exception 'INVALID_REST_DAYS';end if;
  rules:=rules||jsonb_build_object('rest_weekdays',p_options->'rest_weekdays');
 end if;
 if p_options?'allow_manual' then rules:=rules||jsonb_build_object('allow_manual',(p_options->>'allow_manual')::boolean);end if;
 foreach task in array v_tasks loop
   if not (rules->'metrics')?task then raise exception 'UNSAFE_CHALLENGE_METRIC'; end if;
   target:=(p_targets->>task)::numeric;
   if target is null or target<(rules->'metrics'->task->>'min')::numeric or target>(rules->'metrics'->task->>'max')::numeric then raise exception 'INVALID_TARGET'; end if;
 end loop;
 if not public.check_rate_limit('challenge_create:'||p_actor::text,(cfg->>'creation_hourly_limit')::integer,3600) then raise exception 'RATE_LIMITED'; end if;
 insert into public.challenges(id,template_id,template_version,rules_snapshot,creator_id,scope,room_id,start_date,end_date,duration_days,status,forfeit_id,custom_title,invite_expires_at)
 values(p_id,t.id,t.version,rules,p_actor,p_scope,p_room,case when cardinality(p_partners)>0 then null else coalesce(p_start,v_today+1) end,case when cardinality(p_partners)>0 then null else coalesce(p_start,v_today+1)+p_duration-1 end,p_duration,case when cardinality(p_partners)>0 then 'invited' else 'scheduled' end,p_forfeit,nullif(trim(p_title),''),now()+make_interval(hours=>(cfg->>'invite_expiry_hours')::integer));
 insert into public.challenge_participants(challenge_id,user_id,status,targets,benefits,tz,start_date,joined_at,board_opt_in)
 values(p_id,p_actor,'joined',p_targets,lim,v_tz,case when cardinality(p_partners)>0 then null else coalesce(p_start,v_today+1) end,now(),coalesce((p_options->>'board_opt_in')::boolean,false));
 foreach u in array coalesce(p_partners,'{}') loop
   insert into public.challenge_participants(challenge_id,user_id,status,benefits,tz) select p_id,u,'invited',public.challenge_plan_config(u),timezone from public.profiles where id=u;
 end loop;
 update public.challenge_counters set joined_count=joined_count+1 where template_id=t.id;
 insert into public.challenge_events(id,challenge_id,actor_id,type) values(p_id,p_id,p_actor,'created');
 insert into public.challenge_dirty_queue(user_id) values(p_actor) on conflict(user_id) do update set updated_at=now();
 return jsonb_build_object('id',p_id);
end; $$;

create or replace function public.challenge_respond_server(p_actor uuid,p_id uuid,p_accept boolean,p_targets jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.challenges;p public.challenge_participants; lim jsonb;cfg jsonb;v_limit integer;v_count integer;task text;target numeric;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_actor::text,73));
 select * into c from public.challenges where id=p_id for update;
 select * into p from public.challenge_participants where challenge_id=p_id and user_id=p_actor;
 if found and p.status='declined' and not p_accept then return jsonb_build_object('id',p_id);end if;
 if not found or p.status not in ('invited','joined') then raise exception 'NOT_CHALLENGE_PARTICIPANT'; end if;
 if p.status='joined' and p_accept then return jsonb_build_object('id',p_id); end if;
 if p.status<>'invited' or c.status<>'invited' then raise exception 'INVITE_UNAVAILABLE'; end if;
 if c.invite_expires_at<=now() then raise exception 'INVITE_EXPIRED'; end if;
 if c.room_id is not null and not public.is_room_member(c.room_id,p_actor) then raise exception 'NOT_ROOM_MEMBER'; end if;
 if exists(select 1 from public.blocks b join public.challenge_participants peer on peer.challenge_id=p_id and peer.status='joined' where (b.blocker_id=p_actor and b.blocked_id=peer.user_id) or (b.blocked_id=p_actor and b.blocker_id=peer.user_id)) then raise exception 'USER_BLOCKED'; end if;
 lim:=public.challenge_plan_config(p_actor);select jsonb_object_agg(key,value) into cfg from public.challenge_config;
 if not p_accept then
   update public.challenge_participants set status='declined' where challenge_id=p_id and user_id=p_actor;
   update public.challenges set status='cancelled',updated_at=now() where id=p_id and scope in ('pair','occasion');
   return jsonb_build_object('id',p_id);
 end if;
 if c.scope in ('pair','occasion') and c.duration_days>(lim->>'duration_max')::integer then raise exception 'PLUS_REQUIRED'; end if;
 if c.forfeit_id is not null and not (lim->>'forfeits')::boolean then raise exception 'PLUS_REQUIRED'; end if;
 v_limit:=(lim->>case c.scope when 'pair' then 'pair_limit' when 'room' then 'room_limit' else 'solo_limit' end)::integer;
 if c.scope<>'room' then
   select count(*) into v_count from public.challenges x join public.challenge_participants a on a.challenge_id=x.id where a.user_id=p_actor and a.status='joined' and x.status in ('invited','scheduled','active') and x.scope=c.scope;
   if v_count>=v_limit then raise exception 'CHALLENGE_LIMIT'; end if;
 end if;
 for task in select jsonb_array_elements_text(c.rules_snapshot->'tasks') loop
   target:=(p_targets->>task)::numeric;
   if target is null or target<(c.rules_snapshot->'metrics'->task->>'min')::numeric or target>(c.rules_snapshot->'metrics'->task->>'max')::numeric then raise exception 'INVALID_TARGET'; end if;
 end loop;
 update public.challenge_participants set status='joined',targets=p_targets,benefits=lim,joined_at=now() where challenge_id=p_id and user_id=p_actor;
 update public.challenge_counters set joined_count=joined_count+1 where template_id=c.template_id;
 if not exists(select 1 from public.challenge_participants where challenge_id=p_id and status='invited') then
   update public.challenge_participants set start_date=greatest((c.rules_snapshot->>'requested_start')::date,(now() at time zone tz)::date+1) where challenge_id=p_id and status='joined';
   update public.challenges set status='scheduled',start_date=(select min(start_date) from public.challenge_participants where challenge_id=p_id),end_date=(select max(start_date)+c.duration_days-1 from public.challenge_participants where challenge_id=p_id),updated_at=now() where id=p_id;
 end if;
 insert into public.challenge_dirty_queue(user_id) select user_id from public.challenge_participants where challenge_id=p_id on conflict(user_id) do update set updated_at=now();
 return jsonb_build_object('id',p_id);
end; $$;
revoke all on function public.challenge_create_server(uuid,uuid,uuid,text,integer,uuid[],jsonb,uuid,text,uuid,date,jsonb),public.challenge_respond_server(uuid,uuid,boolean,jsonb) from public,anon,authenticated;
grant execute on function public.challenge_create_server(uuid,uuid,uuid,text,integer,uuid[],jsonb,uuid,text,uuid,date,jsonb),public.challenge_respond_server(uuid,uuid,boolean,jsonb) to service_role;

-- Source rows never cross an app boundary. Only the trusted scorer can read these aggregates.
create or replace function public.challenge_source_days(p_user uuid,p_from date,p_to date,p_rules jsonb default null)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare cfg jsonb;r jsonb;
begin
 select coalesce(p_rules,value) into cfg from public.challenge_config where key='rules';
 select coalesce(jsonb_agg(jsonb_build_object('local_date',d::date,'values',jsonb_build_object(
 'steps',coalesce(a.steps,0),'distance',coalesce(a.distance_m,0),
 'water_ml',(select coalesce(sum(amount_ml),0) from public.water_logs w where w.user_id=p_user and w.local_date::date=d::date and w.deleted_at is null),
 'workouts_count',(select count(*) from public.workouts w where w.user_id=p_user and w.local_date::date=d::date and w.deleted_at is null and w.duration_minutes>0),
 'workout_minutes',(select coalesce(sum(duration_minutes),0) from public.workouts w where w.user_id=p_user and w.local_date::date=d::date and w.deleted_at is null),
 'food_log_days',case when (select count(distinct meal_section) from public.food_entries f where f.user_id=p_user and f.local_date=d::date and f.deleted_at is null)>=(cfg->>'minimum_meals')::integer then 1 else 0 end,
 'protein_in_range',case when (select coalesce(sum(protein),0) from public.food_entries f where f.user_id=p_user and f.local_date=d::date and f.deleted_at is null) between coalesce(g.protein_grams,0)*(cfg->>'protein_min_pct')::numeric/100 and coalesce(g.protein_grams,0)*(cfg->>'protein_max_pct')::numeric/100 and coalesce(g.protein_grams,0)>0 then 1 else 0 end,
 'focus_minutes',(select coalesce(sum(greatest(0,extract(epoch from (ended_at-started_at))-paused_seconds))/60,0) from public.focus_sessions f where f.user_id=p_user and f.status in ('ended','auto_ended') and (f.started_at at time zone p.timezone)::date=d::date),
 'weigh_in_days',case when exists(select 1 from public.weight_logs w where w.user_id=p_user and w.local_date::date=d::date and w.deleted_at is null) then 1 else 0 end,
 'partner_actions',(select count(*) from public.challenge_events e where e.actor_id=p_user and e.type in ('cheer','nudge') and (e.created_at at time zone p.timezone)::date=d::date)),
 'sources',jsonb_build_object('steps',coalesce(a.source,'none'),'distance',coalesce(a.source,'none'),'water_ml','log','workouts_count','log','workout_minutes','log','food_log_days','log','protein_in_range','log','focus_minutes','timer','weigh_in_days','log','partner_actions','challenge')) order by d),'[]') into r
 from generate_series(p_from::timestamp,p_to::timestamp,interval '1 day') d join public.profiles p on p.id=p_user
 left join public.activity_days a on a.user_id=p_user and a.local_date::date=d::date and a.deleted_at is null
 left join lateral(select protein_grams from public.goal_profiles where user_id=p_user and effective_from<d::date+1 order by effective_from desc limit 1) g on true;
 return r;
end; $$;
revoke all on function public.challenge_source_days(uuid,date,date,jsonb) from public,anon,authenticated;
grant execute on function public.challenge_source_days(uuid,date,date,jsonb) to service_role;

create or replace function public.challenge_engine_input(p_user uuid,p_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare cfg jsonb;r jsonb;
begin
 select jsonb_object_agg(key,value) into cfg from public.challenge_config;
 return jsonb_build_object('now',now(),'config',cfg,'profile',(select jsonb_build_object('timezone',p.timezone,'activity_level',(select activity_level from public.goal_profiles where user_id=p_user order by effective_from desc limit 1),'current_weight',(select current_weight_kg from public.goal_profiles where user_id=p_user order by effective_from desc limit 1),'date_of_birth',p.date_of_birth,'screened',exists(select 1 from public.health_screening h where h.user_id=p_user and (pregnant_or_breastfeeding or has_diabetes_or_medication or has_eating_disorder_history))) from public.profiles p where p.id=p_user),
 'history',public.challenge_source_days(p_user,(now() at time zone (select timezone from public.profiles where id=p_user))::date-(cfg->>'history_days')::integer,(now() at time zone (select timezone from public.profiles where id=p_user))::date-1),
 'challenges',(select coalesce(jsonb_agg(jsonb_build_object('challenge',to_jsonb(c),'participant',to_jsonb(p),'source_days',case when p.start_date is not null then public.challenge_source_days(p_user,p.start_date,p.start_date+c.duration_days-1,c.rules_snapshot) else '[]'::jsonb end,'existing',(select coalesce(jsonb_agg(to_jsonb(d)),'[]') from public.challenge_day_results d where d.challenge_id=c.id and d.user_id=p_user),'pauses',(select coalesce(jsonb_agg(local_date),'[]') from public.challenge_pauses a where a.challenge_id=c.id and a.user_id=p_user))),'[]') from public.challenge_participants p join public.challenges c on c.id=p.challenge_id where p.user_id=p_user and p.status='joined' and c.status in ('scheduled','active','invited') and (p_id is null or c.id=p_id)));
end; $$;
revoke all on function public.challenge_engine_input(uuid,uuid) from public,anon,authenticated;
grant execute on function public.challenge_engine_input(uuid,uuid) to service_role;
