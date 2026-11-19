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
  exerciseNames = workout.exercises.map((exercise) => exercise.exercise_name),
  workoutName = workout.name,
): Promise<void> {
  if (
    draft.length !== workout.exercises.length ||
    !draft.length ||
    draft.some((sets) => !validWorkoutLog(sets, 0)) ||
    exerciseNames.length !== draft.length ||
    exerciseNames.some((name) => !name.trim() || name.trim().length > 100) ||
    (workoutName?.trim().length ?? 0) > 100
  )
    throw new Error('INVALID_WORKOUT');
  if (await beforeAccountWrite()) throw new Error('ACCOUNT_DATA_RESET');
  const client = getSupabase();
  const auth = await client.auth.getUser();
  if (auth.error || !auth.data.user || auth.data.user.id !== workout.user_id)
    throw new Error('ACCOUNT_CHANGED');
  const now = new Date().toISOString();
  const setPayload = (set: WorkoutSet) => ({
    id: set.id,
    user_id: set.user_id,
    workout_id: set.workout_id,
    workout_exercise_id: set.workout_exercise_id,
    set_number: set.set_number,
    reps: set.reps,
    weight_kg: set.weight_kg,
    duration_seconds: set.duration_seconds ?? null,
    distance_meters: set.distance_meters ?? null,
    is_warmup: set.is_warmup,
    completed: set.completed,
    created_at: set.created_at ?? request.createdAt,
    updated_at: set.updated_at,
    deleted_at: set.deleted_at ?? null,
  });
  const active = new Set<string>();
  workout.exercises.forEach((exercise, index) => {
    if (exercise.user_id !== workout.user_id || exercise.workout_id !== workout.id)
      throw new Error('ACCOUNT_CHANGED');
    for (const set of exercise.sets ?? []) {
      if (set.user_id !== workout.user_id || set.workout_id !== workout.id)
        throw new Error('ACCOUNT_CHANGED');
      if (!request.rows.has(set.id))
        request.rows.set(set.id, { entity: 'workout_sets', payload: setPayload(set) });
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
      request.rows.set(id, { entity: 'workout_sets', payload: setPayload(set) });
    });
  });
  const changes = [...request.rows.entries()].map(([id, row]) => ({
    id,
    entity: row.entity,
    operation: 'upsert',
    payload: active.has(id) ? row.payload : { ...row.payload, updated_at: now, deleted_at: now },
  }));
  const rename: Array<{
    id: string;
    entity: string;
    operation: string;
    payload: Record<string, unknown>;
  }> = workout.exercises.flatMap((exercise, index) => {
    const name = exerciseNames[index]!.trim();
    if (name === exercise.exercise_name) return [];
    return [
      {
        id: exercise.id,
        entity: 'workout_exercises',
        operation: 'upsert',
        payload: {
          id: exercise.id,
          workout_id: workout.id,
          user_id: workout.user_id,
          exercise_id: exercise.exercise_id,
          exercise_name: name,
          order_in_workout: exercise.order_in_workout,
          notes: exercise.notes,
          created_at: exercise.created_at ?? request.createdAt,
          updated_at: now,
          deleted_at: null,
        },
      },
    ];
  });
  const exercise = workout.exercises[0];
  const name =
    exercise &&
    workout.exercises.length === 1 &&
    rename.length &&
    (!workout.name || workout.name === exercise.exercise_name)
      ? exerciseNames[0]!.trim()
      : workoutName?.trim() || null;
  if (name !== (workout.name ?? null)) {
    rename.unshift({
      id: workout.id,
      entity: 'workouts',
      operation: 'upsert',
      payload: {
        id: workout.id,
        user_id: workout.user_id,
        name,
        type: workout.type,
        start_time: workout.start_time,
        duration_minutes: workout.duration_minutes,
        local_date: workout.local_date,
        notes: workout.notes,
        effort_rating: workout.effort_rating,
        created_at: workout.created_at ?? request.createdAt,
        updated_at: now,
        deleted_at: null,
      },
    });
  }
  const { error } = await client.rpc('save_tracking_changes', {
    p_changes: [...rename, ...changes],
  });
  if (error) throw error;
  const current = await client.auth.getUser();
  if (current.error || current.data.user?.id !== workout.user_id)
    throw new Error('ACCOUNT_CHANGED');
  workoutEvents.emitChange();
  diaryEvents.emitChange();
}
