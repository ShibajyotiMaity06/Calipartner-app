import { useCallback, useEffect, useState } from 'react';
import {
  summarizeWorkout as coreGetWorkoutSummary,
  type PreviousExercisePerformance,
  type Workout,
  type WorkoutExercise,
  type WorkoutSet,
  type WorkoutSummary,
  type WorkoutTimerState,
  type WorkoutWithDetails,
} from '@calipartner/core';
import { getDb } from '@/db';
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
  getWorkoutsForDate,
  pauseWorkoutTimer,
  removeExerciseFromWorkout,
  reorderWorkoutExercises,
  resumeWorkoutTimer,
  startWorkoutTimer,
  stopWorkoutTimer,
  updateWorkout,
  updateWorkoutSet,
  type AddExerciseInput,
  type AddSetInput,
  type CreateWorkoutInput,
  type UpdateSetInput,
  type UpdateWorkoutInput,
} from '@/services/workoutService';
import { useTargets } from './useTargets';

export interface UseWorkoutsResult {
  workouts: WorkoutWithDetails[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  create: (input: Omit<CreateWorkoutInput, 'userId' | 'localDate'> & { localDate?: string }) => Promise<Workout>;
  update: (workoutId: string, updates: UpdateWorkoutInput) => Promise<Workout>;
  remove: (workoutId: string) => Promise<void>;
  addExercise: (workoutId: string, input: AddExerciseInput) => Promise<WorkoutExercise>;
  removeExercise: (workoutExerciseId: string) => Promise<void>;
  reorderExercises: (workoutId: string, orderedIds: string[]) => Promise<void>;
  addSet: (workoutExerciseId: string, input: AddSetInput) => Promise<WorkoutSet>;
  updateSet: (setId: string, updates: UpdateSetInput) => Promise<WorkoutSet>;
  deleteSet: (setId: string) => Promise<void>;
  copyToDate: (workoutId: string, targetDate: string) => Promise<WorkoutWithDetails>;
  getSummary: (workout: WorkoutWithDetails) => WorkoutSummary;
  getPreviousPerformance: (exerciseIdOrName: string) => Promise<PreviousExercisePerformance | null>;
}

export function useWorkouts(date?: string): UseWorkoutsResult {
  const localDate = date ?? new Date().toISOString().split('T')[0]!;
  const { currentGoalProfile } = useTargets();
  const userId = currentGoalProfile?.user_id ?? 'guest-user';
  const userWeightKg = currentGoalProfile?.current_weight_kg ?? 70;

  const [workouts, setWorkouts] = useState<WorkoutWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const db = await getDb();
      const items = await getWorkoutsForDate(db, userId, localDate);
      setWorkouts(items);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [userId, localDate]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const create = useCallback(
    async (input: Omit<CreateWorkoutInput, 'userId' | 'localDate'> & { localDate?: string }) => {
      const db = await getDb();
      const res = await createWorkout(db, {
        ...input,
        userId,
        localDate: input.localDate ?? localDate,
      });
      await loadData();
      return res;
    },
    [userId, localDate, loadData],
  );

  const update = useCallback(
    async (workoutId: string, updates: UpdateWorkoutInput) => {
      const db = await getDb();
      const res = await updateWorkout(db, workoutId, updates);
      await loadData();
      return res;
    },
    [loadData],
  );

  const remove = useCallback(
    async (workoutId: string) => {
      const db = await getDb();
      await deleteWorkout(db, workoutId);
      await loadData();
    },
    [loadData],
  );

  const addExercise = useCallback(
    async (workoutId: string, input: AddExerciseInput) => {
      const db = await getDb();
      const res = await addExerciseToWorkout(db, workoutId, input);
      await loadData();
      return res;
    },
    [loadData],
  );

  const removeExercise = useCallback(
    async (workoutExerciseId: string) => {
      const db = await getDb();
      await removeExerciseFromWorkout(db, workoutExerciseId);
      await loadData();
    },
    [loadData],
  );

  const reorderExercises = useCallback(
    async (workoutId: string, orderedIds: string[]) => {
      const db = await getDb();
      await reorderWorkoutExercises(db, workoutId, orderedIds);
      await loadData();
    },
    [loadData],
  );

  const addSet = useCallback(
    async (workoutExerciseId: string, input: AddSetInput) => {
      const db = await getDb();
      const res = await addSetToExercise(db, workoutExerciseId, input);
      await loadData();
      return res;
    },
    [loadData],
  );

  const updateSet = useCallback(
    async (setId: string, updates: UpdateSetInput) => {
      const db = await getDb();
      const res = await updateWorkoutSet(db, setId, updates);
      await loadData();
      return res;
    },
    [loadData],
  );

  const deleteSet = useCallback(
    async (setId: string) => {
      const db = await getDb();
      await deleteWorkoutSet(db, setId);
      await loadData();
    },
    [loadData],
  );

  const copyToDate = useCallback(
    async (workoutId: string, targetDate: string) => {
      const db = await getDb();
      const res = await copyPreviousWorkoutToToday(db, workoutId, targetDate, userId);
      await loadData();
      return res;
    },
    [userId, loadData],
  );

  const getSummary = useCallback(
    (workout: WorkoutWithDetails) => {
      return coreGetWorkoutSummary(workout, userWeightKg);
    },
    [userWeightKg],
  );

  const getPreviousPerformance = useCallback(
    async (exerciseIdOrName: string) => {
      const db = await getDb();
      return getPreviousPerformanceForExercise(db, userId, exerciseIdOrName, localDate);
    },
    [userId, localDate],
  );

  return {
    workouts,
    loading,
    error,
    refresh: loadData,
    create,
    update,
    remove,
    addExercise,
    removeExercise,
    reorderExercises,
    addSet,
    updateSet,
    deleteSet,
    copyToDate,
    getSummary,
    getPreviousPerformance,
  };
}

// -----------------------------------------------------------------------------
// Running Session Timer Hook (survives app kill)
// -----------------------------------------------------------------------------

export interface UseWorkoutTimerResult {
  timer: WorkoutTimerState | null;
  elapsedSeconds: number;
  formattedTime: string;
  isRunning: boolean;
  start: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<number>;
}

export function useWorkoutTimer(workoutId?: string | null): UseWorkoutTimerResult {
  const [timer, setTimer] = useState<WorkoutTimerState | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const loadTimer = useCallback(async () => {
    try {
      const db = await getDb();
      const current = await getRunningWorkoutTimer(db, workoutId);
      setTimer(current);
      if (current) {
        setElapsedSeconds(calculateElapsedSeconds(current));
      } else {
        setElapsedSeconds(0);
      }
    } catch {
      // Ignore
    }
  }, [workoutId]);

  useEffect(() => {
    void loadTimer();
  }, [loadTimer]);

  // Tick interval for active timer
  useEffect(() => {
    if (!timer || !timer.is_running) return;

    const interval = setInterval(() => {
      setElapsedSeconds(calculateElapsedSeconds(timer));
    }, 1000);

    return () => clearInterval(interval);
  }, [timer]);

  const start = useCallback(async () => {
    const db = await getDb();
    const created = await startWorkoutTimer(db, workoutId);
    setTimer(created);
    setElapsedSeconds(0);
  }, [workoutId]);

  const pause = useCallback(async () => {
    if (!timer) return;
    const db = await getDb();
    const paused = await pauseWorkoutTimer(db, timer.id);
    setTimer(paused);
    setElapsedSeconds(calculateElapsedSeconds(paused));
  }, [timer]);

  const resume = useCallback(async () => {
    if (!timer) return;
    const db = await getDb();
    const resumed = await resumeWorkoutTimer(db, timer.id);
    setTimer(resumed);
    setElapsedSeconds(calculateElapsedSeconds(resumed));
  }, [timer]);

  const stop = useCallback(async () => {
    if (!timer) return 0;
    const db = await getDb();
    const res = await stopWorkoutTimer(db, timer.id);
    setTimer(null);
    setElapsedSeconds(0);
    return res.totalDurationSeconds;
  }, [timer]);

  // Format elapsed seconds as HH:MM:SS or MM:SS
  const formatTime = (secs: number) => {
    const hours = Math.floor(secs / 3600);
    const minutes = Math.floor((secs % 3600) / 60);
    const seconds = secs % 60;

    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

    if (hours > 0) {
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}`;
  };

  return {
    timer,
    elapsedSeconds,
    formattedTime: formatTime(elapsedSeconds),
    isRunning: timer?.is_running ?? false,
    start,
    pause,
    resume,
    stop,
  };
}
