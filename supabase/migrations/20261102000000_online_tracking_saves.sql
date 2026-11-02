-- One online request commits the complete meal/workout save. No delivery queue or background job.
CREATE OR REPLACE FUNCTION public.save_tracking_changes(p_changes jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  change jsonb;
  payload jsonb;
  entity text;
  column_list text;
  assignment_list text;
  conflict_columns text;
  affected integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
  IF jsonb_typeof(p_changes) IS DISTINCT FROM 'array' OR jsonb_array_length(p_changes) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'INVALID_SAVE';
  END IF;
  FOR change IN SELECT value FROM jsonb_array_elements(p_changes) LOOP
    entity := change->>'entity';
    payload := change->'payload';
    IF entity IS NULL OR NOT entity = ANY(ARRAY[
      'foods','food_entries','user_food_stats','saved_meals','water_logs','weight_logs',
      'activity_days','exercises','workouts','workout_exercises','workout_sets',
      'fasting_settings','fasting_sessions','squad_check_ins','recipe_favorites','recipe_reports'
    ]) OR jsonb_typeof(payload) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'INVALID_SAVE'; END IF;
    IF (payload ? 'user_id' AND payload->>'user_id' IS DISTINCT FROM auth.uid()::text)
       OR (payload ? 'owner_id' AND payload->>'owner_id' IS DISTINCT FROM auth.uid()::text) THEN
      RAISE EXCEPTION 'NOT_AUTHORIZED';
    END IF;
    IF entity = 'recipe_favorites' THEN
      IF change->>'operation' NOT IN ('upsert','delete') THEN RAISE EXCEPTION 'INVALID_SAVE'; END IF;
      PERFORM public.set_recipe_favorite((payload->>'recipe_id')::uuid, change->>'operation' = 'upsert');
    ELSIF change->>'operation' = 'delete' THEN
      EXECUTE format('UPDATE public.%I SET deleted_at = now() WHERE id = $1', entity) USING (change->>'id')::uuid;
      GET DIAGNOSTICS affected = ROW_COUNT;
      IF affected = 0 THEN RAISE EXCEPTION 'SAVE_NOT_ALLOWED'; END IF;
    ELSIF change->>'operation' = 'upsert' THEN
      -- Only actual columns may be named; identifiers are quoted and values stay parameters.
      IF EXISTS (
        SELECT 1 FROM jsonb_object_keys(payload) AS requested(name)
        WHERE NOT EXISTS (
          SELECT 1 FROM information_schema.columns c
          WHERE c.table_schema='public' AND c.table_name=entity AND c.column_name=requested.name
        )
      ) THEN RAISE EXCEPTION 'INVALID_SAVE_COLUMN'; END IF;
      SELECT string_agg(format('%I', key), ',' ORDER BY key),
        string_agg(format('%I = EXCLUDED.%I', key, key), ',' ORDER BY key)
      INTO column_list, assignment_list FROM jsonb_object_keys(payload) AS keys(key);
      IF column_list IS NULL THEN RAISE EXCEPTION 'INVALID_SAVE'; END IF;
      conflict_columns := CASE entity
        WHEN 'user_food_stats' THEN 'user_id,food_id'
        WHEN 'activity_days' THEN 'user_id,local_date'
        WHEN 'fasting_settings' THEN 'user_id'
        WHEN 'squad_check_ins' THEN 'user_id,room_id,local_date'
        ELSE 'id' END;
      EXECUTE format(
        'INSERT INTO public.%I (%s) SELECT %s FROM jsonb_populate_record(NULL::public.%I,$1) ON CONFLICT (%s) DO UPDATE SET %s',
        entity,column_list,column_list,entity,conflict_columns,assignment_list
      ) USING payload;
    ELSE RAISE EXCEPTION 'INVALID_SAVE';
    END IF;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.save_tracking_changes(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_tracking_changes(jsonb) TO authenticated;
