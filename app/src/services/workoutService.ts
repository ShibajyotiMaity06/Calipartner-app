import {
  summarizeWorkout,
  type Equipment,
  type Exercise,
  type ExerciseType,
  type MuscleGroup,
  type PreviousExercisePerformance,
  type Workout,
  type WorkoutExercise,
  type WorkoutSet,
  type WorkoutSummary,
  type WorkoutTimerState,
  type WorkoutType,
  type WorkoutWithDetails,
} from '@calipartner/core';
import { enqueueOutbox, type SyncDb } from './syncService';

export interface CreateWorkoutInput {
  userId: string;
  type: WorkoutType;
  name?: string | null;
  startTime?: string | null;
  durationMinutes?: number;
  localDate: string; // YYYY-MM-DD
  notes?: string | null;
  effortRating?: number | null;
}

export interface UpdateWorkoutInput {
  type?: WorkoutType;
  name?: string | null;
  startTime?: string | null;
  durationMinutes?: number;
  localDate?: string;
  notes?: string | null;
  effortRating?: number | null;
}

export interface AddExerciseInput {
  exerciseId?: string | null;
  exerciseName: string;
  orderInWorkout?: number;
  notes?: string | null;
}

export interface AddSetInput {
  reps?: number | null;
  weightKg?: number | null;
  durationSeconds?: number | null;
  distanceMeters?: number | null;
  isWarmup?: boolean;
  completed?: boolean;
}

export interface UpdateSetInput {
  reps?: number | null;
  weightKg?: number | null;
  durationSeconds?: number | null;
  distanceMeters?: number | null;
  isWarmup?: boolean;
  completed?: boolean;
}

// -----------------------------------------------------------------------------
// 1. WORKOUT CRUD
// -----------------------------------------------------------------------------

export async function createWorkout(
  db: SyncDb,
  input: CreateWorkoutInput,
): Promise<Workout> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const duration = input.durationMinutes ?? 0;

  const workout: Workout = {
    id,
    user_id: input.userId,
    type: input.type,
    name: input.name ?? null,
    start_time: input.startTime ?? null,
    duration_minutes: duration,
    local_date: input.localDate,
    notes: input.notes ?? null,
    effort_rating: input.effortRating ?? null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };

  await db.runAsync(
    `INSERT INTO local_workouts (
      id, user_id, type, name, start_time, duration_minutes, local_date, notes, effort_rating, created_at, updated_at, deleted_at, sync_state
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'pending')`,
    [
      workout.id,
      workout.user_id,
      workout.type,
      workout.name,
      workout.start_time,
      workout.duration_minutes,
      workout.local_date,
      workout.notes,
      workout.effort_rating,
      workout.created_at,
      workout.updated_at,
    ],
  );

  await enqueueOutbox(db, {
    id: workout.id,
    entity: 'workouts',
    operation: 'upsert',
    payload: {
      id: workout.id,
      user_id: workout.user_id,
      type: workout.type,
      name: workout.name,
      start_time: workout.start_time,
      duration_minutes: workout.duration_minutes,
      local_date: workout.local_date,
      notes: workout.notes,
      effort_rating: workout.effort_rating,
      created_at: workout.created_at,
      updated_at: workout.updated_at,
      deleted_at: null,
    },
  });

  return workout;
}

export async function updateWorkout(
  db: SyncDb,
  workoutId: string,
  updates: UpdateWorkoutInput,
): Promise<Workout> {
  const existing = await db.getFirstAsync<Workout>(
    `SELECT * FROM local_workouts WHERE id = ? AND deleted_at IS NULL`,
    [workoutId],
  );
  if (!existing) {
    throw new Error(`Workout not found: ${workoutId}`);
  }

  const now = new Date().toISOString();
  const updated: Workout = {
    ...existing,
    type: updates.type ?? existing.type,
    name: updates.name !== undefined ? updates.name : existing.name,
    start_time: updates.startTime !== undefined ? updates.startTime : existing.start_time,
    duration_minutes: updates.durationMinutes !== undefined ? updates.durationMinutes : existing.duration_minutes,
    local_date: updates.localDate ?? existing.local_date,
    notes: updates.notes !== undefined ? updates.notes : existing.notes,
    effort_rating: updates.effortRating !== undefined ? updates.effortRating : existing.effort_rating,
    updated_at: now,
  };

  await db.runAsync(
    `UPDATE local_workouts SET
       type = ?, name = ?, start_time = ?, duration_minutes = ?, local_date = ?, notes = ?, effort_rating = ?, updated_at = ?, sync_state = 'pending'
     WHERE id = ?`,
    [
      updated.type,
      updated.name,
      updated.start_time,
      updated.duration_minutes,
      updated.local_date,
      updated.notes,
      updated.effort_rating,
      updated.updated_at,
      workoutId,
    ],
  );

  await enqueueOutbox(db, {
    id: updated.id,
    entity: 'workouts',
    operation: 'upsert',
    payload: {
      id: updated.id,
      user_id: updated.user_id,
      type: updated.type,
      name: updated.name,
      start_time: updated.start_time,
      duration_minutes: updated.duration_minutes,
      local_date: updated.local_date,
      notes: updated.notes,
      effort_rating: updated.effort_rating,
      created_at: updated.created_at,
      updated_at: updated.updated_at,
      deleted_at: null,
    },
  });

  return updated;
}

export async function deleteWorkout(db: SyncDb, workoutId: string): Promise<void> {
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE local_workouts SET deleted_at = ?, updated_at = ?, sync_state = 'pending' WHERE id = ?`,
    [now, now, workoutId],
  );

  // Soft delete child exercises and sets
  await db.runAsync(
    `UPDATE local_workout_exercises SET deleted_at = ?, updated_at = ?, sync_state = 'pending' WHERE workout_id = ?`,
    [now, now, workoutId],
  );
  await db.runAsync(
    `UPDATE local_workout_sets SET deleted_at = ?, updated_at = ?, sync_state = 'pending' WHERE workout_id = ?`,
    [now, now, workoutId],
  );

  await enqueueOutbox(db, {
    id: workoutId,
    entity: 'workouts',
    operation: 'delete',
    payload: { id: workoutId, deleted_at: now },
  });
}

// -----------------------------------------------------------------------------
// 2. WORKOUT EXERCISES & SETS
// -----------------------------------------------------------------------------

export async function addExerciseToWorkout(
  db: SyncDb,
  workoutId: string,
  input: AddExerciseInput,
): Promise<WorkoutExercise> {
  const workout = await db.getFirstAsync<Workout>(
    `SELECT * FROM local_workouts WHERE id = ? AND deleted_at IS NULL`,
    [workoutId],
  );
  if (!workout) {
    throw new Error(`Workout not found: ${workoutId}`);
  }

  let order = input.orderInWorkout;
  if (order === undefined) {
    const maxOrderRow = await db.getFirstAsync<{ max_order: number | null }>(
      `SELECT MAX(order_in_workout) as max_order FROM local_workout_exercises WHERE workout_id = ? AND deleted_at IS NULL`,
      [workoutId],
    );
    order = (maxOrderRow?.max_order ?? 0) + 1;
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const we: WorkoutExercise = {
    id,
    workout_id: workoutId,
    user_id: workout.user_id,
    exercise_id: input.exerciseId ?? null,
    exercise_name: input.exerciseName.trim(),
    order_in_workout: order,
    notes: input.notes ?? null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    sets: [],
  };

  await db.runAsync(
    `INSERT INTO local_workout_exercises (
      id, workout_id, user_id, exercise_id, exercise_name, order_in_workout, notes, created_at, updated_at, deleted_at, sync_state
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'pending')`,
    [
      we.id,
      we.workout_id,
      we.user_id,
      we.exercise_id,
      we.exercise_name,
      we.order_in_workout,
      we.notes,
      we.created_at,
      we.updated_at,
    ],
  );

  await enqueueOutbox(db, {
    id: we.id,
    entity: 'workout_exercises',
    operation: 'upsert',
    payload: {
      id: we.id,
      workout_id: we.workout_id,
      user_id: we.user_id,
      exercise_id: we.exercise_id,
      exercise_name: we.exercise_name,
      order_in_workout: we.order_in_workout,
      notes: we.notes,
      created_at: we.created_at,
      updated_at: we.updated_at,
      deleted_at: null,
    },
  });

  return we;
}

export async function removeExerciseFromWorkout(
  db: SyncDb,
  workoutExerciseId: string,
): Promise<void> {
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE local_workout_exercises SET deleted_at = ?, updated_at = ?, sync_state = 'pending' WHERE id = ?`,
    [now, now, workoutExerciseId],
  );

  await db.runAsync(
    `UPDATE local_workout_sets SET deleted_at = ?, updated_at = ?, sync_state = 'pending' WHERE workout_exercise_id = ?`,
    [now, now, workoutExerciseId],
  );

  await enqueueOutbox(db, {
    id: workoutExerciseId,
    entity: 'workout_exercises',
    operation: 'delete',
    payload: { id: workoutExerciseId, deleted_at: now },
  });
}

export async function reorderWorkoutExercises(
  db: SyncDb,
  workoutId: string,
  orderedExerciseIds: string[],
): Promise<void> {
  const now = new Date().toISOString();

  for (let i = 0; i < orderedExerciseIds.length; i++) {
    const exId = orderedExerciseIds[i];
    const order = i + 1;

    await db.runAsync(
      `UPDATE local_workout_exercises SET order_in_workout = ?, updated_at = ?, sync_state = 'pending' WHERE id = ? AND workout_id = ?`,
      [order, now, exId, workoutId],
    );

    const we = await db.getFirstAsync<WorkoutExercise>(
      `SELECT * FROM local_workout_exercises WHERE id = ?`,
      [exId],
    );
    if (we) {
      await enqueueOutbox(db, {
        id: we.id,
        entity: 'workout_exercises',
        operation: 'upsert',
        payload: {
          id: we.id,
          workout_id: we.workout_id,
          user_id: we.user_id,
          exercise_id: we.exercise_id,
          exercise_name: we.exercise_name,
          order_in_workout: order,
          notes: we.notes,
          created_at: we.created_at,
          updated_at: now,
          deleted_at: null,
        },
      });
    }
  }
}

export async function addSetToExercise(
  db: SyncDb,
  workoutExerciseId: string,
  input: AddSetInput,
): Promise<WorkoutSet> {
  const we = await db.getFirstAsync<WorkoutExercise>(
    `SELECT * FROM local_workout_exercises WHERE id = ? AND deleted_at IS NULL`,
    [workoutExerciseId],
  );
  if (!we) {
    throw new Error(`Workout exercise not found: ${workoutExerciseId}`);
  }

  const maxSetRow = await db.getFirstAsync<{ max_set: number | null }>(
    `SELECT MAX(set_number) as max_set FROM local_workout_sets WHERE workout_exercise_id = ? AND deleted_at IS NULL`,
    [workoutExerciseId],
  );
  const setNumber = (maxSetRow?.max_set ?? 0) + 1;

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const ws: WorkoutSet = {
    id,
    workout_exercise_id: workoutExerciseId,
    workout_id: we.workout_id,
    user_id: we.user_id,
    set_number: setNumber,
    reps: input.reps !== undefined ? input.reps : null,
    weight_kg: input.weightKg !== undefined ? input.weightKg : null,
    duration_seconds: input.durationSeconds !== undefined ? input.durationSeconds : null,
    distance_meters: input.distanceMeters !== undefined ? input.distanceMeters : null,
    is_warmup: input.isWarmup ?? false,
    completed: input.completed ?? true,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };

  await db.runAsync(
    `INSERT INTO local_workout_sets (
      id, workout_exercise_id, workout_id, user_id, set_number, reps, weight_kg, duration_seconds, distance_meters, is_warmup, completed, created_at, updated_at, deleted_at, sync_state
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'pending')`,
    [
      ws.id,
      ws.workout_exercise_id,
      ws.workout_id,
      ws.user_id,
      ws.set_number,
      ws.reps,
      ws.weight_kg,
      ws.duration_seconds,
      ws.distance_meters,
      ws.is_warmup ? 1 : 0,
      ws.completed ? 1 : 0,
      ws.created_at,
      ws.updated_at,
    ],
  );

  await enqueueOutbox(db, {
    id: ws.id,
    entity: 'workout_sets',
    operation: 'upsert',
    payload: {
      id: ws.id,
      workout_exercise_id: ws.workout_exercise_id,
      workout_id: ws.workout_id,
      user_id: ws.user_id,
      set_number: ws.set_number,
      reps: ws.reps,
      weight_kg: ws.weight_kg,
      duration_seconds: ws.duration_seconds,
      distance_meters: ws.distance_meters,
      is_warmup: ws.is_warmup,
      completed: ws.completed,
      created_at: ws.created_at,
      updated_at: ws.updated_at,
      deleted_at: null,
    },
  });

  return ws;
}

export async function updateWorkoutSet(
  db: SyncDb,
  setId: string,
  updates: UpdateSetInput,
): Promise<WorkoutSet> {
  const existing = await db.getFirstAsync<{
    id: string;
    workout_exercise_id: string;
    workout_id: string;
    user_id: string;
    set_number: number;
    reps: number | null;
    weight_kg: number | null;
    duration_seconds: number | null;
    distance_meters: number | null;
    is_warmup: number;
    completed: number;
    created_at: string;
    updated_at: string;
  }>(`SELECT * FROM local_workout_sets WHERE id = ? AND deleted_at IS NULL`, [setId]);

  if (!existing) {
    throw new Error(`Workout set not found: ${setId}`);
  }

  const now = new Date().toISOString();
  const updated: WorkoutSet = {
    id: existing.id,
    workout_exercise_id: existing.workout_exercise_id,
    workout_id: existing.workout_id,
    user_id: existing.user_id,
    set_number: existing.set_number,
    reps: updates.reps !== undefined ? updates.reps : existing.reps,
    weight_kg: updates.weightKg !== undefined ? updates.weightKg : existing.weight_kg,
    duration_seconds: updates.durationSeconds !== undefined ? updates.durationSeconds : existing.duration_seconds,
    distance_meters: updates.distanceMeters !== undefined ? updates.distanceMeters : existing.distance_meters,
    is_warmup: updates.isWarmup !== undefined ? updates.isWarmup : existing.is_warmup === 1,
    completed: updates.completed !== undefined ? updates.completed : existing.completed === 1,
    created_at: existing.created_at,
    updated_at: now,
    deleted_at: null,
  };

  await db.runAsync(
    `UPDATE local_workout_sets SET
       reps = ?, weight_kg = ?, duration_seconds = ?, distance_meters = ?, is_warmup = ?, completed = ?, updated_at = ?, sync_state = 'pending'
     WHERE id = ?`,
    [
      updated.reps,
      updated.weight_kg,
      updated.duration_seconds,
      updated.distance_meters,
      updated.is_warmup ? 1 : 0,
      updated.completed ? 1 : 0,
      updated.updated_at,
      setId,
    ],
  );

  await enqueueOutbox(db, {
    id: updated.id,
    entity: 'workout_sets',
    operation: 'upsert',
    payload: {
      id: updated.id,
      workout_exercise_id: updated.workout_exercise_id,
      workout_id: updated.workout_id,
      user_id: updated.user_id,
      set_number: updated.set_number,
      reps: updated.reps,
      weight_kg: updated.weight_kg,
      duration_seconds: updated.duration_seconds,
      distance_meters: updated.distance_meters,
      is_warmup: updated.is_warmup,
      completed: updated.completed,
      created_at: updated.created_at,
      updated_at: updated.updated_at,
      deleted_at: null,
    },
  });

  return updated;
}

export async function deleteWorkoutSet(db: SyncDb, setId: string): Promise<void> {
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE local_workout_sets SET deleted_at = ?, updated_at = ?, sync_state = 'pending' WHERE id = ?`,
    [now, now, setId],
  );

  await enqueueOutbox(db, {
    id: setId,
    entity: 'workout_sets',
    operation: 'delete',
    payload: { id: setId, deleted_at: now },
  });
}

// -----------------------------------------------------------------------------
// 3. QUERIES: DETAILS, HISTORY, CALENDAR, SUMMARY
// -----------------------------------------------------------------------------

export async function getWorkoutById(
  db: SyncDb,
  workoutId: string,
): Promise<WorkoutWithDetails | null> {
  const workout = await db.getFirstAsync<Workout>(
    `SELECT * FROM local_workouts WHERE id = ? AND deleted_at IS NULL`,
    [workoutId],
  );
  if (!workout) return null;

  const exercises = await db.getAllAsync<WorkoutExercise>(
    `SELECT * FROM local_workout_exercises WHERE workout_id = ? AND deleted_at IS NULL ORDER BY order_in_workout ASC`,
    [workoutId],
  );

  const rawSets = await db.getAllAsync<{
    id: string;
    workout_exercise_id: string;
    workout_id: string;
    user_id: string;
    set_number: number;
    reps: number | null;
    weight_kg: number | null;
    duration_seconds: number | null;
    distance_meters: number | null;
    is_warmup: number;
    completed: number;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT * FROM local_workout_sets WHERE workout_id = ? AND deleted_at IS NULL ORDER BY set_number ASC`,
    [workoutId],
  );

  const setsByExercise = new Map<string, WorkoutSet[]>();
  for (const s of rawSets) {
    const list = setsByExercise.get(s.workout_exercise_id) || [];
    list.push({
      ...s,
      is_warmup: s.is_warmup === 1,
      completed: s.completed === 1,
    });
    setsByExercise.set(s.workout_exercise_id, list);
  }

  const enrichedExercises = exercises.map((e) => ({
    ...e,
    sets: setsByExercise.get(e.id) || [],
  }));

  return {
    ...workout,
    exercises: enrichedExercises,
  };
}

export async function getWorkoutsForDate(
  db: SyncDb,
  userId: string,
  localDate: string,
): Promise<WorkoutWithDetails[]> {
  const workouts = await db.getAllAsync<Workout>(
    `SELECT * FROM local_workouts WHERE user_id = ? AND local_date = ? AND deleted_at IS NULL ORDER BY created_at ASC`,
    [userId, localDate],
  );

  const result: WorkoutWithDetails[] = [];
  for (const w of workouts) {
    const full = await getWorkoutById(db, w.id);
    if (full) result.push(full);
  }
  return result;
}

export async function getWorkoutsHistory(
  db: SyncDb,
  userId: string,
  limit = 50,
  offset = 0,
): Promise<Workout[]> {
  return db.getAllAsync<Workout>(
    `SELECT * FROM local_workouts
     WHERE user_id = ? AND deleted_at IS NULL
     ORDER BY local_date DESC, created_at DESC
     LIMIT ? OFFSET ?`,
    [userId, limit, offset],
  );
}

export async function getWorkoutsCalendarData(
  db: SyncDb,
  userId: string,
  startDate: string,
  endDate: string,
): Promise<Record<string, number>> {
  const rows = await db.getAllAsync<{ local_date: string; count: number }>(
    `SELECT local_date, COUNT(*) as count
     FROM local_workouts
     WHERE user_id = ? AND local_date >= ? AND local_date <= ? AND deleted_at IS NULL
     GROUP BY local_date`,
    [userId, startDate, endDate],
  );

  const map: Record<string, number> = {};
  for (const r of rows) {
    map[r.local_date] = r.count;
  }
  return map;
}

export function getWorkoutSummary(
  workout: WorkoutWithDetails,
  userWeightKg = 70,
): WorkoutSummary {
  return summarizeWorkout(workout, userWeightKg);
}

// -----------------------------------------------------------------------------
// 4. COPY PREVIOUS WORKOUT TO TODAY (PRD 6.6 WRK-6)
// -----------------------------------------------------------------------------

export async function copyPreviousWorkoutToToday(
  db: SyncDb,
  previousWorkoutId: string,
  targetDate: string,
  userId: string,
): Promise<WorkoutWithDetails> {
  const prev = await getWorkoutById(db, previousWorkoutId);
  if (!prev) {
    throw new Error(`Previous workout not found: ${previousWorkoutId}`);
  }

  // 1. Create new workout
  const newWorkout = await createWorkout(db, {
    userId,
    type: prev.type,
    name: prev.name,
    durationMinutes: prev.duration_minutes,
    localDate: targetDate,
    notes: prev.notes,
    effortRating: prev.effort_rating,
  });

  const clonedExercises: WorkoutExercise[] = [];

  // 2. Clone exercises & sets
  for (const ex of prev.exercises) {
    const newEx = await addExerciseToWorkout(db, newWorkout.id, {
      exerciseId: ex.exercise_id,
      exerciseName: ex.exercise_name,
      orderInWorkout: ex.order_in_workout,
      notes: ex.notes,
    });

    const clonedSets: WorkoutSet[] = [];
    for (const set of ex.sets || []) {
      const newSet = await addSetToExercise(db, newEx.id, {
        reps: set.reps,
        weightKg: set.weight_kg,
        durationSeconds: set.duration_seconds,
        distanceMeters: set.distance_meters,
        isWarmup: set.is_warmup,
        completed: set.completed,
      });
      clonedSets.push(newSet);
    }

    clonedExercises.push({
      ...newEx,
      sets: clonedSets,
    });
  }

  return {
    ...newWorkout,
    exercises: clonedExercises,
  };
}

// -----------------------------------------------------------------------------
// 5. PREVIOUS PERFORMANCE PER EXERCISE ("Last time: 3 x 8 at 40 kg", PRD 6.6 WRK-5)
// -----------------------------------------------------------------------------

export async function getPreviousPerformanceForExercise(
  db: SyncDb,
  userId: string,
  exerciseIdOrName: string,
  beforeDate?: string,
): Promise<PreviousExercisePerformance | null> {
  // Find the most recent workout before specified date containing this exercise
  let query = `
    SELECT we.id as exercise_row_id, w.id as workout_id, w.local_date
    FROM local_workout_exercises we
    JOIN local_workouts w ON w.id = we.workout_id
    WHERE we.user_id = ?
      AND (we.exercise_id = ? OR LOWER(we.exercise_name) = LOWER(?))
      AND we.deleted_at IS NULL
      AND w.deleted_at IS NULL
  `;
  const params: unknown[] = [userId, exerciseIdOrName, exerciseIdOrName];

  if (beforeDate) {
    query += ` AND w.local_date < ?`;
    params.push(beforeDate);
  }

  query += ` ORDER BY w.local_date DESC, w.created_at DESC LIMIT 1`;

  const match = await db.getFirstAsync<{
    exercise_row_id: string;
    workout_id: string;
    local_date: string;
  }>(query, params);

  if (!match) return null;

  // Fetch sets for that exercise
  const sets = await db.getAllAsync<{
    set_number: number;
    reps: number | null;
    weight_kg: number | null;
    duration_seconds: number | null;
    distance_meters: number | null;
    is_warmup: number;
    completed: number;
  }>(
    `SELECT set_number, reps, weight_kg, duration_seconds, distance_meters, is_warmup, completed
     FROM local_workout_sets
     WHERE workout_exercise_id = ? AND deleted_at IS NULL AND completed = 1
     ORDER BY set_number ASC`,
    [match.exercise_row_id],
  );

  const workSets = sets.filter((s) => s.is_warmup === 0);
  if (workSets.length === 0 && sets.length === 0) return null;

  const effectiveSets = workSets.length > 0 ? workSets : sets;

  // Format "Last time: 3 x 8 at 40 kg" or similar
  let formattedSummary = '';
  const firstReps = effectiveSets[0]?.reps;
  const firstWeight = effectiveSets[0]?.weight_kg;

  const allSameRepsAndWeight = effectiveSets.every(
    (s) => s.reps === firstReps && s.weight_kg === firstWeight,
  );

  if (allSameRepsAndWeight && firstReps !== null && firstReps !== undefined) {
    if (firstWeight !== null && firstWeight !== undefined && firstWeight > 0) {
      formattedSummary = `Last time: ${effectiveSets.length} x ${firstReps} at ${firstWeight} kg`;
    } else {
      formattedSummary = `Last time: ${effectiveSets.length} x ${firstReps} reps`;
    }
  } else {
    // Variable sets: e.g. "Last time: 10, 8, 6 at 50 kg" or sets summary
    const repsSummary = effectiveSets.map((s) => s.reps ?? '-').join(', ');
    if (firstWeight !== null && firstWeight !== undefined && firstWeight > 0) {
      formattedSummary = `Last time: ${repsSummary} at ${firstWeight} kg`;
    } else {
      formattedSummary = `Last time: ${repsSummary}`;
    }
  }

  return {
    workout_id: match.workout_id,
    local_date: match.local_date,
    formatted_summary: formattedSummary,
    sets: effectiveSets.map((s) => ({
      set_number: s.set_number,
      reps: s.reps,
      weight_kg: s.weight_kg,
      duration_seconds: s.duration_seconds,
      distance_meters: s.distance_meters,
    })),
  };
}

// -----------------------------------------------------------------------------
// 6. RUNNING SESSION TIMER (survives app kill, UTC timestamps, PRD 6.6 WRK-10)
// -----------------------------------------------------------------------------

export function calculateElapsedSeconds(
  timer: WorkoutTimerState,
  now: Date = new Date(),
): number {
  const startedMs = new Date(timer.started_at).getTime();
  const currentMs = timer.is_running
    ? now.getTime()
    : timer.paused_at
      ? new Date(timer.paused_at).getTime()
      : now.getTime();

  const elapsedMs = Math.max(0, currentMs - startedMs - timer.total_paused_ms);
  return Math.floor(elapsedMs / 1000);
}

export async function startWorkoutTimer(
  db: SyncDb,
  workoutId?: string | null,
  startTime?: Date,
): Promise<WorkoutTimerState> {
  const id = crypto.randomUUID();
  const now = (startTime ?? new Date()).toISOString();

  // Clear any existing active timer
  await db.runAsync(`DELETE FROM local_workout_timers`);

  const timer: WorkoutTimerState = {
    id,
    workout_id: workoutId ?? null,
    started_at: now,
    paused_at: null,
    total_paused_ms: 0,
    is_running: true,
    updated_at: now,
  };

  await db.runAsync(
    `INSERT INTO local_workout_timers (id, workout_id, started_at, paused_at, total_paused_ms, is_running, updated_at)
     VALUES (?, ?, ?, NULL, 0, 1, ?)`,
    [timer.id, timer.workout_id, timer.started_at, timer.updated_at],
  );

  return timer;
}

export async function pauseWorkoutTimer(
  db: SyncDb,
  timerId: string,
  pauseTime?: Date,
): Promise<WorkoutTimerState> {
  const row = await db.getFirstAsync<{
    id: string;
    workout_id: string | null;
    started_at: string;
    paused_at: string | null;
    total_paused_ms: number;
    is_running: number;
    updated_at: string;
  }>(`SELECT * FROM local_workout_timers WHERE id = ?`, [timerId]);

  if (!row) {
    throw new Error(`Timer not found: ${timerId}`);
  }

  if (row.is_running === 0) {
    // Already paused
    return {
      ...row,
      is_running: false,
    };
  }

  const now = (pauseTime ?? new Date()).toISOString();
  await db.runAsync(
    `UPDATE local_workout_timers SET is_running = 0, paused_at = ?, updated_at = ? WHERE id = ?`,
    [now, now, timerId],
  );

  return {
    id: row.id,
    workout_id: row.workout_id,
    started_at: row.started_at,
    paused_at: now,
    total_paused_ms: row.total_paused_ms,
    is_running: false,
    updated_at: now,
  };
}

export async function resumeWorkoutTimer(
  db: SyncDb,
  timerId: string,
  resumeTime?: Date,
): Promise<WorkoutTimerState> {
  const row = await db.getFirstAsync<{
    id: string;
    workout_id: string | null;
    started_at: string;
    paused_at: string | null;
    total_paused_ms: number;
    is_running: number;
    updated_at: string;
  }>(`SELECT * FROM local_workout_timers WHERE id = ?`, [timerId]);

  if (!row) {
    throw new Error(`Timer not found: ${timerId}`);
  }

  if (row.is_running === 1) {
    // Already running
    return {
      ...row,
      is_running: true,
    };
  }

  const now = resumeTime ?? new Date();
  const pauseDurationMs = row.paused_at ? now.getTime() - new Date(row.paused_at).getTime() : 0;
  const newTotalPausedMs = row.total_paused_ms + Math.max(0, pauseDurationMs);
  const nowIso = now.toISOString();

  await db.runAsync(
    `UPDATE local_workout_timers SET is_running = 1, paused_at = NULL, total_paused_ms = ?, updated_at = ? WHERE id = ?`,
    [newTotalPausedMs, nowIso, timerId],
  );

  return {
    id: row.id,
    workout_id: row.workout_id,
    started_at: row.started_at,
    paused_at: null,
    total_paused_ms: newTotalPausedMs,
    is_running: true,
    updated_at: nowIso,
  };
}


export async function stopWorkoutTimer(
  db: SyncDb,
  timerId: string,
): Promise<{ totalDurationSeconds: number }> {
  const row = await db.getFirstAsync<{
    id: string;
    workout_id: string | null;
    started_at: string;
    paused_at: string | null;
    total_paused_ms: number;
    is_running: number;
    updated_at: string;
  }>(`SELECT * FROM local_workout_timers WHERE id = ?`, [timerId]);

  if (!row) {
    return { totalDurationSeconds: 0 };
  }

  const timerState: WorkoutTimerState = {
    ...row,
    is_running: row.is_running === 1,
  };

  const elapsed = calculateElapsedSeconds(timerState);
  await db.runAsync(`DELETE FROM local_workout_timers WHERE id = ?`, [timerId]);

  return { totalDurationSeconds: elapsed };
}

export async function getRunningWorkoutTimer(
  db: SyncDb,
  workoutId?: string | null,
): Promise<WorkoutTimerState | null> {
  let query = `SELECT * FROM local_workout_timers`;
  const params: unknown[] = [];
  if (workoutId) {
    query += ` WHERE workout_id = ?`;
    params.push(workoutId);
  }
  query += ` LIMIT 1`;

  const row = await db.getFirstAsync<{
    id: string;
    workout_id: string | null;
    started_at: string;
    paused_at: string | null;
    total_paused_ms: number;
    is_running: number;
    updated_at: string;
  }>(query, params);

  if (!row) return null;

  return {
    id: row.id,
    workout_id: row.workout_id,
    started_at: row.started_at,
    paused_at: row.paused_at,
    total_paused_ms: row.total_paused_ms,
    is_running: row.is_running === 1,
    updated_at: row.updated_at,
  };
}

// -----------------------------------------------------------------------------
// 7. EXERCISE LIBRARY SEARCH & CUSTOM EXERCISES
// -----------------------------------------------------------------------------

export async function getExercises(
  db: SyncDb,
  options?: {
    muscleGroup?: MuscleGroup;
    searchQuery?: string;
    userId?: string;
  },
): Promise<Exercise[]> {
  let sql = `SELECT * FROM local_exercises WHERE deleted_at IS NULL`;
  const params: unknown[] = [];

  if (options?.muscleGroup) {
    sql += ` AND muscle_group = ?`;
    params.push(options.muscleGroup);
  }

  if (options?.searchQuery && options.searchQuery.trim().length > 0) {
    sql += ` AND LOWER(name) LIKE ?`;
    params.push(`%${options.searchQuery.trim().toLowerCase()}%`);
  }

  if (options?.userId) {
    sql += ` AND (owner_id IS NULL OR owner_id = ?)`;
    params.push(options.userId);
  } else {
    sql += ` AND owner_id IS NULL`;
  }

  sql += ` ORDER BY name ASC`;

  return db.getAllAsync<Exercise>(sql, params);
}

export async function createCustomExercise(
  db: SyncDb,
  input: {
    name: string;
    muscleGroup: MuscleGroup;
    equipment: Equipment;
    type: ExerciseType;
    attribution?: string | null;
  },
  userId: string,
): Promise<Exercise> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const ex: Exercise = {
    id,
    name: input.name.trim(),
    muscle_group: input.muscleGroup,
    equipment: input.equipment,
    type: input.type,
    owner_id: userId,
    attribution: input.attribution ?? null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };

  await db.runAsync(
    `INSERT INTO local_exercises (
      id, name, muscle_group, equipment, type, owner_id, attribution, created_at, updated_at, deleted_at, sync_state
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'pending')`,
    [
      ex.id,
      ex.name,
      ex.muscle_group,
      ex.equipment,
      ex.type,
      ex.owner_id,
      ex.attribution,
      ex.created_at,
      ex.updated_at,
    ],
  );

  await enqueueOutbox(db, {
    id: ex.id,
    entity: 'exercises',
    operation: 'upsert',
    payload: {
      id: ex.id,
      name: ex.name,
      muscle_group: ex.muscle_group,
      equipment: ex.equipment,
      type: ex.type,
      owner_id: ex.owner_id,
      attribution: ex.attribution,
      created_at: ex.created_at,
      updated_at: ex.updated_at,
      deleted_at: null,
    },
  });

  return ex;
}
