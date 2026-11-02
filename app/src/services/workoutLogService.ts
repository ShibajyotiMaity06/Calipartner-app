import { validWorkoutLog } from '@calipartner/core';
import { withOnlineSave, type LocalDb } from './accountDataService';
import {
  addExerciseToWorkout,
  addSetToExercise,
  createWorkout,
  getWorkoutById,
} from './workoutService';

export async function logWorkoutExercise(
  db: LocalDb,
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
  return withOnlineSave(db, async (db) => {
    let id = '';
    // Save directly and require server acknowledgement.
    const persist = async () => {
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
    };
    await persist();
    const result = await getWorkoutById(db, id);
    if (!result) throw new Error('WORKOUT_NOT_FOUND');
    return result;
  });
}
