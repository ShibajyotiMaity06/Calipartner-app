import { blendObservedMaintenance, safeReviewedTargets } from './adaptiveReview';
import type { Goal, Sex } from './types';

export interface WeightProjectionInput {
  weight: number;
  height: number;
  sex: Sex;
  gymDays: number;
  tdee: number;
  calories: number;
  goal: Goal;
  rate: number;
  targetWeight?: number | null;
  maintenanceBias?: number;
}
export interface WeightPath {
  tier: 'basic' | 'plus' | 'pro';
  points: { week: number; weight: number }[];
}
/** Illustrative energy balance, not a validated physiological prediction or a tier efficacy claim. */
export function projectWeightPaths(input: WeightProjectionInput): WeightPath[] {
  const bias = input.maintenanceBias ?? 0;
  if (
    ![
      input.weight,
      input.height,
      input.tdee,
      input.calories,
      input.rate,
      bias,
      input.gymDays,
    ].every(Number.isFinite) ||
    input.weight < 20 ||
    input.weight > 500 ||
    input.height < 50 ||
    input.height > 300 ||
    input.tdee <= 0 ||
    input.calories <= 0 ||
    input.rate < 0 ||
    Math.abs(bias) > 0.1 ||
    !Number.isInteger(input.gymDays) ||
    input.gymDays < 0 ||
    input.gymDays > 7 ||
    !['cut', 'bulk', 'maintain'].includes(input.goal) ||
    (input.targetWeight != null &&
      (!Number.isFinite(input.targetWeight) || input.targetWeight < 20 || input.targetWeight > 500))
  )
    throw new Error('INVALID_PROJECTION');
  const run = (tier: WeightPath['tier']): WeightPath => {
    let weight = input.weight,
      calories = input.calories,
      estimate = input.tdee;
    const points = [{ week: 0, weight }];
    let reached = false;
    const history: { weight: number; calories: number }[] = [];
    for (let day = 1; day <= 84; day++) {
      if (tier === 'pro' && day > 1 && (day - 1) % 30 === 0 && !reached) {
        const recent = history.slice(-14);
        const average = (items: number[]) => items.reduce((a, b) => a + b, 0) / items.length;
        const change =
          average(recent.slice(7).map((p) => p.weight)) -
          average(recent.slice(0, 7).map((p) => p.weight));
        const observed = average(recent.map((p) => p.calories)) - (change * 7700) / 14;
        if (observed > 0) estimate = blendObservedMaintenance(estimate, observed);
        const next = safeReviewedTargets({
          tdee: estimate,
          weight,
          height: input.height,
          sex: input.sex,
          goal: input.goal,
          rate: input.rate,
        });
        if (next) calories = next.daily_calorie_target;
      }
      // Weight-dependent expenditure is anchored to the actual saved starting estimate.
      const maintenance = Math.max(
        1,
        input.tdee * (1 + bias) + 10 * (weight - input.weight) * (1.35 + 0.04 * input.gymDays),
      );
      const change = reached ? 0 : (calories - maintenance) / 7700;
      weight = Math.max(
        20,
        Math.min(
          500,
          weight + Math.max((-weight * 0.01) / 7, Math.min((weight * 0.01) / 7, change)),
        ),
      );
      if (input.goal === 'cut') weight = Math.max(weight, 18.5 * (input.height / 100) ** 2);
      if (
        input.targetWeight != null &&
        ((input.goal === 'cut' && weight <= input.targetWeight) ||
          (input.goal === 'bulk' && weight >= input.targetWeight))
      ) {
        weight = input.targetWeight;
        reached = true;
      }
      history.push({ weight, calories });
      if (day % 7 === 0) points.push({ week: day / 7, weight: Math.round(weight * 100) / 100 });
    }
    return { tier, points };
  };
  return [run('basic'), run('plus'), run('pro')];
}
