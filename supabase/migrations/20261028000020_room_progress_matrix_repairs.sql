-- Owner-authorized room matrix repairs, 28 October 2026.
create or replace function public.get_room_progress(
  p_room_id uuid,
  p_range text default '30d',
  p_selected_member_ids uuid[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_id uuid := auth.uid();
  v_room record;
  v_total_members integer := 0;
  v_is_large_room boolean := false;
  v_start_date date;
  v_today date;
  v_members_series jsonb := '{}'::jsonb;
  v_summary_table jsonb := '[]'::jsonb;
  v_room_averages jsonb := '{}'::jsonb;
  v_selected_ids uuid[];
  v_m record;
  v_p jsonb;
  v_is_self boolean;
  v_is_locked boolean;

  -- Member metrics
  v_start_weight numeric(5,2);
  v_cur_weight numeric(5,2);
  v_target_weight numeric(5,2);
  v_wt_change numeric(5,2);
  v_wt_change_pct numeric(5,2);
  v_goal_prog_pct numeric(5,1);

  v_logged_days integer;
  v_goal_days integer;
  v_consistency_score numeric(5,2);

  v_avg_cal_vs_target numeric(5,1);
  v_avg_steps integer;
  v_workouts_cnt integer;

  v_wt_series jsonb := '[]'::jsonb;
  v_cal_series jsonb := '[]'::jsonb;
  v_step_series jsonb := '[]'::jsonb;
  v_water_series jsonb := '[]'::jsonb;
  v_wrk_series jsonb := '[]'::jsonb;
  v_con_series jsonb := '[]'::jsonb;
begin
  if v_caller_id is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  select * into v_room
  from public.rooms where id = p_room_id;

  if not found or v_room.state in ('archived', 'locked') then
    raise exception 'ROOM_NOT_ACCESSIBLE';
  end if;

  if not exists (
    select 1 from public.room_members
    where room_id = p_room_id and user_id = v_caller_id
      and status in ('active', 'paused')
  ) then
    raise exception 'NOT_A_ROOM_MEMBER';
  end if;

  if public.active_room_tier(auth.uid())='free' then raise exception 'PLUS_REQUIRED'; end if;
  if not public.room_is_usable(p_room_id) then raise exception 'ROOM_NOT_ACCESSIBLE'; end if;
  select (now() at time zone coalesce(timezone,'UTC'))::date into v_today from public.profiles where id=v_caller_id;

  -- Range resolution
  if p_range = '7d' then
    v_start_date := v_today - interval '6 days';
  elsif p_range = '30d' then
    v_start_date := v_today - interval '29 days';
  elsif p_range = '90d' then
    v_start_date := v_today - interval '89 days';
  elsif p_range = '6m' then
    v_start_date := v_today - interval '180 days';
  elsif p_range = '1y' then
    v_start_date := v_today - interval '365 days';
  elsif p_range = 'all' then
    select least(v_room.created_at::date,coalesce(min(local_date::date),v_room.created_at::date)) into v_start_date from public.daily_summaries where user_id=v_caller_id;
  elsif p_range = 'since_start' then
    v_start_date := v_room.created_at::date;
  else
    v_start_date := v_today - interval '29 days';
  end if;

  -- Member count
  select count(*) into v_total_members
  from public.room_members
  where room_id = p_room_id and status in ('active', 'paused', 'locked');

  v_is_large_room := (v_total_members > 10);

  -- Large rooms (RPG-7): return at most 8 selected members (default: me + 3 most recently active)
  if v_is_large_room then
    if p_selected_member_ids is not null and array_length(p_selected_member_ids, 1) > 0 then
      select array_agg(user_id) into v_selected_ids from (
        select rm.user_id from public.room_members rm
        where rm.room_id=p_room_id and rm.status in ('active','paused')
          and (rm.user_id=v_caller_id or rm.user_id=any(p_selected_member_ids))
          and not exists(select 1 from public.blocks b where (b.blocker_id=v_caller_id and b.blocked_id=rm.user_id) or (b.blocked_id=v_caller_id and b.blocker_id=rm.user_id))
        order by (rm.user_id=v_caller_id) desc,rm.user_id limit (case when v_caller_id=any(p_selected_member_ids) then 8 else 7 end)
      ) selected;
      -- Reserve one place for the caller; normalize to at most eight below.
      -- Ensure caller is always in selection
      if not (v_caller_id = any(v_selected_ids)) then
        v_selected_ids := array_append(v_selected_ids, v_caller_id);
      end if;
    else
      -- Default: me plus 3 most recently active
      select array_agg(uid) into v_selected_ids
      from (
        select rm.user_id as uid
        from public.room_members rm
        left join lateral (
          select max(updated_at) as last_act from public.daily_summaries where user_id = rm.user_id
        ) ds on true
        where rm.room_id = p_room_id and rm.status in ('active', 'paused')
        order by
          case when rm.user_id = v_caller_id then 0 else 1 end,
          coalesce(ds.last_act, rm.joined_at) desc
        limit 4
      ) top_m;
    end if;
  end if;

  -- Iterate room members
  for v_m in
    select rm.user_id, rm.status, rm.privacy_settings,
           p.nickname, p.username, p.avatar_url, p.created_at as profile_created_at
    from public.room_members rm
    join public.profiles p on p.id = rm.user_id
    where rm.room_id = p_room_id and rm.status <> 'left'
      and not exists(select 1 from public.blocks b where (b.blocker_id=v_caller_id and b.blocked_id=rm.user_id) or (b.blocked_id=v_caller_id and b.blocker_id=rm.user_id))
    order by
      case when rm.user_id = v_caller_id then 0 else 1 end,
      lower(p.nickname) asc
  loop
    v_is_self := (v_m.user_id = v_caller_id);
    v_is_locked := (v_m.status = 'locked');
    v_p := v_m.privacy_settings;

    if v_is_locked then
      -- Locked members excluded from charts and marked (PRD RPG-3, RPG-4)
      v_summary_table := v_summary_table || jsonb_build_array(
        jsonb_build_object(
          'user_id', v_m.user_id,
          'nickname', v_m.nickname,
          'avatar_url', v_m.avatar_url,
          'status', 'locked',
          'is_self', v_is_self,
          'is_locked_member', true,
          'weight_change_kg', 'locked',
          'weight_change_pct', 'locked',
          'goal_progress_pct', 'locked',
          'average_calories_vs_target_pct', 'locked',
          'average_steps', 'locked',
          'total_workouts', 'locked',
          'consistency_score', 'locked'
        )
      );
      continue;
    end if;

    -- Never carry a previous member's weight values into the next member.
    v_wt_change := null; v_wt_change_pct := null; v_goal_prog_pct := null;
    -- Compute member summaries for period
    select
      coalesce(count(*) filter (where logged_day = true), 0),
      coalesce(count(*) filter (where goal_day = true), 0),
      coalesce(round(avg(calories / nullif(target_calories, 0)) * 100, 1), 0),
      coalesce(round(avg(steps), 0), 0)
    into v_logged_days, v_goal_days, v_avg_cal_vs_target, v_avg_steps
    from public.daily_summaries
    where user_id = v_m.user_id and local_date::date between v_start_date and v_today;

    v_consistency_score := round(least(100.0, 100.0 * (0.40 * (v_logged_days::numeric / 7.0) + 0.60 * (v_goal_days::numeric / 7.0))), 1);

    select count(*) into v_workouts_cnt
    from public.workouts
    where user_id = v_m.user_id and deleted_at is null
      and local_date::date between v_start_date and v_today;

    -- Weight progress (RPG-2: never raw weight unless opted in)
    select weight_kg into v_start_weight
    from public.weight_logs
    where user_id = v_m.user_id and deleted_at is null
    order by local_date asc, logged_at asc limit 1;

    select weight_kg into v_cur_weight
    from public.weight_logs
    where user_id = v_m.user_id and deleted_at is null
    order by local_date desc, logged_at desc limit 1;

    select target_weight_kg into v_target_weight
    from public.goal_profiles
    where user_id = v_m.user_id and effective_from <= now()
    order by effective_from desc limit 1;

    if v_start_weight is not null and v_cur_weight is not null then
      v_wt_change := v_cur_weight - v_start_weight;
      if v_start_weight > 0 then
        v_wt_change_pct := round((v_wt_change / v_start_weight) * 100, 1);
      end if;
      if v_target_weight is not null and abs(v_start_weight - v_target_weight) > 0.001 then
        v_goal_prog_pct := round(((v_start_weight - v_cur_weight) / (v_start_weight - v_target_weight)) * 100, 1);
        v_goal_prog_pct := greatest(0.0, least(100.0, v_goal_prog_pct));
      end if;
    end if;

    -- Enforce privacy on summary table
    v_summary_table := v_summary_table || jsonb_build_array(
      jsonb_build_object(
        'user_id', v_m.user_id,
        'nickname', v_m.nickname,
        'avatar_url', v_m.avatar_url,
        'status', v_m.status,
        'is_self', v_is_self,
        'is_locked_member', false,
        'weight_change_kg', case when v_is_self or coalesce((v_p->>'share_weight_number')::boolean, false) then to_jsonb(v_wt_change) else '"locked"'::jsonb end,
        'weight_change_pct', case when v_is_self or coalesce((v_p->>'share_weight_progress')::boolean, false) then to_jsonb(v_wt_change_pct) else '"locked"'::jsonb end,
        'goal_progress_pct', case when v_is_self or coalesce((v_p->>'share_weight_progress')::boolean, false) then to_jsonb(v_goal_prog_pct) else '"locked"'::jsonb end,
        'average_calories_vs_target_pct', case when v_is_self or coalesce((v_p->>'share_goal_completion')::boolean, true) then to_jsonb(v_avg_cal_vs_target) else '"locked"'::jsonb end,
        'average_steps', case when v_is_self or coalesce((v_p->>'share_steps')::boolean, true) then to_jsonb(v_avg_steps) else '"locked"'::jsonb end,
        'total_workouts', case when v_is_self or coalesce((v_p->>'share_workouts')::boolean, true) then to_jsonb(v_workouts_cnt) else '"locked"'::jsonb end,
        'consistency_score', case when v_is_self or coalesce((v_p->>'share_streak')::boolean, true) then to_jsonb(v_consistency_score) else '"locked"'::jsonb end
      )
    );

    -- Build member series for charts (if selected in large room or standard room)
    if not v_is_large_room or (v_selected_ids is not null and v_m.user_id = any(v_selected_ids)) then
      -- Steps series
      v_step_series := v_step_series || jsonb_build_array(
        jsonb_build_object(
          'user_id', v_m.user_id,
          'nickname', v_m.nickname,
          'username', v_m.username,
          'avatar_url', v_m.avatar_url,
          'status', v_m.status,
          'is_self', v_is_self,
          'is_locked_member', false,
          'is_metric_locked', not (v_is_self or coalesce((v_p->>'share_steps')::boolean, true)),
          'data', case when v_is_self or coalesce((v_p->>'share_steps')::boolean, true) then (
            select coalesce(jsonb_agg(jsonb_build_object('date', local_date, 'value', steps) order by local_date asc), '[]'::jsonb)
            from public.daily_summaries where user_id = v_m.user_id and local_date::date between v_start_date and v_today
          ) else '[]'::jsonb end
        )
      );

      -- Consistency series
      v_con_series := v_con_series || jsonb_build_array(
        jsonb_build_object(
          'user_id', v_m.user_id,
          'nickname', v_m.nickname,
          'username', v_m.username,
          'avatar_url', v_m.avatar_url,
          'status', v_m.status,
          'is_self', v_is_self,
          'is_locked_member', false,
          'is_metric_locked', not (v_is_self or coalesce((v_p->>'share_streak')::boolean, true)),
          'data', case when v_is_self or coalesce((v_p->>'share_streak')::boolean, true) then (
            select coalesce(jsonb_agg(jsonb_build_object('date', local_date, 'value', case when logged_day then 100 else 0 end) order by local_date asc), '[]'::jsonb)
            from public.daily_summaries where user_id = v_m.user_id and local_date::date between v_start_date and v_today
          ) else '[]'::jsonb end
        )
      );

      -- Weight change series (progress towards goal or change from start)
      v_wt_series := v_wt_series || jsonb_build_array(
        jsonb_build_object(
          'user_id', v_m.user_id,
          'nickname', v_m.nickname,
          'username', v_m.username,
          'avatar_url', v_m.avatar_url,
          'status', v_m.status,
          'is_self', v_is_self,
          'is_locked_member', false,
          'is_metric_locked', not (v_is_self or coalesce((v_p->>'share_weight_progress')::boolean, false)),
          'data', case when v_is_self or coalesce((v_p->>'share_weight_progress')::boolean, false) then (
            select coalesce(jsonb_agg(jsonb_build_object('date', local_date, 'value', round(100.0*(weight_kg-coalesce(v_start_weight,weight_kg))/nullif(v_start_weight,0),2)) order by local_date asc), '[]'::jsonb)
            from public.weight_logs where user_id = v_m.user_id and deleted_at is null and local_date::date between v_start_date and v_today
          ) else '[]'::jsonb end
        )
      );

      -- Calories vs target % series
      v_cal_series := v_cal_series || jsonb_build_array(
        jsonb_build_object(
          'user_id', v_m.user_id,
          'nickname', v_m.nickname,
          'username', v_m.username,
          'avatar_url', v_m.avatar_url,
          'status', v_m.status,
          'is_self', v_is_self,
          'is_locked_member', false,
          'is_metric_locked', not (v_is_self or coalesce((v_p->>'share_goal_completion')::boolean, true)),
          'data', case when v_is_self or coalesce((v_p->>'share_goal_completion')::boolean, true) then (
            select coalesce(jsonb_agg(jsonb_build_object('date', local_date, 'value', round((calories / nullif(target_calories, 0)) * 100, 1)) order by local_date asc), '[]'::jsonb)
            from public.daily_summaries where user_id = v_m.user_id and local_date::date between v_start_date and v_today
          ) else '[]'::jsonb end
        )
      );

      -- Water series
      v_water_series := v_water_series || jsonb_build_array(
        jsonb_build_object(
          'user_id', v_m.user_id,
          'nickname', v_m.nickname,
          'username', v_m.username,
          'avatar_url', v_m.avatar_url,
          'status', v_m.status,
          'is_self', v_is_self,
          'is_locked_member', false,
          'is_metric_locked', not (v_is_self or coalesce((v_p->>'share_water')::boolean, true)),
          'data', case when v_is_self or coalesce((v_p->>'share_water')::boolean, true) then (
            select coalesce(jsonb_agg(jsonb_build_object('date', local_date, 'value', water_ml) order by local_date asc), '[]'::jsonb)
            from public.daily_summaries where user_id = v_m.user_id and local_date::date between v_start_date and v_today
          ) else '[]'::jsonb end
        )
      );

      -- Workouts series
      v_wrk_series := v_wrk_series || jsonb_build_array(
        jsonb_build_object(
          'user_id', v_m.user_id,
          'nickname', v_m.nickname,
          'username', v_m.username,
          'avatar_url', v_m.avatar_url,
          'status', v_m.status,
          'is_self', v_is_self,
          'is_locked_member', false,
          'is_metric_locked', not (v_is_self or coalesce((v_p->>'share_workouts')::boolean, true)),
          'data', case when v_is_self or coalesce((v_p->>'share_workouts')::boolean, true) then (
            select coalesce(jsonb_agg(jsonb_build_object('date', local_date, 'value', workout_minutes) order by local_date asc), '[]'::jsonb)
            from public.daily_summaries where user_id = v_m.user_id and local_date::date between v_start_date and v_today
          ) else '[]'::jsonb end
        )
      );
    end if;
  end loop;

  -- The average uses only visible steps of current, unblocked members.
  select jsonb_build_object('steps',coalesce(jsonb_agg(jsonb_build_object(
    'date',day::date::text,'value',value) order by day),'[]'::jsonb)) into v_room_averages
  from (
    select d.day,round(avg(ds.steps),0) as value
    from generate_series(v_start_date::timestamp,v_today::timestamp,interval '1 day') d(day)
    join public.room_members rm on rm.room_id=p_room_id and rm.status in ('active','paused')
      and (rm.user_id=v_caller_id or coalesce((rm.privacy_settings->>'share_steps')::boolean,true))
      and not exists(select 1 from public.blocks b where (b.blocker_id=v_caller_id and b.blocked_id=rm.user_id) or (b.blocked_id=v_caller_id and b.blocker_id=rm.user_id))
    join public.daily_summaries ds on ds.user_id=rm.user_id and ds.local_date=d.day::date::text
    group by d.day
  ) visible_days;

  return jsonb_build_object(
    'room_id', p_room_id,
    'range', p_range,
    'start_date', v_start_date::text,
    'end_date', v_today::text,
    'total_members', v_total_members,
    'is_large_room', v_is_large_room,
    'selected_member_ids', coalesce(to_jsonb(v_selected_ids), '[]'::jsonb),
    'members_series', jsonb_build_object(
      'consistency', v_con_series,
      'weight_change', v_wt_series,
      'calories_vs_target', v_cal_series,
      'steps', v_step_series,
      'water', v_water_series,
      'workouts', v_wrk_series
    ),
    'room_average_series', v_room_averages,
    'summary_table', v_summary_table
  );
end;
$$;
revoke all on function public.get_room_progress(uuid,text,uuid[]) from public,anon;
grant execute on function public.get_room_progress(uuid,text,uuid[]) to authenticated;

create or replace function public.search_room_members_for_progress(p_room_id uuid,p_query text default null)
returns table(user_id uuid,nickname text,username text,avatar_url text,status text,is_locked boolean)
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  if not public.is_room_member(p_room_id,auth.uid()) then raise exception 'NOT_A_ROOM_MEMBER'; end if;
  if public.active_room_tier(auth.uid())='free' then raise exception 'PLUS_REQUIRED'; end if;
  if not public.room_is_usable(p_room_id) then raise exception 'ROOM_NOT_ACCESSIBLE'; end if;
  return query select rm.user_id,p.nickname,p.username::text,p.avatar_url,rm.status,(rm.status='locked')
  from public.room_members rm join public.profiles p on p.id=rm.user_id
  where rm.room_id=p_room_id and rm.status<>'left'
    and not exists(select 1 from public.blocks b where (b.blocker_id=auth.uid() and b.blocked_id=rm.user_id) or (b.blocked_id=auth.uid() and b.blocker_id=rm.user_id))
    and (coalesce(trim(p_query),'')='' or position(lower(trim(p_query)) in lower(p.username::text))>0 or position(lower(trim(p_query)) in lower(p.nickname))>0)
  order by (rm.user_id=auth.uid()) desc,lower(p.nickname),rm.user_id limit 20;
end; $$;
revoke all on function public.search_room_members_for_progress(uuid,text) from public,anon;
grant execute on function public.search_room_members_for_progress(uuid,text) to authenticated;
notify pgrst,'reload schema';
