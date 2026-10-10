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

// -----------------------------------------------------------------------------
// Phase 3: Food, Logging, Diary & Offline Sync Types
// -----------------------------------------------------------------------------

export type FoodSource = 'ifct' | 'off' | 'usda' | 'user';

export type MealSection = 'breakfast' | 'lunch' | 'dinner' | 'snacks' | 'extra';

export type EntrySource =
  | 'search'
  | 'scan'
  | 'photo'
  | 'history'
  | 'copy'
  | 'recipe';

export interface ServingUnit {
  unit: string; // e.g. 'g', 'ml', 'piece', 'bowl', 'katori', 'cup', 'tbsp', 'slice'
  grams: number; // equivalent in grams (or ml)
  description?: string; // e.g. "1 medium katori (~150g)"
}

export interface NutrientSnapshot {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium_mg: number;
}

export interface Food {
  id: string;
  source: FoodSource;
  name: string;
  brand: string | null;
  barcode: string | null;
  serving_units: ServingUnit[];
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  fiber_per_100g: number;
  sugar_per_100g: number;
  sodium_mg_per_100g: number;
  owner_id: string | null; // null for public/global foods, user UUID for custom foods
  attribution: string | null;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface CreateFoodInput {
  id?: string;
  source?: FoodSource;
  name: string;
  brand?: string | null;
  barcode?: string | null;
  serving_units?: ServingUnit[];
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  fiber_per_100g?: number;
  sugar_per_100g?: number;
  sodium_mg_per_100g?: number;
  owner_id?: string | null;
  attribution?: string | null;
}

export interface UpdateFoodInput {
  name?: string;
  brand?: string | null;
  barcode?: string | null;
  serving_units?: ServingUnit[];
  calories_per_100g?: number;
  protein_per_100g?: number;
  carbs_per_100g?: number;
  fat_per_100g?: number;
  fiber_per_100g?: number;
  sugar_per_100g?: number;
  sodium_mg_per_100g?: number;
}

export interface FoodEntry {
  id: string; // client-generated UUID
  user_id: string;
  food_id: string | null;
  meal_section: MealSection;
  quantity: number;
  unit: string;
  // Snapshot columns:
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium_mg: number;
  food_name: string;
  brand_name: string | null;
  logged_at: string; // UTC ISO-8601
  local_date: string; // YYYY-MM-DD
  source: EntrySource;
  shared_meal_id: string | null;
  updated_at: string;
  deleted_at: string | null;
  created_at?: string;
}

export interface CreateFoodEntryInput {
  id?: string;
  user_id: string;
  food_id?: string | null;
  meal_section: MealSection;
  quantity: number;
  unit: string;
  food_name: string;
  brand_name?: string | null;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  sugar?: number;
  sodium_mg?: number;
  logged_at?: string;
  local_date?: string;
  source?: EntrySource;
  shared_meal_id?: string | null;
}

export interface UpdateFoodEntryInput {
  meal_section?: MealSection;
  quantity?: number;
  unit?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  sugar?: number;
  sodium_mg?: number;
  food_name?: string;
  brand_name?: string | null;
  logged_at?: string;
  local_date?: string;
  source?: EntrySource;
}

export interface UserFoodStats {
  user_id: string;
  food_id: string;
  use_count: number;
  last_used_at: string;
  last_quantity: number;
  last_unit: string;
  last_meal_section: MealSection;
  hidden: boolean;
  updated_at: string;
}

export interface SavedMealItem {
  food_id: string;
  food_name: string;
  brand_name?: string | null;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
}

export interface SavedMeal {
  id: string;
  user_id: string;
  name: string;
  items: SavedMealItem[];
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface DiarySectionSummary {
  section: MealSection;
  entries: FoodEntry[];
  count: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium_mg: number;
}

export interface DiaryDaySummary {
  local_date: string;
  sections: Record<MealSection, DiarySectionSummary>;
  totals: NutrientSnapshot & { entryCount: number };
}

