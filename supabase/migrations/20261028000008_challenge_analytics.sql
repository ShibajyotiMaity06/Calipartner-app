insert into public.challenge_config(key,value) values('analytics_events','["challenge_viewed","join_tapped","share_tapped","lock_tapped","create_started","rematch_tapped"]'),('retention_days','30');
create or replace function public.challenge_track(p_request uuid,p_event text,p_challenge uuid default null)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare e public.challenge_events;
begin
 if auth.uid() is null then raise exception 'UNAUTHENTICATED';end if;
 if not exists(select 1 from public.challenge_config where key='analytics_events' and value?p_event) then raise exception 'INVALID_EVENT';end if;
 select * into e from public.challenge_events where id=p_request;
 if found then
  if e.actor_id is distinct from auth.uid() or e.type<>p_event or e.challenge_id is distinct from p_challenge then raise exception 'IDEMPOTENCY_CONFLICT';end if;
  return;
 end if;
 if p_challenge is not null and not public.challenge_has_access(p_challenge) then raise exception 'NOT_CHALLENGE_PARTICIPANT';end if;
 if not public.check_rate_limit('challenge_analytics:'||auth.uid()::text,(select (value#>>'{}')::integer from public.challenge_config where key='action_hourly_limit'),3600) then raise exception 'RATE_LIMITED';end if;
 insert into public.challenge_events(id,challenge_id,actor_id,type) values(p_request,p_challenge,auth.uid(),p_event);
end;$$;
revoke all on function public.challenge_track(uuid,text,uuid) from public,anon;
grant execute on function public.challenge_track(uuid,text,uuid) to authenticated;
create or replace function public.challenge_analytics_dashboard()
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('events',public.challenge_analytics_summary(),
 'templates',(select coalesce(jsonb_agg(jsonb_build_object('slug',t.slug,'joined',coalesce(n.joined_count,0),'completed',coalesce(n.completed_count,0))),'[]') from public.challenge_templates t left join public.challenge_counters n on n.template_id=t.id),
 'formats',(select coalesce(jsonb_agg(jsonb_build_object('format',format,'joined',joined,'completed',completed,'finished',finished)),'[]') from (select c.rules_snapshot->>'format' format,count(*) filter(where p.joined_at is not null) joined,count(*) filter(where p.status='completed') completed,count(*) filter(where p.status in ('completed','finished')) finished from public.challenges c join public.challenge_participants p on p.challenge_id=c.id group by c.rules_snapshot->>'format') scores),
 'invitations',(select jsonb_build_object('sent',count(*),'accepted',count(*) filter(where p.joined_at is not null)) from public.challenge_participants p join public.challenges c on c.id=p.challenge_id where p.user_id<>c.creator_id),
 'retention',(select jsonb_build_object('days',days,'eligible',count(*),'returned',count(*) filter(where returned)) from (select u.user_id,days,exists(select 1 from public.challenge_events e where e.actor_id=u.user_id and e.type='challenge_viewed' and e.created_at>=u.first_join+make_interval(days=>days)) returned from (select user_id,min(joined_at) first_join from public.challenge_participants where joined_at is not null group by user_id) u cross join (select (value#>>'{}')::integer days from public.challenge_config where key='retention_days') cfg where first_join<=now()-make_interval(days=>days)) cohort group by days));
$$;
revoke all on function public.challenge_analytics_dashboard() from public,anon,authenticated;
grant execute on function public.challenge_analytics_dashboard() to service_role;
