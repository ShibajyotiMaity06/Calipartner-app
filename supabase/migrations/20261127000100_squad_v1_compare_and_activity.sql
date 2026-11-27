-- Squad Design System v1 backend support:
-- 1) Pinned squad goal on rooms + set_room_pinned_goal RPC
-- 2) Enriched get_my_rooms & get_squad_today (strictly backwards-compatible, privacy-filtered)
-- 3) get_squad_activity RPC (privacy-filtered workouts, water milestones, joins)
-- 4) chat_message_reactions table + toggle_chat_reaction & get_chat_reactions RPCs
-- 5) get_squad_compare RPC implementing all 7 Compare rules + Pro gating + privacy filtering

alter table public.rooms
  add column if not exists pinned_goal text
  check (pinned_goal is null or char_length(trim(pinned_goal)) <= 120);

create or replace function public.set_room_pinned_goal(p_room_id uuid, p_goal text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_clean text;
begin
  perform public.assert_squad_access(p_room_id);
  v_clean := nullif(trim(coalesce(p_goal, '')), '');
  if v_clean is not null and char_length(v_clean) > 120 then
    raise exception 'INVALID_INPUT';
  end if;
  update public.rooms
  set pinned_goal = v_clean, updated_at = now()
  where id = p_room_id;
  return v_clean;
end;
$$;

revoke all on function public.set_room_pinned_goal(uuid, text) from public, anon;
grant execute on function public.set_room_pinned_goal(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Enriched get_my_rooms() preserving all existing JSON keys
-- -----------------------------------------------------------------------------
create or replace function public.get_my_rooms()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', r.id,
      'name', r.name,
      'code', r.code,
      'state', r.state,
      'created_at', r.created_at,
      'who_can_invite', r.who_can_invite,
      'plan_holder_id', r.plan_holder_id,
      'plan_holder_name', ph.nickname,
      'pinned_goal', r.pinned_goal,
      'member_cap', public.room_cap(r.id),
      'role', own.role,
      'my_status', own.status,
      'member_count', (
        select count(*)
        from public.room_members m
        where m.room_id = r.id and m.status in ('active', 'paused', 'locked')
      )
    ) order by r.created_at, r.id), '[]'::jsonb)
    from public.room_members own
    join public.rooms r on r.id = own.room_id
    left join public.profiles ph on ph.id = r.plan_holder_id
    where own.user_id = auth.uid()
      and own.status in ('active', 'paused', 'locked')
      and r.state <> 'archived'
  );
end;
$$;

revoke all on function public.get_my_rooms() from public, anon;
grant execute on function public.get_my_rooms() to authenticated;

-- -----------------------------------------------------------------------------
-- Enriched get_squad_today(p_room_id) preserving all existing member keys
-- -----------------------------------------------------------------------------
create or replace function public.get_squad_today(p_room_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_room public.rooms;
  v_latest_msg jsonb;
begin
  perform public.assert_squad_access(p_room_id);
  select * into v_room from public.rooms where id = p_room_id;

  select jsonb_build_object(
    'id', cm.id,
    'sender_name', mp.nickname,
    'text', cm.text,
    'message_type', cm.message_type,
    'created_at', cm.created_at
  )
  into v_latest_msg
  from public.chat_messages cm
  left join public.profiles mp on mp.id = cm.sender_id
  where cm.room_id = p_room_id
    and cm.deleted_at is null
    and (
      cm.sender_id is null
      or (
        not exists (
          select 1 from public.blocks b
          where (b.blocker_id = auth.uid() and b.blocked_id = cm.sender_id)
             or (b.blocked_id = auth.uid() and b.blocker_id = cm.sender_id)
        )
        and not exists (
          select 1 from public.member_mutes mu
          where mu.user_id = auth.uid() and mu.muted_user_id = cm.sender_id
        )
      )
    )
  order by cm.created_at desc, cm.id desc
  limit 1;

  return jsonb_build_object(
    'room_id', p_room_id,
    'pinned_goal', v_room.pinned_goal,
    'latest_message', v_latest_msg,
    'members', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'user_id', p.id,
        'username', p.username,
        'nickname', p.nickname,
        'avatar_url', p.avatar_url,
        'is_self', p.id = auth.uid(),
        'role', m.role,
        'status', m.status,
        'local_date', (now() at time zone p.timezone)::date,
        'goal', g.goal,
        'city', p.place,
        'training_style', nullif(sp.training_style, ''),
        'calories', case when coalesce((tp.enabled->>'calories')::boolean, true) then coalesce(f.calories, 0) else null end,
        'protein', case when coalesce((tp.enabled->>'protein')::boolean, true) then coalesce(f.protein, 0) else null end,
        'carbs', case when coalesce((tp.enabled->>'carbs')::boolean, true) then coalesce(f.carbs, 0) else null end,
        'fat', case when coalesce((tp.enabled->>'fat')::boolean, true) then coalesce(f.fat, 0) else null end,
        'tracking', coalesce(tp.enabled, '{"calories":true,"protein":true,"carbs":true,"fat":true,"steps":true,"water":false}'::jsonb),
        'steps', case when coalesce((tp.enabled->>'steps')::boolean, true) then coalesce(a.steps, 0) else null end,
        'water', case when coalesce((tp.enabled->>'water')::boolean, false) then coalesce(h.water, 0) else null end,
        'targets', case when g.id is null then null else jsonb_build_object(
          'calories', g.daily_calorie_target,
          'protein', g.protein_grams,
          'carbs', g.carb_grams,
          'fat', g.fat_grams,
          'steps', g.step_goal,
          'water', g.water_ml_goal
        ) end,
        'height_cm', case when p.id = auth.uid() or coalesce((m.privacy_settings->>'share_height')::boolean, false) then p.height_cm else null end,
        'weight_kg', case when p.id = auth.uid() or coalesce((m.privacy_settings->>'share_weight_number')::boolean, false) then coalesce(w.weight_kg, g.current_weight_kg) else null end,
        'privacy', m.privacy_settings,
        'rest_day_today', coalesce(pd.is_rest, false),
        'workout_today', case
          when (p.id = auth.uid() or coalesce((m.privacy_settings->>'share_workouts')::boolean, true)) and wt.id is not null
          then jsonb_build_object(
            'id', wt.id,
            'name', coalesce(nullif(wt.name, ''), initcap(replace(wt.type, '_', ' '))),
            'type', wt.type,
            'duration_minutes', wt.duration_minutes,
            'exercise_count', wt.exercise_count,
            'occurred_at', wt.occurred_at
          )
          else null
        end,
        'latest_activity', case
          when (p.id = auth.uid() or coalesce((m.privacy_settings->>'share_workouts')::boolean, true)) and wt.id is not null
          then jsonb_build_object(
            'kind', 'workout',
            'label', coalesce(nullif(wt.name, ''), initcap(replace(wt.type, '_', ' '))),
            'occurred_at', wt.occurred_at
          )
          when (p.id = auth.uid() or coalesce((m.privacy_settings->>'share_meals')::text, 'never') <> 'never' or coalesce((m.privacy_settings->>'share_calories_macros')::boolean, false)) and fl.meal_section is not null
          then jsonb_build_object(
            'kind', 'meal',
            'label', fl.meal_section,
            'occurred_at', fl.logged_at
          )
          else null
        end
      ) order by p.id), '[]'::jsonb)
      from public.room_members m
      join public.profiles p on p.id = m.user_id
      left join public.social_profiles sp on sp.user_id = p.id
      left join public.tracking_preferences tp on tp.user_id = p.id
      left join lateral (
        select * from public.goal_profiles
        where user_id = p.id and effective_from <= now()
        order by effective_from desc, created_at desc, id desc limit 1
      ) g on true
      left join lateral (
        select sum(calories) calories, sum(protein) protein, sum(carbs) carbs, sum(fat) fat
        from public.food_entries
        where user_id = p.id and deleted_at is null
          and local_date::text = (now() at time zone p.timezone)::date::text
      ) f on true
      left join lateral (
        select meal_section, logged_at
        from public.food_entries
        where user_id = p.id and deleted_at is null
          and local_date::text = (now() at time zone p.timezone)::date::text
        order by logged_at desc, id desc limit 1
      ) fl on true
      left join lateral (
        select sum(amount_ml) water
        from public.water_logs
        where user_id = p.id and deleted_at is null
          and local_date::text = (now() at time zone p.timezone)::date::text
      ) h on true
      left join public.activity_days a
        on a.user_id = p.id
       and a.local_date::text = (now() at time zone p.timezone)::date::text
       and a.deleted_at is null
      left join lateral (
        select weight_kg
        from public.weight_logs
        where user_id = p.id and deleted_at is null and logged_at <= now()
        order by logged_at desc, id desc limit 1
      ) w on true
      left join lateral (
        select
          wo.id,
          wo.name,
          wo.type,
          wo.duration_minutes,
          coalesce(wo.start_time, wo.created_at) as occurred_at,
          (
            select count(*)::integer
            from public.workout_exercises we
            where we.workout_id = wo.id and we.user_id = p.id and we.deleted_at is null
          ) as exercise_count
        from public.workouts wo
        where wo.user_id = p.id
          and wo.deleted_at is null
          and wo.local_date::text = (now() at time zone p.timezone)::date::text
        order by coalesce(wo.start_time, wo.created_at) desc, wo.id desc
        limit 1
      ) wt on true
      left join lateral (
        select d.is_rest
        from public.user_workout_plans uwp
        join public.plan_days d on d.plan_id = uwp.id and d.user_id = p.id
        where uwp.user_id = p.id
          and uwp.status = 'active'
          and d.weekday = extract(isodow from (now() at time zone p.timezone)::date)::integer
        order by uwp.updated_at desc
        limit 1
      ) pd on true
      where m.room_id = p_room_id
        and m.status in ('active', 'paused', 'locked')
        and not exists (
          select 1 from public.blocks b
          where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
             or (b.blocked_id = auth.uid() and b.blocker_id = p.id)
        )
    )
  );
end;
$$;

revoke all on function public.get_squad_today(uuid) from public, anon;
grant execute on function public.get_squad_today(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Squad activity feed (privacy-enforced, block-filtered)
-- -----------------------------------------------------------------------------
create or replace function public.get_squad_activity(p_room_id uuid, p_limit integer default 12)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_lim integer := least(greatest(coalesce(p_limit, 12), 1), 30);
begin
  perform public.assert_squad_access(p_room_id);

  return (
    select coalesce(jsonb_agg(item order by occurred_at desc), '[]'::jsonb)
    from (
      select occurred_at, item
      from (
        -- 1. Finished workouts (within 14 days)
        select
          coalesce(wo.start_time, wo.created_at) as occurred_at,
          jsonb_build_object(
            'id', 'wo:' || wo.id::text,
            'user_id', p.id,
            'nickname', p.nickname,
            'kind', 'workout',
            'label', coalesce(nullif(wo.name, ''), initcap(replace(wo.type, '_', ' '))),
            'occurred_at', coalesce(wo.start_time, wo.created_at)
          ) as item
        from public.room_members m
        join public.profiles p on p.id = m.user_id
        join public.workouts wo on wo.user_id = p.id and wo.deleted_at is null
        where m.room_id = p_room_id
          and m.status in ('active', 'paused', 'locked')
          and coalesce(wo.start_time, wo.created_at) >= now() - interval '14 days'
          and (p.id = auth.uid() or coalesce((m.privacy_settings->>'share_workouts')::boolean, true))
          and not exists (
            select 1 from public.blocks b
            where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
               or (b.blocked_id = auth.uid() and b.blocker_id = p.id)
          )

        union all

        -- 2. Water goal hit today
        select
          wl.last_logged_at as occurred_at,
          jsonb_build_object(
            'id', 'water:' || p.id::text || ':' || ((now() at time zone p.timezone)::date)::text,
            'user_id', p.id,
            'nickname', p.nickname,
            'kind', 'water_goal',
            'label', 'water goal',
            'occurred_at', wl.last_logged_at
          ) as item
        from public.room_members m
        join public.profiles p on p.id = m.user_id
        left join public.tracking_preferences tp on tp.user_id = p.id
        join lateral (
          select water_ml_goal
          from public.goal_profiles
          where user_id = p.id and effective_from <= now()
          order by effective_from desc, created_at desc, id desc limit 1
        ) g on true
        join lateral (
          select sum(amount_ml) as total_ml, max(logged_at) as last_logged_at
          from public.water_logs
          where user_id = p.id and deleted_at is null
            and local_date::text = (now() at time zone p.timezone)::date::text
        ) wl on true
        where m.room_id = p_room_id
          and m.status in ('active', 'paused', 'locked')
          and coalesce((tp.enabled->>'water')::boolean, false) = true
          and coalesce(g.water_ml_goal, 0) > 0
          and coalesce(wl.total_ml, 0) >= g.water_ml_goal
          and (p.id = auth.uid() or coalesce((m.privacy_settings->>'share_water')::boolean, true))
          and not exists (
            select 1 from public.blocks b
            where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
               or (b.blocked_id = auth.uid() and b.blocker_id = p.id)
          )

        union all

        -- 3. Member joins
        select
          m.joined_at as occurred_at,
          jsonb_build_object(
            'id', 'join:' || m.id::text,
            'user_id', p.id,
            'nickname', p.nickname,
            'kind', 'member_joined',
            'label', 'joined',
            'occurred_at', m.joined_at
          ) as item
        from public.room_members m
        join public.profiles p on p.id = m.user_id
        where m.room_id = p_room_id
          and m.status in ('active', 'paused', 'locked')
          and not exists (
            select 1 from public.blocks b
            where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
               or (b.blocked_id = auth.uid() and b.blocker_id = p.id)
          )
      ) events
      order by occurred_at desc
      limit v_lim
    ) ranked
  );
end;
$$;

revoke all on function public.get_squad_activity(uuid, integer) from public, anon;
grant execute on function public.get_squad_activity(uuid, integer) to authenticated;

-- -----------------------------------------------------------------------------
-- Chat reactions table + RPCs
-- -----------------------------------------------------------------------------
create table if not exists public.chat_message_reactions (
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null default 'heart' check (emoji in ('heart')),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

alter table public.chat_message_reactions enable row level security;
drop policy if exists chat_reactions_no_direct_access on public.chat_message_reactions;
create policy chat_reactions_no_direct_access
  on public.chat_message_reactions
  for all to authenticated
  using (false)
  with check (false);

create or replace function public.toggle_chat_reaction(
  p_message_id uuid,
  p_emoji text default 'heart'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_msg public.chat_messages;
  v_emoji text := coalesce(nullif(trim(p_emoji), ''), 'heart');
  v_liked boolean := false;
  v_count integer := 0;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if v_emoji <> 'heart' then raise exception 'INVALID_INPUT'; end if;

  select * into v_msg
  from public.chat_messages
  where id = p_message_id and deleted_at is null;

  if not found then raise exception 'NOT_FOUND'; end if;
  perform public.assert_squad_access(v_msg.room_id);

  if exists (
    select 1 from public.chat_message_reactions
    where message_id = p_message_id and user_id = auth.uid() and emoji = v_emoji
  ) then
    delete from public.chat_message_reactions
    where message_id = p_message_id and user_id = auth.uid() and emoji = v_emoji;
    v_liked := false;
  else
    insert into public.chat_message_reactions (message_id, user_id, emoji)
    values (p_message_id, auth.uid(), v_emoji)
    on conflict (message_id, user_id, emoji) do nothing;
    v_liked := true;
  end if;

  select count(*)::integer into v_count
  from public.chat_message_reactions
  where message_id = p_message_id and emoji = v_emoji;

  return jsonb_build_object(
    'message_id', p_message_id,
    'emoji', v_emoji,
    'count', v_count,
    'viewer_liked', v_liked
  );
end;
$$;

create or replace function public.get_chat_reactions(
  p_room_id uuid,
  p_message_ids uuid[]
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.assert_squad_access(p_room_id);
  return (
    select coalesce(jsonb_object_agg(r.message_id::text, jsonb_build_object(
      'count', r.cnt,
      'viewer_liked', r.viewer_liked
    )), '{}'::jsonb)
    from (
      select
        cm.id as message_id,
        count(cr.user_id)::integer as cnt,
        bool_or(cr.user_id = auth.uid()) as viewer_liked
      from public.chat_messages cm
      join public.chat_message_reactions cr on cr.message_id = cm.id
      where cm.room_id = p_room_id
        and cm.id = any(p_message_ids)
        and cm.deleted_at is null
      group by cm.id
    ) r
  );
end;
$$;

revoke all on function public.toggle_chat_reaction(uuid, text), public.get_chat_reactions(uuid, uuid[]) from public, anon;
grant execute on function public.toggle_chat_reaction(uuid, text), public.get_chat_reactions(uuid, uuid[]) to authenticated;

-- -----------------------------------------------------------------------------
-- Head-to-head Compare RPC (Rules 1-7 + Pro/Free gating + Privacy enforcement)
-- -----------------------------------------------------------------------------
create or replace function public.get_squad_compare(
  p_room_id uuid,
  p_left_id uuid,
  p_right_id uuid,
  p_range text default '7d'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_is_pro boolean;
  v_days integer;
  v_left_profile public.profiles;
  v_right_profile public.profiles;
  v_left_member public.room_members;
  v_right_member public.room_members;
  v_left_tp jsonb;
  v_right_tp jsonb;
  v_left_g public.goal_profiles;
  v_right_g public.goal_profiles;
  v_left_today date;
  v_right_today date;
  v_left_start date;
  v_right_start date;
  v_left_end date;
  v_right_end date;
  v_left_join_date date;
  v_right_join_date date;
  v_left_overall integer := 0;
  v_right_overall integer := 0;
  v_in_sync integer := 0;
  v_days_together integer := 0;
  v_shared_workouts integer := 0;
  v_days_strip jsonb := '[]'::jsonb;
  v_head_to_head jsonb := '[]'::jsonb;
  v_macros jsonb := '[]'::jsonb;
  v_today_rows jsonb := '[]'::jsonb;
  v_workouts_detail jsonb := null;
  v_meals_detail jsonb := null;
  v_left_tracker_count integer := 0;
  v_right_tracker_count integer := 0;
  v_left_wo_count integer := 0;
  v_right_wo_count integer := 0;
  v_left_steps_pct integer := 0;
  v_right_steps_pct integer := 0;
  v_left_water_pct integer := 0;
  v_right_water_pct integer := 0;
  v_left_protein_pct integer := 0;
  v_right_protein_pct integer := 0;
  v_left_carbs_pct integer := 0;
  v_right_carbs_pct integer := 0;
  v_left_fat_pct integer := 0;
  v_right_fat_pct integer := 0;
  v_left_wo_shared boolean;
  v_right_wo_shared boolean;
  v_left_meals_shared boolean;
  v_right_meals_shared boolean;
  v_left_wo_today record;
  v_right_wo_today record;
  v_left_rest_today boolean := false;
  v_right_rest_today boolean := false;
  v_left_meals_today integer := 0;
  v_right_meals_today integer := 0;
  v_left_cal_today numeric := 0;
  v_right_cal_today numeric := 0;
  v_left_pro_today numeric := 0;
  v_right_pro_today numeric := 0;
  v_left_carb_today numeric := 0;
  v_right_carb_today numeric := 0;
  v_left_fat_today numeric := 0;
  v_right_fat_today numeric := 0;
  v_left_steps_today numeric := 0;
  v_right_steps_today numeric := 0;
  v_left_water_today numeric := 0;
  v_right_water_today numeric := 0;
  v_default_tp jsonb := '{"calories":true,"protein":true,"carbs":true,"fat":true,"steps":true,"water":false}'::jsonb;
begin
  perform public.assert_squad_access(p_room_id);

  if p_range not in ('today', '7d', '30d') then
    raise exception 'INVALID_RANGE';
  end if;

  if not public.is_room_member(p_room_id, p_left_id) or not public.is_room_member(p_room_id, p_right_id) then
    raise exception 'NOT_ROOM_MEMBER';
  end if;

  if exists (
    select 1 from public.blocks
    where (blocker_id = auth.uid() and blocked_id in (p_left_id, p_right_id))
       or (blocked_id = auth.uid() and blocker_id in (p_left_id, p_right_id))
  ) then
    raise exception 'USER_BLOCKED';
  end if;

  v_is_pro := (public.active_room_tier(auth.uid()) = 'pro');
  v_days := case when p_range = 'today' then 1 when p_range = '30d' then 30 else 7 end;

  select * into v_left_profile from public.profiles where id = p_left_id;
  select * into v_right_profile from public.profiles where id = p_right_id;
  select * into v_left_member from public.room_members where room_id = p_room_id and user_id = p_left_id;
  select * into v_right_member from public.room_members where room_id = p_room_id and user_id = p_right_id;

  select coalesce(tp.enabled, v_default_tp) into v_left_tp from public.tracking_preferences tp where tp.user_id = p_left_id;
  v_left_tp := coalesce(v_left_tp, v_default_tp);

  select coalesce(tp.enabled, v_default_tp) into v_right_tp from public.tracking_preferences tp where tp.user_id = p_right_id;
  v_right_tp := coalesce(v_right_tp, v_default_tp);

  select * into v_left_g from public.goal_profiles where user_id = p_left_id and effective_from <= now() order by effective_from desc, created_at desc, id desc limit 1;
  select * into v_right_g from public.goal_profiles where user_id = p_right_id and effective_from <= now() order by effective_from desc, created_at desc, id desc limit 1;

  v_left_today := (now() at time zone coalesce(v_left_profile.timezone, 'UTC'))::date;
  v_right_today := (now() at time zone coalesce(v_right_profile.timezone, 'UTC'))::date;
  v_left_join_date := (v_left_member.joined_at at time zone coalesce(v_left_profile.timezone, 'UTC'))::date;
  v_right_join_date := (v_right_member.joined_at at time zone coalesce(v_right_profile.timezone, 'UTC'))::date;

  if p_range = 'today' then
    v_left_start := v_left_today;
    v_left_end := v_left_today;
    v_right_start := v_right_today;
    v_right_end := v_right_today;
  else
    -- Completed days only: yesterday back v_days - 1, clipped to join date when member is new
    v_left_end := v_left_today - 1;
    v_left_start := greatest(v_left_today - v_days, least(v_left_join_date, v_left_end));
    v_right_end := v_right_today - 1;
    v_right_start := greatest(v_right_today - v_days, least(v_right_join_date, v_right_end));
  end if;

  v_left_wo_shared := (p_left_id = auth.uid() or coalesce((v_left_member.privacy_settings->>'share_workouts')::boolean, true));
  v_right_wo_shared := (p_right_id = auth.uid() or coalesce((v_right_member.privacy_settings->>'share_workouts')::boolean, true));
  v_left_meals_shared := (p_left_id = auth.uid() or coalesce((v_left_member.privacy_settings->>'share_meals')::text, 'never') <> 'never');
  v_right_meals_shared := (p_right_id = auth.uid() or coalesce((v_right_member.privacy_settings->>'share_meals')::text, 'never') <> 'never');

  v_left_tracker_count :=
    (case when coalesce((v_left_tp->>'calories')::boolean, true) then 1 else 0 end) +
    (case when coalesce((v_left_tp->>'protein')::boolean, true) then 1 else 0 end) +
    (case when coalesce((v_left_tp->>'carbs')::boolean, true) then 1 else 0 end) +
    (case when coalesce((v_left_tp->>'fat')::boolean, true) then 1 else 0 end) +
    (case when coalesce((v_left_tp->>'steps')::boolean, true) then 1 else 0 end) +
    (case when coalesce((v_left_tp->>'water')::boolean, false) then 1 else 0 end);

  v_right_tracker_count :=
    (case when coalesce((v_right_tp->>'calories')::boolean, true) then 1 else 0 end) +
    (case when coalesce((v_right_tp->>'protein')::boolean, true) then 1 else 0 end) +
    (case when coalesce((v_right_tp->>'carbs')::boolean, true) then 1 else 0 end) +
    (case when coalesce((v_right_tp->>'fat')::boolean, true) then 1 else 0 end) +
    (case when coalesce((v_right_tp->>'steps')::boolean, true) then 1 else 0 end) +
    (case when coalesce((v_right_tp->>'water')::boolean, false) then 1 else 0 end);

  -- Daily series scores over window (step index 0..v_days-1 aligned by offset from end date)
  with idx as (
    select generate_series(0, least(v_days - 1, 29)) as off
  ),
  left_daily as (
    select
      idx.off,
      (v_left_end - idx.off) as d,
      coalesce(fe.calories, 0) as calories,
      coalesce(fe.protein, 0) as protein,
      coalesce(fe.carbs, 0) as carbs,
      coalesce(fe.fat, 0) as fat,
      coalesce(ad.steps, 0) as steps,
      coalesce(wl.water, 0) as water,
      coalesce(wo.cnt, 0) as wo_cnt,
      coalesce(pd.is_rest, false) as is_rest,
      ((v_left_end - idx.off) >= v_left_join_date or p_range = 'today') as in_membership
    from idx
    left join lateral (
      select sum(calories) calories, sum(protein) protein, sum(carbs) carbs, sum(fat) fat
      from public.food_entries
      where user_id = p_left_id and deleted_at is null and local_date = (v_left_end - idx.off)
    ) fe on true
    left join public.activity_days ad
      on ad.user_id = p_left_id and ad.deleted_at is null and ad.local_date = (v_left_end - idx.off)::text
    left join lateral (
      select sum(amount_ml) water from public.water_logs
      where user_id = p_left_id and deleted_at is null and local_date = (v_left_end - idx.off)::text
    ) wl on true
    left join lateral (
      select count(*)::integer cnt from public.workouts
      where user_id = p_left_id and deleted_at is null and local_date = (v_left_end - idx.off)::text
    ) wo on true
    left join lateral (
      select d.is_rest from public.user_workout_plans uwp
      join public.plan_days d on d.plan_id = uwp.id and d.user_id = p_left_id
      where uwp.user_id = p_left_id and uwp.status = 'active'
        and d.weekday = extract(isodow from (v_left_end - idx.off))::integer
      order by uwp.updated_at desc limit 1
    ) pd on true
  ),
  right_daily as (
    select
      idx.off,
      (v_right_end - idx.off) as d,
      coalesce(fe.calories, 0) as calories,
      coalesce(fe.protein, 0) as protein,
      coalesce(fe.carbs, 0) as carbs,
      coalesce(fe.fat, 0) as fat,
      coalesce(ad.steps, 0) as steps,
      coalesce(wl.water, 0) as water,
      coalesce(wo.cnt, 0) as wo_cnt,
      coalesce(pd.is_rest, false) as is_rest,
      ((v_right_end - idx.off) >= v_right_join_date or p_range = 'today') as in_membership
    from idx
    left join lateral (
      select sum(calories) calories, sum(protein) protein, sum(carbs) carbs, sum(fat) fat
      from public.food_entries
      where user_id = p_right_id and deleted_at is null and local_date = (v_right_end - idx.off)
    ) fe on true
    left join public.activity_days ad
      on ad.user_id = p_right_id and ad.deleted_at is null and ad.local_date = (v_right_end - idx.off)::text
    left join lateral (
      select sum(amount_ml) water from public.water_logs
      where user_id = p_right_id and deleted_at is null and local_date = (v_right_end - idx.off)::text
    ) wl on true
    left join lateral (
      select count(*)::integer cnt from public.workouts
      where user_id = p_right_id and deleted_at is null and local_date = (v_right_end - idx.off)::text
    ) wo on true
    left join lateral (
      select d.is_rest from public.user_workout_plans uwp
      join public.plan_days d on d.plan_id = uwp.id and d.user_id = p_right_id
      where uwp.user_id = p_right_id and uwp.status = 'active'
        and d.weekday = extract(isodow from (v_right_end - idx.off))::integer
      order by uwp.updated_at desc limit 1
    ) pd on true
  ),
  scored as (
    select
      ld.off,
      ld.d as left_date,
      rd.d as right_date,
      ld.in_membership as left_ok,
      rd.in_membership as right_ok,
      ld.wo_cnt as left_wo,
      rd.wo_cnt as right_wo,
      -- Left daily score using own targets & own enabled trackers (Rule 4 & 5)
      (
        select round(avg(val))::integer from (
          select case
            when ld.calories <= 0 then 0
            when abs(ld.calories - v_left_g.daily_calorie_target) / nullif(v_left_g.daily_calorie_target, 0) <= 0.10 then 100
            else greatest(0, least(100, (1 - (abs(ld.calories - v_left_g.daily_calorie_target) / nullif(v_left_g.daily_calorie_target, 0) - 0.10) / 0.90) * 100))
          end as val where coalesce((v_left_tp->>'calories')::boolean, true) and coalesce(v_left_g.daily_calorie_target, 0) > 0
          union all
          select least(100, (ld.protein / nullif(v_left_g.protein_grams, 0)) * 100)
          where coalesce((v_left_tp->>'protein')::boolean, true) and coalesce(v_left_g.protein_grams, 0) > 0
          union all
          select case
            when ld.carbs <= 0 then 0
            when abs(ld.carbs - v_left_g.carb_grams) / nullif(v_left_g.carb_grams, 0) <= 0.10 then 100
            else greatest(0, least(100, (1 - (abs(ld.carbs - v_left_g.carb_grams) / nullif(v_left_g.carb_grams, 0) - 0.10) / 0.90) * 100))
          end where coalesce((v_left_tp->>'carbs')::boolean, true) and coalesce(v_left_g.carb_grams, 0) > 0
          union all
          select case
            when ld.fat <= 0 then 0
            when abs(ld.fat - v_left_g.fat_grams) / nullif(v_left_g.fat_grams, 0) <= 0.10 then 100
            else greatest(0, least(100, (1 - (abs(ld.fat - v_left_g.fat_grams) / nullif(v_left_g.fat_grams, 0) - 0.10) / 0.90) * 100))
          end where coalesce((v_left_tp->>'fat')::boolean, true) and coalesce(v_left_g.fat_grams, 0) > 0
          union all
          select least(100, (ld.steps::numeric / nullif(v_left_g.step_goal, 0)) * 100)
          where coalesce((v_left_tp->>'steps')::boolean, true) and coalesce(v_left_g.step_goal, 0) > 0
          union all
          select least(100, (ld.water::numeric / nullif(v_left_g.water_ml_goal, 0)) * 100)
          where coalesce((v_left_tp->>'water')::boolean, false) and coalesce(v_left_g.water_ml_goal, 0) > 0
        ) parts
      ) as left_score,
      (
        select round(avg(val))::integer from (
          select case
            when rd.calories <= 0 then 0
            when abs(rd.calories - v_right_g.daily_calorie_target) / nullif(v_right_g.daily_calorie_target, 0) <= 0.10 then 100
            else greatest(0, least(100, (1 - (abs(rd.calories - v_right_g.daily_calorie_target) / nullif(v_right_g.daily_calorie_target, 0) - 0.10) / 0.90) * 100))
          end as val where coalesce((v_right_tp->>'calories')::boolean, true) and coalesce(v_right_g.daily_calorie_target, 0) > 0
          union all
          select least(100, (rd.protein / nullif(v_right_g.protein_grams, 0)) * 100)
          where coalesce((v_right_tp->>'protein')::boolean, true) and coalesce(v_right_g.protein_grams, 0) > 0
          union all
          select case
            when rd.carbs <= 0 then 0
            when abs(rd.carbs - v_right_g.carb_grams) / nullif(v_right_g.carb_grams, 0) <= 0.10 then 100
            else greatest(0, least(100, (1 - (abs(rd.carbs - v_right_g.carb_grams) / nullif(v_right_g.carb_grams, 0) - 0.10) / 0.90) * 100))
          end where coalesce((v_right_tp->>'carbs')::boolean, true) and coalesce(v_right_g.carb_grams, 0) > 0
          union all
          select case
            when rd.fat <= 0 then 0
            when abs(rd.fat - v_right_g.fat_grams) / nullif(v_right_g.fat_grams, 0) <= 0.10 then 100
            else greatest(0, least(100, (1 - (abs(rd.fat - v_right_g.fat_grams) / nullif(v_right_g.fat_grams, 0) - 0.10) / 0.90) * 100))
          end where coalesce((v_right_tp->>'fat')::boolean, true) and coalesce(v_right_g.fat_grams, 0) > 0
          union all
          select least(100, (rd.steps::numeric / nullif(v_right_g.step_goal, 0)) * 100)
          where coalesce((v_right_tp->>'steps')::boolean, true) and coalesce(v_right_g.step_goal, 0) > 0
          union all
          select least(100, (rd.water::numeric / nullif(v_right_g.water_ml_goal, 0)) * 100)
          where coalesce((v_right_tp->>'water')::boolean, false) and coalesce(v_right_g.water_ml_goal, 0) > 0
        ) parts
      ) as right_score
    from left_daily ld
    join right_daily rd on rd.off = ld.off
  )
  select
    coalesce(round(avg(left_score) filter (where left_ok)), 0)::integer,
    coalesce(round(avg(right_score) filter (where right_ok)), 0)::integer,
    coalesce(round(greatest(0, 100 - avg(abs(left_score - right_score)) filter (where left_ok and right_ok and left_score is not null and right_score is not null))), 0)::integer,
    count(*) filter (where left_ok and right_ok and left_score >= 80 and right_score >= 80)::integer,
    count(*) filter (where v_left_wo_shared and v_right_wo_shared and left_wo > 0 and right_wo > 0)::integer,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', s.left_date::text,
        'label', left(to_char(s.left_date, 'Dy'), 1),
        'status', case
          when s.left_score >= 80 and s.right_score >= 80 then 'both'
          when s.left_score >= 80 or s.right_score >= 80 then 'one'
          else 'neither'
        end,
        'left_pct', s.left_score,
        'right_pct', s.right_score
      ) order by s.off desc)
      from (select * from scored where off < 7) s
    ), '[]'::jsonb)
  into v_left_overall, v_right_overall, v_in_sync, v_days_together, v_shared_workouts, v_days_strip
  from scored;

  -- Aggregates across window for Head to head and Macros (capped steps/water at 100%; raw macro avg %)
  select count(*)::integer into v_left_wo_count
  from public.workouts where user_id = p_left_id and deleted_at is null
    and local_date::date between v_left_start and v_left_end;
  select count(*)::integer into v_right_wo_count
  from public.workouts where user_id = p_right_id and deleted_at is null
    and local_date::date between v_right_start and v_right_end;

  select coalesce(round(avg(least(100, (coalesce(ad.steps, 0)::numeric / nullif(v_left_g.step_goal, 0)) * 100))), 0)::integer
  into v_left_steps_pct
  from generate_series(v_left_start, v_left_end, interval '1 day') g(d)
  left join public.activity_days ad on ad.user_id = p_left_id and ad.deleted_at is null and ad.local_date = g.d::date::text
  where coalesce(v_left_g.step_goal, 0) > 0;

  select coalesce(round(avg(least(100, (coalesce(ad.steps, 0)::numeric / nullif(v_right_g.step_goal, 0)) * 100))), 0)::integer
  into v_right_steps_pct
  from generate_series(v_right_start, v_right_end, interval '1 day') g(d)
  left join public.activity_days ad on ad.user_id = p_right_id and ad.deleted_at is null and ad.local_date = g.d::date::text
  where coalesce(v_right_g.step_goal, 0) > 0;

  select coalesce(round(avg(least(100, (coalesce(wl.tot, 0)::numeric / nullif(v_left_g.water_ml_goal, 0)) * 100))), 0)::integer
  into v_left_water_pct
  from generate_series(v_left_start, v_left_end, interval '1 day') g(d)
  left join lateral (
    select sum(amount_ml) tot from public.water_logs where user_id = p_left_id and deleted_at is null and local_date = g.d::date::text
  ) wl on true
  where coalesce(v_left_g.water_ml_goal, 0) > 0;

  select coalesce(round(avg(least(100, (coalesce(wl.tot, 0)::numeric / nullif(v_right_g.water_ml_goal, 0)) * 100))), 0)::integer
  into v_right_water_pct
  from generate_series(v_right_start, v_right_end, interval '1 day') g(d)
  left join lateral (
    select sum(amount_ml) tot from public.water_logs where user_id = p_right_id and deleted_at is null and local_date = g.d::date::text
  ) wl on true
  where coalesce(v_right_g.water_ml_goal, 0) > 0;

  -- Head-to-head rows (only metrics BOTH track and share)
  if v_left_wo_shared and v_right_wo_shared then
    v_head_to_head := v_head_to_head || jsonb_build_object(
      'key', 'workouts',
      'left_value', v_left_wo_count,
      'right_value', v_right_wo_count,
      'unit', 'count'
    );
  end if;
  if coalesce((v_left_tp->>'steps')::boolean, true) and coalesce((v_right_tp->>'steps')::boolean, true)
     and (p_left_id = auth.uid() or coalesce((v_left_member.privacy_settings->>'share_steps')::boolean, true))
     and (p_right_id = auth.uid() or coalesce((v_right_member.privacy_settings->>'share_steps')::boolean, true)) then
    v_head_to_head := v_head_to_head || jsonb_build_object(
      'key', 'steps',
      'left_value', v_left_steps_pct,
      'right_value', v_right_steps_pct,
      'unit', 'pct'
    );
  end if;
  if coalesce((v_left_tp->>'water')::boolean, false) and coalesce((v_right_tp->>'water')::boolean, false)
     and (p_left_id = auth.uid() or coalesce((v_left_member.privacy_settings->>'share_water')::boolean, true))
     and (p_right_id = auth.uid() or coalesce((v_right_member.privacy_settings->>'share_water')::boolean, true)) then
    v_head_to_head := v_head_to_head || jsonb_build_object(
      'key', 'water',
      'left_value', v_left_water_pct,
      'right_value', v_right_water_pct,
      'unit', 'pct'
    );
  end if;

  -- Macros average % over window (shared enabled macros only; no raw calories exposed)
  select
    coalesce(round(avg((coalesce(fe.protein, 0) / nullif(v_left_g.protein_grams, 0)) * 100)), 0)::integer,
    coalesce(round(avg((coalesce(fe.carbs, 0) / nullif(v_left_g.carb_grams, 0)) * 100)), 0)::integer,
    coalesce(round(avg((coalesce(fe.fat, 0) / nullif(v_left_g.fat_grams, 0)) * 100)), 0)::integer
  into v_left_protein_pct, v_left_carbs_pct, v_left_fat_pct
  from generate_series(v_left_start, v_left_end, interval '1 day') g(d)
  left join lateral (
    select sum(protein) protein, sum(carbs) carbs, sum(fat) fat
    from public.food_entries where user_id = p_left_id and deleted_at is null and local_date = g.d::date
  ) fe on true;

  select
    coalesce(round(avg((coalesce(fe.protein, 0) / nullif(v_right_g.protein_grams, 0)) * 100)), 0)::integer,
    coalesce(round(avg((coalesce(fe.carbs, 0) / nullif(v_right_g.carb_grams, 0)) * 100)), 0)::integer,
    coalesce(round(avg((coalesce(fe.fat, 0) / nullif(v_right_g.fat_grams, 0)) * 100)), 0)::integer
  into v_right_protein_pct, v_right_carbs_pct, v_right_fat_pct
  from generate_series(v_right_start, v_right_end, interval '1 day') g(d)
  left join lateral (
    select sum(protein) protein, sum(carbs) carbs, sum(fat) fat
    from public.food_entries where user_id = p_right_id and deleted_at is null and local_date = g.d::date
  ) fe on true;

  if coalesce((v_left_tp->>'protein')::boolean, true) and coalesce((v_right_tp->>'protein')::boolean, true) then
    v_macros := v_macros || jsonb_build_object('key', 'protein', 'left_pct', v_left_protein_pct, 'right_pct', v_right_protein_pct);
  end if;
  if coalesce((v_left_tp->>'carbs')::boolean, true) and coalesce((v_right_tp->>'carbs')::boolean, true) then
    v_macros := v_macros || jsonb_build_object('key', 'carbs', 'left_pct', v_left_carbs_pct, 'right_pct', v_right_carbs_pct);
  end if;
  if coalesce((v_left_tp->>'fat')::boolean, true) and coalesce((v_right_tp->>'fat')::boolean, true) then
    v_macros := v_macros || jsonb_build_object('key', 'fat', 'left_pct', v_left_fat_pct, 'right_pct', v_right_fat_pct);
  end if;

  -- Today side-by-side detail rows (Rule 2 + Screen 77)
  select count(distinct meal_section)::integer, coalesce(sum(calories), 0), coalesce(sum(protein), 0), coalesce(sum(carbs), 0), coalesce(sum(fat), 0)
  into v_left_meals_today, v_left_cal_today, v_left_pro_today, v_left_carb_today, v_left_fat_today
  from public.food_entries where user_id = p_left_id and deleted_at is null and local_date = v_left_today;

  select count(distinct meal_section)::integer, coalesce(sum(calories), 0), coalesce(sum(protein), 0), coalesce(sum(carbs), 0), coalesce(sum(fat), 0)
  into v_right_meals_today, v_right_cal_today, v_right_pro_today, v_right_carb_today, v_right_fat_today
  from public.food_entries where user_id = p_right_id and deleted_at is null and local_date = v_right_today;

  select coalesce(steps, 0) into v_left_steps_today from public.activity_days where user_id = p_left_id and deleted_at is null and local_date = v_left_today::text;
  select coalesce(steps, 0) into v_right_steps_today from public.activity_days where user_id = p_right_id and deleted_at is null and local_date = v_right_today::text;
  select coalesce(sum(amount_ml), 0) into v_left_water_today from public.water_logs where user_id = p_left_id and deleted_at is null and local_date = v_left_today::text;
  select coalesce(sum(amount_ml), 0) into v_right_water_today from public.water_logs where user_id = p_right_id and deleted_at is null and local_date = v_right_today::text;

  select id, coalesce(nullif(name, ''), initcap(replace(type, '_', ' '))) as name, duration_minutes into v_left_wo_today
  from public.workouts where user_id = p_left_id and deleted_at is null and local_date = v_left_today::text
  order by coalesce(start_time, created_at) desc limit 1;

  select id, coalesce(nullif(name, ''), initcap(replace(type, '_', ' '))) as name, duration_minutes into v_right_wo_today
  from public.workouts where user_id = p_right_id and deleted_at is null and local_date = v_right_today::text
  order by coalesce(start_time, created_at) desc limit 1;

  select coalesce(d.is_rest, false) into v_left_rest_today
  from public.user_workout_plans uwp join public.plan_days d on d.plan_id = uwp.id and d.user_id = p_left_id
  where uwp.user_id = p_left_id and uwp.status = 'active' and d.weekday = extract(isodow from v_left_today)::integer
  order by uwp.updated_at desc limit 1;

  select coalesce(d.is_rest, false) into v_right_rest_today
  from public.user_workout_plans uwp join public.plan_days d on d.plan_id = uwp.id and d.user_id = p_right_id
  where uwp.user_id = p_right_id and uwp.status = 'active' and d.weekday = extract(isodow from v_right_today)::integer
  order by uwp.updated_at desc limit 1;

  if v_left_wo_shared and v_right_wo_shared then
    v_today_rows := v_today_rows || jsonb_build_object(
      'key', 'workout',
      'left_tracks', true,
      'right_tracks', true,
      'left_pct', null,
      'right_pct', null,
      'left_label', case when v_left_wo_today.id is not null then v_left_wo_today.name || case when coalesce(v_left_wo_today.duration_minutes, 0) > 0 then ' · ' || v_left_wo_today.duration_minutes || ' min' else '' end else null end,
      'right_label', case when v_right_wo_today.id is not null then v_right_wo_today.name || case when coalesce(v_right_wo_today.duration_minutes, 0) > 0 then ' · ' || v_right_wo_today.duration_minutes || ' min' else '' end else null end,
      'left_is_rest', coalesce(v_left_rest_today, false),
      'right_is_rest', coalesce(v_right_rest_today, false),
      'left_done', v_left_wo_today.id is not null,
      'right_done', v_right_wo_today.id is not null
    );
  end if;

  if coalesce((v_left_tp->>'calories')::boolean, true) or coalesce((v_right_tp->>'calories')::boolean, true) then
    v_today_rows := v_today_rows || jsonb_build_object(
      'key', 'meals',
      'left_tracks', coalesce((v_left_tp->>'calories')::boolean, true),
      'right_tracks', coalesce((v_right_tp->>'calories')::boolean, true),
      'left_pct', case when coalesce(v_left_g.daily_calorie_target, 0) > 0 then least(100, round((coalesce(v_left_cal_today, 0) / v_left_g.daily_calorie_target) * 100))::integer else 0 end,
      'right_pct', case when coalesce(v_right_g.daily_calorie_target, 0) > 0 then least(100, round((coalesce(v_right_cal_today, 0) / v_right_g.daily_calorie_target) * 100))::integer else 0 end,
      'left_label', case when coalesce(v_left_meals_today, 0) > 0 then v_left_meals_today::text else null end,
      'right_label', case when coalesce(v_right_meals_today, 0) > 0 then v_right_meals_today::text else null end,
      'left_done', coalesce(v_left_meals_today, 0) > 0,
      'right_done', coalesce(v_right_meals_today, 0) > 0
    );
  end if;

  if coalesce((v_left_tp->>'water')::boolean, false) or coalesce((v_right_tp->>'water')::boolean, false) then
    v_today_rows := v_today_rows || jsonb_build_object(
      'key', 'water',
      'left_tracks', coalesce((v_left_tp->>'water')::boolean, false),
      'right_tracks', coalesce((v_right_tp->>'water')::boolean, false),
      'left_pct', case when coalesce(v_left_g.water_ml_goal, 0) > 0 then least(100, round((coalesce(v_left_water_today, 0) / v_left_g.water_ml_goal) * 100))::integer else 0 end,
      'right_pct', case when coalesce(v_right_g.water_ml_goal, 0) > 0 then least(100, round((coalesce(v_right_water_today, 0) / v_right_g.water_ml_goal) * 100))::integer else 0 end
    );
  end if;

  if coalesce((v_left_tp->>'steps')::boolean, true) or coalesce((v_right_tp->>'steps')::boolean, true) then
    v_today_rows := v_today_rows || jsonb_build_object(
      'key', 'steps',
      'left_tracks', coalesce((v_left_tp->>'steps')::boolean, true),
      'right_tracks', coalesce((v_right_tp->>'steps')::boolean, true),
      'left_pct', case when coalesce(v_left_g.step_goal, 0) > 0 then least(100, round((coalesce(v_left_steps_today, 0) / v_left_g.step_goal) * 100))::integer else 0 end,
      'right_pct', case when coalesce(v_right_g.step_goal, 0) > 0 then least(100, round((coalesce(v_right_steps_today, 0) / v_right_g.step_goal) * 100))::integer else 0 end
    );
  end if;

  -- Pro-only workout splits/volume & most-logged meals (Rule 7)
  if v_is_pro then
    v_workouts_detail := jsonb_build_object(
      'left', case when v_left_wo_shared then (
        select jsonb_build_object(
          'shared', true,
          'count', v_left_wo_count,
          'splits', coalesce((
            select jsonb_agg(jsonb_build_object('label', s.lbl, 'count', s.cnt) order by s.cnt desc, s.lbl)
            from (
              select coalesce(nullif(w.name, ''), initcap(replace(w.type, '_', ' '))) as lbl, count(*)::integer as cnt
              from public.workouts w
              where w.user_id = p_left_id and w.deleted_at is null and w.local_date::date between v_left_start and v_left_end
              group by 1 limit 4
            ) s
          ), '[]'::jsonb),
          'duration_minutes', coalesce((select sum(w.duration_minutes)::integer from public.workouts w where w.user_id = p_left_id and w.deleted_at is null and w.local_date::date between v_left_start and v_left_end), 0),
          'volume_kg', coalesce((
            select round(sum(coalesce(ws.reps, 0) * coalesce(ws.weight_kg, 0)))::numeric
            from public.workouts w
            join public.workout_sets ws on ws.workout_id = w.id and ws.user_id = p_left_id
            where w.user_id = p_left_id and w.deleted_at is null
              and ws.deleted_at is null and ws.completed and not ws.is_warmup
              and w.local_date::date between v_left_start and v_left_end
          ), 0)
        )
      ) else jsonb_build_object('shared', false, 'count', 0, 'splits', '[]'::jsonb, 'duration_minutes', 0, 'volume_kg', 0) end,
      'right', case when v_right_wo_shared then (
        select jsonb_build_object(
          'shared', true,
          'count', v_right_wo_count,
          'splits', coalesce((
            select jsonb_agg(jsonb_build_object('label', s.lbl, 'count', s.cnt) order by s.cnt desc, s.lbl)
            from (
              select coalesce(nullif(w.name, ''), initcap(replace(w.type, '_', ' '))) as lbl, count(*)::integer as cnt
              from public.workouts w
              where w.user_id = p_right_id and w.deleted_at is null and w.local_date::date between v_right_start and v_right_end
              group by 1 limit 4
            ) s
          ), '[]'::jsonb),
          'duration_minutes', coalesce((select sum(w.duration_minutes)::integer from public.workouts w where w.user_id = p_right_id and w.deleted_at is null and w.local_date::date between v_right_start and v_right_end), 0),
          'volume_kg', coalesce((
            select round(sum(coalesce(ws.reps, 0) * coalesce(ws.weight_kg, 0)))::numeric
            from public.workouts w
            join public.workout_sets ws on ws.workout_id = w.id and ws.user_id = p_right_id
            where w.user_id = p_right_id and w.deleted_at is null
              and ws.deleted_at is null and ws.completed and not ws.is_warmup
              and w.local_date::date between v_right_start and v_right_end
          ), 0)
        )
      ) else jsonb_build_object('shared', false, 'count', 0, 'splits', '[]'::jsonb, 'duration_minutes', 0, 'volume_kg', 0) end
    );

    v_meals_detail := jsonb_build_object(
      'left', case when v_left_meals_shared then jsonb_build_object(
        'shared', true,
        'top_items', coalesce((
          select jsonb_agg(jsonb_build_object('name', m.food_name, 'count', m.cnt) order by m.cnt desc, m.food_name)
          from (
            select food_name, count(*)::integer as cnt
            from public.food_entries
            where user_id = p_left_id and deleted_at is null and local_date between v_left_start and v_left_end
            group by food_name order by cnt desc, food_name limit 3
          ) m
        ), '[]'::jsonb),
        'meals_per_day', coalesce((
          select round(avg(day_cnt), 1)
          from (
            select local_date, count(distinct meal_section)::numeric as day_cnt
            from public.food_entries
            where user_id = p_left_id and deleted_at is null and local_date between v_left_start and v_left_end
            group by local_date
          ) d
        ), 0)
      ) else jsonb_build_object('shared', false, 'top_items', '[]'::jsonb, 'meals_per_day', 0) end,
      'right', case when v_right_meals_shared then jsonb_build_object(
        'shared', true,
        'top_items', coalesce((
          select jsonb_agg(jsonb_build_object('name', m.food_name, 'count', m.cnt) order by m.cnt desc, m.food_name)
          from (
            select food_name, count(*)::integer as cnt
            from public.food_entries
            where user_id = p_right_id and deleted_at is null and local_date between v_right_start and v_right_end
            group by food_name order by cnt desc, food_name limit 3
          ) m
        ), '[]'::jsonb),
        'meals_per_day', coalesce((
          select round(avg(day_cnt), 1)
          from (
            select local_date, count(distinct meal_section)::numeric as day_cnt
            from public.food_entries
            where user_id = p_right_id and deleted_at is null and local_date between v_right_start and v_right_end
            group by local_date
          ) d
        ), 0)
      ) else jsonb_build_object('shared', false, 'top_items', '[]'::jsonb, 'meals_per_day', 0) end
    );
  end if;

  return jsonb_build_object(
    'room_id', p_room_id,
    'range', p_range,
    'is_pro', v_is_pro,
    'locked', not v_is_pro,
    'left', jsonb_build_object(
      'user_id', v_left_profile.id,
      'name', coalesce(v_left_profile.nickname, v_left_profile.username),
      'overall_pct', v_left_overall,
      'tracker_count', v_left_tracker_count,
      'workouts_shared', v_left_wo_shared,
      'meals_shared', v_left_meals_shared
    ),
    'right', jsonb_build_object(
      'user_id', v_right_profile.id,
      'name', coalesce(v_right_profile.nickname, v_right_profile.username),
      'overall_pct', v_right_overall,
      'tracker_count', v_right_tracker_count,
      'workouts_shared', v_right_wo_shared,
      'meals_shared', v_right_meals_shared
    ),
    'in_sync_pct', v_in_sync,
    'days_together', v_days_together,
    'shared_workouts', v_shared_workouts,
    'days_strip', v_days_strip,
    'head_to_head', v_head_to_head,
    'macros', v_macros,
    'today_rows', v_today_rows,
    'workouts_detail', v_workouts_detail,
    'meals_detail', v_meals_detail
  );
end;
$$;

revoke all on function public.get_squad_compare(uuid, uuid, uuid, text) from public, anon;
grant execute on function public.get_squad_compare(uuid, uuid, uuid, text) to authenticated;

notify pgrst, 'reload schema';
