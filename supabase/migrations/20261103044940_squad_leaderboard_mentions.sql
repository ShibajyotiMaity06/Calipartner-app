-- Owner-approved squad revision: free mandatory macros/steps, Plus details,
-- optional height/weight only, and explicit unread chat mentions.
-- Historical check-ins and nudges stay private; the new UI never reads them.
create or replace function public.assert_squad_access(p_room_id uuid)
returns void language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if not public.is_room_member(p_room_id,auth.uid()) then raise exception 'NOT_ROOM_MEMBER'; end if;
  if not public.room_is_usable(p_room_id) then raise exception 'ROOM_LOCKED'; end if;
end; $$;
revoke all on function public.assert_squad_access(uuid) from public,anon,authenticated;

create or replace function public.get_squad_today(p_room_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  perform public.assert_squad_access(p_room_id);
  return jsonb_build_object('room_id',p_room_id,'members',(
    select coalesce(jsonb_agg(jsonb_build_object(
      'user_id',p.id,'username',p.username,'nickname',p.nickname,'avatar_url',p.avatar_url,
      'is_self',p.id=auth.uid(),'role',m.role,'status',m.status,
      'local_date',(now() at time zone p.timezone)::date,'goal',g.goal,
      'calories',coalesce(f.calories,0),'protein',coalesce(f.protein,0),'carbs',coalesce(f.carbs,0),'fat',coalesce(f.fat,0),
      'steps',coalesce(a.steps,0),
      'targets',case when g.id is null then null else jsonb_build_object('calories',g.daily_calorie_target,'protein',g.protein_grams,'carbs',g.carb_grams,'fat',g.fat_grams,'steps',g.step_goal) end,
      'height_cm',case when p.id=auth.uid() or coalesce((m.privacy_settings->>'share_height')::boolean,false) then p.height_cm else null end,
      'weight_kg',case when p.id=auth.uid() or coalesce((m.privacy_settings->>'share_weight_number')::boolean,false) then coalesce(w.weight_kg,g.current_weight_kg) else null end
    ) order by p.id),'[]'::jsonb)
    from public.room_members m join public.profiles p on p.id=m.user_id
    left join lateral (select * from public.goal_profiles where user_id=p.id and effective_from<=now() order by effective_from desc,created_at desc,id desc limit 1) g on true
    left join lateral (select sum(calories) calories,sum(protein) protein,sum(carbs) carbs,sum(fat) fat from public.food_entries where user_id=p.id and deleted_at is null and local_date::text=(now() at time zone p.timezone)::date::text) f on true
    left join public.activity_days a on a.user_id=p.id and a.local_date::text=(now() at time zone p.timezone)::date::text and a.deleted_at is null
    left join lateral (select weight_kg from public.weight_logs where user_id=p.id and deleted_at is null and logged_at<=now() order by logged_at desc,id desc limit 1) w on true
    where m.room_id=p_room_id and m.status in ('active','paused','locked')
      and not exists(select 1 from public.blocks b where (b.blocker_id=auth.uid() and b.blocked_id=p.id) or (b.blocked_id=auth.uid() and b.blocker_id=p.id))
  ));
end; $$;
revoke all on function public.get_squad_today(uuid) from public,anon;
grant execute on function public.get_squad_today(uuid) to authenticated;

create or replace function public.get_squad_member_details(p_room_id uuid,p_member_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare day text;
begin
  perform public.assert_squad_access(p_room_id);
  if public.active_room_tier(auth.uid())='free' then raise exception 'PLUS_REQUIRED'; end if;
  if not public.is_room_member(p_room_id,p_member_id) then raise exception 'NOT_ROOM_MEMBER'; end if;
  if exists(select 1 from public.blocks where (blocker_id=auth.uid() and blocked_id=p_member_id) or (blocked_id=auth.uid() and blocker_id=p_member_id)) then raise exception 'USER_BLOCKED'; end if;
  select (now() at time zone timezone)::date::text into day from public.profiles where id=p_member_id;
  return jsonb_build_object(
    'meals',(select coalesce(jsonb_agg(to_jsonb(meal) order by section),'[]'::jsonb) from (
      select e.meal_section section,sum(e.calories) calories,sum(e.protein) protein,sum(e.carbs) carbs,sum(e.fat) fat,
        jsonb_agg(jsonb_build_object('id',e.id,'name',e.food_name,'quantity',e.quantity,'unit',e.unit) order by e.logged_at,e.id) items
      from public.food_entries e where e.user_id=p_member_id and e.local_date::text=day and e.deleted_at is null group by e.meal_section
    ) meal),
    'workouts',(select coalesce(jsonb_agg(jsonb_build_object('id',w.id,'name',coalesce(w.name,w.type),'type',w.type,'duration_minutes',w.duration_minutes,
      'exercises',(select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'name',e.exercise_name,'sets',(
        select coalesce(jsonb_agg(jsonb_build_object('set_number',s.set_number,'reps',s.reps,'weight_kg',s.weight_kg,'duration_seconds',s.duration_seconds,'distance_meters',s.distance_meters) order by s.set_number,s.id),'[]'::jsonb)
        from public.workout_sets s where s.workout_exercise_id=e.id and s.user_id=p_member_id and s.workout_id=w.id and s.completed and s.deleted_at is null
      )) order by e.order_in_workout,e.id),'[]'::jsonb) from public.workout_exercises e where e.workout_id=w.id and e.user_id=p_member_id and e.deleted_at is null)
    ) order by w.start_time,w.id),'[]'::jsonb) from public.workouts w where w.user_id=p_member_id and w.local_date::text=day and w.deleted_at is null)
  );
end; $$;
revoke all on function public.get_squad_member_details(uuid,uuid) from public,anon;
grant execute on function public.get_squad_member_details(uuid,uuid) to authenticated;

-- The new visibility contract patches only the two optional measurements.
create or replace function public.get_squad_visibility(p_room_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  perform public.assert_squad_access(p_room_id);
  return (select jsonb_build_object('share_weight',coalesce((privacy_settings->>'share_weight_number')::boolean,false),'share_height',coalesce((privacy_settings->>'share_height')::boolean,false)) from public.room_members where room_id=p_room_id and user_id=auth.uid());
end; $$;
create or replace function public.set_squad_visibility(p_room_id uuid,p_share_weight boolean,p_share_height boolean)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform public.assert_squad_access(p_room_id);
  if p_share_weight is null or p_share_height is null then raise exception 'INVALID_INPUT'; end if;
  update public.room_members set privacy_settings=privacy_settings||jsonb_build_object('share_weight_number',p_share_weight,'share_height',p_share_height),updated_at=now() where room_id=p_room_id and user_id=auth.uid();
  return public.get_squad_visibility(p_room_id);
end; $$;
revoke all on function public.get_squad_visibility(uuid),public.set_squad_visibility(uuid,boolean,boolean) from public,anon;
grant execute on function public.get_squad_visibility(uuid),public.set_squad_visibility(uuid,boolean,boolean) to authenticated;

create table public.squad_mentions (
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  created_at timestamptz not null default now(),
  seen_at timestamptz,
  primary key(message_id,recipient_id)
);
alter table public.squad_mentions enable row level security;
create policy squad_mentions_owner_read on public.squad_mentions for select to authenticated using(recipient_id=auth.uid() and public.is_room_member(room_id,auth.uid()));
create policy squad_mentions_no_app_write on public.squad_mentions for all to authenticated using(false) with check(false);
revoke all on public.squad_mentions from anon,authenticated;
grant all on public.squad_mentions to service_role;
create index squad_mentions_unseen on public.squad_mentions(recipient_id,room_id,created_at desc,message_id desc) where seen_at is null;

create or replace function public.capture_squad_mentions()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.message_type<>'user' or new.deleted_at is not null or new.text is null then return new; end if;
  insert into public.squad_mentions(message_id,recipient_id,room_id,created_at)
    select distinct new.id,p.id,new.room_id,new.created_at
    from regexp_matches(new.text,'(^|[^A-Za-z0-9_.])@([A-Za-z0-9_.]+)','g') token
    join public.profiles p on lower(p.username::text)=lower(rtrim(token[2],'.'))
    join public.room_members m on m.user_id=p.id and m.room_id=new.room_id and m.status in ('active','paused','locked')
    where p.id<>new.sender_id
      and not exists(select 1 from public.blocks b where (b.blocker_id=p.id and b.blocked_id=new.sender_id) or (b.blocked_id=p.id and b.blocker_id=new.sender_id))
      and not exists(select 1 from public.member_mutes mu where mu.user_id=p.id and mu.muted_user_id=new.sender_id)
    on conflict(message_id,recipient_id) do nothing;
  return new;
end; $$;
revoke all on function public.capture_squad_mentions() from public,anon,authenticated;
create trigger chat_capture_squad_mentions after insert on public.chat_messages for each row execute function public.capture_squad_mentions();

create or replace function public.get_squad_mentions(p_room_id uuid,p_before_created_at timestamptz default null,p_before_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare total integer; paid boolean; items jsonb; remaining integer;
begin
  perform public.assert_squad_access(p_room_id);
  paid:=public.active_room_tier(auth.uid())<>'free';
  select count(*) into total from public.squad_mentions n join public.chat_messages m on m.id=n.message_id
    where n.recipient_id=auth.uid() and n.room_id=p_room_id and n.seen_at is null and m.deleted_at is null and public.chat_sender_visible(p_room_id,m.sender_id);
  if not paid then return jsonb_build_object('count',total,'locked',true,'mentions','[]'::jsonb,'has_more',false); end if;
  select count(*) into remaining from public.squad_mentions n join public.chat_messages m on m.id=n.message_id
    where n.recipient_id=auth.uid() and n.room_id=p_room_id and n.seen_at is null and m.deleted_at is null and public.chat_sender_visible(p_room_id,m.sender_id)
      and (p_before_created_at is null or (n.created_at,n.message_id)<(p_before_created_at,p_before_id));
  select coalesce(jsonb_agg(to_jsonb(item) order by created_at desc,message_id desc),'[]'::jsonb) into items from (
    select n.message_id,m.sender_id,p.nickname,m.text,n.created_at
    from public.squad_mentions n join public.chat_messages m on m.id=n.message_id join public.profiles p on p.id=m.sender_id
    where n.recipient_id=auth.uid() and n.room_id=p_room_id and n.seen_at is null and m.deleted_at is null and public.chat_sender_visible(p_room_id,m.sender_id)
      and (p_before_created_at is null or (n.created_at,n.message_id)<(p_before_created_at,p_before_id))
    order by n.created_at desc,n.message_id desc limit 30
  ) item;
  return jsonb_build_object('count',total,'locked',false,'mentions',items,'has_more',remaining>30);
end; $$;
create or replace function public.mark_squad_mention_seen(p_room_id uuid,p_message_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform public.assert_squad_access(p_room_id);
  if public.active_room_tier(auth.uid())='free' then raise exception 'PLUS_REQUIRED'; end if;
  update public.squad_mentions n set seen_at=coalesce(n.seen_at,now()) where n.room_id=p_room_id and n.recipient_id=auth.uid() and n.message_id=p_message_id
    and exists(select 1 from public.chat_messages m where m.id=n.message_id and m.deleted_at is null and public.chat_sender_visible(p_room_id,m.sender_id));
end; $$;

-- Fetch the exact tagged message even if it is older than the newest chat page.
create or replace function public.get_squad_mention_context(p_room_id uuid,p_message_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
  perform public.assert_squad_access(p_room_id);
  if public.active_room_tier(auth.uid())='free' then raise exception 'PLUS_REQUIRED'; end if;
  select jsonb_build_array(to_jsonb(m)||jsonb_build_object(
    'sender_nickname',p.nickname,'sender_username',p.username,'sender_avatar_url',p.avatar_url,
    'attachments',(select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at,a.id),'[]'::jsonb) from public.chat_attachments a where a.message_id=m.id and a.moderation_status='approved')
  )) into result
  from public.squad_mentions n join public.chat_messages m on m.id=n.message_id join public.profiles p on p.id=m.sender_id
  where n.room_id=p_room_id and n.recipient_id=auth.uid() and n.message_id=p_message_id and m.deleted_at is null and public.chat_sender_visible(p_room_id,m.sender_id);
  if result is null then raise exception 'MESSAGE_NOT_FOUND'; end if;
  return result;
end; $$;
revoke all on function public.get_squad_mentions(uuid,timestamptz,uuid),public.mark_squad_mention_seen(uuid,uuid),public.get_squad_mention_context(uuid,uuid) from public,anon;
grant execute on function public.get_squad_mentions(uuid,timestamptz,uuid),public.mark_squad_mention_seen(uuid,uuid),public.get_squad_mention_context(uuid,uuid) to authenticated;
notify pgrst,'reload schema';
