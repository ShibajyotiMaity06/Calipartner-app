import { customMacroTargets, getCalorieFloor } from './targets';
import type { GoalProfile, Sex } from './types';

export const TRACKING_METRICS = ['calories', 'protein', 'carbs', 'fat', 'steps', 'water'] as const;
export type TrackingMetric = (typeof TRACKING_METRICS)[number];
export type TrackingPreferences = Record<TrackingMetric, boolean>;
export const DEFAULT_TRACKING: TrackingPreferences = {
  calories: true,
  protein: true,
  carbs: true,
  fat: true,
  steps: true,
  water: false,
};
export function validateTrackingPreferences(input: unknown): TrackingPreferences {
  if (
    !input ||
    typeof input !== 'object' ||
    Object.keys(input).length !== TRACKING_METRICS.length ||
    TRACKING_METRICS.some((key) => typeof (input as Record<string, unknown>)[key] !== 'boolean')
  )
    throw new Error('INVALID_TRACKING_PREFERENCES');
  return { ...input } as TrackingPreferences;
}
/** Personal completion is the mean of enabled, available own-goal percentages, each capped at 100%. */
export function personalTrackingCompletion(
  values: Record<TrackingMetric, number | null>,
  targets: Record<TrackingMetric, number | null>,
  enabled: TrackingPreferences,
): number | null {
  const keys = TRACKING_METRICS.filter((key) => enabled[key]);
  if (
    !keys.length ||
    keys.some(
      (key) =>
        values[key] == null ||
        targets[key] == null ||
        !Number.isFinite(values[key]) ||
        !Number.isFinite(targets[key]) ||
        targets[key]! <= 0,
    )
  )
    return null;
  return Math.round(
    (keys.reduce((sum, key) => sum + Math.max(0, Math.min(1, values[key]! / targets[key]!)), 0) /
      keys.length) *
      100,
  );
}
export interface OnboardingTargetOverrides {
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  steps?: number | null;
  water?: number | null;
}
/** Blank fields preserve calculated targets. Custom grams use the existing server-matched safety rules. */
export function applyOnboardingTargetOverrides(
  goal: GoalProfile,
  sex: Sex,
  input: OnboardingTargetOverrides,
): GoalProfile {
  const hasMacros = ['protein', 'carbs', 'fat'].some(
    (key) => input[key as keyof OnboardingTargetOverrides] != null,
  );
  const grams = {
    protein: input.protein ?? goal.protein_grams,
    carbs: input.carbs ?? goal.carb_grams,
    fat: input.fat ?? goal.fat_grams,
  };
  if (input.calories != null) {
    if (!Number.isInteger(input.calories) || input.calories <= 0) throw new Error('INVALID_MACROS');
    if (input.calories < getCalorieFloor(sex) || input.calories > 10000)
      throw new Error('UNSAFE_MACROS');
    if (input.carbs == null) {
      // Whole-gram targets must still add up exactly to the requested calories.
      if (input.fat == null) {
        const compatibleFat = [
          grams.fat,
          grams.fat + 1,
          grams.fat - 1,
          grams.fat + 2,
          grams.fat - 2,
          grams.fat + 3,
          grams.fat - 3,
        ].find(
          (fat) =>
            fat >= 0 &&
            input.calories! - 4 * grams.protein - 9 * fat >= 0 &&
            (input.calories! - 4 * grams.protein - 9 * fat) % 4 === 0,
        );
        if (compatibleFat !== undefined) grams.fat = compatibleFat;
      }
      grams.carbs = (input.calories - 4 * grams.protein - 9 * grams.fat) / 4;
    } else if (input.protein == null)
      grams.protein = (input.calories - 4 * grams.carbs - 9 * grams.fat) / 4;
    else if (input.fat == null)
      grams.fat = (input.calories - 4 * grams.protein - 4 * grams.carbs) / 9;
    if (
      4 * grams.protein + 4 * grams.carbs + 9 * grams.fat !== input.calories ||
      Object.values(grams).some((value) => !Number.isInteger(value))
    )
      throw new Error('INCONSISTENT_TARGETS');
  }
  const macros = hasMacros || input.calories != null ? customMacroTargets(grams, goal, sex) : {};
  const step_goal = input.steps ?? goal.step_goal;
  const water_ml_goal = input.water ?? goal.water_ml_goal;
  if (
    !Number.isInteger(step_goal) ||
    step_goal < 1 ||
    step_goal > 100000 ||
    !Number.isInteger(water_ml_goal) ||
    water_ml_goal < 1 ||
    water_ml_goal > 20000
  )
    throw new Error('INVALID_DAILY_TARGETS');
  return { ...goal, ...macros, step_goal, water_ml_goal };
}
