import type { WorkoutType, WorkoutWithDetails } from '@calipartner/core';
import { cardioSessionMetrics } from '@calipartner/core';
import { getSupabase } from '@/lib/supabase';
import { beforeAccountWrite } from './accountDataGate';
import { generateClientUuid } from './foodService';
import { workoutEvents } from './workoutEvents';
import { diaryEvents } from './diaryEvents';

export interface WorkoutSessionRequest {
  ids: Map<string, string>;
  rows: Map<string, { entity: string; payload: Record<string, unknown> }>;
  createdAt: string;
}
export function newWorkoutSessionRequest(): WorkoutSessionRequest {
  return { ids: new Map(), rows: new Map(), createdAt: new Date().toISOString() };
}
export async function saveNewWorkoutSession(
  request: WorkoutSessionRequest,
  input: {
    userId: string;
    localDate: string;
    type: WorkoutType;
    name: string | null;
    durationMinutes: number;
    distanceKm: number;
    notes: string | null;
    effortRating: number | null;
    exercises: Array<{
      exerciseId?: string | null;
      exerciseName: string;
      notes?: string | null;
      sets: Array<{
        reps: number;
        weightKg: number;
        durationSeconds?: number;
        distanceMeters?: number;
        isWarmup: boolean;
        completed: boolean;
      }>;
    }>;
  },
): Promise<WorkoutWithDetails> {
  if (await beforeAccountWrite()) throw new Error('ACCOUNT_DATA_RESET');
  const client = getSupabase();
  const auth = await client.auth.getUser();
  if (auth.error || !auth.data.user || auth.data.user.id !== input.userId)
    throw new Error('ACCOUNT_CHANGED');
  if (
    !Number.isFinite(input.durationMinutes) ||
    input.durationMinutes < 0 ||
    (input.type !== 'strength' && input.durationMinutes === 0)
  )
    throw new Error('INVALID_WORKOUT');
  const id = (key: string) => {
    if (!request.ids.has(key)) request.ids.set(key, generateClientUuid());
    return request.ids.get(key)!;
  };
  const now = new Date().toISOString();
  const common = {
    user_id: input.userId,
    created_at: request.createdAt,
    updated_at: now,
    deleted_at: null,
  };
  const workoutId = id('workout');
  const cardio = input.type === 'cardio' || input.type === 'walk_run';
  const cardioMetrics = cardio
    ? cardioSessionMetrics(input.durationMinutes, input.distanceKm)
    : null;
  const exercises = cardio
    ? [
        {
          exerciseName: input.name ?? input.type,
          sets: [{ reps: 0, weightKg: 0, isWarmup: false, completed: true, ...cardioMetrics! }],
        },
      ]
    : input.exercises;
  const workout: WorkoutWithDetails = {
    ...common,
    id: workoutId,
    type: input.type,
    name: input.name,
    start_time: null,
    duration_minutes: input.durationMinutes,
    local_date: input.localDate,
    notes: input.notes,
    effort_rating: input.effortRating,
    exercises: exercises.map((exercise, index) => ({
      ...common,
      id: id(`exercise:${index}`),
      workout_id: workoutId,
      exercise_id: 'exerciseId' in exercise ? (exercise.exerciseId ?? null) : null,
      exercise_name: exercise.exerciseName,
      order_in_workout: index + 1,
      notes: 'notes' in exercise ? (exercise.notes ?? null) : null,
      sets: exercise.sets.map((set, setIndex) => ({
        ...common,
        id: id(`set:${index}:${setIndex}`),
        workout_id: workoutId,
        workout_exercise_id: id(`exercise:${index}`),
        set_number: setIndex + 1,
        reps: set.reps,
        weight_kg: set.weightKg,
        duration_seconds: set.durationSeconds ?? null,
        distance_meters: set.distanceMeters ?? null,
        is_warmup: set.isWarmup,
        completed: set.completed,
      })),
    })),
  };
  const active = new Set<string>();
  const record = (entity: string, payload: Record<string, unknown>) => {
    const key = `${entity}:${payload.id}`;
    active.add(key);
    request.rows.set(key, { entity, payload });
  };
  const { exercises: savedExercises, ...workoutRow } = workout;
  record('workouts', workoutRow);
  for (const { sets, ...exercise } of savedExercises) {
    record('workout_exercises', exercise);
    for (const set of sets ?? []) record('workout_sets', { ...set });
  }
  const changes = [...request.rows.entries()].map(([key, row]) => ({
    id: row.payload.id,
    entity: row.entity,
    operation: 'upsert',
    payload: active.has(key) ? row.payload : { ...row.payload, deleted_at: now, updated_at: now },
  }));
  const { error } = await client.rpc('save_tracking_changes', { p_changes: changes });
  if (error) throw error;
  const current = await client.auth.getUser();
  if (current.error || current.data.user?.id !== input.userId) throw new Error('ACCOUNT_CHANGED');
  workoutEvents.emitChange();
  diaryEvents.emitChange();
  return workout;
}
