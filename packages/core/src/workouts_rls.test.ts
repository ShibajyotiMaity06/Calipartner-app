import { describe, expect, it } from 'vitest';
import {
  maskMemberSnapshot,
  type DailySummary,
  type Exercise,
  type RoomMember,
  type Workout,
  type WorkoutExercise,
  type WorkoutSet,
} from './index';

/**
 * In-memory simulation of Supabase Row-Level Security policies for Phase 6 tables:
 * - exercises: library (owner_id IS NULL) readable by all; custom (owner_id = uid) readable/writable only by owner
 * - workouts: owner_only (auth.uid() = user_id)
 * - workout_exercises: owner_only (auth.uid() = user_id)
 * - workout_sets: owner_only (auth.uid() = user_id)
 */
class InMemoryWorkoutRlsDb {
  exercises: Exercise[] = [];
  workouts: Workout[] = [];
  workoutExercises: WorkoutExercise[] = [];
  workoutSets: WorkoutSet[] = [];

  // EXERCISES
  insertExercise(callerId: string | null, ex: Exercise): Exercise {
    if (ex.owner_id === null) {
      if (callerId !== 'service_role') {
        throw new Error('RLS violation: only service_role can create global library exercises');
      }
    } else {
      if (callerId !== ex.owner_id) {
        throw new Error('RLS violation: cannot create custom exercise for another user');
      }
    }
    this.exercises.push(ex);
    return ex;
  }

  selectExercises(callerId: string | null): Exercise[] {
    if (!callerId) {
      return this.exercises.filter((e) => e.owner_id === null && !e.deleted_at);
    }
    return this.exercises.filter(
      (e) => (e.owner_id === null || e.owner_id === callerId) && !e.deleted_at,
    );
  }

  // WORKOUTS
  insertWorkout(callerId: string, w: Workout): Workout {
    if (callerId !== w.user_id) {
      throw new Error('RLS violation: cannot insert workout for another user');
    }
    this.workouts.push(w);
    return w;
  }

  selectWorkouts(callerId: string): Workout[] {
    return this.workouts.filter((w) => w.user_id === callerId && !w.deleted_at);
  }

  // WORKOUT EXERCISES
  insertWorkoutExercise(callerId: string, we: WorkoutExercise): WorkoutExercise {
    if (callerId !== we.user_id) {
      throw new Error('RLS violation: cannot insert workout exercise for another user');
    }
    this.workoutExercises.push(we);
    return we;
  }

  selectWorkoutExercises(callerId: string): WorkoutExercise[] {
    return this.workoutExercises.filter((we) => we.user_id === callerId && !we.deleted_at);
  }

  // WORKOUT SETS
  insertWorkoutSet(callerId: string, ws: WorkoutSet): WorkoutSet {
    if (callerId !== ws.user_id) {
      throw new Error('RLS violation: cannot insert workout set for another user');
    }
    this.workoutSets.push(ws);
    return ws;
  }

  selectWorkoutSets(callerId: string): WorkoutSet[] {
    return this.workoutSets.filter((ws) => ws.user_id === callerId && !ws.deleted_at);
  }
}

describe('Phase 6 RLS Security & Privacy Enforcement', () => {
  it('enforces owner-only access on workouts, workout_exercises, and workout_sets', () => {
    const db = new InMemoryWorkoutRlsDb();
    const userA = 'user-a';
    const userB = 'user-b';

    // User A logs a workout with exercises and sets
    db.insertWorkout(userA, {
      id: 'w-1',
      user_id: userA,
      type: 'strength',
      duration_minutes: 60,
      local_date: '2026-10-10',
    });

    db.insertWorkoutExercise(userA, {
      id: 'we-1',
      workout_id: 'w-1',
      user_id: userA,
      exercise_name: 'Barbell Bench Press',
      order_in_workout: 1,
    });

    db.insertWorkoutSet(userA, {
      id: 'ws-1',
      workout_exercise_id: 'we-1',
      workout_id: 'w-1',
      user_id: userA,
      set_number: 1,
      reps: 8,
      weight_kg: 80,
    });

    // User A can read their own
    expect(db.selectWorkouts(userA)).toHaveLength(1);
    expect(db.selectWorkoutExercises(userA)).toHaveLength(1);
    expect(db.selectWorkoutSets(userA)).toHaveLength(1);

    // User B CANNOT read User A's workout, exercises, or sets
    expect(db.selectWorkouts(userB)).toHaveLength(0);
    expect(db.selectWorkoutExercises(userB)).toHaveLength(0);
    expect(db.selectWorkoutSets(userB)).toHaveLength(0);

    // User B cannot insert records belonging to User A
    expect(() =>
      db.insertWorkout(userB, {
        id: 'w-2',
        user_id: userA,
        type: 'strength',
        duration_minutes: 30,
        local_date: '2026-10-10',
      }),
    ).toThrow(/RLS violation/);
  });

  it('allows all users to read library exercises, but custom exercises are owner-only', () => {
    const db = new InMemoryWorkoutRlsDb();
    const userA = 'user-a';
    const userB = 'user-b';

    // Global library exercise
    db.insertExercise('service_role', {
      id: 'ex-lib-1',
      name: 'Squat',
      muscle_group: 'legs',
      equipment: 'barbell',
      type: 'strength',
      owner_id: null,
    });

    // Custom exercise created by User A
    db.insertExercise(userA, {
      id: 'ex-custom-a',
      name: 'Special Cable Kickback',
      muscle_group: 'legs',
      equipment: 'cable',
      type: 'strength',
      owner_id: userA,
    });

    // User A sees both
    const exA = db.selectExercises(userA);
    expect(exA).toHaveLength(2);

    // User B sees library exercise, but NOT User A's custom exercise
    const exB = db.selectExercises(userB);
    expect(exB).toHaveLength(1);
    expect(exB[0]!.id).toBe('ex-lib-1');
  });

  it('respects room privacy settings: hides workout status when share_workouts is false', () => {
    const member: RoomMember = {
      id: 'rm-1',
      room_id: 'room-1',
      user_id: 'user-a',
      role: 'member',
      status: 'active',
      privacy_settings: {
        share_streak: true,
        share_goal_completion: true,
        share_steps: true,
        share_water: true,
        share_workouts: false, // HIDDEN!
        share_workout_details: false,
        share_calories_macros: false,
        share_meals: 'never',
        share_weight_number: false,
        share_weight_progress: false,
        share_fasting: false,
      },
      joined_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const summary: DailySummary = {
      user_id: 'user-a',
      local_date: '2026-10-10',
      calories: 2000,
      protein: 150,
      carbs: 200,
      fat: 65,
      steps: 8000,
      water_ml: 2500,
      workout_minutes: 60,
      logged_day: true,
      goal_day: true,
    };

    // When User B views User A's snapshot:
    const snapshot = maskMemberSnapshot(
      member,
      { nickname: 'Alice', username: 'alice', avatar_url: null },
      summary,
      {},
      2000,
      false, // viewing as partner
    );

    expect(snapshot.metrics.workout_status).toBe('locked');
  });

  it('shares workout status (worked_out + duration) when share_workouts is true, but NEVER leaks sets or weights', () => {
    const member: RoomMember = {
      id: 'rm-1',
      room_id: 'room-1',
      user_id: 'user-a',
      role: 'member',
      status: 'active',
      privacy_settings: {
        share_streak: true,
        share_goal_completion: true,
        share_steps: true,
        share_water: true,
        share_workouts: true, // SHARED!
        share_workout_details: false,
        share_calories_macros: false,
        share_meals: 'never',
        share_weight_number: false,
        share_weight_progress: false,
        share_fasting: false,
      },
      joined_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const summary: DailySummary = {
      user_id: 'user-a',
      local_date: '2026-10-10',
      calories: 2000,
      protein: 150,
      carbs: 200,
      fat: 65,
      steps: 8000,
      water_ml: 2500,
      workout_minutes: 45,
      logged_day: true,
      goal_day: true,
    };

    const snapshot = maskMemberSnapshot(
      member,
      { nickname: 'Alice', username: 'alice', avatar_url: null },
      summary,
      {},
      2000,
      false, // viewing as partner
    );

    // Partner sees worked_out and duration
    expect(snapshot.metrics.workout_status).toEqual({
      worked_out: true,
      duration_minutes: 45,
    });

    // Notice that snapshot metrics contains NO sets, reps, or weights!
    const metricsAny = snapshot.metrics as unknown as Record<string, unknown>;
    expect(metricsAny.sets).toBeUndefined();
    expect(metricsAny.weights).toBeUndefined();
    expect(metricsAny.volume).toBeUndefined();
  });
});
