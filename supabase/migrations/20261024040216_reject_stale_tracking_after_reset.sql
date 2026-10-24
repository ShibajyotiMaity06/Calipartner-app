-- Older installed clients must not restore pre-reset tracking from an offline queue.
create or replace function public.reject_pre_reset_tracking_write()
returns trigger language plpgsql set search_path = public, pg_temp as $guard$
declare
  v_row jsonb := to_jsonb(new);
  v_reset_at timestamptz;
begin
  -- Shared catalog entries are not user tracking data.
  if tg_table_name in ('foods', 'exercises') and v_row->>'owner_id' is null then return new; end if;
  select (value->>'reset_at')::timestamptz into v_reset_at
    from public.remote_config where key = 'account_tracking_reset';
  if v_reset_at is not null and v_row->>'created_at' is not null
     and (v_row->>'created_at')::timestamptz < v_reset_at then
    raise exception 'ACCOUNT_DATA_RESET: queued data predates the fresh start; reload the updated app'
      using errcode = '23514';
  end if;
  return new;
end;
$guard$;

do $install_guards$
declare v_table text;
begin
  foreach v_table in array array[
    'goal_profiles', 'health_screening', 'food_entries', 'user_food_stats', 'saved_meals',
    'water_logs', 'weight_logs', 'activity_days', 'workouts', 'workout_exercises', 'workout_sets',
    'fasting_sessions', 'fasting_settings', 'focus_sessions', 'focus_settings', 'recipe_favorites',
    'chat_messages', 'shared_meals', 'room_focus_sessions', 'room_focus_participants',
    'notification_settings', 'consent_records', 'foods', 'exercises'
  ] loop
    execute format('drop trigger if exists reject_pre_reset_tracking on public.%I', v_table);
    execute format('create trigger reject_pre_reset_tracking before insert or update on public.%I for each row execute function public.reject_pre_reset_tracking_write()', v_table);
  end loop;
end;
$install_guards$;
