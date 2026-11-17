import { expect, it } from 'vitest';
import {
  defaultWorkoutDays,
  WORKOUT_MUSCLES,
  WORKOUT_SPLITS,
  WORKOUT_SPLIT_DAYS,
  workoutSplitSchedule,
} from './workoutSplits';
import { validateWorkoutPreferences, workoutRoutineFromAI } from './weeklyPlan';

const base = {
  location: 'home',
  equipment: ['bodyweight'],
  experience: 'beginner',
  session_minutes: 45,
  limitations: '',
};
it('keeps all five splits and their supported weekly frequencies without priority muscles', () => {
  for (const workout_split of WORKOUT_SPLITS)
    for (const count of WORKOUT_SPLIT_DAYS[workout_split]) {
      const preferences = validateWorkoutPreferences({
        ...base,
        workout_split,
        workout_days: defaultWorkoutDays(count),
      });
      const schedule = workoutSplitSchedule(preferences)!;
      expect(schedule.map((day) => day.day)).toEqual(preferences.workout_days);
      for (const muscle of WORKOUT_MUSCLES) {
        const expected =
          workout_split === 'full_body'
            ? count
            : workout_split === 'upper_lower' ||
                workout_split === 'hybrid' ||
                (workout_split === 'ppl' && count === 6)
              ? 2
              : 1;
        expect(schedule.filter((day) => day.muscles.includes(muscle))).toHaveLength(expected);
      }
    }
  expect(
    workoutSplitSchedule({ workout_days: [0, 1, 2, 4, 5], workout_split: 'hybrid' })!.map(
      (day) => day.focus,
    ),
  ).toEqual(['Upper body', 'Lower body', 'Push', 'Pull', 'Legs and core']);
  expect(workoutSplitSchedule({ workout_days: [0, 2, 4], workout_split: 'ppl' })).toMatchObject([
    { day: 0, muscles: ['chest', 'shoulders', 'triceps'] },
    { day: 2, muscles: ['back', 'biceps'] },
    { day: 4, muscles: ['legs', 'core'] },
  ]);
});
it('rejects incompatible counts, unknown splits and duplicate training days before building', () => {
  for (const changes of [
    { workout_split: 'hybrid' },
    { workout_split: 'invented' },
    { workout_days: [0, 0, 2] },
  ])
    expect(() =>
      validateWorkoutPreferences({
        ...base,
        workout_days: [0, 2, 4],
        workout_split: 'ppl',
        ...changes,
      }),
    ).toThrow();
  const parsed = validateWorkoutPreferences({
    ...base,
    workout_days: [0, 2, 4],
    workout_split: 'ppl',
    target_muscles: ['chest'],
  });
  expect(parsed).not.toHaveProperty('target_muscles');
});
const preferences = validateWorkoutPreferences({
  ...base,
  workout_days: [0, 2, 4],
  workout_split: 'ppl',
});
const raw = () => ({
  days: Array.from({ length: 7 }, (_, day) => {
    const muscles =
      day === 0
        ? ['chest', 'shoulders', 'triceps']
        : day === 2
          ? ['back', 'biceps', 'back']
          : day === 4
            ? ['legs', 'core', 'legs']
            : [];
    return {
      day,
      workout: {
        title: day === 0 ? 'Push' : day === 2 ? 'Pull' : day === 4 ? 'Legs and core' : 'Rest',
        minutes: muscles.length ? 30 : 0,
        exercises: muscles.map((muscle) => ({
          name: (
            {
              chest: 'Push-up',
              shoulders: 'Pike push-up',
              triceps: 'Diamond push-up',
              back: 'Prone back extension',
              biceps: 'Self-resisted curl',
              legs: 'Squat',
              core: 'Crunch',
            } as Record<string, string>
          )[muscle],
          primary_muscles: [muscle],
          equipment: 'bodyweight',
          sets: 2,
          reps: 10,
          rest_seconds: 60,
        })),
      },
    };
  }),
});
it('saves real split coverage and rejects missing muscles or exercises outside a day’s split', () => {
  const result = workoutRoutineFromAI(raw(), preferences);
  expect(result.days[4]!.exercises[1]!.primary_muscles).toEqual(['core']);
  const missing = raw();
  missing.days[4]!.workout.exercises[1]!.primary_muscles = ['legs'];
  expect(() => workoutRoutineFromAI(missing, preferences)).toThrow();
  const wrong = raw();
  wrong.days[0]!.workout.exercises[0]!.primary_muscles = ['legs'];
  expect(() => workoutRoutineFromAI(wrong, preferences)).toThrow();
  const unlabelled = raw();
  unlabelled.days[0]!.workout.exercises[0]!.primary_muscles = [];
  expect(() => workoutRoutineFromAI(unlabelled, preferences)).toThrow();
});
it('preserves explicit safety exclusions within the split', () => {
  const schedule = workoutSplitSchedule({
    ...preferences,
    workout_notes: 'No legs.',
  })!;
  expect(schedule.flatMap((day) => day.muscles)).not.toContain('legs');
  expect(schedule.filter((day) => day.muscles.includes('chest'))).toHaveLength(1);
});
