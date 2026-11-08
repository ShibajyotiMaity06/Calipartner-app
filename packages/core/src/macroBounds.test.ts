import { expect, it } from 'vitest';
import { applyOnboardingTargetOverrides } from './personalTracking';
import { customMacroTargets, macroRecommendation, validateMacroBounds } from './targets';
import type { GoalProfile } from './types';
const goal = {
  goal: 'maintain',
  tdee: 2600,
  current_weight_kg: 80,
  gym_days: 3,
  input_height_cm: 175,
  daily_calorie_target: 2600,
  protein_grams: 176,
  fat_grams: 96,
  carb_grams: 258,
  step_goal: 8000,
  water_ml_goal: 2500,
} as GoalProfile;
it('accepts both protein boundaries and rejects moving a custom anchor through repeated edits', () => {
  for (const protein of [126, 226]) {
    const next = applyOnboardingTargetOverrides(goal, 'male', { protein });
    expect(next.protein_grams).toBe(protein);
    expect(next.daily_calorie_target).toBe(2600);
    expect(() =>
      applyOnboardingTargetOverrides(next, 'male', { protein: protein === 126 ? 125 : 227 }),
    ).toThrow('MACRO_RANGE_PROTEIN');
  }
});
it('uses inclusive bounds for every macro and calories without changing recommendations', () => {
  const reference = macroRecommendation(goal, 'male');
  for (const [key, limit] of Object.entries({ calories: 500, protein: 50, carbs: 125, fat: 55 }))
    for (const direction of [-1, 1]) {
      expect(() =>
        validateMacroBounds(
          { ...reference, [key]: reference[key as keyof typeof reference] + limit * direction },
          goal,
          'male',
        ),
      ).not.toThrow();
      expect(() =>
        validateMacroBounds(
          {
            ...reference,
            [key]: reference[key as keyof typeof reference] + (limit + 1) * direction,
          },
          goal,
          'male',
        ),
      ).toThrow(`MACRO_RANGE_${key.toUpperCase()}`);
    }
});
it('retains safety floors, rate caps and maintenance direction even within adjustment bounds', () => {
  expect(() => customMacroTargets({ protein: 176, carbs: 259, fat: 96 }, goal, 'male')).toThrow(
    'UNSAFE_MACROS',
  );
  expect(
    applyOnboardingTargetOverrides(goal, 'male', { protein: null, carbs: null, fat: null }),
  ).toEqual(goal);
});
