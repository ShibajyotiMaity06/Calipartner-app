export type Sex = 'male' | 'female' | 'other';
export type Units = 'metric' | 'imperial';
export type Goal = 'cut' | 'maintain' | 'bulk';
export type ActivityLevel =
  | 'sedentary'
  | 'light'
  | 'moderate'
  | 'very_active'
  | 'extra_active';

export interface Profile {
  id: string;
  username: string;
  nickname: string;
  avatar_url: string | null;
  date_of_birth: string; // YYYY-MM-DD
  sex: Sex;
  height_cm: number;
  units: Units;
  timezone: string;
  country: string | null;
  discoverable: boolean;
  username_changed_at: string;
  created_at: string;
  updated_at: string;
}

export interface PublicUserProfile {
  username: string;
  nickname: string;
  avatar_url: string | null;
}

export interface CreateProfileInput {
  username: string;
  nickname: string;
  avatar_url?: string | null;
  date_of_birth: string;
  sex: Sex;
  height_cm: number;
  units?: Units;
  timezone?: string;
  country?: string | null;
  discoverable?: boolean;
}

export interface UpdateProfileInput {
  nickname?: string;
  avatar_url?: string | null;
  height_cm?: number;
  units?: Units;
  timezone?: string;
  country?: string | null;
  discoverable?: boolean;
}

// -----------------------------------------------------------------------------
// Phase 2: Goal Profiles, Health Screening & Targets
// -----------------------------------------------------------------------------

export interface BmrInput {
  sex: Sex;
  weightKg: number;
  heightCm: number;
  age: number;
  bodyFatPercentage?: number | null;
}

export interface MacroTargets {
  proteinGrams: number;
  proteinKcal: number;
  fatGrams: number;
  fatKcal: number;
  carbGrams: number;
  carbKcal: number;
  totalKcal: number;
}

export type PresetRateUnavailableReason =
  | 'below_calorie_floor'
  | 'above_rate_cap'
  | 'bmi_too_low';

export type PresetRateAdvisory =
  | 'lean_gain_advisory'
  | 'large_deficit_advisory';

export interface PresetRateOption {
  rateKgPerWeek: number;
  rateLbPerWeek: number;
  dailyChangeKcal: number;
  targetKcal: number;
  available: boolean;
  reason: PresetRateUnavailableReason | null;
  advisories: PresetRateAdvisory[];
  macros: MacroTargets | null;
}

export interface TargetDateAnalysis {
  requiredRateKgPerWeek: number;
  isRealistic: boolean;
  earliestRealisticDate: string; // YYYY-MM-DD
  capKgPerWeek: number;
  weeks: number;
  weightDiffKg: number;
  goal: Goal;
}

export interface CalculateTargetsInput {
  sex: Sex;
  age?: number;
  dateOfBirth?: string | Date;
  heightCm?: number;
  heightFt?: number;
  heightIn?: number;
  weightKg?: number;
  weightLb?: number;
  activityLevel: ActivityLevel;
  goal: Goal;
  weeklyRateKg?: number;
  weeklyRateLb?: number;
  bodyFatPercentage?: number | null;
  targetWeightKg?: number;
  targetDate?: string | Date;
}

export interface CalculateTargetsResult {
  bmr: number;
  rawBmr: number;
  tdee: number;
  bmi: number;
  goal: Goal;
  weeklyRateKg: number;
  dailyChangeKcal: number;
  targetKcal: number;
  macros: MacroTargets;
  presetRates: PresetRateOption[];
  safety: {
    calorieFloor: number;
    isFloorApplied: boolean;
    rateCapKgPerWeek: number;
    isCapApplied: boolean;
    isBmiTooLowForCut: boolean;
    advisories: PresetRateAdvisory[];
    targetDateAnalysis?: TargetDateAnalysis;
  };
}

export type RecomputeReason =
  | 'initial_onboarding'
  | 'manual_edit'
  | 'weight_change'
  | 'recalibration';

export interface GoalProfile {
  id: string;
  user_id: string;
  goal: Goal;
  activity_level: ActivityLevel;
  current_weight_kg: number;
  body_fat_percentage: number | null;
  weekly_rate_kg: number;
  target_weight_kg: number | null;
  target_date: string | null; // YYYY-MM-DD
  daily_calorie_target: number;
  protein_grams: number;
  fat_grams: number;
  carb_grams: number;
  bmr: number;
  tdee: number;
  step_goal: number;
  water_ml_goal: number;
  effective_from: string; // ISO-8601 UTC
  confirmed_at: string; // ISO-8601 UTC
  recompute_reason: RecomputeReason | null;
  created_at: string; // ISO-8601 UTC
}

export interface CreateGoalProfileInput {
  id?: string;
  goal: Goal;
  activity_level: ActivityLevel;
  current_weight_kg: number;
  body_fat_percentage?: number | null;
  weekly_rate_kg?: number;
  target_weight_kg?: number | null;
  target_date?: string | null;
  daily_calorie_target: number;
  protein_grams: number;
  fat_grams: number;
  carb_grams: number;
  bmr: number;
  tdee: number;
  step_goal?: number;
  water_ml_goal?: number;
  effective_from?: string;
  confirmed_at?: string;
  recompute_reason?: RecomputeReason | null;
}

export interface HealthScreening {
  user_id: string;
  pregnant_or_breastfeeding: boolean;
  has_diabetes_or_medication: boolean;
  has_eating_disorder_history: boolean;
  updated_at: string;
  created_at: string;
}

export interface UpdateHealthScreeningInput {
  pregnant_or_breastfeeding: boolean;
  has_diabetes_or_medication: boolean;
  has_eating_disorder_history: boolean;
}
