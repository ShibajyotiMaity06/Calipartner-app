import { calculateAge } from './age';
import { calculateBmi, calculateRawBmr, checkTargetDate, getCalorieFloor } from './targets';
import type { CalculateTargetsInput, CalculateTargetsResult, PresetRateOption } from './types';

/** Version 2, updated 2026-10-25: recommendations are advisory. Legacy targets retain the original PRD calculator. */
export interface GymTargetsInput extends CalculateTargetsInput {
  weightKg: number;
  heightCm: number;
  gymDays: number;
  dailyAdjustmentKcal?: number;
}

export interface GymTargetsResult extends CalculateTargetsResult {
  rawTdee: number;
  activityMultiplier: number;
  monthlyChangeKg: number;
  totalMacroGrams: number;
  recommendedRateKg: number;
  rawMacros: { proteinGrams: number; fatGrams: number; carbGrams: number };
  macroShares: { protein: number; fat: number; carbs: number };
  inputs: {
    weightKg: number;
    heightCm: number;
    age: number;
    sex: GymTargetsInput['sex'];
    gymDays: number;
  };
}

export function calculateGymTargets(input: GymTargetsInput): GymTargetsResult {
  const age = input.age ?? (input.dateOfBirth ? calculateAge(input.dateOfBirth) : NaN);
  const { weightKg, heightCm, gymDays, goal, sex } = input;
  if (!['male', 'female', 'other'].includes(sex) || !['cut', 'bulk', 'maintain'].includes(goal))
    throw new Error('Invalid sex or goal');
  if (!Number.isFinite(age) || age < 18 || age > 120)
    throw new Error('Age must be between 18 and 120');
  if (!Number.isFinite(weightKg) || weightKg < 20 || weightKg > 500)
    throw new Error('Invalid weight');
  if (!Number.isFinite(heightCm) || heightCm < 50 || heightCm > 300)
    throw new Error('Invalid height');
  if (!Number.isInteger(gymDays) || gymDays < 0 || gymDays > 7)
    throw new Error('Gym days must be 0 to 7');
  const rawBmr = calculateRawBmr({ sex, weightKg, heightCm, age });
  const activityMultiplier = 1.35 + 0.04 * gymDays;
  const rawTdee = rawBmr * activityMultiplier;
  const tdee = Math.round(rawTdee);
  const floor = getCalorieFloor(sex);
  const bmi = calculateBmi(weightKg, heightCm);
  const rateCap = Number((weightKg * 0.01).toFixed(6));
  const floorRateCap = Math.max(0, (rawTdee - Math.max(floor, weightKg * 19.6)) / 1100);
  const maxRate = goal === 'cut' ? Math.min(rateCap, floorRateCap) : rateCap;
  const recommendedRateKg =
    goal === 'maintain' || (goal === 'cut' && bmi < 18.5)
      ? 0
      : Math.floor(Math.min(goal === 'bulk' ? weightKg * 0.005 : 0.5, maxRate) * 100) / 100;
  const requestedRate = input.weeklyRateKg ?? recommendedRateKg;
  if (!Number.isFinite(requestedRate) || requestedRate < 0) throw new Error('Invalid weekly rate');
  const adjustment =
    goal === 'maintain' ? 0 : (input.dailyAdjustmentKcal ?? Math.round(requestedRate * 1100));
  if (!Number.isFinite(adjustment) || adjustment < 0) throw new Error('Invalid daily adjustment');
  const weeklyRateKg = goal === 'maintain' ? 0 : adjustment / 1100;
  const dailyChangeKcal = goal === 'cut' ? -adjustment : adjustment;
  const rawTarget = rawTdee + dailyChangeKcal;
  const targetKcal = Math.round(rawTarget);
  const protein = weightKg * 2.2;
  const fat = weightKg * 1.2;
  const proteinKcal = protein * 4;
  const fatKcal = fat * 9;
  const carbKcal = Math.max(0, rawTarget - proteinKcal - fatKcal);
  const macros = {
    proteinGrams: Math.round(protein),
    proteinKcal: Math.round(proteinKcal),
    fatGrams: Math.round(fat),
    fatKcal: Math.round(fatKcal),
    carbGrams: Math.round(carbKcal / 4),
    carbKcal: Math.round(carbKcal),
    totalKcal: targetKcal,
  };
  const rates =
    goal === 'maintain'
      ? [0]
      : [...new Set([recommendedRateKg, 0.25, 0.5, 0.75, ...(goal === 'cut' ? [1] : [])])]
          .filter(
            (r) => r > 0 && (r == recommendedRateKg || Math.abs(r - recommendedRateKg) >= 0.05),
          )
          .sort((a, b) => a - b);
  const presetRates: PresetRateOption[] = rates.map((rate) => {
    const change = Math.round(rate * 1100) * (goal === 'cut' ? -1 : goal === 'maintain' ? 0 : 1);
    const rawKcal = rawTdee + change;
    const kcal = Math.round(rawKcal);
    const reason =
      goal === 'cut' && bmi < 18.5
        ? 'bmi_too_low'
        : rawKcal < floor
          ? 'below_calorie_floor'
          : rate > rateCap
            ? 'above_rate_cap'
            : rawKcal < proteinKcal + fatKcal
              ? 'macro_allocation'
              : null;
    return {
      rateKgPerWeek: rate,
      rateLbPerWeek: Number((rate * 2.2046226218).toFixed(2)),
      dailyChangeKcal: change,
      targetKcal: kcal,
      available: rawKcal > 0 && rawKcal >= proteinKcal + fatKcal,
      reason,
      advisories: [],
      macros: null,
    };
  });
  return {
    bmr: Math.round(rawBmr),
    rawBmr,
    tdee,
    rawTdee,
    activityMultiplier,
    bmi,
    goal,
    weeklyRateKg,
    dailyChangeKcal,
    targetKcal,
    macros,
    presetRates,
    recommendedRateKg,
    monthlyChangeKg: (dailyChangeKcal * 30) / 7700,
    totalMacroGrams: macros.proteinGrams + macros.fatGrams + macros.carbGrams,
    rawMacros: { proteinGrams: protein, fatGrams: fat, carbGrams: carbKcal / 4 },
    macroShares: {
      protein: rawTarget > 0 ? Math.round((proteinKcal / rawTarget) * 100) : 0,
      fat: rawTarget > 0 ? Math.round((fatKcal / rawTarget) * 100) : 0,
      carbs: rawTarget > 0 ? Math.round((carbKcal / rawTarget) * 100) : 0,
    },
    inputs: { weightKg, heightCm, age, sex, gymDays },
    safety: {
      calorieFloor: floor,
      isFloorApplied: rawTarget < floor,
      rateCapKgPerWeek: rateCap,
      isCapApplied: weeklyRateKg > rateCap + 1e-9,
      isBmiTooLowForCut: goal === 'cut' && bmi < 18.5,
      advisories:
        goal === 'bulk' && weeklyRateKg > weightKg * 0.005
          ? ['lean_gain_advisory']
          : goal === 'cut' && adjustment > rawTdee * 0.25
            ? ['large_deficit_advisory']
            : [],
      targetDateAnalysis:
        input.targetWeightKg !== undefined && input.targetDate
          ? checkTargetDate({
              currentWeightKg: weightKg,
              targetWeightKg: input.targetWeightKg,
              targetDate: input.targetDate,
            })
          : undefined,
    },
  };
}

export function isGymPlanSafe(result: GymTargetsResult): boolean {
  return (
    !result.safety.isFloorApplied &&
    !result.safety.isCapApplied &&
    !result.safety.isBmiTooLowForCut &&
    result.macros.proteinKcal + result.macros.fatKcal <= result.targetKcal
  );
}

/** Custom plans may exceed recommendations; reject invalid or inconsistent totals. */
export function isGymPlanValid(result: GymTargetsResult): boolean {
  return (
    Number.isFinite(result.targetKcal) &&
    result.targetKcal > 0 &&
    Number.isFinite(result.weeklyRateKg) &&
    result.weeklyRateKg >= 0 &&
    result.macros.proteinKcal + result.macros.fatKcal <= result.targetKcal
  );
}
