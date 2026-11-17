import { describe, expect, it } from 'vitest';
import { customMacroTargets } from './targets';
import type { GoalProfile } from './types';
const goal = {
  daily_calorie_target: 2040,
  goal: 'cut',
  tdee: 2500,
  current_weight_kg: 80,
  input_height_cm: 175,
} as GoalProfile;
describe('custom macro goals', () => {
  it('uses independent grams and preserves the saved calorie target and safe direction', () => {
    expect(customMacroTargets({ protein: 150, carbs: 225, fat: 60 }, goal, 'male')).toEqual({
      daily_calorie_target: 2040,
      protein_grams: 150,
      carb_grams: 225,
      fat_grams: 60,
      weekly_rate_kg: 0.42,
      custom_macros: true,
    });
  });
  it.each([NaN, Infinity, -1, 1.5, 2501])('rejects invalid grams %s', (protein) => {
    expect(() => customMacroTargets({ protein, carbs: 225, fat: 60 }, goal, 'male')).toThrow(
      'INVALID_MACROS',
    );
  });
  it('rejects floors, excessive change, opposite direction and low-BMI cuts', () => {
    for (const [macros, plan] of [
      [{ calories: 1160, protein: 100, carbs: 100, fat: 40 }, goal],
      [
        { calories: 1560, protein: 100, carbs: 200, fat: 40 },
        { ...goal, tdee: 3000 },
      ],
      [{ calories: 2720, protein: 200, carbs: 300, fat: 80 }, goal],
      [
        { protein: 150, carbs: 225, fat: 60 },
        { ...goal, current_weight_kg: 50 },
      ],
    ] as const)
      expect(() => customMacroTargets(macros, plan, 'male')).toThrow('UNSAFE_MACROS');
  });
  it('supports maintenance with redistributed grams and an unchanged calorie goal', () => {
    expect(
      customMacroTargets(
        { protein: 150, carbs: 250, fat: 100 },
        { ...goal, goal: 'maintain', daily_calorie_target: 2500 },
        'male',
      ).daily_calorie_target,
    ).toBe(2500);
    expect(() =>
      customMacroTargets(
        { calories: 2504, protein: 150, carbs: 251, fat: 100 },
        { ...goal, goal: 'maintain', daily_calorie_target: 2500 },
        'male',
      ),
    ).toThrow();
  });
});
