import {
  calculateTargets,
  isAtLeast18,
  type ActivityLevel,
  type CalculateTargetsResult,
  type Goal,
  type HealthScreening,
  type Sex,
  type Units,
} from '@calipartner/core';

export type OnboardingStep =
  | 'goal'
  | 'body_stats'
  | 'activity_level'
  | 'rate_selection'
  | 'target_weight_date'
  | 'health_screening'
  | 'review_calculation'
  | 'completed';

export const ONBOARDING_STEPS_ORDER: readonly OnboardingStep[] = [
  'goal',
  'body_stats',
  'activity_level',
  'rate_selection',
  'target_weight_date',
  'health_screening',
  'review_calculation',
  'completed',
] as const;

export interface OnboardingState {
  currentStep: OnboardingStep;
  goal: Goal;
  units: Units;
  sex: Sex;
  dateOfBirth: string; // YYYY-MM-DD
  heightCm: number;
  weightKg: number;
  bodyFatPercentage: number | null;
  activityLevel: ActivityLevel;
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
  calculatedTargets: CalculateTargetsResult | null;
  errors: Record<string, string>;
}

export const INITIAL_ONBOARDING_STATE: OnboardingState = {
  currentStep: 'goal',
  goal: 'cut',
  units: 'metric',
  sex: 'male',
  dateOfBirth: '',
  heightCm: 175,
  weightKg: 70,
  bodyFatPercentage: null,
  activityLevel: 'moderate',
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
  calculatedTargets: null,
  errors: {},
};

export class OnboardingStateMachine {
  private state: OnboardingState;

  constructor(initialState?: Partial<OnboardingState>) {
    this.state = {
      ...INITIAL_ONBOARDING_STATE,
      ...initialState,
    };
    if (this.canCalculateTargets()) {
      this.recalculateTargets();
    }
  }

  getState(): OnboardingState {
    return { ...this.state };
  }

  setGoal(goal: Goal): this {
    this.state.goal = goal;
    if (goal === 'maintain') {
      this.state.weeklyRateKg = 0;
    } else if (this.state.weeklyRateKg === 0) {
      this.state.weeklyRateKg = 0.5;
    }
    this.recalculateTargets();
    return this;
  }

  setUnits(units: Units): this {
    this.state.units = units;
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
    if (stats.bodyFatPercentage !== undefined) this.state.bodyFatPercentage = stats.bodyFatPercentage;
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
    this.recalculateTargets();
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

  validateStep(step: OnboardingStep): { isValid: boolean; errors: Record<string, string> } {
    const errors: Record<string, string> = {};

    switch (step) {
      case 'goal':
        if (!['cut', 'maintain', 'bulk'].includes(this.state.goal)) {
          errors.goal = 'Please choose a goal';
        }
        break;

      case 'body_stats':
        if (!this.state.dateOfBirth) {
          errors.dateOfBirth = 'Date of birth is required';
        } else if (!isAtLeast18(this.state.dateOfBirth)) {
          errors.dateOfBirth = 'You must be at least 18 years old to use CaliPartner';
        }
        if (this.state.heightCm < 50 || this.state.heightCm > 300) {
          errors.height = 'Please enter a valid height';
        }
        if (this.state.weightKg < 20 || this.state.weightKg > 500) {
          errors.weight = 'Please enter a valid weight';
        }
        if (
          this.state.bodyFatPercentage !== null &&
          (this.state.bodyFatPercentage < 3 || this.state.bodyFatPercentage > 70)
        ) {
          errors.bodyFat = 'Body fat percentage must be between 3% and 70%';
        }
        break;

      case 'activity_level':
        if (!this.state.activityLevel) {
          errors.activityLevel = 'Please select your activity level';
        }
        break;

      case 'rate_selection':
        if (this.state.calculatedTargets) {
          const selectedOption = this.state.calculatedTargets.presetRates.find(
            (p) => p.rateKgPerWeek === this.state.weeklyRateKg,
          );
          if (selectedOption && !selectedOption.available) {
            errors.rate = `Selected rate is unavailable: ${selectedOption.reason}`;
          }
        }
        break;

      case 'target_weight_date':
        // Target weight and date are optional; but if entered, must be valid
        if (this.state.targetWeightKg !== null) {
          if (this.state.targetWeightKg < 20 || this.state.targetWeightKg > 500) {
            errors.targetWeight = 'Please enter a valid target weight';
          }
        }
        if (this.state.targetDate) {
          const date = new Date(this.state.targetDate + 'T00:00:00Z');
          if (isNaN(date.getTime()) || date.getTime() <= Date.now()) {
            errors.targetDate = 'Target date must be in the future';
          }
        }
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
    const currentIndex = ONBOARDING_STEPS_ORDER.indexOf(this.state.currentStep);
    if (currentIndex < ONBOARDING_STEPS_ORDER.length - 1) {
      const nextStep = ONBOARDING_STEPS_ORDER[currentIndex + 1];
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
    const currentIndex = ONBOARDING_STEPS_ORDER.indexOf(this.state.currentStep);
    if (currentIndex > 0) {
      const prevStep = ONBOARDING_STEPS_ORDER[currentIndex - 1];
      if (prevStep) {
        this.state.currentStep = prevStep;
        return true;
      }
    }
    return false;
  }

  goToStep(step: OnboardingStep): boolean {
    const targetIndex = ONBOARDING_STEPS_ORDER.indexOf(step);
    const currentIndex = ONBOARDING_STEPS_ORDER.indexOf(this.state.currentStep);
    if (targetIndex <= currentIndex) {
      this.state.currentStep = step;
      this.state.errors = {};
      return true;
    }
    // Forward jump requires validation
    return false;
  }

  private canCalculateTargets(): boolean {
    return (
      Boolean(this.state.dateOfBirth) &&
      this.state.heightCm > 0 &&
      this.state.weightKg > 0
    );
  }

  private recalculateTargets(): void {
    if (!this.canCalculateTargets()) {
      return;
    }
    try {
      this.state.calculatedTargets = calculateTargets({
        sex: this.state.sex,
        dateOfBirth: this.state.dateOfBirth,
        heightCm: this.state.heightCm,
        weightKg: this.state.weightKg,
        bodyFatPercentage: this.state.bodyFatPercentage,
        activityLevel: this.state.activityLevel,
        goal: this.state.goal,
        weeklyRateKg: this.state.weeklyRateKg,
        targetWeightKg: this.state.targetWeightKg ?? undefined,
        targetDate: this.state.targetDate ?? undefined,
      });
    } catch {
      // Targets calculation will be retried when inputs are complete
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

    const now = new Date().toISOString();
    return {
      id: `gp-${userId}-${Date.now()}`,
      user_id: userId,
      goal: this.state.goal,
      activity_level: this.state.activityLevel,
      current_weight_kg: this.state.weightKg,
      body_fat_percentage: this.state.bodyFatPercentage,
      weekly_rate_kg: this.state.weeklyRateKg,
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
