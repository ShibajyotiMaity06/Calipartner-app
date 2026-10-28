alter table public.challenge_participants add column notify_partner boolean not null default false;
create table public.challenge_job_config(id boolean primary key default true check(id),worker_url text not null,worker_secret text not null,cursor uuid);
alter table public.challenge_job_config enable row level security;
create policy private_job_config on public.challenge_job_config for all to authenticated using(false) with check(false);
revoke all on public.challenge_job_config from public,anon,authenticated;
grant all on public.challenge_job_config to service_role;

create or replace function public.challenge_notify(p_user uuid,p_id uuid,p_kind text,p_key text,p_params jsonb default '{}')
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare v_title text;v_body text;k text;v text;q uuid;
begin
 if exists(select 1 from public.challenge_notifications where event_key=p_key) then return true; end if;
 if exists(select 1 from public.challenge_participants where challenge_id=p_id and user_id=p_user and muted) then return false; end if;
 select tx.en into v_title from public.challenges c join public.challenge_texts tx on tx.key=c.rules_snapshot->>'title_key' where c.id=p_id;
 select en into v_body from public.challenge_texts where key='notify.'||p_kind;
 for k,v in select * from jsonb_each_text(p_params) loop v_body:=replace(v_body,'{'||k||'}',v);end loop;
 if v_body is null then return false; end if;
 q:=public.queue_push_notification(p_user,case when p_kind='invite' then 'room_invitation' else 'room_state_change' end,coalesce(v_title,'CaliPartner'),v_body,jsonb_build_object('kind','challenge','url',case when p_id is null then '/progress?tab=challenges' else '/progress?tab=challenges&challenge='||p_id::text end),null);
 if exists(select 1 from public.push_notification_queue where id=q and status in ('pending','processing','sent')) then
  insert into public.challenge_notifications(event_key,user_id,challenge_id) values(p_key,p_user,p_id) on conflict do nothing;
  return true;
 end if;
 return false;
end; $$;
revoke all on function public.challenge_notify(uuid,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.challenge_notify(uuid,uuid,text,text,jsonb) to service_role;

create or replace function public.challenge_participant_invite_push()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_name text;v_title text;
begin
 if new.status='invited' then
  select p.nickname,t.en into v_name,v_title from public.challenges c left join public.profiles p on p.id=c.creator_id join public.challenge_texts t on t.key=c.rules_snapshot->>'title_key' where c.id=new.challenge_id;
  perform public.challenge_notify(new.user_id,new.challenge_id,'invite',new.challenge_id::text||new.user_id::text||':invite',jsonb_build_object('name',v_name,'title',v_title));
 end if;
 return new;
end; $$;
revoke all on function public.challenge_participant_invite_push() from public,anon,authenticated;
create trigger challenge_invite_push after insert on public.challenge_participants for each row execute function public.challenge_participant_invite_push();

create or replace function public.challenge_event_push()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare p record;kind text;
begin
 if new.type not in ('cheer','nudge','day_passed','shield','completed','finished') then return new;end if;
 kind:=case new.type when 'day_passed' then 'pass' when 'completed' then 'complete' when 'finished' then 'complete' else new.type end;
 for p in select * from public.challenge_participants where challenge_id=new.challenge_id and status in ('joined','completed','finished') loop
  if (new.type in ('completed','finished','shield') and p.user_id=new.actor_id) or (new.type in ('cheer','nudge') and p.user_id::text=new.params->>'target') or (new.type='day_passed' and p.user_id<>new.actor_id and p.notify_partner and not p.comparison_opt_out and not exists(select 1 from public.challenge_participants x where x.challenge_id=new.challenge_id and x.user_id=new.actor_id and x.comparison_opt_out)) then
   perform public.challenge_notify(p.user_id,new.challenge_id,kind,new.id::text||p.user_id::text,'{}');
  end if;
 end loop;
 return new;
end; $$;
revoke all on function public.challenge_event_push() from public,anon,authenticated;
create trigger challenge_activity_push after insert on public.challenge_events for each row execute function public.challenge_event_push();

create or replace function public.challenge_reconcile_members(p_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.challenges;v_count integer;
begin
 select * into c from public.challenges where id=p_id for update;
 if not found then return;end if;
 select count(*) into v_count from public.challenge_participants where challenge_id=p_id and status in ('joined','completed','finished');
 if v_count=0 or (c.status='invited' and not exists(select 1 from public.challenge_participants where challenge_id=p_id and status='invited')) then
  update public.challenges set status='cancelled',updated_at=now() where id=p_id;
 elsif v_count=1 and c.scope in ('pair','room','occasion') and c.status<>'invited' then
  update public.challenges set scope='solo',room_id=null,updated_at=now() where id=p_id;
 end if;
end; $$;
revoke all on function public.challenge_reconcile_members(uuid) from public,anon,authenticated;
create or replace function public.challenge_membership_changed()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if tg_op='DELETE' or (new.status in ('left','declined') and old.status<>new.status) then perform public.challenge_reconcile_members(old.challenge_id);end if;
 return null;
end; $$;
revoke all on function public.challenge_membership_changed() from public,anon,authenticated;
create trigger challenge_member_changes after update of status or delete on public.challenge_participants for each row execute function public.challenge_membership_changed();
create or replace function public.challenge_blocked()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 update public.challenge_participants p set status='left' where p.user_id=new.blocked_id and p.status in ('invited','joined') and exists(select 1 from public.challenge_participants a where a.challenge_id=p.challenge_id and a.user_id=new.blocker_id and a.status in ('invited','joined'));
 return new;
end; $$;
revoke all on function public.challenge_blocked() from public,anon,authenticated;
create trigger challenge_block_consent after insert on public.blocks for each row execute function public.challenge_blocked();
create or replace function public.challenge_room_member_left()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if tg_op='DELETE' or new.status='left' then update public.challenge_participants p set status='left' where p.user_id=old.user_id and p.status in ('invited','joined') and exists(select 1 from public.challenges c where c.id=p.challenge_id and c.room_id=old.room_id);end if;
 return null;
end; $$;
revoke all on function public.challenge_room_member_left() from public,anon,authenticated;
create trigger challenge_room_consent after update of status or delete on public.room_members for each row execute function public.challenge_room_member_left();

create or replace function public.challenge_log_changed()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare u uuid;
begin
 u:=case when tg_op='DELETE' then old.user_id else new.user_id end;
 if exists(select 1 from auth.users where id=u) then insert into public.challenge_dirty_queue(user_id) values(u) on conflict(user_id) do update set updated_at=now();end if;
 return null;
end; $$;
revoke all on function public.challenge_log_changed() from public,anon,authenticated;
do $$ declare t text;begin
 foreach t in array array['food_entries','water_logs','activity_days','workouts','focus_sessions','weight_logs'] loop
  execute format('create trigger challenge_source_changed after insert or update or delete on public.%I for each row execute function public.challenge_log_changed()',t);
 end loop;
end; $$;

create or replace function public.challenge_maintenance()
returns void language plpgsql security definer set search_path=public,pg_temp as $$
#variable_conflict use_column
declare p record;cfg jsonb;today date;hour integer;r record;v_done boolean;
begin
 select jsonb_object_agg(key,value) into cfg from public.challenge_config;
 update public.challenge_participants p set status='declined' where p.status='invited' and exists(select 1 from public.challenges c where c.id=p.challenge_id and c.status='invited' and c.invite_expires_at<=now());
 update public.challenges set status='cancelled',updated_at=now() where status='invited' and invite_expires_at<=now();
 for p in select p.*,c.duration_days,c.status as challenge_status from public.challenge_participants p join public.challenges c on c.id=p.challenge_id where p.status in ('joined','completed','finished') and p.start_date is not null loop
  today:=(now() at time zone p.tz)::date;hour:=extract(hour from now() at time zone p.tz);
  if p.status in ('completed','finished') then perform public.challenge_notify(p.user_id,p.challenge_id,'complete',p.challenge_id::text||p.user_id::text||':complete');
  elsif p.start_date=today+1 then perform public.challenge_notify(p.user_id,p.challenge_id,'start',p.challenge_id::text||p.user_id::text||':start');
  elsif p.start_date<=today and today<p.start_date+p.duration_days and coalesce((p.summary->>'today_percent')::numeric,0)<100 then
   if hour>=(cfg->>'reminder_hour')::integer then perform public.challenge_notify(p.user_id,p.challenge_id,'morning',p.challenge_id::text||p.user_id::text||today::text||':morning');end if;
   if hour>=(cfg->>'evening_hour')::integer then perform public.challenge_notify(p.user_id,p.challenge_id,'evening',p.challenge_id::text||p.user_id::text||today::text||':evening');end if;
  end if;
  if p.start_date+p.duration_days-1=today+1 then perform public.challenge_notify(p.user_id,p.challenge_id,'ends',p.challenge_id::text||p.user_id::text||':ends');end if;
 end loop;
 for r in select r.*,t.title_key from public.challenge_reminders r join public.challenge_templates t on t.id=r.template_id join public.challenge_seasons s on s.id=t.season_id where r.sent_at is null and s.starts_at<=now() and s.ends_at>now() loop
  v_done:=public.challenge_notify(r.user_id,null,'reminder',r.template_id::text||r.user_id::text||':reminder',jsonb_build_object('title',(select en from public.challenge_texts where key=r.title_key)));
  if v_done then update public.challenge_reminders set sent_at=now() where template_id=r.template_id and user_id=r.user_id;end if;
 end loop;
 update public.occasion_milestones m set status=case when m.local_date<=(now() at time zone p.tz)::date then 'reached' else 'upcoming' end from public.occasion_plans o join public.challenge_participants p on p.challenge_id=o.id and p.user_id=o.creator_id where m.plan_id=o.id;
end; $$;
revoke all on function public.challenge_maintenance() from public,anon,authenticated;
grant execute on function public.challenge_maintenance() to service_role;

create or replace function public.configure_challenge_worker(p_url text,p_secret text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if p_url !~ '^https://[a-z0-9]+\.supabase\.co/functions/v1/challenges-api$' or length(p_secret)<32 then raise exception 'INVALID_WORKER_CONFIG';end if;
 insert into public.challenge_job_config(id,worker_url,worker_secret) values(true,p_url,p_secret) on conflict(id) do update set worker_url=excluded.worker_url,worker_secret=excluded.worker_secret;
end; $$;
revoke all on function public.configure_challenge_worker(text,text) from public,anon,authenticated;
grant execute on function public.configure_challenge_worker(text,text) to service_role;
create or replace function public.process_challenges_cron()
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.challenge_job_config;
begin
 select * into c from public.challenge_job_config where id;
 if not found then return;end if;
 if exists(select 1 from pg_extension where extname='pg_net') then
  execute 'select net.http_post(url:=$1,headers:=$2,body:=$3)' using c.worker_url,jsonb_build_object('Content-Type','application/json','x-challenge-worker',c.worker_secret),jsonb_build_object('action','maintenance');
 end if;
end; $$;
revoke all on function public.process_challenges_cron() from public,anon,authenticated;
grant execute on function public.process_challenges_cron() to service_role;
do $$ begin
 if exists(select 1 from pg_extension where extname='pg_cron') then perform cron.schedule('challenge_hourly','10 * * * *','select public.process_challenges_cron()');end if;
end; $$;

create or replace function public.challenge_public_counters()
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(jsonb_agg(jsonb_build_object('template',t.slug,'joined',case when c.joined_count>=(select (value#>>'{}')::integer from public.challenge_config where key='min_public_count') then c.joined_count else null end,'completed',case when c.completed_count>=(select (value#>>'{}')::integer from public.challenge_config where key='min_public_count') then c.completed_count else null end)),'[]') from public.challenge_counters c join public.challenge_templates t on t.id=c.template_id where t.active;
$$;
revoke all on function public.challenge_public_counters() from public;
grant execute on function public.challenge_public_counters() to anon,authenticated;

create or replace function public.challenge_analytics_summary()
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce(jsonb_object_agg(type,n),'{}') from (select type,count(*) n from public.challenge_events group by type) counts;
$$;
revoke all on function public.challenge_analytics_summary() from public,anon,authenticated;
grant execute on function public.challenge_analytics_summary() to service_role;
