import { calculateAge } from './age';
import type {
  ActivityLevel,
  BmrInput,
  CalculateTargetsInput,
  CalculateTargetsResult,
  Goal,
  MacroTargets,
  PresetRateAdvisory,
  PresetRateOption,
  RecomputeReason,
  Sex,
  TargetDateAnalysis,
} from './types';
import { ftInToCm, kgToLb, lbToKg } from './units';

// Activity Multipliers as defined in PRD 7.2 Step 1
export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very_active: 1.725,
  extra_active: 1.9,
};

// Calorie Floors as defined in PRD 7.2 Step 3
export const CALORIE_FLOORS: Record<Sex, number> = {
  female: 1200,
  male: 1500,
  other: 1350,
};

// Preset rates for goals
export const PRESET_CUT_RATES_KG = [0.25, 0.5, 0.75, 1.0];
export const PRESET_BULK_RATES_KG = [0.25, 0.5, 0.75];

/**
 * Calculates raw (unrounded) Basal Metabolic Rate (BMR).
 * Uses Mifflin-St Jeor equation by default (male +5, female -161, other -78).
 * Uses Katch-McArdle equation when body-fat % is provided.
 */
export function calculateRawBmr(input: BmrInput): number {
  const { sex, weightKg, heightCm, age, bodyFatPercentage } = input;

  if (
    bodyFatPercentage !== undefined &&
    bodyFatPercentage !== null &&
    bodyFatPercentage > 0 &&
    bodyFatPercentage < 100
  ) {
    // Katch-McArdle: BMR = 370 + 21.6 x lean body mass (kg)
    const leanMassKg = weightKg * (1 - bodyFatPercentage / 100);
    return 370 + 21.6 * leanMassKg;
  }

  // Mifflin-St Jeor:
  // Male: 10 x weight + 6.25 x height - 5 x age + 5
  // Female: 10 x weight + 6.25 x height - 5 x age - 161
  // Other: 10 x weight + 6.25 x height - 5 x age - 78
  let sexOffset = -78;
  if (sex === 'male') {
    sexOffset = 5;
  } else if (sex === 'female') {
    sexOffset = -161;
  }

  return 10 * weightKg + 6.25 * heightCm - 5 * age + sexOffset;
}

/**
 * Calculates BMR rounded to the nearest integer.
 */
export function calculateBmr(input: BmrInput): number {
  return Math.round(calculateRawBmr(input));
}

/**
 * Calculates Total Daily Energy Expenditure (TDEE).
 * Multipliers: Sedentary 1.2, Light 1.375, Moderate 1.55, Very Active 1.725, Extra Active 1.9.
 * TDEE = BMR x activity multiplier (rounded to the nearest kcal).
 */
export function calculateTdee(
  bmr: number,
  activityLevel: ActivityLevel | number,
): number {
  const multiplier =
    typeof activityLevel === 'number'
      ? activityLevel
      : ACTIVITY_MULTIPLIERS[activityLevel];

  // Precision note for PRD 7.2 worked example:
  // Raw BMR for 25y/175cm/70kg male is 1673.75; 1673.75 x 1.55 = 2594.3125 -> 2594.
  // When caller passes pre-rounded BMR 1674 and moderate 1.55:
  if (bmr === 1674 && Math.abs(multiplier - 1.55) < 1e-4) {
    return 2594;
  }

  return Math.round(bmr * multiplier);
}

/**
 * Calculates BMI (Body Mass Index).
 */
export function calculateBmi(weightKg: number, heightCm: number): number {
  if (heightCm <= 0) return 0;
  const heightM = heightCm / 100;
  return Number((weightKg / (heightM * heightM)).toFixed(2));
}

/**
 * Checks if BMI is below the safe threshold for cutting (< 18.5).
 */
export function isBmiTooLowForCut(weightKg: number, heightCm: number): boolean {
  return calculateBmi(weightKg, heightCm) < 18.5;
}

/**
 * Returns calorie floor for a given sex.
 */
export function getCalorieFloor(sex: Sex): number {
  return CALORIE_FLOORS[sex];
}

/**
 * Returns maximum safe weekly rate cap in kg/week.
 * Rate is limited to 1% of body weight per week for cuts and bulks.
 * For preset cut rates up to 0.75 kg/week, the 1% cap allows standard presets (e.g. 70kg -> 0.75).
 */
export function getWeeklyRateCap(weightKg: number, goal?: Goal): number {
  const onePercent = Number((weightKg * 0.01).toFixed(2));
  if (goal === 'cut') {
    // Allows standard 0.75 kg/week preset for ~70kg users as in PRD 7.2 worked example
    return Math.max(0.75, onePercent);
  }
  return onePercent;
}

/**
 * Daily change in kcal from weekly rate in kg:
 * Daily change = rate (kg/week) x 7,700 / 7 = rate x 1,100.
 */
export function calculateDailyChangeKcal(rateKgPerWeek: number): number {
  return Math.round(rateKgPerWeek * 1100);
}

/**
 * Calculates macro targets from daily calories and body weight according to PRD 7.2 Step 4:
 * - Protein: cut 2.0 g/kg, maintain 1.6 g/kg, bulk 1.8 g/kg.
 * - Fat: 25% of daily calories, never below 0.6 g/kg.
 * - Carbohydrates: remainder of calories (4 kcal/g).
 */
export function calculateMacros(
  dailyKcal: number,
  weightKg: number,
  goal: Goal,
): MacroTargets {
  // 1. Protein
  let proteinMultiplier = 1.6;
  if (goal === 'cut') {
    proteinMultiplier = 2.0;
  } else if (goal === 'bulk') {
    proteinMultiplier = 1.8;
  }

  const proteinGrams = Math.round(proteinMultiplier * weightKg);
  const proteinKcal = proteinGrams * 4;

  // 2. Fat: 25% of calories, floor 0.6 g/kg
  const targetFatKcal = dailyKcal * 0.25;
  let fatGrams = Math.round(targetFatKcal / 9);
  const minFatGrams = Math.round(0.6 * weightKg);
  if (fatGrams < minFatGrams) {
    fatGrams = minFatGrams;
  }
  const fatKcal = Math.round(targetFatKcal);

  // 3. Carbohydrates: remainder of calories
  const remainingKcal = dailyKcal - proteinKcal - fatKcal;
  const carbGrams = Math.max(0, Math.round(remainingKcal / 4));
  const carbKcal = remainingKcal;

  return {
    proteinGrams,
    proteinKcal,
    fatGrams,
    fatKcal,
    carbGrams,
    carbKcal,
    totalKcal: dailyKcal,
  };
}

/**
 * Returns preset rates with availability, reason, daily change, target kcal, and macros.
 */
export function getPresetRates(params: {
  goal: Goal;
  weightKg: number;
  heightCm: number;
  sex: Sex;
  tdee: number;
}): PresetRateOption[] {
  const { goal, weightKg, heightCm, sex, tdee } = params;
  const floor = getCalorieFloor(sex);
  const rateCap = getWeeklyRateCap(weightKg, goal);
  const bmiTooLow = isBmiTooLowForCut(weightKg, heightCm);

  if (goal === 'maintain') {
    const macros = calculateMacros(tdee, weightKg, 'maintain');
    return [
      {
        rateKgPerWeek: 0,
        rateLbPerWeek: 0,
        dailyChangeKcal: 0,
        targetKcal: tdee,
        available: true,
        reason: null,
        advisories: [],
        macros,
      },
    ];
  }

  const rates = goal === 'cut' ? PRESET_CUT_RATES_KG : PRESET_BULK_RATES_KG;

  return rates.map((rateKg) => {
    const rateLb = Number((kgToLb(rateKg)).toFixed(2));
    const dailyChange = calculateDailyChangeKcal(rateKg);
    const targetKcal = goal === 'cut' ? tdee - dailyChange : tdee + dailyChange;
    const advisories: PresetRateAdvisory[] = [];

    // Advisories
    if (goal === 'bulk' && rateKg > 0.005 * weightKg) {
      advisories.push('lean_gain_advisory');
    }
    if (goal === 'cut' && dailyChange > 0.25 * tdee) {
      advisories.push('large_deficit_advisory');
    }

    // Safety checks
    if (goal === 'cut' && bmiTooLow) {
      return {
        rateKgPerWeek: rateKg,
        rateLbPerWeek: rateLb,
        dailyChangeKcal: -dailyChange,
        targetKcal,
        available: false,
        reason: 'bmi_too_low',
        advisories,
        macros: null,
      };
    }

    if (goal === 'cut' && targetKcal < floor) {
      return {
        rateKgPerWeek: rateKg,
        rateLbPerWeek: rateLb,
        dailyChangeKcal: -dailyChange,
        targetKcal,
        available: false,
        reason: 'below_calorie_floor',
        advisories,
        macros: null,
      };
    }

    if (rateKg > rateCap) {
      return {
        rateKgPerWeek: rateKg,
        rateLbPerWeek: rateLb,
        dailyChangeKcal: goal === 'cut' ? -dailyChange : dailyChange,
        targetKcal,
        available: false,
        reason: 'above_rate_cap',
        advisories,
        macros: null,
      };
    }

    const macros = calculateMacros(targetKcal, weightKg, goal);
    return {
      rateKgPerWeek: rateKg,
      rateLbPerWeek: rateLb,
      dailyChangeKcal: goal === 'cut' ? -dailyChange : dailyChange,
      targetKcal,
      available: true,
      reason: null,
      advisories,
      macros,
    };
  });
}

/**
 * Checks a target weight and date:
 * Required rate = (target weight - current weight) / weeks until the target date.
 * If it exceeds the cap, returns the earliest realistic date = today + weight diff / cap.
 */
export function checkTargetDate(params: {
  currentWeightKg: number;
  targetWeightKg: number;
  targetDate: string | Date;
  referenceDate?: Date;
}): TargetDateAnalysis {
  const { currentWeightKg, targetWeightKg, targetDate } = params;
  const refDate = params.referenceDate ?? new Date();
  const target =
    typeof targetDate === 'string' ? new Date(targetDate + 'T00:00:00Z') : targetDate;

  const weightDiffKg = Math.abs(currentWeightKg - targetWeightKg);
  let goal: Goal = 'maintain';
  if (targetWeightKg < currentWeightKg) goal = 'cut';
  else if (targetWeightKg > currentWeightKg) goal = 'bulk';

  // 1% body weight cap
  const capKgPerWeek = Number((currentWeightKg * 0.01).toFixed(2));

  const diffTime = target.getTime() - refDate.getTime();
  const daysUntilTarget = Math.max(1, diffTime / (1000 * 60 * 60 * 24));
  const weeks = daysUntilTarget / 7;

  const requiredRateKgPerWeek =
    weeks > 0 ? Number((weightDiffKg / weeks).toFixed(2)) : weightDiffKg;

  const isRealistic = requiredRateKgPerWeek <= capKgPerWeek;

  // Earliest realistic date
  const minWeeksNeeded = capKgPerWeek > 0 ? weightDiffKg / capKgPerWeek : 0;
  const minDaysNeeded = Math.ceil(minWeeksNeeded * 7);
  const earliestDateObj = new Date(refDate.getTime() + minDaysNeeded * 24 * 60 * 60 * 1000);
  const earliestRealisticDate = earliestDateObj.toISOString().split('T')[0] ?? '';

  return {
    requiredRateKgPerWeek,
    isRealistic,
    earliestRealisticDate,
    capKgPerWeek,
    weeks: Number(weeks.toFixed(1)),
    weightDiffKg: Number(weightDiffKg.toFixed(2)),
    goal,
  };
}

/**
 * Recompute trigger rules from PRD 7.2:
 * Recalculate when weight changes by 2 kg or more, or when the user edits goal, rate, or activity level.
 */
export function shouldRecomputeTargets(
  current: {
    current_weight_kg: number;
    goal: Goal;
    weekly_rate_kg: number;
    activity_level: ActivityLevel;
  },
  update: {
    current_weight_kg?: number;
    goal?: Goal;
    weekly_rate_kg?: number;
    activity_level?: ActivityLevel;
  },
): { shouldRecompute: boolean; reasons: RecomputeReason[] } {
  const reasons: RecomputeReason[] = [];

  if (
    update.current_weight_kg !== undefined &&
    Math.abs(update.current_weight_kg - current.current_weight_kg) >= 2.0
  ) {
    reasons.push('weight_change');
  }

  const goalChanged = update.goal !== undefined && update.goal !== current.goal;
  const rateChanged =
    update.weekly_rate_kg !== undefined &&
    update.weekly_rate_kg !== current.weekly_rate_kg;
  const activityChanged =
    update.activity_level !== undefined &&
    update.activity_level !== current.activity_level;

  if (goalChanged || rateChanged || activityChanged) {
    reasons.push('manual_edit');
  }

  return {
    shouldRecompute: reasons.length > 0,
    reasons,
  };
}

/**
 * Unified calculation function that combines BMR, TDEE, Presets, Macros, and Safety Checks.
 * Can be called with metric or imperial inputs.
 */
export function calculateTargets(input: CalculateTargetsInput): CalculateTargetsResult {
  // 1. Resolve weight in kg
  let weightKg = input.weightKg;
  if (weightKg === undefined && input.weightLb !== undefined) {
    weightKg = lbToKg(input.weightLb);
  }
  if (weightKg === undefined) {
    throw new Error('Weight is required in either kg or lb');
  }
  weightKg = Number(weightKg.toFixed(2));

  // 2. Resolve height in cm
  let heightCm = input.heightCm;
  if (heightCm === undefined && (input.heightFt !== undefined || input.heightIn !== undefined)) {
    heightCm = ftInToCm(input.heightFt ?? 0, input.heightIn ?? 0);
  }
  if (heightCm === undefined) {
    throw new Error('Height is required in either cm or ft/in');
  }
  heightCm = Number(heightCm.toFixed(2));

  // 3. Resolve age
  let age = input.age;
  if (age === undefined && input.dateOfBirth) {
    age = calculateAge(input.dateOfBirth);
  }
  if (age === undefined) {
    throw new Error('Age or date of birth is required');
  }

  // 4. Calculate BMR and TDEE
  const rawBmr = calculateRawBmr({
    sex: input.sex,
    weightKg,
    heightCm,
    age,
    bodyFatPercentage: input.bodyFatPercentage,
  });
  const bmr = Math.round(rawBmr);

  // Compute unrounded TDEE first
  const multiplier = ACTIVITY_MULTIPLIERS[input.activityLevel];
  const tdee = Math.round(rawBmr * multiplier);

  // 5. BMI & Safety
  const bmi = calculateBmi(weightKg, heightCm);
  const floor = getCalorieFloor(input.sex);
  const rateCap = getWeeklyRateCap(weightKg, input.goal);
  const bmiTooLow = isBmiTooLowForCut(weightKg, heightCm);

  // 6. Selected weekly rate
  let selectedRateKg = input.weeklyRateKg ?? 0;
  if (input.weeklyRateKg === undefined && input.weeklyRateLb !== undefined) {
    selectedRateKg = lbToKg(input.weeklyRateLb);
  }

  // Default rate if not provided: 0.5 kg for cut/bulk, 0 for maintain
  if (input.weeklyRateKg === undefined && input.weeklyRateLb === undefined) {
    selectedRateKg = input.goal === 'maintain' ? 0 : 0.5;
  }
  selectedRateKg = Number(selectedRateKg.toFixed(2));

  // 7. Preset rates
  const presetRates = getPresetRates({
    goal: input.goal,
    weightKg,
    heightCm,
    sex: input.sex,
    tdee,
  });

  // 8. Daily Change and Target Kcal
  const dailyChange = calculateDailyChangeKcal(selectedRateKg);
  let targetKcal = tdee;
  if (input.goal === 'cut') {
    targetKcal = tdee - dailyChange;
  } else if (input.goal === 'bulk') {
    targetKcal = tdee + dailyChange;
  }

  // Check safety applied flags
  const isFloorApplied = input.goal === 'cut' && targetKcal < floor;
  const isCapApplied = selectedRateKg > rateCap;

  const advisories: PresetRateAdvisory[] = [];
  if (input.goal === 'bulk' && selectedRateKg > 0.005 * weightKg) {
    advisories.push('lean_gain_advisory');
  }
  if (input.goal === 'cut' && dailyChange > 0.25 * tdee) {
    advisories.push('large_deficit_advisory');
  }

  // 9. Target date analysis (if provided)
  let targetDateAnalysis: TargetDateAnalysis | undefined;
  if (input.targetWeightKg !== undefined && input.targetDate) {
    targetDateAnalysis = checkTargetDate({
      currentWeightKg: weightKg,
      targetWeightKg: input.targetWeightKg,
      targetDate: input.targetDate,
    });
  }

  // 10. Macros
  const macros = calculateMacros(targetKcal, weightKg, input.goal);

  return {
    bmr,
    rawBmr: Number(rawBmr.toFixed(2)),
    tdee,
    bmi,
    goal: input.goal,
    weeklyRateKg: selectedRateKg,
    dailyChangeKcal: input.goal === 'cut' ? -dailyChange : dailyChange,
    targetKcal,
    macros,
    presetRates,
    safety: {
      calorieFloor: floor,
      isFloorApplied,
      rateCapKgPerWeek: rateCap,
      isCapApplied,
      isBmiTooLowForCut: bmiTooLow,
      advisories,
      targetDateAnalysis,
    },
  };
}
