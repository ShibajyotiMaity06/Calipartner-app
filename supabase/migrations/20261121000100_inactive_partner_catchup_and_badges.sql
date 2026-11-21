-- Migration: Inactive partner catchup notifications (2 days inactivity) & Navigation badges
-- Following PRD 6.12, NTF-3 (no calorie disclosure, supportive tone), and AGENT_RULES.md

-- 1. Extend push_notification_queue notification_type check constraint
alter table public.push_notification_queue drop constraint if exists push_notification_queue_notification_type_check;
alter table public.push_notification_queue add constraint push_notification_queue_notification_type_check
  check (
    notification_type in (
      'nudge',
      'partner_workout',
      'partner_food',
      'inactive_partner_catchup',
      'room_invitation',
      'room_join_request',
      'room_request_accepted',
      'chat_message',
      'streak_at_risk',
      'weekly_summary',
      'trial_ending',
      'subscription_lapse',
      'room_state_change',
      'focus_session'
    )
  );

-- 2. Helper to check if a user is inactive for 2 days (48 hours)
create or replace function public.is_user_inactive_2days(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select not exists (
    select 1 from public.food_entries fe
    where fe.user_id = p_user_id
      and fe.deleted_at is null
      and fe.logged_at >= (now() - interval '48 hours')
  )
  and not exists (
    select 1 from public.workouts w
    where w.user_id = p_user_id
      and w.deleted_at is null
      and coalesce(w.created_at, w.start_time, now()) >= (now() - interval '48 hours')
  );
$$;

-- 3. Trigger function: Notify inactive friends/squadmates when a meal is logged
create or replace function public.trg_food_entries_inactive_catchup_push()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sender_nick text;
  v_inactive_partner record;
begin
  if NEW.deleted_at is not null then
    return NEW;
  end if;

  select nickname into v_sender_nick from public.profiles where id = NEW.user_id;
  v_sender_nick := coalesce(v_sender_nick, 'Your partner');

  -- Find all inactive connected partners (squadmates or friends)
  for v_inactive_partner in (
    with connected_partners as (
      -- Squad members in common usable rooms
      select rm.user_id as partner_id
      from public.room_members rm
      join public.room_members sender_rm on sender_rm.room_id = rm.room_id and sender_rm.user_id = NEW.user_id
      join public.rooms r on r.id = rm.room_id
      where rm.user_id <> NEW.user_id
        and rm.status in ('active', 'paused')
        and sender_rm.status in ('active', 'paused')
        and r.state not in ('locked', 'archived')
        and public.room_is_usable(rm.room_id)

      union

      -- Accepted friends
      select case when fr.sender_id = NEW.user_id then fr.recipient_id else fr.sender_id end as partner_id
      from public.friend_requests fr
      where (fr.sender_id = NEW.user_id or fr.recipient_id = NEW.user_id)
        and fr.status = 'accepted'
    )
    select cp.partner_id
    from connected_partners cp
    where public.is_user_inactive_2days(cp.partner_id)
      -- Avoid spam: at most one catchup push per 24 hours per recipient
      and not exists (
        select 1 from public.push_notification_queue q
        where q.user_id = cp.partner_id
          and q.notification_type = 'inactive_partner_catchup'
          and q.created_at >= (now() - interval '24 hours')
      )
      -- Blocks & mutes check
      and not exists (
        select 1 from public.blocks bl
        where (bl.blocker_id = cp.partner_id and bl.blocked_id = NEW.user_id)
           or (bl.blocker_id = NEW.user_id and bl.blocked_id = cp.partner_id)
      )
      and not exists (
        select 1 from public.member_mutes mm
        where mm.user_id = cp.partner_id and mm.muted_user_id = NEW.user_id
      )
  ) loop
    perform public.queue_push_notification(
      p_user_id := v_inactive_partner.partner_id,
      p_type := 'inactive_partner_catchup',
      p_title := v_sender_nick || ' logged their meal',
      p_body := v_sender_nick || ' logged their meal and is ahead of you. Tap to catch up!',
      p_data := jsonb_build_object(
        'type', 'inactive_partner_catchup',
        'activityType', 'meal',
        'senderId', NEW.user_id,
        'url', '/today'
      )
    );
  end loop;

  return NEW;
end;
$$;

drop trigger if exists trg_food_entries_inactive_catchup on public.food_entries;
create trigger trg_food_entries_inactive_catchup
  after insert on public.food_entries
  for each row
  execute function public.trg_food_entries_inactive_catchup_push();

-- 4. Trigger function: Notify inactive friends/squadmates when a workout is logged
create or replace function public.trg_workouts_inactive_catchup_push()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sender_nick text;
  v_inactive_partner record;
begin
  if NEW.deleted_at is not null then
    return NEW;
  end if;

  select nickname into v_sender_nick from public.profiles where id = NEW.user_id;
  v_sender_nick := coalesce(v_sender_nick, 'Your partner');

  -- Find all inactive connected partners (squadmates or friends)
  for v_inactive_partner in (
    with connected_partners as (
      -- Squad members in common usable rooms
      select rm.user_id as partner_id
      from public.room_members rm
      join public.room_members sender_rm on sender_rm.room_id = rm.room_id and sender_rm.user_id = NEW.user_id
      join public.rooms r on r.id = rm.room_id
      where rm.user_id <> NEW.user_id
        and rm.status in ('active', 'paused')
        and sender_rm.status in ('active', 'paused')
        and r.state not in ('locked', 'archived')
        and public.room_is_usable(rm.room_id)

      union

      -- Accepted friends
      select case when fr.sender_id = NEW.user_id then fr.recipient_id else fr.sender_id end as partner_id
      from public.friend_requests fr
      where (fr.sender_id = NEW.user_id or fr.recipient_id = NEW.user_id)
        and fr.status = 'accepted'
    )
    select cp.partner_id
    from connected_partners cp
    where public.is_user_inactive_2days(cp.partner_id)
      -- Avoid spam: at most one catchup push per 24 hours per recipient
      and not exists (
        select 1 from public.push_notification_queue q
        where q.user_id = cp.partner_id
          and q.notification_type = 'inactive_partner_catchup'
          and q.created_at >= (now() - interval '24 hours')
      )
      -- Blocks & mutes check
      and not exists (
        select 1 from public.blocks bl
        where (bl.blocker_id = cp.partner_id and bl.blocked_id = NEW.user_id)
           or (bl.blocker_id = NEW.user_id and bl.blocked_id = cp.partner_id)
      )
      and not exists (
        select 1 from public.member_mutes mm
        where mm.user_id = cp.partner_id and mm.muted_user_id = NEW.user_id
      )
  ) loop
    perform public.queue_push_notification(
      p_user_id := v_inactive_partner.partner_id,
      p_type := 'inactive_partner_catchup',
      p_title := v_sender_nick || ' logged a workout',
      p_body := v_sender_nick || ' logged a workout and is ahead of you. Tap to catch up!',
      p_data := jsonb_build_object(
        'type', 'inactive_partner_catchup',
        'activityType', 'workout',
        'senderId', NEW.user_id,
        'url', '/today'
      )
    );
  end loop;

  return NEW;
end;
$$;

drop trigger if exists trg_workouts_inactive_catchup on public.workouts;
create trigger trg_workouts_inactive_catchup
  after insert on public.workouts
  for each row
  execute function public.trg_workouts_inactive_catchup_push();

-- 5. Batch scheduled function: process inactive partner notifications
create or replace function public.process_inactive_partner_notifications()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count int := 0;
  v_item record;
  v_active_sender record;
begin
  for v_item in (
    select p.id as user_id, p.timezone
    from public.profiles p
    where public.is_user_inactive_2days(p.id)
      and not exists (
        select 1 from public.push_notification_queue q
        where q.user_id = p.id
          and q.notification_type = 'inactive_partner_catchup'
          and q.created_at >= (now() - interval '24 hours')
      )
  ) loop
    -- Find an active partner who logged recently (last 24 hours)
    select
      sub.partner_id as sender_id,
      pr.nickname as sender_nickname,
      sub.act_type as activity_type
    into v_active_sender
    from (
      -- Food log in last 24h
      select fe.user_id as partner_id, 'meal' as act_type, fe.logged_at
      from public.food_entries fe
      where fe.deleted_at is null and fe.logged_at >= (now() - interval '24 hours')
      union all
      -- Workout in last 24h
      select w.user_id as partner_id, 'workout' as act_type, coalesce(w.created_at, w.start_time, now()) as logged_at
      from public.workouts w
      where w.deleted_at is null and coalesce(w.created_at, w.start_time, now()) >= (now() - interval '24 hours')
    ) sub
    join public.profiles pr on pr.id = sub.partner_id
    where (
      -- Squad mate
      exists (
        select 1 from public.room_members rm1
        join public.room_members rm2 on rm1.room_id = rm2.room_id
        where rm1.user_id = v_item.user_id
          and rm2.user_id = sub.partner_id
          and rm1.status in ('active', 'paused')
          and rm2.status in ('active', 'paused')
          and public.room_is_usable(rm1.room_id)
      )
      or
      -- Friend
      exists (
        select 1 from public.friend_requests fr
        where (fr.sender_id = v_item.user_id and fr.recipient_id = sub.partner_id
           or fr.recipient_id = v_item.user_id and fr.sender_id = sub.partner_id)
          and fr.status = 'accepted'
      )
    )
    and not exists (
      select 1 from public.blocks bl
      where (bl.blocker_id = v_item.user_id and bl.blocked_id = sub.partner_id)
         or (bl.blocker_id = sub.partner_id and bl.blocked_id = v_item.user_id)
    )
    order by sub.logged_at desc
    limit 1;

    if v_active_sender.sender_id is not null then
      perform public.queue_push_notification(
        p_user_id := v_item.user_id,
        p_type := 'inactive_partner_catchup',
        p_title := coalesce(v_active_sender.sender_nickname, 'Your partner') || ' logged ' ||
                   case when v_active_sender.activity_type = 'workout' then 'a workout' else 'their meal' end,
        p_body := coalesce(v_active_sender.sender_nickname, 'Your partner') || ' logged ' ||
                  case when v_active_sender.activity_type = 'workout' then 'a workout' else 'their meal' end ||
                  ' and is ahead of you. Tap to catch up!',
        p_data := jsonb_build_object(
          'type', 'inactive_partner_catchup',
          'activityType', v_active_sender.activity_type,
          'senderId', v_active_sender.sender_id,
          'url', '/today'
        )
      );
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

-- 6. RPC for in-app cumulative navigation badges
create or replace function public.get_user_navigation_badges()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_chat_unread int := 0;
  v_incoming_friends int := 0;
  v_incoming_room_requests int := 0;
  v_feed_notifications int := 0;
begin
  if v_user_id is null then
    return jsonb_build_object('chat', 0, 'room', 0, 'feed', 0, 'today', 0, 'progress', 0);
  end if;

  -- 1. Unread chat messages across user's active/paused rooms
  select coalesce(sum(
    case
      when r.id is null then 0
      else (
        select count(*)
        from public.chat_messages cm
        left join public.chat_read_cursors crc on crc.room_id = rm.room_id and crc.user_id = v_user_id
        where cm.room_id = rm.room_id
          and cm.sender_id <> v_user_id
          and cm.deleted_at is null
          and (crc.last_read_message_id is null or cm.created_at > (
            select cm2.created_at from public.chat_messages cm2 where cm2.id = crc.last_read_message_id
          ))
      )
    end
  ), 0)
  into v_chat_unread
  from public.room_members rm
  join public.rooms r on r.id = rm.room_id
  where rm.user_id = v_user_id
    and rm.status in ('active', 'paused')
    and r.state not in ('locked', 'archived');

  -- 2. Incoming friend requests
  select count(*)
  into v_incoming_friends
  from public.friend_requests
  where recipient_id = v_user_id
    and status = 'pending';

  -- 3. Incoming room join requests and room invitations
  select count(*)
  into v_incoming_room_requests
  from (
    -- Room invitations for current user
    select id from public.room_requests
    where recipient_id = v_user_id
      and type = 'invitation'
      and status = 'pending'
    union all
    -- Join requests for rooms hosted by current user
    select rr.id
    from public.room_requests rr
    join public.rooms r on r.id = rr.room_id
    where r.host_id = v_user_id
      and rr.type = 'join_request'
      and rr.status = 'pending'
  ) reqs;

  -- 4. Feed interactions: likes and comments on user's posts in the last 7 days
  select count(*)
  into v_feed_notifications
  from (
    select fl.post_id
    from public.feed_likes fl
    join public.feed_posts fp on fp.id = fl.post_id
    where fp.author_id = v_user_id
      and fl.user_id <> v_user_id
    union all
    select fc.id
    from public.feed_comments fc
    join public.feed_posts fp on fp.id = fc.post_id
    where fp.author_id = v_user_id
      and fc.author_id <> v_user_id
      and fc.deleted_at is null
      and fc.created_at >= (now() - interval '7 days')
  ) feed_activity;

  return jsonb_build_object(
    'chat', v_chat_unread + v_incoming_friends,
    'room', v_incoming_room_requests,
    'feed', v_feed_notifications,
    'today', 0,
    'progress', 0
  );
end;
$$;

grant execute on function public.get_user_navigation_badges() to authenticated;
