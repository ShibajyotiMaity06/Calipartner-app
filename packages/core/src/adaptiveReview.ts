import { calculateRawBmr, getCalorieFloor } from './targets';
import type { Goal, Sex } from './types';

export const REVIEW_INTERVAL_DAYS = 30;
export const REVIEW_WINDOW_DAYS = 14;
export interface ReviewGoal {
  id: string;
  goal: Goal;
  current_weight_kg: number;
  input_height_cm: number;
  weekly_rate_kg: number;
  tdee: number;
  daily_calorie_target: number;
  confirmed_at: string;
  custom_macros?: boolean;
}
export interface ReviewDay {
  date: string;
  calories: number;
  foods: number;
  weight: number | null;
}
export interface ReviewContext {
  age: number;
  now: string;
  goal: ReviewGoal;
  sex: Sex;
  safe: boolean;
  days: ReviewDay[];
}
export interface ReviewedTargets {
  tdee: number;
  daily_calorie_target: number;
  protein_grams: number;
  carb_grams: number;
  fat_grams: number;
  current_weight_kg: number;
  weekly_rate_kg: number;
}
export interface ReviewProposal extends ReviewedTargets {
  bmr: number;
  source_goal_id: string;
  logged_days: number;
  weigh_in_days: number;
  weight_change: number;
  observed_tdee: number;
}
export type ReviewResult =
  { reason: 'ready'; proposal: ReviewProposal } | { reason: 'not_due' | 'need_data' | 'safety' };

/** PRD 7.2: blend observed evidence slowly; a review is not a guaranteed improvement. */
export function blendObservedMaintenance(current: number, observed: number): number {
  if (![current, observed].every(Number.isFinite) || current <= 0 || observed <= 0)
    throw new Error('INVALID_REVIEW');
  return Math.round(
    Math.max(current * 0.9, Math.min(current * 1.1, current * 0.7 + observed * 0.3)),
  );
}

/** Keep the current gym macro convention, with all safety limits applied to a new proposal. */
export function safeReviewedTargets(input: {
  tdee: number;
  weight: number;
  height: number;
  sex: Sex;
  goal: Goal;
  rate: number;
}): ReviewedTargets | null {
  const { weight, height, sex, goal } = input;
  if (
    ![input.tdee, weight, height, input.rate].every(Number.isFinite) ||
    input.tdee <= 0 ||
    weight < 20 ||
    weight > 500 ||
    height < 50 ||
    height > 300 ||
    input.rate < 0 ||
    !['male', 'female', 'other'].includes(sex) ||
    !['cut', 'bulk', 'maintain'].includes(goal) ||
    (goal === 'cut' && weight / (height / 100) ** 2 < 18.5)
  )
    return null;
  const tdee = Math.round(input.tdee);
  const protein = Math.round(weight * 2.2),
    fat = Math.round(weight * 1.2);
  const floor = Math.max(getCalorieFloor(sex), protein * 4 + fat * 9);
  const rate = goal === 'maintain' ? 0 : Math.min(input.rate, weight * 0.01);
  const target = Math.round(tdee + (goal === 'cut' ? -1 : goal === 'bulk' ? 1 : 0) * rate * 1100);
  const calories = Math.max(floor, target);
  if (
    calories > 10000 ||
    Math.abs(calories - tdee) > weight * 0.01 * 1100 + 1 ||
    (goal === 'cut' && calories > tdee) ||
    (goal === 'maintain' && calories !== tdee)
  )
    return null;
  return {
    tdee,
    daily_calorie_target: calories,
    protein_grams: protein,
    fat_grams: fat,
    carb_grams: Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4)),
    current_weight_kg: weight,
    weekly_rate_kg: Math.abs(calories - tdee) / 1100,
  };
}

export function proposeAdaptiveReview(context: ReviewContext): ReviewResult {
  const { goal, days } = context;
  const now = Date.parse(context.now),
    confirmed = Date.parse(goal.confirmed_at);
  if (!Number.isFinite(now) || !Number.isFinite(confirmed)) throw new Error('INVALID_REVIEW');
  if (
    !context.safe ||
    goal.custom_macros ||
    !Number.isFinite(context.age) ||
    context.age < 18 ||
    context.age > 120
  )
    return { reason: 'safety' };
  if (now - confirmed < REVIEW_INTERVAL_DAYS * 86400000) return { reason: 'not_due' };
  if (
    days.length !== REVIEW_WINDOW_DAYS ||
    new Set(days.map((day) => day.date)).size !== REVIEW_WINDOW_DAYS
  )
    return { reason: 'need_data' };
  const ordered = [...days].sort((a, b) => a.date.localeCompare(b.date));
  if (
    ordered.some(
      (day, i) =>
        !/^\d{4}-\d{2}-\d{2}$/.test(day.date) ||
        !Number.isFinite(Date.parse(day.date)) ||
        (i > 0 && Date.parse(day.date) - Date.parse(ordered[i - 1]!.date) !== 86400000) ||
        !Number.isFinite(day.calories) ||
        day.calories < 0 ||
        !Number.isInteger(day.foods) ||
        day.foods < 0 ||
        (day.weight !== null &&
          (!Number.isFinite(day.weight) || day.weight < 20 || day.weight > 500)),
    )
  )
    throw new Error('INVALID_REVIEW');
  const logged = ordered.filter(
    (day) => day.foods >= 2 && day.calories >= goal.daily_calorie_target * 0.5,
  );
  const weighIns = ordered.filter((day) => day.weight !== null);
  const first = ordered.slice(0, 7).filter((day) => day.weight !== null),
    last = ordered.slice(7).filter((day) => day.weight !== null);
  if (logged.length < 10 || weighIns.length < 4 || !first.length || !last.length)
    return { reason: 'need_data' };
  const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
  const change = mean(last.map((day) => day.weight!)) - mean(first.map((day) => day.weight!));
  // Uses the 14-day window denominator specified by PRD 7.2 Step 5.
  const observed = mean(logged.map((day) => day.calories)) - (change * 7700) / REVIEW_WINDOW_DAYS;
  if (!Number.isFinite(observed) || observed < 500 || observed > 10000) return { reason: 'safety' };
  const targets = safeReviewedTargets({
    tdee: blendObservedMaintenance(goal.tdee, observed),
    weight: mean(last.map((day) => day.weight!)),
    height: goal.input_height_cm,
    sex: context.sex,
    goal: goal.goal,
    rate: goal.weekly_rate_kg,
  });
  if (!targets) return { reason: 'safety' };
  return {
    reason: 'ready',
    proposal: {
      ...targets,
      bmr: Math.round(
        calculateRawBmr({
          sex: context.sex,
          age: context.age,
          weightKg: targets.current_weight_kg,
          heightCm: goal.input_height_cm,
        }),
      ),
      source_goal_id: goal.id,
      logged_days: logged.length,
      weigh_in_days: weighIns.length,
      weight_change: change,
      observed_tdee: Math.round(observed),
    },
  };
}
