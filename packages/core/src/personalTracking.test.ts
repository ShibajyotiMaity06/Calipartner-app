import { expect, it } from 'vitest';
import {
  applyOnboardingTargetOverrides,
  DEFAULT_TRACKING,
  personalTrackingCompletion,
  validateTrackingPreferences,
} from './personalTracking';
import type { GoalProfile } from './types';
const goal = {
  goal: 'cut',
  tdee: 2500,
  current_weight_kg: 80,
  input_height_cm: 175,
  daily_calorie_target: 2040,
  protein_grams: 150,
  carb_grams: 225,
  fat_grams: 60,
  step_goal: 8000,
  water_ml_goal: 2500,
} as GoalProfile;
it('preserves every default for blank inputs and only changes supplied targets', () => {
  expect(applyOnboardingTargetOverrides(goal, 'male', {})).toEqual(goal);
  expect(applyOnboardingTargetOverrides(goal, 'male', { protein: null, steps: 10000 })).toEqual({
    ...goal,
    step_goal: 10000,
  });
  expect(applyOnboardingTargetOverrides(goal, 'male', { protein: 160 })).toMatchObject({
    protein_grams: 160,
    carb_grams: 225,
    fat_grams: 60,
    daily_calorie_target: 2080,
    custom_macros: true,
  });
});
it('enforces the calorie floor, whole grams, direction, weekly cap and habit bounds', () => {
  for (const overrides of [
    { protein: NaN },
    { protein: 1.5 },
    { protein: 0, carbs: 0, fat: 0 },
    { steps: 0 },
    { water: 20001 },
  ])
    expect(() => applyOnboardingTargetOverrides(goal, 'male', overrides)).toThrow();
  expect(() =>
    applyOnboardingTargetOverrides({ ...goal, goal: 'maintain' }, 'male', { protein: 100 }),
  ).toThrow('UNSAFE_MACROS');
});
it('uses only enabled own-goal percentages, caps excess and handles no targets or unavailable reads', () => {
  const values = { calories: 100, protein: 0, carbs: 100, fat: 200, steps: 50, water: 0 };
  const targets = { calories: 100, protein: 100, carbs: 100, fat: 100, steps: 100, water: 100 };
  expect(personalTrackingCompletion(values, targets, DEFAULT_TRACKING)).toBe(70);
  expect(
    personalTrackingCompletion(values, targets, {
      ...DEFAULT_TRACKING,
      protein: false,
      steps: false,
    }),
  ).toBe(100);
  expect(personalTrackingCompletion(values, targets, { ...DEFAULT_TRACKING, water: true })).toBe(
    58,
  );
  expect(
    personalTrackingCompletion({ ...values, water: null }, targets, {
      ...DEFAULT_TRACKING,
      water: true,
    }),
  ).toBeNull();
  expect(
    personalTrackingCompletion(values, targets, {
      calories: false,
      protein: false,
      carbs: false,
      fat: false,
      steps: false,
      water: false,
    }),
  ).toBeNull();
  expect(() => validateTrackingPreferences({ ...DEFAULT_TRACKING, water: 1 })).toThrow();
});
