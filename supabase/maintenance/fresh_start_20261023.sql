-- Explicit, one-time administrative maintenance requested by the project owner.
-- Execute as one transaction. Never delete auth users/sessions, rooms, room_members,
-- entitlements, billing/webhook records, trial-abuse records, blocks, or reports.
-- Re-running this exact operation must NOT erase data entered after the reset.
do $fresh_start$
declare
  v_epoch constant text := 'fresh-start-2026-10-23-v1';
  v_preserved_before jsonb;
  v_preserved_after jsonb;
  v_table text;
  v_tables constant text[] := array[
    'workout_sets', 'workout_exercises', 'workouts',
    'shared_meal_participants', 'shared_meals',
    'food_entries', 'user_food_stats', 'saved_meals',
    'water_logs', 'weight_logs', 'activity_days',
    'health_screening', 'goal_profiles',
    'fasting_sessions', 'fasting_settings',
    'focus_sessions', 'room_focus_participants', 'room_focus_sessions', 'focus_settings',
    'reactions', 'nudges', 'room_events',
    'chat_attachments', 'chat_read_state', 'chat_messages', 'chat_room_settings', 'member_mutes',
    'daily_summaries', 'weekly_scores', 'user_streaks', 'room_streaks',
    'recipe_favorites', 'leaderboard_settings', 'notification_settings',
    'consent_records', 'push_notification_queue'
  ];
begin
  perform pg_advisory_xact_lock(hashtext(v_epoch));
  if exists (select 1 from public.remote_config where key = 'account_tracking_reset' and value->>'epoch' = v_epoch) then
    return;
  end if;

  lock table public.rooms, public.room_members, public.entitlements in share row exclusive mode;
  select jsonb_build_object(
    'users', (select coalesce(jsonb_agg(id order by id), '[]'::jsonb) from auth.users),
    'rooms', (select coalesce(jsonb_agg(to_jsonb(r) order by id), '[]'::jsonb) from public.rooms r),
    'members', (select coalesce(jsonb_agg(to_jsonb(m) order by room_id, user_id), '[]'::jsonb) from public.room_members m),
    'entitlements', (select coalesce(jsonb_agg(to_jsonb(e) order by user_id), '[]'::jsonb) from public.entitlements e)
  ) into v_preserved_before;

  foreach v_table in array v_tables loop
    execute format('lock table public.%I in share row exclusive mode', v_table);
  end loop;
  foreach v_table in array v_tables loop
    execute format('delete from public.%I', v_table);
  end loop;
  delete from public.foods where owner_id is not null;
  delete from public.exercises where owner_id is not null;

  select jsonb_build_object(
    'users', (select coalesce(jsonb_agg(id order by id), '[]'::jsonb) from auth.users),
    'rooms', (select coalesce(jsonb_agg(to_jsonb(r) order by id), '[]'::jsonb) from public.rooms r),
    'members', (select coalesce(jsonb_agg(to_jsonb(m) order by room_id, user_id), '[]'::jsonb) from public.room_members m),
    'entitlements', (select coalesce(jsonb_agg(to_jsonb(e) order by user_id), '[]'::jsonb) from public.entitlements e)
  ) into v_preserved_after;
  if v_preserved_before is distinct from v_preserved_after then
    raise exception 'Fresh start aborted: identities, memberships, rooms, or subscriptions changed';
  end if;

  insert into public.remote_config (key, value, description, updated_at)
  values ('account_tracking_reset', jsonb_build_object('epoch', v_epoch, 'reset_at', now()),
    'One-time fresh start of personal tracking; identities, rooms, memberships and subscriptions preserved', now())
  on conflict (key) do update set value = excluded.value, description = excluded.description, updated_at = excluded.updated_at;
end;
$fresh_start$;
