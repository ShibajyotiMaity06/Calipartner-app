import { validWorkoutLog, type WorkoutWithDetails, type WorkoutSet } from '@calipartner/core';
import { getSupabase } from '@/lib/supabase';
import { beforeAccountWrite } from './accountDataGate';
import { generateClientUuid } from './foodService';
import { workoutEvents } from './workoutEvents';
import { diaryEvents } from './diaryEvents';
import type { WorkoutSessionRequest } from './workoutSessionService';

/** One acknowledged, atomic mutation. Retain IDs across explicit retries and tombstone removed sets. */
export async function saveLoggedWorkoutSets(
  request: WorkoutSessionRequest,
  workout: WorkoutWithDetails,
  draft: Array<Array<{ reps: number; weightKg: number }>>,
): Promise<void> {
  if (
    draft.length !== workout.exercises.length ||
    !draft.length ||
    draft.some((sets) => !validWorkoutLog(sets, 0))
  )
    throw new Error('INVALID_WORKOUT');
  if (await beforeAccountWrite()) throw new Error('ACCOUNT_DATA_RESET');
  const client = getSupabase();
  const auth = await client.auth.getUser();
  if (auth.error || !auth.data.user || auth.data.user.id !== workout.user_id)
    throw new Error('ACCOUNT_CHANGED');
  const now = new Date().toISOString();
  const active = new Set<string>();
  workout.exercises.forEach((exercise, index) => {
    if (exercise.user_id !== workout.user_id || exercise.workout_id !== workout.id)
      throw new Error('ACCOUNT_CHANGED');
    for (const set of exercise.sets ?? []) {
      if (set.user_id !== workout.user_id || set.workout_id !== workout.id)
        throw new Error('ACCOUNT_CHANGED');
      if (!request.rows.has(set.id))
        request.rows.set(set.id, { entity: 'workout_sets', payload: { ...set } });
    }
    draft[index]!.forEach((value, setIndex) => {
      const original = exercise.sets?.[setIndex];
      const key = `${exercise.id}:${setIndex}`;
      if (!request.ids.has(key)) request.ids.set(key, original?.id ?? generateClientUuid());
      const id = request.ids.get(key)!;
      const set: WorkoutSet = {
        ...original,
        id,
        workout_id: workout.id,
        workout_exercise_id: exercise.id,
        user_id: workout.user_id,
        set_number: setIndex + 1,
        reps: value.reps,
        weight_kg: value.weightKg || null,
        is_warmup: original?.is_warmup ?? false,
        completed: original?.completed ?? true,
        created_at: original?.created_at ?? request.createdAt,
        updated_at: now,
        deleted_at: null,
      };
      active.add(id);
      request.rows.set(id, { entity: 'workout_sets', payload: { ...set } });
    });
  });
  const changes = [...request.rows.entries()].map(([id, row]) => ({
    id,
    entity: row.entity,
    operation: 'upsert',
    payload: active.has(id) ? row.payload : { ...row.payload, updated_at: now, deleted_at: now },
  }));
  const { error } = await client.rpc('save_tracking_changes', { p_changes: changes });
  if (error) throw error;
  const current = await client.auth.getUser();
  if (current.error || current.data.user?.id !== workout.user_id)
    throw new Error('ACCOUNT_CHANGED');
  workoutEvents.emitChange();
  diaryEvents.emitChange();
}
