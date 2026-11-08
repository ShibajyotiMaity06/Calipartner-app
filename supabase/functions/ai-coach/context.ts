import { coachHistoryWindow } from '@calipartner/core';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.117.3';

/** Caller identity comes exclusively from the verified token, never from the request body. */
export async function loadCoachDiaryContext(
  admin: SupabaseClient,
  userId: string,
  today: string,
  question: string,
) {
  const window = coachHistoryWindow(today, question);
  const read = async (table: string, columns: string, cap: number, deleted = true) => {
    let query = admin
      .from(table)
      .select(columns)
      .eq('user_id', userId)
      .gte('local_date', window.start)
      .lte('local_date', window.end);
    if (deleted) query = query.is('deleted_at', null);
    const result = await query.order('local_date', { ascending: false }).limit(cap + 1);
    if (result.error) throw new Error('COACH_CONTEXT_UNAVAILABLE');
    return {
      rows: ((result.data ?? []) as unknown as Record<string, unknown>[]).slice(0, cap),
      truncated: (result.data?.length ?? 0) > cap,
    };
  };
  const [days, foods, workouts] = await Promise.all([
    read(
      'daily_summaries',
      'local_date,calories,protein,carbs,fat,steps,water_ml,workout_minutes,weight_kg,logged_day',
      90,
      false,
    ),
    read(
      'food_entries',
      'local_date,meal_section,food_name,quantity,unit,calories,protein,carbs,fat,fiber,sugar,sodium_mg',
      1000,
    ),
    read('workouts', 'id,local_date,name,type,duration_minutes,effort_rating', 200),
  ]);
  const workoutIds = workouts.rows.map((workout) => workout.id);
  let exercises: unknown[] = [],
    sets: unknown[] = [],
    detailsTruncated = false;
  if (workoutIds.length) {
    const [exerciseResult, setResult] = await Promise.all([
      admin
        .from('workout_exercises')
        .select('id,workout_id,exercise_name,order_in_workout')
        .eq('user_id', userId)
        .in('workout_id', workoutIds)
        .is('deleted_at', null)
        .order('order_in_workout')
        .limit(1001),
      admin
        .from('workout_sets')
        .select(
          'workout_id,workout_exercise_id,set_number,reps,weight_kg,duration_seconds,distance_meters,completed',
        )
        .eq('user_id', userId)
        .in('workout_id', workoutIds)
        .is('deleted_at', null)
        .order('set_number')
        .limit(2001),
    ]);
    if (exerciseResult.error || setResult.error) throw new Error('COACH_CONTEXT_UNAVAILABLE');
    exercises = (exerciseResult.data ?? []).slice(0, 1000);
    sets = (setResult.data ?? []).slice(0, 2000);
    detailsTruncated =
      (exerciseResult.data?.length ?? 0) > 1000 || (setResult.data?.length ?? 0) > 2000;
  }
  const context = {
    window,
    days: days.rows,
    foods: foods.rows,
    workouts: workouts.rows,
    exercises,
    sets,
    truncated: days.truncated || foods.truncated || workouts.truncated || detailsTruncated,
  };
  // Keep provider context bounded; expose truncation instead of silently implying a complete history.
  while (new TextEncoder().encode(JSON.stringify(context)).length > 20000) {
    const key = (['sets', 'exercises', 'foods', 'workouts', 'days'] as const)
      .filter((key) => context[key].length)
      .sort((a, b) => JSON.stringify(context[b]).length - JSON.stringify(context[a]).length)[0];
    if (!key) break;
    context[key].pop();
    context.truncated = true;
  }
  return context;
}
