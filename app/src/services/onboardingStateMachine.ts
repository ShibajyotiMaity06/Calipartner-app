import {
  calculateGymTargets,
  calculateAge,
  isGymPlanValid,
  isAtLeast18,
  type ActivityLevel,
  type GymTargetsResult,
  type Goal,
  type HealthScreening,
  type OnboardingTargetOverrides,
  type Sex,
  type Units,
} from '@calipartner/core';
import { generateClientUuid } from './foodService';

export const ONBOARDING_STEPS_ORDER = [
  'goal',
  'nickname',
  'age',
  'height',
  'weight',
  'activity_level',
  'gym_days',
  'target_weight',
  'rate_selection',
  'step_goal',
  'water_goal',
  'profile',
  'plan_summary',
] as const;

const ONBOARDING_FLOW = [...ONBOARDING_STEPS_ORDER, 'reveal', 'paywall'] as const;
export const MAX_ONBOARDING_WEEKLY_RATE_KG = 3;
export type OnboardingStep = (typeof ONBOARDING_FLOW)[number];
type ValidationStep = OnboardingStep | 'body_stats' | 'daily_goals';
export type SelectedGoal = Exclude<Goal, 'maintain'>;
export type CharacterGender = Exclude<Sex, 'other'>;

export interface OnboardingState {
  currentStep: OnboardingStep;
  goal: Goal;
  goalSelected: boolean;
  characterGender: CharacterGender | null;
  units: Units;
  heightUnits: Units;
  nickname: string;
  sex: Sex;
  dateOfBirth: string; // YYYY-MM-DD
  heightCm: number;
  weightKg: number;
  bodyFatPercentage: number | null;
  activityLevel: ActivityLevel;
  gymDays: number;
  dailyAdjustmentKcal: number | null;
  goalProfileId: string;
  weeklyRateKg: number;
  targetWeightKg: number | null;
  targetDate: string | null; // YYYY-MM-DD
  healthScreening: {
    pregnantOrBreastfeeding: boolean;
    hasDiabetesOrMedication: boolean;
    hasEatingDisorderHistory: boolean;
  };
  stepGoal: number;
  waterMlGoal: number;
  targetOverrides: OnboardingTargetOverrides;
  calculatedTargets: GymTargetsResult | null;
  errors: Record<string, string>;
}

export const INITIAL_ONBOARDING_STATE: OnboardingState = {
  currentStep: 'goal',
  goal: 'cut',
  goalSelected: false,
  characterGender: null,
  units: 'metric',
  heightUnits: 'metric',
  nickname: '',
  sex: 'male',
  dateOfBirth: '',
  heightCm: 175,
  weightKg: 70,
  bodyFatPercentage: null,
  activityLevel: 'moderate',
  gymDays: 3,
  dailyAdjustmentKcal: null,
  goalProfileId: '',
  weeklyRateKg: 0.5,
  targetWeightKg: null,
  targetDate: null,
  healthScreening: {
    pregnantOrBreastfeeding: false,
    hasDiabetesOrMedication: false,
    hasEatingDisorderHistory: false,
  },
  stepGoal: 8000,
  waterMlGoal: 2500,
  targetOverrides: {},
  calculatedTargets: null,
  errors: {},
};

export class OnboardingStateMachine {
  private state: OnboardingState;

  constructor(initialState?: Partial<OnboardingState>) {
    this.state = {
      ...INITIAL_ONBOARDING_STATE,
      ...initialState,
      goalProfileId: initialState?.goalProfileId || generateClientUuid(),
    };
    if (this.canCalculateTargets()) {
      this.recalculateTargets();
    }
  }

  getState(): OnboardingState {
    return { ...this.state };
  }

  setGoal(goal: Goal): this {
    if (this.state.characterGender && goal !== this.state.goal) {
      this.state.targetWeightKg = null;
      this.state.targetDate = null;
    }
    this.state.goal = goal;
    this.state.dailyAdjustmentKcal = null;
    this.state.goalSelected = goal === 'bulk' || goal === 'cut';
    if (goal === 'maintain') {
      this.state.weeklyRateKg = 0;
    } else if (this.state.weeklyRateKg === 0) {
      this.state.weeklyRateKg = 0.5;
    }
    this.recalculateTargets();
    return this;
  }

  setCharacterGender(gender: CharacterGender, useForCalculation: boolean): this {
    this.state.characterGender = gender;
    if (useForCalculation) this.setBodyStats({ sex: gender });
    return this;
  }

  setTargetOverrides(overrides: OnboardingTargetOverrides): this {
    this.state.targetOverrides = overrides;
    return this;
  }

  setUnits(units: Units): this {
    this.state.units = units;
    return this;
  }

  setHeightUnits(units: Units): this {
    this.state.heightUnits = units;
    return this;
  }

  setNickname(nickname: string): this {
    this.state.nickname = nickname;
    return this;
  }

  setBodyStats(stats: {
    sex?: Sex;
    dateOfBirth?: string;
    heightCm?: number;
    weightKg?: number;
    bodyFatPercentage?: number | null;
  }): this {
    if (stats.sex !== undefined) this.state.sex = stats.sex;
    if (stats.dateOfBirth !== undefined) this.state.dateOfBirth = stats.dateOfBirth;
    if (stats.heightCm !== undefined) this.state.heightCm = stats.heightCm;
    if (stats.weightKg !== undefined) this.state.weightKg = stats.weightKg;
    if (stats.bodyFatPercentage !== undefined)
      this.state.bodyFatPercentage = stats.bodyFatPercentage;
    this.recalculateTargets();
    return this;
  }

  setActivityLevel(level: ActivityLevel): this {
    this.state.activityLevel = level;
    this.recalculateTargets();
    return this;
  }

  setWeeklyRate(rateKg: number): this {
    this.state.weeklyRateKg = rateKg;
    this.state.dailyAdjustmentKcal = null;
    this.recalculateTargets();
    return this;
  }

  setGymDays(days: number): this {
    this.state.gymDays = days;
    this.recalculateTargets();
    return this;
  }

  setDailyAdjustment(kcal: number): this {
    this.state.dailyAdjustmentKcal = kcal;
    this.state.weeklyRateKg = kcal / 1100;
    this.recalculateTargets();
    return this;
  }

  useRecommendedRate(): this {
    if (this.state.calculatedTargets)
      this.setWeeklyRate(this.state.calculatedTargets.recommendedRateKg);
    return this;
  }

  setTargetWeightAndDate(targetWeightKg: number | null, targetDate: string | null): this {
    this.state.targetWeightKg = targetWeightKg;
    this.state.targetDate = targetDate;
    this.recalculateTargets();
    return this;
  }

  setHealthScreening(screening: Partial<OnboardingState['healthScreening']>): this {
    this.state.healthScreening = {
      ...this.state.healthScreening,
      ...screening,
    };
    return this;
  }

  setStepAndWaterGoals(stepGoal?: number, waterMlGoal?: number): this {
    if (stepGoal !== undefined) this.state.stepGoal = stepGoal;
    if (waterMlGoal !== undefined) this.state.waterMlGoal = waterMlGoal;
    return this;
  }

  validateStep(step: ValidationStep): { isValid: boolean; errors: Record<string, string> } {
    const errors: Record<string, string> = {};

    switch (step) {
      case 'daily_goals':
        Object.assign(
          errors,
          this.validateStep('step_goal').errors,
          this.validateStep('water_goal').errors,
        );
        break;
      case 'step_goal':
        if (
          !Number.isInteger(this.state.stepGoal) ||
          this.state.stepGoal < 1 ||
          this.state.stepGoal > 100000
        )
          errors.stepGoal = 'Invalid step goal';
        break;
      case 'water_goal':
        if (
          !Number.isInteger(this.state.waterMlGoal) ||
          this.state.waterMlGoal < 1 ||
          this.state.waterMlGoal > 20000
        )
          errors.waterMlGoal = 'Invalid water goal';
        break;
      case 'goal':
        if (!this.state.characterGender) errors.characterGender = 'Please choose a character';
        if (!this.state.goalSelected || !['cut', 'bulk'].includes(this.state.goal)) {
          errors.goal = 'Please choose a goal';
        }
        break;
      case 'nickname':
        if (!this.state.nickname.trim() || this.state.nickname.trim().length > 60)
          errors.nickname = 'Please enter a nickname';
        break;

      case 'body_stats':
        for (const detail of ['age', 'height', 'weight', 'gym_days'] as const) {
          Object.assign(errors, this.validateStep(detail).errors);
        }
        if (
          this.state.bodyFatPercentage !== null &&
          (this.state.bodyFatPercentage < 3 || this.state.bodyFatPercentage > 70)
        ) {
          errors.bodyFat = 'Body fat percentage must be between 3% and 70%';
        }
        break;
      case 'age':
        if (!this.state.dateOfBirth) {
          errors.dateOfBirth = 'Date of birth is required';
        } else if (!isAtLeast18(this.state.dateOfBirth)) {
          errors.dateOfBirth = 'You must be at least 18 years old to use CaliPartner';
        } else if (calculateAge(this.state.dateOfBirth) > 120) {
          errors.dateOfBirth = 'Please enter a valid date of birth';
        }
        break;
      case 'height':
        if (
          !Number.isFinite(this.state.heightCm) ||
          this.state.heightCm < 50 ||
          this.state.heightCm > 300
        ) {
          errors.height = 'Please enter a valid height';
        }
        break;
      case 'weight':
        if (
          !Number.isFinite(this.state.weightKg) ||
          this.state.weightKg < 20 ||
          this.state.weightKg > 500
        ) {
          errors.weight = 'Please enter a valid weight';
        }
        break;
      case 'gym_days':
        if (
          !Number.isInteger(this.state.gymDays) ||
          this.state.gymDays < 0 ||
          this.state.gymDays > 7
        )
          errors.gymDays = 'Gym days must be between 0 and 7';
        break;

      case 'activity_level':
        if (!this.state.activityLevel) {
          errors.activityLevel = 'Please select your activity level';
        }
        break;

      case 'rate_selection':
      case 'plan_summary':
        if (this.state.characterGender && this.state.weeklyRateKg > MAX_ONBOARDING_WEEKLY_RATE_KG) {
          errors.rateTooHigh = 'Pace exceeds the maximum';
        }
        if (
          !this.state.calculatedTargets ||
          !isGymPlanValid(this.state.calculatedTargets) ||
          (this.state.characterGender &&
            (this.state.calculatedTargets.safety.isFloorApplied ||
              this.state.calculatedTargets.safety.isBmiTooLowForCut ||
              this.state.weeklyRateKg <= 0))
        )
          errors.rate = 'Enter a valid pace with enough calories for your macros';
        Object.assign(errors, this.validateStep('target_weight').errors);
        break;
      case 'target_weight':
        if (
          this.state.targetWeightKg !== null &&
          (!Number.isFinite(this.state.targetWeightKg) ||
            this.state.targetWeightKg < 20 ||
            this.state.targetWeightKg > 500)
        )
          errors.targetWeight = 'Please enter a valid target weight';
        if (
          this.state.targetWeightKg !== null &&
          ((this.state.goal === 'bulk' && this.state.targetWeightKg <= this.state.weightKg) ||
            (this.state.goal === 'cut' && this.state.targetWeightKg >= this.state.weightKg))
        )
          errors.targetWeight = 'Target weight must match your chosen goal';
        break;

      default:
        break;
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }

  next(): boolean {
    const validation = this.validateStep(this.state.currentStep);
    if (!validation.isValid) {
      this.state.errors = validation.errors;
      return false;
    }

    this.state.errors = {};
    const currentIndex = ONBOARDING_FLOW.indexOf(this.state.currentStep);
    if (currentIndex < ONBOARDING_FLOW.length - 1) {
      const nextStep = ONBOARDING_FLOW[currentIndex + 1];
      if (nextStep) {
        this.state.currentStep = nextStep;
        this.recalculateTargets();
        return true;
      }
    }
    return false;
  }

  back(): boolean {
    this.state.errors = {};
    const currentIndex = ONBOARDING_FLOW.indexOf(this.state.currentStep);
    if (currentIndex > 0) {
      const prevStep = ONBOARDING_FLOW[currentIndex - 1];
      if (prevStep) {
        this.state.currentStep = prevStep;
        return true;
      }
    }
    return false;
  }

  goToStep(step: OnboardingStep): boolean {
    const targetIndex = ONBOARDING_FLOW.indexOf(step);
    const currentIndex = ONBOARDING_FLOW.indexOf(this.state.currentStep);
    if (targetIndex === -1) return false;
    if (targetIndex <= currentIndex) {
      this.state.currentStep = step;
      this.state.errors = {};
      return true;
    }
    for (const required of ONBOARDING_FLOW.slice(currentIndex, targetIndex)) {
      const validation = this.validateStep(required);
      if (!validation.isValid) {
        this.state.currentStep = required;
        this.state.errors = validation.errors;
        return false;
      }
    }
    this.state.currentStep = step;
    this.state.errors = {};
    this.recalculateTargets();
    return true;
  }

  private canCalculateTargets(): boolean {
    return Boolean(this.state.dateOfBirth) && this.state.heightCm > 0 && this.state.weightKg > 0;
  }

  private recalculateTargets(): void {
    if (!this.canCalculateTargets()) {
      this.state.calculatedTargets = null;
      return;
    }
    try {
      this.state.calculatedTargets = calculateGymTargets({
        sex: this.state.sex,
        dateOfBirth: this.state.dateOfBirth,
        heightCm: this.state.heightCm,
        weightKg: this.state.weightKg,
        bodyFatPercentage: this.state.bodyFatPercentage,
        activityLevel: this.state.activityLevel,
        gymDays: this.state.gymDays,
        dailyAdjustmentKcal: this.state.dailyAdjustmentKcal ?? undefined,
        goal: this.state.goal,
        weeklyRateKg: this.state.weeklyRateKg,
        targetWeightKg: this.state.targetWeightKg ?? undefined,
        targetDate: this.state.targetDate ?? undefined,
      });
    } catch {
      this.state.calculatedTargets = null;
    }
  }

  /**
   * Builds the final GoalProfile data ready for local and Supabase persistence.
   */
  buildGoalProfile(userId: string): {
    id: string;
    user_id: string;
    goal: Goal;
    activity_level: ActivityLevel;
    gym_days: number;
    macro_reference_adjustment_kcal: number;
    input_height_cm: number;
    current_weight_kg: number;
    body_fat_percentage: number | null;
    weekly_rate_kg: number;
    target_weight_kg: number | null;
    target_date: string | null;
    daily_calorie_target: number;
    protein_grams: number;
    fat_grams: number;
    carb_grams: number;
    bmr: number;
    tdee: number;
    step_goal: number;
    water_ml_goal: number;
    effective_from: string;
    confirmed_at: string;
    recompute_reason: 'initial_onboarding';
    created_at: string;
  } {
    if (!this.state.calculatedTargets) {
      throw new Error('Cannot build goal profile: targets not calculated');
    }
    if (!isGymPlanValid(this.state.calculatedTargets))
      throw new Error('Plan has invalid calorie or macro totals');
    if (
      !this.validateStep('body_stats').isValid ||
      !this.validateStep('rate_selection').isValid ||
      !this.validateStep('daily_goals').isValid
    )
      throw new Error('Complete your body details and goal before saving');

    const now = new Date().toISOString();
    return {
      id: this.state.goalProfileId,
      user_id: userId,
      goal: this.state.goal,
      activity_level: this.state.activityLevel,
      gym_days: this.state.gymDays,
      macro_reference_adjustment_kcal: Math.round(
        Math.abs(this.state.calculatedTargets.dailyChangeKcal),
      ),
      input_height_cm: this.state.heightCm,
      current_weight_kg: this.state.weightKg,
      body_fat_percentage: this.state.bodyFatPercentage,
      weekly_rate_kg: this.state.calculatedTargets.weeklyRateKg,
      target_weight_kg: this.state.targetWeightKg,
      target_date: this.state.targetDate,
      daily_calorie_target: this.state.calculatedTargets.targetKcal,
      protein_grams: this.state.calculatedTargets.macros.proteinGrams,
      fat_grams: this.state.calculatedTargets.macros.fatGrams,
      carb_grams: this.state.calculatedTargets.macros.carbGrams,
      bmr: this.state.calculatedTargets.bmr,
      tdee: this.state.calculatedTargets.tdee,
      step_goal: this.state.stepGoal,
      water_ml_goal: this.state.waterMlGoal,
      effective_from: now,
      confirmed_at: now,
      recompute_reason: 'initial_onboarding',
      created_at: now,
    };
  }

  buildHealthScreening(userId: string): HealthScreening {
    const now = new Date().toISOString();
    return {
      user_id: userId,
      pregnant_or_breastfeeding: this.state.healthScreening.pregnantOrBreastfeeding,
      has_diabetes_or_medication: this.state.healthScreening.hasDiabetesOrMedication,
      has_eating_disorder_history: this.state.healthScreening.hasEatingDisorderHistory,
      updated_at: now,
      created_at: now,
    };
  }
}
