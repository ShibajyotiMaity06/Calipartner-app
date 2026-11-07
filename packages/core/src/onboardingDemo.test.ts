import { expect, it } from 'vitest';
import { buildOnboardingDemo, demoGoalPercent } from './onboardingDemo';
import type { GoalProfile } from './types';
import type { PlanDay, PlanPreferences } from './weeklyPlan';
const goal = {
  daily_calorie_target: 2200,
  protein_grams: 150,
  carb_grams: 260,
  fat_grams: 60,
  step_goal: 7000,
  water_ml_goal: 2600,
} as GoalProfile;
const day = {
  workout: {
    minutes: 30,
    exercises: [{ name: 'Dumbbell row', equipment: 'dumbbell', sets: 3, reps: 8 }],
  },
  meals: [],
} as unknown as PlanDay;
const preferences = { session_minutes: 30 } as PlanPreferences;
it('uses saved individual targets and the generated exercise for its illustrative conversation and comparison', () => {
  const demo = buildOnboardingDemo(goal, day, preferences);
  expect(demo.targets).toEqual({
    calories: 2200,
    protein: 150,
    carbs: 260,
    fat: 60,
    steps: 7000,
    water: 2600,
  });
  expect(demo.yesterdayCalories).toBe(2134);
  expect(demo.yesterdayProtein).toBe(135);
  expect(demo.exercise?.name).toBe('Dumbbell row');
  expect(demo.exampleLoad).toBe(8);
  expect(demo.nextReps).toBe(9);
  expect(demoGoalPercent(7000, 7000)).toBe(100);
});
it('never assigns an external example weight to a bodyweight exercise or exceeds 30 reps', () => {
  const bodyweight = {
    ...day,
    workout: {
      ...day.workout,
      exercises: [{ ...day.workout.exercises[0]!, equipment: 'bodyweight' as const, reps: 30 }],
    },
  };
  const demo = buildOnboardingDemo(goal, bodyweight, preferences);
  expect(demo.exampleLoad).toBeNull();
  expect(demo.nextReps).toBe(30);
});
