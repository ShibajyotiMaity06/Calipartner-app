create or replace function public.challenge_snapshot(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare c public.challenges; viewer public.challenge_participants;details boolean;members jsonb;v_now timestamptz:=now();
begin
 if not public.challenge_has_access(p_id) then raise exception 'NOT_CHALLENGE_PARTICIPANT'; end if;
 select * into c from public.challenges where id=p_id;
 select * into viewer from public.challenge_participants where challenge_id=p_id and user_id=auth.uid();
 details:=c.scope<>'room' or coalesce((viewer.benefits->>'custom')::boolean,false) or public.active_room_tier(auth.uid())<>'free';
 select coalesce(jsonb_agg(jsonb_build_object('id',case when p.status in ('left','declined') then null else p.user_id end,'self',p.user_id=auth.uid(),
 'name',case when p.status in ('left','declined') then null else pr.nickname end,'avatar_url',case when p.status in ('left','declined') then null else pr.avatar_url end,'status',p.status,
 'percent',case when p.user_id=auth.uid() then coalesce(p.summary->'today_percent','0') when p.status in ('invited','left','declined') or viewer.status='invited' or p.comparison_opt_out or not details then '"locked"'::jsonb else coalesce(p.summary->'today_percent','0') end,
 'overall_percent',case when p.user_id=auth.uid() then coalesce(p.summary->'percent','0') when p.status in ('invited','left','declined') or viewer.status='invited' or p.comparison_opt_out or not details then '"locked"'::jsonb else coalesce(p.summary->'percent','0') end,
 'summary',case when p.user_id=auth.uid() then p.summary else null end,
 'days',case when p.user_id=auth.uid() then (select coalesce(jsonb_agg(jsonb_build_object('local_date',d.local_date,'day_index',d.day_index,'percent',d.percent,'status',d.status,'verified',d.verified,'finalized',d.finalized,'tasks',d.source) order by d.local_date),'[]') from public.challenge_day_results d where d.challenge_id=p_id and d.user_id=p.user_id) when p.comparison_opt_out or not details or viewer.status='invited' or p.status in ('invited','left','declined') then null else (select coalesce(jsonb_agg(jsonb_build_object('local_date',d.local_date,'day_index',d.day_index,'percent',d.percent,'status',d.status) order by d.local_date),'[]') from public.challenge_day_results d where d.challenge_id=p_id and d.user_id=p.user_id) end) order by p.user_id<>auth.uid(),p.joined_at),'[]') into members
 from public.challenge_participants p left join public.profiles pr on pr.id=p.user_id where p.challenge_id=p_id;
 return jsonb_build_object('now',v_now,'today_date',(v_now at time zone viewer.tz)::date,'challenge',to_jsonb(c)-'creator_id','participants',members,'self',jsonb_build_object('status',viewer.status,'targets',viewer.targets,'benefits',viewer.benefits,'start_date',viewer.start_date,'tz',viewer.tz,'shields',viewer.shields,'pause_days_used',viewer.pause_days_used,'cover_used',viewer.cover_used,'target_adjusted',viewer.target_adjusted,'comparison_opt_out',viewer.comparison_opt_out,'board_opt_in',viewer.board_opt_in,'muted',viewer.muted,'notify_partner',viewer.notify_partner),
 'details_locked',not details,'day',case when viewer.start_date is null then 0 else greatest(0,least(c.duration_days,(v_now at time zone viewer.tz)::date-viewer.start_date+1)) end,
 'team_percent',case when not details or viewer.status='invited' or exists(select 1 from public.challenge_participants where challenge_id=p_id and status in ('joined','completed','finished') and comparison_opt_out) then '"locked"'::jsonb else to_jsonb((select coalesce(avg(least(100,(summary->>'percent')::numeric)),0) from public.challenge_participants where challenge_id=p_id and status in ('joined','completed','finished'))) end,
 'forfeit_key',case when coalesce((viewer.benefits->>'forfeits')::boolean,false) or public.active_room_tier(auth.uid())<>'free' then (select text_key from public.forfeit_cards where id=c.forfeit_id) else null end,
 'events',(select coalesce(jsonb_agg(item order by stamp desc),'[]') from (select e.created_at stamp,jsonb_build_object('id',e.id,'type',e.type,'actor',case when p.status not in ('left','declined') then pr.nickname else null end,'at',e.created_at,'params',e.params-'private'-'target') item from public.challenge_events e left join public.challenge_participants p on p.challenge_id=p_id and p.user_id=e.actor_id left join public.profiles pr on pr.id=e.actor_id where e.challenge_id=p_id and (e.actor_id=auth.uid() or (viewer.status<>'invited' and not coalesce(p.comparison_opt_out,false) and p.status not in ('left','declined'))) order by e.created_at desc limit 100) feed),
 'occasion',(select jsonb_build_object('event_type',o.event_type,'event_date',o.event_date,'private_plan',case when o.creator_id=auth.uid() then o.private_plan else null end,'milestones',(select coalesce(jsonb_agg(jsonb_build_object('week',m.week,'date',m.local_date,'habit_factor',m.habit_factor,'status',m.status,'weight',case when o.creator_id=auth.uid() then m.private_weight else null end) order by week),'[]') from public.occasion_milestones m where m.plan_id=p_id)) from public.occasion_plans o where id=p_id));
end; $$;
revoke all on function public.challenge_snapshot(uuid) from public,anon;
grant execute on function public.challenge_snapshot(uuid) to authenticated;

create or replace function public.challenge_home()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
 return jsonb_build_object('catalog',public.challenge_catalog(),'items',(select coalesce(jsonb_agg(public.challenge_snapshot(c.id) order by c.created_at desc),'[]') from public.challenges c join public.challenge_participants p on p.challenge_id=c.id where p.user_id=auth.uid() and p.status not in ('left','declined') and (c.room_id is null or public.is_room_member(c.room_id,auth.uid()))),
 'reminders',(select coalesce(jsonb_agg(template_id),'[]') from public.challenge_reminders where user_id=auth.uid()));
end; $$;
revoke all on function public.challenge_home() from public,anon;
grant execute on function public.challenge_home() to authenticated;

create or replace function public.challenge_commit_results(p_actor uuid,p_id uuid,p_days jsonb,p_summary jsonb)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.challenges;p public.challenge_participants;d jsonb;b public.badges;badge_ok boolean;v_type text;
begin
 select * into c from public.challenges where id=p_id for update;
 select * into p from public.challenge_participants where challenge_id=p_id and user_id=p_actor for update;
 if not found or p.status<>'joined' or c.status not in ('scheduled','active') or p.start_date is null then return; end if;
 if c.room_id is not null and not public.is_room_member(c.room_id,p_actor) then return; end if;
 if jsonb_array_length(p_days)<>c.duration_days then raise exception 'INVALID_RESULTS'; end if;
 for d in select value from jsonb_array_elements(p_days) loop
   if (d->>'local_date')::date<p.start_date or (d->>'local_date')::date>=p.start_date+c.duration_days then raise exception 'INVALID_RESULTS'; end if;
   insert into public.challenge_day_results(challenge_id,user_id,local_date,day_index,value,target,percent,status,source,verified,finalized)
   values(p_id,p_actor,(d->>'local_date')::date,(d->>'day_index')::integer,(d->>'value')::numeric,(d->>'target')::numeric,(d->>'percent')::numeric,d->>'status',d->'tasks',(d->>'verified')::boolean,(d->>'finalized')::boolean)
   on conflict(challenge_id,user_id,local_date) do update set value=excluded.value,target=excluded.target,percent=excluded.percent,status=excluded.status,source=excluded.source,verified=excluded.verified,finalized=excluded.finalized,updated_at=now()
   where not challenge_day_results.finalized;
   if d->>'status'='pass' then
     insert into public.challenge_events(id,challenge_id,actor_id,type,params) values(md5(p_id::text||p_actor::text||(d->>'local_date')||'pass')::uuid,p_id,p_actor,'day_passed',jsonb_build_object('date',d->>'local_date')) on conflict(id) do nothing;
   end if;
 end loop;
 update public.challenge_participants set summary=p_summary,shields=greatest(0,(p_summary->>'shields')::integer),status=case when p_summary->>'outcome' in ('completed','finished') then p_summary->>'outcome' else status end where challenge_id=p_id and user_id=p_actor;
 update public.challenges set status=case when not exists(select 1 from public.challenge_participants where challenge_id=p_id and status='joined') then case when exists(select 1 from public.challenge_participants where challenge_id=p_id and status='completed') then 'completed' else 'finished' end when start_date<=(now() at time zone p.tz)::date then 'active' else status end,updated_at=now() where id=p_id;
 if p_summary->>'outcome' in ('completed','finished') then
   insert into public.challenge_events(id,challenge_id,actor_id,type) values(md5(p_id::text||p_actor::text||'finish')::uuid,p_id,p_actor,p_summary->>'outcome') on conflict(id) do nothing;
   if p_summary->>'outcome'='completed' then
     update public.challenge_counters set completed_count=completed_count+1 where template_id=c.template_id;
     for b in select * from public.badges loop
       badge_ok:=(not (b.rule?'duration_min') or c.duration_days>=(b.rule->>'duration_min')::integer) and (not (b.rule?'cover_used') or p.cover_used>=(b.rule->>'cover_used')::integer) and (not (b.rule?'season') or c.rules_snapshot->>'season_id' is not null);
       if badge_ok and (b.plan_required='free' or coalesce((p.benefits->>'custom')::boolean,false)) then insert into public.user_badges(user_id,badge_id,challenge_id) values(p_actor,b.id,p_id) on conflict do nothing; end if;
     end loop;
   end if;
 end if;
end; $$;
revoke all on function public.challenge_commit_results(uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.challenge_commit_results(uuid,uuid,jsonb,jsonb) to service_role;

create or replace function public.challenge_action(p_client_id uuid,p_id uuid,p_action text,p_target uuid default null,p_date date default null,p_value jsonb default '{}')
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.challenges;p public.challenge_participants;peer public.challenge_participants;cfg jsonb;e public.challenge_events;task text;v numeric;lim jsonb;v_today date;
begin
 if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
 select * into e from public.challenge_events where id=p_client_id;
 if found then
   if e.actor_id<>auth.uid() or e.challenge_id<>p_id or e.type<>p_action then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
   return jsonb_build_object('id',p_id);
 end if;
 if not public.challenge_has_access(p_id) then raise exception 'NOT_CHALLENGE_PARTICIPANT'; end if;
 select * into c from public.challenges where id=p_id for update;
 select * into p from public.challenge_participants where challenge_id=p_id and user_id=auth.uid() for update;
 select jsonb_object_agg(key,value) into cfg from public.challenge_config;
 v_today:=(now() at time zone p.tz)::date;lim:=p.benefits;
 if not public.check_rate_limit('challenge_action:'||auth.uid()::text,(cfg->>'action_hourly_limit')::integer,3600) then raise exception 'RATE_LIMITED'; end if;
 if p_action not in ('cheer','nudge','pause','cover','adjust','comparison','board','mute','leave','report','viewed','share','recap') then raise exception 'INVALID_ACTION'; end if;
 if p_action in ('cheer','nudge','cover') then
   select * into peer from public.challenge_participants where challenge_id=p_id and user_id=p_target and status in ('joined','completed','finished') for update;
   if not found or peer.user_id=auth.uid() or p.status not in ('joined','completed','finished') then raise exception 'PARTNER_REQUIRED'; end if;
   if exists(select 1 from public.blocks where (blocker_id=auth.uid() and blocked_id=p_target) or (blocked_id=auth.uid() and blocker_id=p_target)) then raise exception 'USER_BLOCKED'; end if;
 end if;
 if p_action='nudge' and (select count(*) from public.challenge_events where challenge_id=p_id and actor_id=auth.uid() and type='nudge' and (created_at at time zone p.tz)::date=v_today)>=(cfg->>'nudge_daily_limit')::integer then raise exception 'NUDGE_LIMIT'; end if;
 if p_action='pause' then
   if p.status<>'joined' or p_date is null or p_date<v_today or p_date<p.start_date or p_date>=p.start_date+c.duration_days then raise exception 'INVALID_PAUSE'; end if;
   if p.pause_days_used>=(lim->>'pause_max')::integer then raise exception 'PAUSE_LIMIT'; end if;
   insert into public.challenge_pauses(challenge_id,user_id,local_date) values(p_id,auth.uid(),p_date) on conflict do nothing;
   if found then update public.challenge_participants set pause_days_used=pause_days_used+1 where challenge_id=p_id and user_id=auth.uid(); end if;
 elsif p_action='cover' then
   if p.cover_used>=(lim->>'cover_max')::integer or p.shields<=0 then raise exception 'COVER_UNAVAILABLE'; end if;
   update public.challenge_day_results set status='covered',updated_at=now() where challenge_id=p_id and user_id=p_target and local_date=p_date and status='miss';
   if not found then raise exception 'DAY_NOT_MISSED'; end if;
   update public.challenge_participants set cover_used=cover_used+1,shields=shields-1 where challenge_id=p_id and user_id=auth.uid();
 elsif p_action='adjust' then
   if p.target_adjusted or p.status<>'joined' or v_today>=p.start_date+(cfg->>'adjust_first_days')::integer then raise exception 'TARGET_ADJUSTMENT_CLOSED'; end if;
   for task in select jsonb_array_elements_text(c.rules_snapshot->'tasks') loop
     v:=(p_value->>task)::numeric;
     if v is null or v>(p.targets->>task)::numeric or v<(p.targets->>task)::numeric*(1-(c.rules_snapshot->>'target_adjust_pct')::numeric/100) or v<(c.rules_snapshot->'metrics'->task->>'min')::numeric then raise exception 'INVALID_TARGET'; end if;
   end loop;
   update public.challenge_participants set targets=p_value,target_adjusted=true where challenge_id=p_id and user_id=auth.uid();
 elsif p_action='comparison' then update public.challenge_participants set comparison_opt_out=coalesce((p_value->>'enabled')::boolean,false) where challenge_id=p_id and user_id=auth.uid();
 elsif p_action='board' then update public.challenge_participants set board_opt_in=coalesce((p_value->>'enabled')::boolean,false) where challenge_id=p_id and user_id=auth.uid();
 elsif p_action='mute' then update public.challenge_participants set muted=coalesce((p_value->>'enabled')::boolean,false) where challenge_id=p_id and user_id=auth.uid();
 elsif p_action='leave' then
   update public.challenge_participants set status='left' where challenge_id=p_id and user_id=auth.uid();
   update public.challenges set scope='solo',room_id=null,updated_at=now() where id=p_id and scope in ('pair','room','occasion') and (select count(*) from public.challenge_participants where challenge_id=p_id and status='joined')=1;
 elsif p_action='report' then
   if length(coalesce(p_value->>'reason',''))=0 then raise exception 'REPORT_REASON_REQUIRED'; end if;
   insert into public.reports(reporter_id,target_type,target_id,reason,details) values(auth.uid(),'user',coalesce(p_target,c.creator_id),left(p_value->>'reason',100),left(coalesce(p_value->>'details',''),2000));
 end if;
 insert into public.challenge_events(id,challenge_id,actor_id,type,params) values(p_client_id,p_id,auth.uid(),p_action,case when p_action='report' then '{}'::jsonb else jsonb_strip_nulls(jsonb_build_object('date',p_date,'target',p_target)) end);
 insert into public.challenge_dirty_queue(user_id) select user_id from public.challenge_participants where challenge_id=p_id and status='joined' on conflict(user_id) do update set updated_at=now();
 return jsonb_build_object('id',p_id);
end; $$;
revoke all on function public.challenge_action(uuid,uuid,text,uuid,date,jsonb) from public,anon;
grant execute on function public.challenge_action(uuid,uuid,text,uuid,date,jsonb) to authenticated;

create or replace function public.challenge_remind(p_template uuid,p_enabled boolean)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
 if not exists(select 1 from public.challenge_templates where id=p_template and season_id is not null and active) then raise exception 'TEMPLATE_UNAVAILABLE'; end if;
 if p_enabled then insert into public.challenge_reminders(template_id,user_id) values(p_template,auth.uid()) on conflict do nothing;
 else delete from public.challenge_reminders where template_id=p_template and user_id=auth.uid(); end if;
end; $$;
revoke all on function public.challenge_remind(uuid,boolean) from public,anon;
grant execute on function public.challenge_remind(uuid,boolean) to authenticated;

create or replace function public.challenge_board(p_season uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_bands integer;v_limit integer;v_min integer;
begin
 if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
 select (value#>>'{}')::integer into v_bands from public.challenge_config where key='board_bands';
 select (value#>>'{}')::integer into v_limit from public.challenge_config where key='board_limit';
 select (value#>>'{}')::integer into v_min from public.challenge_config where key='min_public_count';
 if (select count(*) from public.challenge_participants p join public.challenges c on c.id=p.challenge_id where c.rules_snapshot->>'season_id'=p_season::text and p.board_opt_in and not p.comparison_opt_out and (p.summary->>'verified_days')::integer>0)<v_min then return '[]'::jsonb; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('name',nickname,'avatar_url',avatar_url,'percent',score,'band',band)),'[]') from (select pr.nickname,pr.avatar_url,(p.summary->>'public_percent')::numeric score,ntile(v_bands) over(order by (p.summary->>'public_percent')::numeric desc) band from public.challenge_participants p join public.challenges c on c.id=p.challenge_id join public.profiles pr on pr.id=p.user_id where c.rules_snapshot->>'season_id'=p_season::text and p.board_opt_in and not p.comparison_opt_out and p.status in ('joined','completed','finished') and (p.summary->>'verified_days')::integer>0 and pr.discoverable and not exists(select 1 from public.blocks b where (blocker_id=auth.uid() and blocked_id=p.user_id) or (blocked_id=auth.uid() and blocker_id=p.user_id)) order by score desc limit v_limit) ranks);
end; $$;
revoke all on function public.challenge_board(uuid) from public,anon;
grant execute on function public.challenge_board(uuid) to authenticated;
