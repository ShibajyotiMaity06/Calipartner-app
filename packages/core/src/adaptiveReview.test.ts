import { describe, expect, it } from 'vitest';
import {
  blendObservedMaintenance,
  proposeAdaptiveReview,
  safeReviewedTargets,
  type ReviewContext,
} from './adaptiveReview';
const context = (): ReviewContext => ({
  age: 31,
  now: '2026-11-05T12:00:00Z',
  sex: 'male',
  safe: true,
  goal: {
    id: 'goal',
    goal: 'cut',
    current_weight_kg: 80,
    input_height_cm: 180,
    weekly_rate_kg: 0.5,
    tdee: 2500,
    daily_calorie_target: 2000,
    confirmed_at: '2026-10-01T12:00:00Z',
  },
  days: Array.from({ length: 14 }, (_, i) => ({
    date: new Date(Date.UTC(2026, 9, 22 + i)).toISOString().slice(0, 10),
    calories: 2100,
    foods: 2,
    weight: [0, 3, 8, 13].includes(i) ? (i < 7 ? 81 : 80) : null,
  })),
});
describe('monthly adaptive reviews', () => {
  it('uses the PRD 14-day window, blends 70/30 and proposes without changing the source', () => {
    const input = context(),
      before = structuredClone(input),
      result = proposeAdaptiveReview(input);
    expect(result.reason).toBe('ready');
    if (result.reason !== 'ready') throw new Error('missing proposal');
    expect(result.proposal.observed_tdee).toBe(2650);
    expect(result.proposal.tdee).toBe(2545);
    expect(result.proposal.daily_calorie_target).toBe(1995);
    expect(result.proposal.logged_days).toBe(14);
    expect(result.proposal.weigh_in_days).toBe(4);
    expect(input).toEqual(before);
  });
  it('caps upward and downward maintenance changes at 10%', () => {
    expect(blendObservedMaintenance(2500, 5000)).toBe(2750);
    expect(blendObservedMaintenance(2500, 500)).toBe(2250);
  });
  it('does not infer a calorie change from incomplete logs, same-week weights or repeated weigh-ins', () => {
    const input = context();
    input.days.slice(0, 5).forEach((day) => (day.foods = 1));
    expect(proposeAdaptiveReview(input).reason).toBe('need_data');
    const weights = context();
    weights.days.forEach((day, i) => (day.weight = i < 4 ? 80 : null));
    expect(proposeAdaptiveReview(weights).reason).toBe('need_data');
    const duplicate = context();
    duplicate.days[1]!.date = duplicate.days[0]!.date;
    expect(proposeAdaptiveReview(duplicate).reason).toBe('need_data');
  });
  it('waits 30 days and blocks health risks or custom macro overwrites', () => {
    expect(proposeAdaptiveReview({ ...context(), now: '2026-10-10T12:00:00Z' }).reason).toBe(
      'not_due',
    );
    expect(proposeAdaptiveReview({ ...context(), safe: false }).reason).toBe('safety');
    const input = context();
    input.goal.custom_macros = true;
    expect(proposeAdaptiveReview(input).reason).toBe('safety');
  });
  it.each(['male', 'female', 'other'] as const)(
    'keeps floors, nonnegative carbs and the 1%% weekly cap for %s',
    (sex) => {
      const result = safeReviewedTargets({
        tdee: 2100,
        weight: 70,
        height: 175,
        sex,
        goal: 'cut',
        rate: 5,
      });
      expect(result).not.toBeNull();
      expect(result!.daily_calorie_target).toBeGreaterThanOrEqual(
        sex === 'male' ? 1500 : sex === 'female' ? 1200 : 1350,
      );
      expect(result!.weekly_rate_kg).toBeLessThanOrEqual(0.7);
      expect(result!.carb_grams).toBeGreaterThanOrEqual(0);
    },
  );
  it('never suggests a cut under BMI 18.5, and maintenance stays at maintenance', () => {
    expect(
      safeReviewedTargets({
        tdee: 2000,
        weight: 45,
        height: 180,
        sex: 'female',
        goal: 'cut',
        rate: 0.5,
      }),
    ).toBeNull();
    expect(
      safeReviewedTargets({
        tdee: 2500,
        weight: 80,
        height: 180,
        sex: 'male',
        goal: 'maintain',
        rate: 0.5,
      })?.daily_calorie_target,
    ).toBe(2500);
  });
});
