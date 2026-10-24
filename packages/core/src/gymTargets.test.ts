import { describe, expect, it } from 'vitest';
import { calculateGymTargets, isGymPlanSafe, type GymTargetsInput } from './gymTargets';

const reference: GymTargetsInput = {
  sex: 'male',
  age: 22,
  heightCm: 157.5,
  weightKg: 47,
  gymDays: 5,
  activityLevel: 'moderate',
  goal: 'bulk',
  dailyAdjustmentKcal: 300,
};

describe('Approved gym-day calculator', () => {
  it('keeps the exact 1% cap for fractional body weights and marks impossible macro presets unavailable', () => {
    const fractional = calculateGymTargets({
      ...reference,
      weightKg: 47.5,
      dailyAdjustmentKcal: 522,
    });
    expect(fractional.safety.rateCapKgPerWeek).toBe(0.475);
    expect(isGymPlanSafe(fractional)).toBe(true);
    const largeCut = calculateGymTargets({
      ...reference,
      weightKg: 200,
      heightCm: 175,
      gymDays: 0,
      goal: 'cut',
      dailyAdjustmentKcal: undefined,
    });
    expect(largeCut.presetRates.find((rate) => rate.rateKgPerWeek === 0.5)?.reason).toBe(
      'macro_allocation',
    );
    expect(isGymPlanSafe(largeCut)).toBe(true);
  });
  it('matches the supplied reference using full precision before display rounding', () => {
    const result = calculateGymTargets(reference);
    expect(result.rawBmr).toBe(1349.375);
    expect(result.activityMultiplier).toBe(1.55);
    expect(result.rawTdee).toBeCloseTo(2091.53125, 6);
    expect(result.bmr).toBe(1349);
    expect(result.tdee).toBe(2092);
    expect(result.targetKcal).toBe(2392);
    expect(result.monthlyChangeKg).toBeCloseTo(1.168831, 5);
    expect(result.macros).toEqual({
      proteinGrams: 103,
      proteinKcal: 414,
      fatGrams: 56,
      fatKcal: 508,
      carbGrams: 368,
      carbKcal: 1470,
      totalKcal: 2392,
    });
    expect(result.totalMacroGrams).toBe(527);
    // 413.6 / 2391.53125 = 17.29%; the reference's 18% label is an arithmetic error.
    expect(result.macroShares.protein).toBe(17);
    expect(isGymPlanSafe(result)).toBe(true);
  });

  it.each([
    ['female', -161],
    ['other', -78],
    ['male', 5],
  ] as const)('uses the correct BMR offset for %s', (sex, offset) => {
    expect(calculateGymTargets({ ...reference, sex }).rawBmr).toBe(470 + 984.375 - 110 + offset);
  });

  it('supports zero training days, cut, and maintenance without double-counting activity', () => {
    const cut = calculateGymTargets({
      ...reference,
      weightKg: 70,
      heightCm: 175,
      gymDays: 0,
      goal: 'cut',
      dailyAdjustmentKcal: 300,
    });
    expect(cut.activityMultiplier).toBe(1.35);
    expect(cut.monthlyChangeKg).toBeCloseTo(-1.168831, 5);
    const maintain = calculateGymTargets({ ...reference, goal: 'maintain' });
    expect(maintain.dailyChangeKcal).toBe(0);
    expect(maintain.weeklyRateKg).toBe(0);
    expect(maintain.targetKcal).toBe(maintain.tdee);
    expect(calculateGymTargets({ ...reference, activityLevel: 'extra_active' }).tdee).toBe(
      calculateGymTargets(reference).tdee,
    );
  });

  it('blocks calorie floors, the exact 1% cap, low BMI cuts, and impossible macro allocations', () => {
    expect(
      isGymPlanSafe(calculateGymTargets({ ...reference, goal: 'cut', dailyAdjustmentKcal: 1000 })),
    ).toBe(false);
    const cap = calculateGymTargets({
      ...reference,
      weightKg: 70,
      heightCm: 175,
      dailyAdjustmentKcal: 825,
    });
    expect(cap.safety.isCapApplied).toBe(true);
    expect(cap.safety.rateCapKgPerWeek).toBe(0.7);
    expect(
      isGymPlanSafe(
        calculateGymTargets({ ...reference, goal: 'cut', heightCm: 175, dailyAdjustmentKcal: 100 }),
      ),
    ).toBe(false);
    expect(
      isGymPlanSafe(
        calculateGymTargets({
          ...reference,
          weightKg: 200,
          heightCm: 175,
          gymDays: 0,
          goal: 'cut',
          dailyAdjustmentKcal: 1500,
        }),
      ),
    ).toBe(false);
  });

  it.each([0, 1, 3, 5, 7])('recommends an available safe pace for %s training days', (gymDays) => {
    for (const goal of ['bulk', 'cut', 'maintain'] as const) {
      const input = {
        ...reference,
        goal,
        gymDays,
        weightKg: 70,
        heightCm: 175,
        dailyAdjustmentKcal: undefined,
      };
      const result = calculateGymTargets(input);
      expect(
        isGymPlanSafe(calculateGymTargets({ ...input, weeklyRateKg: result.recommendedRateKg })),
      ).toBe(true);
    }
  });

  it.each([
    { gymDays: -1 },
    { gymDays: 8 },
    { gymDays: 1.5 },
    { weightKg: NaN },
    { heightCm: Infinity },
    { age: 17 },
    { dailyAdjustmentKcal: -1 },
    { dailyAdjustmentKcal: NaN },
    { weeklyRateKg: -0.5 },
  ])('rejects invalid inputs %j', (overrides) => {
    expect(() => calculateGymTargets({ ...reference, ...overrides })).toThrow();
  });
});
