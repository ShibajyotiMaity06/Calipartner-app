-- CH-1: configurable challenge catalogue, private instances and server-scored results.
create table public.challenge_config(key text primary key,value jsonb not null);
create table public.challenge_texts(key text primary key,en text not null,hi text);
create table public.challenge_seasons(id uuid primary key default gen_random_uuid(),slug text unique not null,name_key text not null,starts_at timestamptz not null,ends_at timestamptz not null,visible_from timestamptz not null,regions text[] not null default '{}',sort integer not null default 0,check(ends_at>starts_at));
create table public.challenge_templates(id uuid primary key default gen_random_uuid(),slug text unique not null,format text not null check(format in ('streak','total','weekly_rhythm','checklist','duel','coop')),tasks text[] not null,scope_options text[] not null,duration_options integer[] not null,rule_overrides jsonb not null default '{}',plan_required text not null default 'free' check(plan_required in ('free','plus','pro')),season_id uuid references public.challenge_seasons on delete cascade,icon_key text not null,title_key text not null,desc_key text not null,chapters jsonb not null default '[]',allow_manual boolean not null default true,active boolean not null default true,version integer not null default 1);
create table public.forfeit_cards(id uuid primary key default gen_random_uuid(),text_key text not null,active boolean not null default true);
create table public.challenges(id uuid primary key,template_id uuid not null references public.challenge_templates,template_version integer not null,rules_snapshot jsonb not null,creator_id uuid references auth.users on delete set null,scope text not null check(scope in ('solo','pair','room','season','occasion')),room_id uuid references public.rooms on delete set null,start_date date,end_date date,duration_days integer not null check(duration_days>0),status text not null check(status in ('invited','scheduled','active','completed','finished','cancelled')),forfeit_id uuid references public.forfeit_cards,custom_title text,invite_expires_at timestamptz not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.challenge_participants(challenge_id uuid not null references public.challenges on delete cascade,user_id uuid not null references auth.users on delete cascade,status text not null check(status in ('invited','joined','declined','left','completed','finished')),targets jsonb not null default '{}',benefits jsonb not null,summary jsonb not null default '{}',tz text not null,start_date date,shields integer not null default 0,pause_days_used integer not null default 0,cover_used integer not null default 0,target_adjusted boolean not null default false,comparison_opt_out boolean not null default false,board_opt_in boolean not null default false,muted boolean not null default false,joined_at timestamptz,primary key(challenge_id,user_id));
create table public.challenge_day_results(challenge_id uuid not null,user_id uuid not null,local_date date not null,day_index integer not null,value numeric not null,target numeric not null,percent numeric not null check(percent between 0 and 100),status text not null check(status in ('pass','partial','miss','shield','covered','paused','rest','pending','upcoming')),source jsonb not null,verified boolean not null,finalized boolean not null,updated_at timestamptz not null default now(),primary key(challenge_id,user_id,local_date),foreign key(challenge_id,user_id) references public.challenge_participants on delete cascade);
create table public.challenge_events(id uuid primary key,challenge_id uuid references public.challenges on delete cascade,actor_id uuid references auth.users on delete set null,type text not null,params jsonb not null default '{}',created_at timestamptz not null default now());
create table public.challenge_counters(template_id uuid primary key references public.challenge_templates on delete cascade,joined_count bigint not null default 0,completed_count bigint not null default 0);
create table public.challenge_pauses(challenge_id uuid not null,user_id uuid not null,local_date date not null,primary key(challenge_id,user_id,local_date),foreign key(challenge_id,user_id) references public.challenge_participants on delete cascade);
create table public.challenge_reminders(template_id uuid not null references public.challenge_templates on delete cascade,user_id uuid not null references auth.users on delete cascade,sent_at timestamptz,primary key(template_id,user_id));
create table public.badges(id text primary key,text_key text not null,icon_key text not null,rule jsonb not null,plan_required text not null default 'free');
create table public.user_badges(user_id uuid not null references auth.users on delete cascade,badge_id text not null references public.badges,challenge_id uuid not null references public.challenges on delete cascade,earned_at timestamptz not null default now(),primary key(user_id,badge_id,challenge_id));
create table public.occasion_plans(id uuid primary key references public.challenges on delete cascade,creator_id uuid not null references auth.users on delete cascade,event_type text not null,event_date date not null,private_plan jsonb not null,created_at timestamptz not null default now());
create table public.occasion_milestones(plan_id uuid not null references public.occasion_plans on delete cascade,week integer not null,local_date date not null,habit_factor numeric not null,status text not null default 'upcoming',private_weight numeric,primary key(plan_id,week));
create table public.challenge_dirty_queue(user_id uuid primary key references auth.users on delete cascade,updated_at timestamptz not null default now());
create table public.challenge_notifications(event_key text primary key,user_id uuid not null references auth.users on delete cascade,challenge_id uuid references public.challenges on delete cascade,created_at timestamptz not null default now());
create index challenge_participants_user_status on public.challenge_participants(user_id,status);
create index challenges_running on public.challenges(status,updated_at);
create index challenge_events_instance_date on public.challenge_events(challenge_id,created_at desc);
create index challenge_seasons_calendar on public.challenge_seasons(visible_from,ends_at);
do $$ declare t text; begin
  foreach t in array array['challenge_config','challenge_texts','challenge_seasons','challenge_templates','forfeit_cards','challenges','challenge_participants','challenge_day_results','challenge_events','challenge_counters','challenge_pauses','challenge_reminders','badges','user_badges','occasion_plans','occasion_milestones','challenge_dirty_queue','challenge_notifications'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('create policy no_direct_access on public.%I for all to authenticated using(false) with check(false)',t);
  end loop;
end; $$;
-- Realtime watches only the caller's own summary row; cross-person data uses projection RPCs.
create policy participant_select_self on public.challenge_participants for select to authenticated using(user_id=auth.uid());
do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    alter publication supabase_realtime add table public.challenge_participants;
  end if;
end; $$;

create or replace function public.challenge_has_access(p_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(select 1 from public.challenge_participants p join public.challenges c on c.id=p.challenge_id
    where p.challenge_id=p_id and p.user_id=auth.uid() and p.status not in ('left','declined')
    and (c.room_id is null or public.is_room_member(c.room_id,auth.uid())));
$$;
revoke all on function public.challenge_has_access(uuid) from public,anon;
grant execute on function public.challenge_has_access(uuid) to authenticated;

create or replace function public.challenge_plan_config(p_user uuid)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select value->public.active_room_tier(p_user) from public.challenge_config where key='plans';
$$;
revoke all on function public.challenge_plan_config(uuid) from public,anon,authenticated;

create or replace function public.challenge_catalog()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
 return jsonb_build_object('now',now(),'plan',public.active_room_tier(auth.uid()),'limits',public.challenge_plan_config(auth.uid()),
 'config',(select jsonb_object_agg(key,value) from public.challenge_config),
 'texts',(select jsonb_object_agg(key,jsonb_build_object('en',en,'hi',hi)) from public.challenge_texts),
 'templates',(select coalesce(jsonb_agg(to_jsonb(t)||jsonb_build_object('joined_count',coalesce(c.joined_count,0),'completed_count',coalesce(c.completed_count,0)) order by t.slug),'[]') from public.challenge_templates t left join public.challenge_counters c on c.template_id=t.id where t.active),
 'seasons',(select coalesce(jsonb_agg(to_jsonb(s) order by sort),'[]') from public.challenge_seasons s where s.visible_from<=now()),
 'forfeits',(select coalesce(jsonb_agg(to_jsonb(f)),'[]') from public.forfeit_cards f where active),
 'badges',(select coalesce(jsonb_agg(to_jsonb(b)||jsonb_build_object('earned',(select count(*) from public.user_badges u where u.user_id=auth.uid() and u.badge_id=b.id))),'[]') from public.badges b),
 'screened',((select coalesce(bool_or(pregnant_or_breastfeeding or has_diabetes_or_medication or has_eating_disorder_history),false) from public.health_screening where user_id=auth.uid()) or not exists(select 1 from public.profiles where id=auth.uid() and date_of_birth<=(now() at time zone timezone)::date-interval '18 years')),
 'partners',(select coalesce(jsonb_agg(public.social_profile_json(p.id,auth.uid())),'[]') from public.profiles p where p.id<>auth.uid() and (exists(select 1 from public.friend_requests f where f.status='accepted' and f.pair_low=least(p.id,auth.uid()) and f.pair_high=greatest(p.id,auth.uid())) or exists(select 1 from public.room_members a join public.room_members b on a.room_id=b.room_id join public.rooms r on r.id=a.room_id where a.user_id=auth.uid() and b.user_id=p.id and a.status<>'left' and b.status<>'left' and r.state<>'archived')) and not exists(select 1 from public.blocks b where (b.blocker_id=auth.uid() and b.blocked_id=p.id) or (b.blocked_id=auth.uid() and b.blocker_id=p.id))),
 'rooms',(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'name',r.name,'host',m.role='host','count',(select count(*) from public.room_members rm where rm.room_id=r.id and rm.status<>'left'))),'[]') from public.rooms r join public.room_members m on m.room_id=r.id and m.user_id=auth.uid() and m.status<>'left' where r.state<>'archived'));
end; $$;
revoke all on function public.challenge_catalog() from public,anon;
grant execute on function public.challenge_catalog() to authenticated;

-- Catalogue and numerical rules are real editable rows, inserted by the seed migration.
