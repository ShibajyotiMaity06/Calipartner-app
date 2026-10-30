import { validWorkoutLog } from '@calipartner/core';
import type { SQLiteDatabase } from 'expo-sqlite';
import {
  addExerciseToWorkout,
  addSetToExercise,
  createWorkout,
  getWorkoutById,
} from './workoutService';

export async function logWorkoutExercise(
  db: SQLiteDatabase,
  input: {
    userId: string;
    localDate: string;
    exerciseName: string;
    durationMinutes: number;
    sets: Array<{ reps: number; weightKg: number }>;
  },
) {
  if (!input.exerciseName.trim() || !validWorkoutLog(input.sets, input.durationMinutes))
    throw new Error('INVALID_WORKOUT');
  let id = '';
  // The diary and every outbox row commit together, including on browser storage failure.
  await db.withTransactionAsync(async () => {
    const workout = await createWorkout(db, {
      userId: input.userId,
      localDate: input.localDate,
      name: input.exerciseName,
      type: 'strength',
      durationMinutes: input.durationMinutes,
    });
    id = workout.id;
    const exercise = await addExerciseToWorkout(db, id, {
      exerciseName: input.exerciseName,
      orderInWorkout: 1,
    });
    for (const set of input.sets)
      await addSetToExercise(db, exercise.id, { ...set, completed: true });
  });
  const result = await getWorkoutById(db, id);
  if (!result) throw new Error('WORKOUT_NOT_FOUND');
  return result;
}
