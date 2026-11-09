import { expect, it } from 'vitest';
import {
  validateWorkoutRoutine,
  workoutRoutineFromAI,
  validatePlanPreferences,
  workoutRoutineFromLegacy,
} from './weeklyPlan';
const preferences = validatePlanPreferences({
  workout_days: [0, 2, 4],
  location: 'home',
  equipment: ['dumbbell'],
  experience: 'beginner',
  session_minutes: 30,
  limitations: '',
  workout_notes: 'Focus on arms. No legs.',
  country: 'India',
  cuisine: 'Indian',
  diet: 'mixed',
  allergies: [],
  exclusions: [],
  meals_per_day: 4,
  cooking_minutes: 30,
  budget: 'economical',
});
const raw = () => ({
  days: Array.from({ length: 7 }, (_, day) => ({
    day,
    workout: {
      title: [0, 2, 4].includes(day) ? 'Arms' : 'Rest',
      minutes: [0, 2, 4].includes(day) ? 30 : 0,
      exercises: [0, 2, 4].includes(day)
        ? [
            {
              name: 'Seated dumbbell curls',
              equipment: 'dumbbell',
              sets: 3,
              reps: 10,
              rest_seconds: 60,
            },
            {
              name: 'Hammer curls',
              equipment: 'dumbbell',
              sets: 3,
              reps: 10,
              rest_seconds: 60,
            },
            {
              name: 'Dumbbell triceps extension',
              equipment: 'dumbbell',
              sets: 3,
              reps: 10,
              rest_seconds: 60,
            },
          ]
        : [],
    },
  })),
});
it('preserves accepted full-week workouts, including manual removals, without a new AI plan', () => {
  const legacy = raw();
  legacy.days[0]!.workout.exercises = legacy.days[0]!.workout.exercises.slice(0, 1);
  expect(workoutRoutineFromLegacy(legacy)!.days[0]!.exercises).toHaveLength(1);
  expect(workoutRoutineFromLegacy({ days: legacy.days.slice(0, 1) })).toBeNull();
});
it('retains training notes, maps every weekday, respects rest days and never invents starting weights', () => {
  const plan = workoutRoutineFromAI(raw(), preferences);
  expect(preferences.workout_notes).toContain('No legs');
  expect(plan.days.map((day) => day.exercises.length)).toEqual([3, 0, 3, 0, 3, 0, 0]);
  expect(plan.days[0]!.exercises[0]!.targetSets).toEqual([
    { reps: 10, weightKg: 0 },
    { reps: 10, weightKg: 0 },
    { reps: 10, weightKg: 0 },
  ]);
});
it('rejects missing days, wrong schedules, unavailable equipment, unsafe values and explicit leg exclusions', () => {
  for (const change of [
    (value: ReturnType<typeof raw>) => value.days.pop(),
    (value: ReturnType<typeof raw>) => {
      value.days[0]!.day = 1;
    },
    (value: ReturnType<typeof raw>) => {
      value.days[1]!.workout.exercises = value.days[0]!.workout.exercises;
    },
    (value: ReturnType<typeof raw>) => {
      value.days[0]!.workout.exercises[0]!.equipment = 'barbell';
    },
    (value: ReturnType<typeof raw>) => {
      value.days[0]!.workout.exercises[0]!.name = 'Goblet squat';
    },
    (value: ReturnType<typeof raw>) => {
      value.days[0]!.workout.exercises[0]!.reps = 101;
    },
  ]) {
    const value = raw();
    change(value);
    expect(() => workoutRoutineFromAI(value, preferences)).toThrow();
  }
});
it('preserves individually edited reps and fractional weights, and validates removals without changing other days', () => {
  const plan = workoutRoutineFromAI(raw(), preferences);
  plan.days[0]!.exercises[0]!.targetSets = [
    { reps: 12, weightKg: 7.5 },
    { reps: 8, weightKg: 10 },
  ];
  expect(validateWorkoutRoutine(plan).days[0]!.exercises[0]!.targetSets).toEqual(
    plan.days[0]!.exercises[0]!.targetSets,
  );
  plan.days[2]!.exercises = [];
  expect(validateWorkoutRoutine(plan).days[2]!.minutes).toBe(0);
  plan.days[0]!.exercises[0]!.targetSets[0]!.reps = 0;
  expect(() => validateWorkoutRoutine(plan)).toThrow();
});
