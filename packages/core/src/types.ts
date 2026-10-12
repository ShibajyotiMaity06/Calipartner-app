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

// -----------------------------------------------------------------------------
// Phase 4: Water, Weight, Steps, Distance & Activity Types
// -----------------------------------------------------------------------------

export type ActivitySource = 'health_platform' | 'pedometer' | 'manual';

export interface WaterLog {
  id: string;
  user_id: string;
  amount_ml: number;
  logged_at: string; // ISO UTC
  local_date: string; // YYYY-MM-DD
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface CreateWaterLogInput {
  id?: string;
  user_id: string;
  amount_ml: number;
  logged_at?: string;
  local_date: string;
}

export interface UpdateWaterLogInput {
  amount_ml?: number;
  deleted_at?: string | null;
}

export interface WeightLog {
  id: string;
  user_id: string;
  weight_kg: number;
  logged_at: string; // ISO UTC
  local_date: string; // YYYY-MM-DD
  notes?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface CreateWeightLogInput {
  id?: string;
  user_id: string;
  weight_kg: number;
  logged_at?: string;
  local_date: string;
  notes?: string | null;
}

export interface UpdateWeightLogInput {
  weight_kg?: number;
  notes?: string | null;
  deleted_at?: string | null;
}

export interface ActivityDay {
  id: string;
  user_id: string;
  local_date: string; // YYYY-MM-DD
  steps: number;
  distance_m: number;
  source: ActivitySource;
  active_calories?: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface UpsertActivityDayInput {
  id?: string;
  user_id: string;
  local_date: string;
  steps: number;
  distance_m?: number | null;
  source: ActivitySource;
  active_calories?: number;
}

export interface WeightTrendPoint {
  date: string;
  rawWeightKg: number;
  trendWeightKg: number;
  entryCountInWindow: number;
}

export interface WeeklyPaceResult {
  weeklyPaceKg: number | null;
  daysSpan: number;
}

export interface ProjectedDateResult {
  projectedDate: string | null; // YYYY-MM-DD
  weeksRemaining: number | null;
  reason: 'achieved' | 'on_track' | 'not_enough_trend' | 'wrong_direction';
}

// -----------------------------------------------------------------------------
// Phase 5: Rooms, Room Members, Privacy, Requests & Entitlements
// -----------------------------------------------------------------------------

export type RoomRole = 'host' | 'member';
export type RoomMemberStatus = 'active' | 'paused' | 'left';
export type RoomState =
  | 'active'
  | 'dormant'
  | 'locked'
  | 'over_capacity'
  | 'archived';
export type RoomWhoCanInvite = 'host_only' | 'any_member';

export type RoomTier = 'basic' | 'plus' | 'pro' | 'community';
export type RoomPeriod = 'monthly' | 'quarterly' | 'annual';

export interface RoomTierConfig {
  tier: RoomTier;
  member_cap: number;
  requires_host_approval: boolean;
}

export interface RoomPrivacySettings {
  share_streak: boolean;
  share_goal_completion: boolean;
  share_steps: boolean;
  share_water: boolean;
  share_workouts: boolean;
  share_workout_details: boolean;
  share_calories_macros: boolean;
  share_meals: 'never' | 'per_meal' | 'always';
  share_weight_number: boolean;
  share_weight_progress: boolean;
  share_fasting: boolean;
}

export type RoomRequestType = 'invitation' | 'join_request';
export type RoomRequestStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'expired'
  | 'cancelled';

export interface RoomRequest {
  id: string;
  room_id: string;
  sender_id: string;
  recipient_id: string | null;
  type: RoomRequestType;
  status: RoomRequestStatus;
  expires_at: string;
  created_at: string;
  responded_at?: string | null;
}

export type EntitlementStatus = 'trial' | 'paid' | 'grace' | 'lapsed';
export type EntitlementPlan = 'monthly' | 'three_month' | 'annual' | 'free';
export type EntitlementSource = 'apple' | 'google' | 'dodo' | 'none';

export interface Entitlement {
  user_id: string;
  tier?: RoomTier;
  period?: RoomPeriod;
  plan?: EntitlementPlan;
  source: EntitlementSource;
  status: EntitlementStatus;
  attached_room_id?: string | null;
  trial_started_at?: string | null;
  period_end?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Room {
  id: string;
  name: string;
  code: string;
  state: RoomState;
  who_can_invite: RoomWhoCanInvite;
  plan_holder_id?: string | null;
  member_cap: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  dormant_at?: string | null;
  over_capacity_at?: string | null;
  locked_at?: string | null;
  archived_at?: string | null;
}

export interface RoomMember {
  id: string;
  room_id: string;
  user_id: string;
  role: RoomRole;
  status: RoomMemberStatus;
  privacy_settings: RoomPrivacySettings;
  joined_at: string;
  updated_at: string;
}

export interface SharedMeal {
  id: string;
  room_id: string;
  creator_id: string;
  food_id?: string | null;
  food_name: string;
  meal_section: MealSection;
  original_quantity: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  sodium_mg?: number;
  created_at: string;
  updated_at?: string;
}

export type SharedMealParticipantStatus = 'pending' | 'accepted' | 'declined';

export interface SharedMealParticipant {
  id: string;
  shared_meal_id: string;
  user_id: string;
  status: SharedMealParticipantStatus;
  responded_quantity?: number | null;
  created_diary_entry_id?: string | null;
  created_at: string;
  responded_at?: string | null;
}

export type RoomReactionType = 'fire' | 'clap' | 'muscle' | 'heart' | 'party';

export interface RoomReaction {
  id: string;
  room_id: string;
  user_id: string;
  event_id: string;
  reaction: RoomReactionType;
  created_at: string;
}

export interface RoomEvent {
  id: string;
  room_id: string;
  user_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface Nudge {
  id: string;
  room_id: string;
  sender_id: string;
  recipient_id: string;
  message: string;
  created_at: string;
}

export interface DailySummary {
  user_id: string;
  local_date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  steps: number;
  water_ml: number;
  workout_minutes: number;
  weight_kg?: number | null;
  logged_day: boolean;
  goal_day: boolean;
  created_at?: string;
  updated_at?: string;
}

export type LockedMetric = 'locked';

export interface RoomMemberSnapshotMetrics {
  status: RoomMemberStatus;
  display_message?: string;
  logged_today: boolean | LockedMetric;
  goal_completion: number | LockedMetric;
  steps: number | LockedMetric;
  water_ml: number | LockedMetric;
  workout_status:
    | { worked_out: boolean; duration_minutes: number }
    | LockedMetric;
  calories: number | LockedMetric;
  macros:
    | { protein: number; carbs: number; fat: number }
    | LockedMetric;
  weight_kg: number | null | LockedMetric;
  weight_progress: number | LockedMetric;
  fasting_status: string | LockedMetric;
  meal_checklist: Record<string, boolean> | LockedMetric;
}

export interface RoomMemberSnapshot {
  user_id: string;
  username: string;
  nickname: string;
  avatar_url?: string | null;
  role: RoomRole;
  status: RoomMemberStatus;
  is_self: boolean;
  metrics: RoomMemberSnapshotMetrics;
}

export interface RoomSnapshotPagination {
  total_count: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface RoomSnapshot {
  room: {
    id: string;
    name: string;
    code: string;
    state: RoomState;
    who_can_invite: RoomWhoCanInvite;
    created_by: string;
    plan_holder_id?: string | null;
    member_cap?: number;
  };
  caller_id: string;
  members: RoomMemberSnapshot[];
  room_average?: {
    goal_completion: number;
    active_members: number;
  };
  pagination?: RoomSnapshotPagination | null;
}

// -----------------------------------------------------------------------------
// Phase 6: Workout Tracking, Exercises & Running Session Timer
// -----------------------------------------------------------------------------

export type WorkoutType =
  | 'strength'
  | 'cardio'
  | 'sports'
  | 'yoga_mobility'
  | 'walk_run'
  | 'other';

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'legs'
  | 'shoulders'
  | 'arms'
  | 'core'
  | 'full_body'
  | 'cardio'
  | 'other';

export type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'cable'
  | 'machine'
  | 'bodyweight'
  | 'kettlebell'
  | 'band'
  | 'other'
  | 'none';

export type ExerciseType =
  | 'strength'
  | 'cardio'
  | 'bodyweight'
  | 'duration'
  | 'distance';

export interface Exercise {
  id: string;
  name: string;
  muscle_group: MuscleGroup;
  equipment: Equipment;
  type: ExerciseType;
  owner_id: string | null; // null = global library exercise; string = custom user exercise
  attribution?: string | null;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface WorkoutSet {
  id: string;
  workout_exercise_id: string;
  workout_id: string;
  user_id: string;
  set_number: number;
  reps?: number | null;
  weight_kg?: number | null;
  duration_seconds?: number | null;
  distance_meters?: number | null;
  is_warmup?: boolean;
  completed?: boolean;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface WorkoutExercise {
  id: string;
  workout_id: string;
  user_id: string;
  exercise_id?: string | null;
  exercise_name: string;
  order_in_workout: number;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
  sets?: WorkoutSet[];
}

export interface Workout {
  id: string;
  user_id: string;
  type: WorkoutType;
  name?: string | null;
  start_time?: string | null;
  duration_minutes: number;
  local_date: string;
  notes?: string | null;
  effort_rating?: number | null; // 1 to 10
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface WorkoutWithDetails extends Workout {
  exercises: WorkoutExercise[];
}

export interface WorkoutSummary {
  workout_id: string;
  duration_minutes: number;
  total_volume_kg: number;
  total_sets: number;
  total_reps: number;
  estimated_calories: number;
  is_calorie_estimate: true;
  exercise_summaries: Array<{
    exercise_id?: string | null;
    exercise_name: string;
    set_count: number;
    total_volume_kg: number;
    best_1rm_kg: number | null;
    heaviest_weight_kg: number | null;
  }>;
}

export interface CardioMetrics {
  speed_km_h: number;
  pace_min_km: number;
  formatted_pace: string; // e.g. "5:30 min/km"
  speed_mph?: number;
  pace_min_mile?: number;
  formatted_pace_mile?: string;
}

export interface PreviousExercisePerformance {
  workout_id: string;
  local_date: string;
  formatted_summary: string; // e.g. "Last time: 3 x 8 at 40 kg"
  sets: Array<{
    set_number: number;
    reps?: number | null;
    weight_kg?: number | null;
    duration_seconds?: number | null;
    distance_meters?: number | null;
  }>;
}

export interface WorkoutTimerState {
  id: string;
  workout_id?: string | null;
  started_at: string; // ISO UTC
  paused_at?: string | null; // ISO UTC
  total_paused_ms: number;
  is_running: boolean;
  updated_at: string;
}

// -----------------------------------------------------------------------------
// Phase 7: Progress Graphs, Streaks, Consistency Score & Leaderboards
// -----------------------------------------------------------------------------

export type ProgressDateRange = '7d' | '30d' | '90d' | '6m' | '1y' | 'all';
export type RoomProgressDateRange =
  | '7d'
  | '30d'
  | '90d'
  | '6m'
  | '1y'
  | 'all'
  | 'since_start';

export type ProgressMetric =
  | 'consistency'
  | 'weight_change'
  | 'calories_vs_target'
  | 'steps'
  | 'water'
  | 'workouts';

export interface UserStreak {
  user_id: string;
  current_streak: number;
  longest_streak: number;
  last_logged_date: string | null;
  updated_at: string;
}

export interface RoomStreak {
  room_id: string;
  current_streak: number;
  longest_streak: number;
  last_achieved_date: string | null;
  updated_at: string;
}

export interface WeeklyScore {
  id: string;
  user_id: string;
  week_start_date: string; // Monday YYYY-MM-DD
  division: 'beginner' | 'cutting' | 'bulking' | 'maintain';
  cohort_id: string;
  logged_days: number;
  goal_days: number;
  consistency_score: number;
  low_intake_flag: boolean;
  is_eligible: boolean;
  earliest_completion_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExerciseProgressionItem {
  exercise_id: string | null;
  exercise_name: string;
  data: Array<{
    local_date: string;
    heaviest_weight_kg: number;
    best_1rm_kg: number;
  }>;
}

export interface IndividualWeightProgress {
  history: Array<{
    date: string;
    raw_weight_kg: number | null;
    trend_weight_kg: number | null;
  }>;
  start_weight_kg: number | null;
  current_weight_kg: number | null;
  current_trend_kg: number | null;
  total_change_kg: number | null;
  total_change_pct: number | null;
  target_weight_kg: number | null;
  weekly_pace_kg: number | null;
  projected_date: string | null;
  goal_progress_pct: number | null;
}

export interface IndividualCaloriesProgress {
  daily: Array<{
    date: string;
    calories: number;
    target_calories: number;
    is_logged_day: boolean;
    is_goal_day: boolean;
  }>;
  average_calories: number;
  average_target: number;
  logged_days_count: number;
  goal_days_count: number;
  total_days_in_range: number;
  adherence_pct: number; // goal_days / logged_days * 100
}

export interface IndividualMacrosProgress {
  protein_avg_g: number;
  carbs_avg_g: number;
  fat_avg_g: number;
  protein_target_g: number;
  carbs_target_g: number;
  fat_target_g: number;
}

export interface IndividualStepsProgress {
  daily: Array<{
    date: string;
    steps: number;
    distance_km: number;
  }>;
  average_steps: number;
  total_steps: number;
  total_distance_km: number;
  goal_steps: number;
}

export interface IndividualWaterProgress {
  daily: Array<{
    date: string;
    water_ml: number;
  }>;
  average_water_ml: number;
  total_water_ml: number;
  goal_water_ml: number;
}

export interface IndividualWorkoutsProgress {
  total_workouts: number;
  sessions_per_week: number;
  total_duration_minutes: number;
  total_volume_kg: number;
  exercise_progression: ExerciseProgressionItem[];
}

export interface IndividualConsistencyProgress {
  current_streak: number;
  longest_streak: number;
  weekly_scores: Array<{
    week_start_date: string;
    logged_days: number;
    goal_days: number;
    consistency_score: number;
  }>;
}

export interface IndividualProgressData {
  range: ProgressDateRange;
  start_date: string;
  end_date: string;
  weight: IndividualWeightProgress;
  calories: IndividualCaloriesProgress;
  macros: IndividualMacrosProgress;
  steps: IndividualStepsProgress;
  water: IndividualWaterProgress;
  workouts: IndividualWorkoutsProgress;
  consistency: IndividualConsistencyProgress;
  goal_progress_pct: number | null;
}

export interface RoomProgressMemberSeries {
  user_id: string;
  nickname: string;
  username: string;
  avatar_url: string | null;
  status: 'active' | 'paused' | 'locked' | 'left';
  is_self: boolean;
  is_locked_member: boolean;
  is_metric_locked: boolean;
  data: Array<{
    date: string;
    value: number | null; // e.g. weight change, consistency, calories vs target %, steps, etc.
  }>;
}

export interface RoomProgressSummaryRow {
  user_id: string;
  nickname: string;
  avatar_url: string | null;
  status: 'active' | 'paused' | 'locked' | 'left';
  is_self: boolean;
  is_locked_member: boolean;
  weight_change_kg: number | 'locked' | null;
  weight_change_pct: number | 'locked' | null;
  goal_progress_pct: number | 'locked' | null;
  average_calories_vs_target_pct: number | 'locked' | null;
  average_steps: number | 'locked' | null;
  total_workouts: number | 'locked' | null;
  consistency_score: number | 'locked';
}

export interface RoomProgressData {
  room_id: string;
  range: RoomProgressDateRange;
  start_date: string;
  end_date: string;
  total_members: number;
  is_large_room: boolean;
  selected_member_ids: string[];
  members_series: Record<ProgressMetric, RoomProgressMemberSeries[]>;
  room_average_series: Record<ProgressMetric, Array<{ date: string; value: number }>>;
  summary_table: RoomProgressSummaryRow[];
}

export interface LeaderboardRankedUser {
  rank: number;
  nickname: string;
  avatar_url: string | null;
  consistency_score: number;
  is_me: boolean;
}

export interface LeaderboardResponse {
  opted_out: boolean;
  division?: 'beginner' | 'cutting' | 'bulking' | 'maintain';
  cohort_id?: string;
  week_start_date?: string;
  top_10?: LeaderboardRankedUser[];
  my_rank?: {
    rank: number;
    nickname: string;
    avatar_url: string | null;
    consistency_score: number;
    is_eligible: boolean;
  } | null;
  total_in_cohort?: number;
  info_note?: string;
}

// -----------------------------------------------------------------------------
// Phase 8: Room Chat, Attachments, R2 URLs, Offline Sync & Safety Types
// -----------------------------------------------------------------------------

export type ChatMessageType = 'user' | 'system';
export type ChatSystemEventType =
  | 'member_joined'
  | 'member_left'
  | 'room_created'
  | 'streak_milestone';

export type ChatModerationStatus = 'pending' | 'ok' | 'blocked';
export type ChatDeliveryStatus = 'sending' | 'sent' | 'failed';
export type ChatSyncState = 'synced' | 'pending' | 'failed';

export interface ChatAttachment {
  id: string;
  message_id: string;
  storage_key: string;
  width: number | null;
  height: number | null;
  size: number;
  mime_type: string;
  moderation_status: ChatModerationStatus;
  created_at: string;
  signed_url?: string | null;
  local_uri?: string | null;
  upload_status?: 'pending' | 'uploading' | 'uploaded' | 'failed';
}

export interface ChatMessage {
  id: string;
  client_id: string;
  room_id: string;
  sender_id: string | null;
  sender_nickname?: string | null;
  sender_username?: string | null;
  sender_avatar_url?: string | null;
  message_type: ChatMessageType;
  system_event_type: ChatSystemEventType | null;
  text: string | null;
  created_at: string;
  deleted_at: string | null;
  attachments: ChatAttachment[];
  delivery_status?: ChatDeliveryStatus;
  sync_state?: ChatSyncState;
}

export interface ChatReadState {
  room_id: string;
  user_id: string;
  last_read_message_id: string | null;
  last_read_at: string;
  unread_count?: number;
}

export interface ChatRoomSettings {
  room_id: string;
  user_id: string;
  mute_system_messages: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface MemberMute {
  user_id: string;
  muted_user_id: string;
  created_at: string;
}

export interface ConsentRecord {
  id: string;
  user_id: string;
  consent_type: 'chat_terms' | 'terms' | 'privacy_policy' | 'ai_processing' | 'partner_finder';
  version: string;
  metadata?: Record<string, unknown>;
  accepted_at: string;
}

export interface ChatUploadUrlRequest {
  room_id: string;
  client_id: string;
  filename: string;
  mime_type: string;
  size: number;
  width?: number;
  height?: number;
}

export interface ChatUploadUrlResponse {
  upload_url: string;
  storage_key: string;
  headers: Record<string, string>;
  expires_in_seconds: number;
}

export interface ChatSignedUrlRequest {
  room_id: string;
  storage_key: string;
}

export interface ChatSignedUrlResponse {
  signed_url: string;
  expires_in_seconds: number;
}

export type ChatErrorCode =
  | 'TERMS_REQUIRED'
  | 'NOT_ROOM_MEMBER'
  | 'ROOM_LOCKED'
  | 'ROOM_DORMANT_READ_ONLY'
  | 'RATE_LIMIT_EXCEEDED'
  | 'ATTACHMENT_LIMIT_EXCEEDED'
  | 'FILE_TOO_LARGE'
  | 'INVALID_FILE_TYPE'
  | 'MESSAGE_TOO_LONG'
  | 'MESSAGE_EMPTY'
  | 'MESSAGE_NOT_FOUND'
  | 'CANNOT_DELETE_OTHERS'
  | 'URL_EXPIRED'
  | 'UNAUTHENTICATED'
  | 'UNKNOWN_ERROR';



