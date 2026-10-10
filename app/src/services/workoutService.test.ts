import { describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import {
  addExerciseToWorkout,
  addSetToExercise,
  calculateElapsedSeconds,
  copyPreviousWorkoutToToday,
  createWorkout,
  deleteWorkout,
  deleteWorkoutSet,
  getPreviousPerformanceForExercise,
  getRunningWorkoutTimer,
  getWorkoutById,
  getWorkoutsCalendarData,
  getWorkoutsForDate,
  getWorkoutsHistory,
  getWorkoutSummary,
  pauseWorkoutTimer,
  reorderWorkoutExercises,
  resumeWorkoutTimer,
  startWorkoutTimer,
  stopWorkoutTimer,
  updateWorkout,
  updateWorkoutSet,
} from './workoutService';
import {
  flushOutbox,
  getPendingOutboxItems,
  type SupabaseSyncClient,
  type SyncDb,
} from './syncService';

function createTestDb(): SyncDb {
  const sqlite = new DatabaseSync(':memory:');

  sqlite.exec(`
    CREATE TABLE outbox (
      id TEXT PRIMARY KEY NOT NULL,
      entity TEXT NOT NULL,
      operation TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      next_retry_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE local_exercises (
      id              TEXT PRIMARY KEY NOT NULL,
      name            TEXT NOT NULL,
      muscle_group    TEXT NOT NULL,
      equipment       TEXT NOT NULL,
      type            TEXT NOT NULL,
      owner_id        TEXT,
      attribution     TEXT,
      created_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL,
      deleted_at      TEXT,
      sync_state      TEXT NOT NULL DEFAULT 'synced'
    );

    CREATE TABLE local_workouts (
      id                TEXT PRIMARY KEY NOT NULL,
      user_id           TEXT NOT NULL,
      type              TEXT NOT NULL,
      name              TEXT,
      start_time        TEXT,
      duration_minutes  INTEGER NOT NULL DEFAULT 0,
      local_date        TEXT NOT NULL,
      notes             TEXT,
      effort_rating     INTEGER,
      created_at        TEXT NOT NULL,
      updated_at        TEXT NOT NULL,
      deleted_at        TEXT,
      sync_state        TEXT NOT NULL DEFAULT 'pending'
    );

    CREATE TABLE local_workout_exercises (
      id                TEXT PRIMARY KEY NOT NULL,
      workout_id        TEXT NOT NULL,
      user_id           TEXT NOT NULL,
      exercise_id       TEXT,
      exercise_name     TEXT NOT NULL,
      order_in_workout  INTEGER NOT NULL DEFAULT 0,
      notes             TEXT,
      created_at        TEXT NOT NULL,
      updated_at        TEXT NOT NULL,
      deleted_at        TEXT,
      sync_state        TEXT NOT NULL DEFAULT 'pending'
    );

    CREATE TABLE local_workout_sets (
      id                  TEXT PRIMARY KEY NOT NULL,
      workout_exercise_id TEXT NOT NULL,
      workout_id          TEXT NOT NULL,
      user_id             TEXT NOT NULL,
      set_number          INTEGER NOT NULL DEFAULT 1,
      reps                INTEGER,
      weight_kg           REAL,
      duration_seconds    INTEGER,
      distance_meters     REAL,
      is_warmup           INTEGER NOT NULL DEFAULT 0,
      completed           INTEGER NOT NULL DEFAULT 1,
      created_at          TEXT NOT NULL,
      updated_at          TEXT NOT NULL,
      deleted_at          TEXT,
      sync_state          TEXT NOT NULL DEFAULT 'pending'
    );

    CREATE TABLE local_workout_timers (
      id                  TEXT PRIMARY KEY NOT NULL,
      workout_id          TEXT,
      started_at          TEXT NOT NULL,
      paused_at           TEXT,
      total_paused_ms     INTEGER NOT NULL DEFAULT 0,
      is_running          INTEGER NOT NULL DEFAULT 1,
      updated_at          TEXT NOT NULL
    );

    CREATE TABLE sync_cursors (
      entity          TEXT PRIMARY KEY NOT NULL,
      last_pulled_at  TEXT NOT NULL
    );
  `);

  return {
    async runAsync(sql: string, ...params: unknown[]) {
      const flat = Array.isArray(params[0]) ? params[0] : params;
      const stmt = sqlite.prepare(sql);
      const res = stmt.run(...flat);
      return { changes: res.changes, lastInsertRowId: res.lastInsertRowid };
    },
    async getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]> {
      const flat = Array.isArray(params[0]) ? params[0] : params;
      const stmt = sqlite.prepare(sql);
      return stmt.all(...flat) as T[];
    },
    async getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null> {
      const flat = Array.isArray(params[0]) ? params[0] : params;
      const stmt = sqlite.prepare(sql);
      const rows = stmt.all(...flat);
      return (rows[0] as T) || null;
    },
  };
}

describe('WorkoutService — CRUD, Exercises, Sets & Offline Sync', () => {
  it('creates, edits, and deletes a workout for any date with outbox queueing', async () => {
    const db = createTestDb();
    const userId = 'user-test-1';

    // 1. Create workout
    const workout = await createWorkout(db, {
      userId,
      type: 'strength',
      name: 'Push Day',
      durationMinutes: 50,
      localDate: '2026-10-10',
      effortRating: 8,
      notes: 'Felt strong on bench',
    });

    expect(workout.id).toBeDefined();
    expect(workout.name).toBe('Push Day');
    expect(workout.local_date).toBe('2026-10-10');

    // Verify outbox queued
    const pendingOutbox = await getPendingOutboxItems(db);
    expect(pendingOutbox).toHaveLength(1);
    expect(pendingOutbox[0]!.entity).toBe('workouts');
    expect(pendingOutbox[0]!.operation).toBe('upsert');

    // 2. Edit workout
    const updated = await updateWorkout(db, workout.id, {
      durationMinutes: 55,
      notes: 'Updated notes after stretching',
    });
    expect(updated.duration_minutes).toBe(55);
    expect(updated.notes).toBe('Updated notes after stretching');

    // 3. Delete workout
    await deleteWorkout(db, workout.id);
    const fetched = await getWorkoutById(db, workout.id);
    expect(fetched).toBeNull();
  });

  it('adds exercises, adds sets, reorders exercises, and updates sets', async () => {
    const db = createTestDb();
    const userId = 'user-test-1';

    const workout = await createWorkout(db, {
      userId,
      type: 'strength',
      name: 'Leg Day',
      localDate: '2026-10-10',
    });

    // Add exercises
    const squatEx = await addExerciseToWorkout(db, workout.id, {
      exerciseName: 'Barbell Back Squat',
      orderInWorkout: 1,
    });
    const legPressEx = await addExerciseToWorkout(db, workout.id, {
      exerciseName: 'Leg Press',
      orderInWorkout: 2,
    });

    // Add sets to Squat
    const set1 = await addSetToExercise(db, squatEx.id, {
      reps: 10,
      weightKg: 80,
      isWarmup: true,
    });
    const set2 = await addSetToExercise(db, squatEx.id, {
      reps: 8,
      weightKg: 100,
      isWarmup: false,
    });

    expect(set1.set_number).toBe(1);
    expect(set2.set_number).toBe(2);

    // Update set 2 to 105 kg
    const updatedSet2 = await updateWorkoutSet(db, set2.id, {
      weightKg: 105,
    });
    expect(updatedSet2.weight_kg).toBe(105);

    // Reorder exercises: Leg Press first, Squat second
    await reorderWorkoutExercises(db, workout.id, [legPressEx.id, squatEx.id]);

    const fullWorkout = await getWorkoutById(db, workout.id);
    expect(fullWorkout).not.toBeNull();
    expect(fullWorkout?.exercises).toHaveLength(2);
    expect(fullWorkout?.exercises[0]!.exercise_name).toBe('Leg Press');
    expect(fullWorkout?.exercises[1]!.exercise_name).toBe('Barbell Back Squat');
    expect(fullWorkout?.exercises[1]!.sets).toHaveLength(2);

    // Delete set 1
    await deleteWorkoutSet(db, set1.id);
    const afterDelete = await getWorkoutById(db, workout.id);
    expect(afterDelete?.exercises[1]!.sets).toHaveLength(1);
  });

  it('copies a previous workout to today (PRD 6.6 WRK-6)', async () => {
    const db = createTestDb();
    const userId = 'user-test-1';

    // Yesterday's workout
    const prevWorkout = await createWorkout(db, {
      userId,
      type: 'strength',
      name: 'Upper Body',
      durationMinutes: 45,
      localDate: '2026-10-09',
    });

    const bench = await addExerciseToWorkout(db, prevWorkout.id, {
      exerciseName: 'Bench Press',
    });
    await addSetToExercise(db, bench.id, { reps: 8, weightKg: 70 });
    await addSetToExercise(db, bench.id, { reps: 8, weightKg: 70 });

    // Copy to today '2026-10-10'
    const copied = await copyPreviousWorkoutToToday(
      db,
      prevWorkout.id,
      '2026-10-10',
      userId,
    );

    expect(copied.id).not.toBe(prevWorkout.id);
    expect(copied.local_date).toBe('2026-10-10');
    expect(copied.name).toBe('Upper Body');
    expect(copied.exercises).toHaveLength(1);
    expect(copied.exercises[0]!.id).not.toBe(bench.id);
    expect(copied.exercises[0]!.exercise_name).toBe('Bench Press');
    expect(copied.exercises[0]!.sets).toHaveLength(2);
    expect(copied.exercises[0]!.sets?.[0]!.weight_kg).toBe(70);
  });

  it('fetches previous performance per exercise ("Last time: 3 x 8 at 40 kg", PRD 6.6 WRK-5)', async () => {
    const db = createTestDb();
    const userId = 'user-test-1';

    // Log workout on 2026-10-05
    const w1 = await createWorkout(db, {
      userId,
      type: 'strength',
      localDate: '2026-10-05',
    });
    const bench1 = await addExerciseToWorkout(db, w1.id, {
      exerciseName: 'Barbell Bench Press',
    });
    await addSetToExercise(db, bench1.id, { reps: 8, weightKg: 40 });
    await addSetToExercise(db, bench1.id, { reps: 8, weightKg: 40 });
    await addSetToExercise(db, bench1.id, { reps: 8, weightKg: 40 });

    // Now on 2026-10-10, user wants to see "Last time" for Bench Press
    const perf = await getPreviousPerformanceForExercise(
      db,
      userId,
      'Barbell Bench Press',
      '2026-10-10',
    );

    expect(perf).not.toBeNull();
    expect(perf?.formatted_summary).toBe('Last time: 3 x 8 at 40 kg');
    expect(perf?.sets).toHaveLength(3);
  });

  it('fetches workouts history list and calendar data', async () => {
    const db = createTestDb();
    const userId = 'user-test-1';

    await createWorkout(db, { userId, type: 'strength', localDate: '2026-10-08' });
    await createWorkout(db, { userId, type: 'cardio', localDate: '2026-10-09' });
    await createWorkout(db, { userId, type: 'strength', localDate: '2026-10-10' });
    await createWorkout(db, { userId, type: 'yoga_mobility', localDate: '2026-10-10' });

    const history = await getWorkoutsHistory(db, userId);
    expect(history).toHaveLength(4);

    const forDate = await getWorkoutsForDate(db, userId, '2026-10-10');
    expect(forDate).toHaveLength(2);

    const calendar = await getWorkoutsCalendarData(
      db,
      userId,
      '2026-10-01',
      '2026-10-15',
    );
    expect(calendar['2026-10-08']).toBe(1);
    expect(calendar['2026-10-09']).toBe(1);
    expect(calendar['2026-10-10']).toBe(2);
    expect(calendar['2026-10-11']).toBeUndefined();
  });

  it('generates accurate per-workout summary with volume and MET calories', async () => {
    const db = createTestDb();
    const userId = 'user-test-1';

    const workout = await createWorkout(db, {
      userId,
      type: 'strength',
      durationMinutes: 60,
      localDate: '2026-10-10',
      effortRating: 7,
    });

    const ex = await addExerciseToWorkout(db, workout.id, {
      exerciseName: 'Deadlift',
    });
    await addSetToExercise(db, ex.id, { reps: 5, weightKg: 100 });
    await addSetToExercise(db, ex.id, { reps: 5, weightKg: 120 });

    const full = await getWorkoutById(db, workout.id);
    expect(full).not.toBeNull();

    const summary = getWorkoutSummary(full!, 75);
    // Volume: 5*100 + 5*120 = 1100 kg
    expect(summary.total_volume_kg).toBe(1100);
    expect(summary.total_sets).toBe(2);
    expect(summary.total_reps).toBe(10);
    expect(summary.is_calorie_estimate).toBe(true);
    expect(summary.estimated_calories).toBeGreaterThan(0);
    expect(summary.exercise_summaries[0]!.best_1rm_kg).toBe(140); // 120 * (1 + 5/30) = 140
  });
});

describe('Workout Running Session Timer (survives app kill, PRD 6.6 WRK-10)', () => {
  it('starts, pauses, resumes, and computes correct elapsed seconds', async () => {
    const db = createTestDb();

    // 1. Start timer
    const t0 = new Date('2026-10-10T10:00:00Z');
    const timer = await startWorkoutTimer(db, 'w-timer-test', t0);
    expect(timer.is_running).toBe(true);

    // Elapsed after 20 seconds
    const t1 = new Date(t0.getTime() + 20_000);
    expect(calculateElapsedSeconds(timer, t1)).toBe(20);

    // 2. Pause timer at 20 seconds
    const paused = await pauseWorkoutTimer(db, timer.id, t1);
    expect(paused.is_running).toBe(false);

    // 10 seconds later while paused, elapsed should STILL be 20 seconds
    const t2 = new Date(t1.getTime() + 10_000);
    expect(calculateElapsedSeconds(paused, t2)).toBe(20);

    // 3. Resume timer 10 seconds later (at t2)
    const resumed = await resumeWorkoutTimer(db, timer.id, t2);
    expect(resumed.is_running).toBe(true);

    // 15 seconds after resuming (t3), elapsed should be 35 seconds (20 + 15)
    const t3 = new Date(t2.getTime() + 15_000);
    expect(calculateElapsedSeconds(resumed, t3)).toBe(35);

    // 4. App kill & reload from database:
    // When component or app relaunches, it fetches running timer from SQLite
    const reloaded = await getRunningWorkoutTimer(db, 'w-timer-test');
    expect(reloaded).not.toBeNull();
    expect(reloaded?.id).toBe(timer.id);

    // 5. Stop timer
    const stopped = await stopWorkoutTimer(db, timer.id);
    expect(stopped.totalDurationSeconds).toBeGreaterThanOrEqual(0);

    const activeAfterStop = await getRunningWorkoutTimer(db, 'w-timer-test');
    expect(activeAfterStop).toBeNull();
  });
});

describe('Workout Offline Sync Layer Integration', () => {
  it('pushes local workouts and sets to Supabase outbox', async () => {
    const db = createTestDb();
    const userId = 'user-sync-test';

    const workout = await createWorkout(db, {
      userId,
      type: 'cardio',
      durationMinutes: 30,
      localDate: '2026-10-10',
    });

    const upsertCalls: Record<string, Array<Record<string, unknown>>> = {};
    const mockSupabase: SupabaseSyncClient = {
      from: (table: string) => ({
        upsert: async (values: Record<string, unknown> | Array<Record<string, unknown>>) => {
          upsertCalls[table] = upsertCalls[table] || [];
          if (Array.isArray(values)) {
            upsertCalls[table]!.push(...values);
          } else {
            upsertCalls[table]!.push(values);
          }
          return { error: null };
        },
        update: () => ({
          eq: async () => ({ error: null }),
        }),
        select: () => ({
          gt: () => ({
            order: async () => ({ error: null, data: [] }),
          }),
          order: async () => ({ error: null, data: [] }),
        }),
      }),
    };

    const flushResult = await flushOutbox(db, mockSupabase);
    expect(flushResult.succeeded).toBe(1);
    expect(upsertCalls['workouts']).toHaveLength(1);
    expect(upsertCalls['workouts']?.[0]?.['id']).toBe(workout.id);

    // Local outbox is now empty
    const remaining = await getPendingOutboxItems(db);
    expect(remaining).toHaveLength(0);
  });

});
