import type { GoalProfile } from './types';
import type { PlanDay, PlanPreferences } from './weeklyPlan';
import { planDayNutrition } from './weeklyPlan';

/** Illustrative onboarding values, never historical logs or prescribed training loads. */
export function buildOnboardingDemo(
  goal: GoalProfile | null,
  day: PlanDay,
  preferences: PlanPreferences,
) {
  const nutrition = planDayNutrition(day);
  const targets = {
    calories: goal?.daily_calorie_target ?? nutrition.calories,
    protein: goal?.protein_grams ?? nutrition.protein,
    carbs: goal?.carb_grams ?? nutrition.carbs,
    fat: goal?.fat_grams ?? nutrition.fat,
    steps: goal?.step_goal ?? 8000,
    water: goal?.water_ml_goal ?? 2500,
  };
  const values = {
    calories: Math.round(targets.calories * 0.96),
    protein: Math.round(targets.protein * 0.98),
    carbs: Math.round(targets.carbs * 0.94),
    fat: Math.round(targets.fat * 0.95),
    steps: Math.round(targets.steps * 0.95),
    water: Math.round(targets.water * 0.92),
  };
  const partnerTargets = {
    calories: 2300,
    protein: 140,
    carbs: 285,
    fat: 65,
    steps: 8000,
    water: 2500,
  };
  const partnerValues = {
    calories: 2210,
    protein: 135,
    carbs: 270,
    fat: 62,
    steps: 7800,
    water: 2400,
  };
  const exercise = day.workout.exercises[0];
  const exampleLoad =
    exercise?.equipment === 'dumbbell' ? 8 : exercise?.equipment === 'barbell' ? 20 : null;
  return {
    targets,
    values,
    partnerTargets,
    partnerValues,
    exercise,
    exampleLoad,
    yesterdayCalories: Math.round(targets.calories * 0.97),
    yesterdayProtein: Math.round(targets.protein * 0.9),
    sets: exercise?.sets ?? 3,
    reps: exercise?.reps ?? 8,
    nextReps: Math.min(30, (exercise?.reps ?? 8) + 1),
    minutes: day.workout.minutes || preferences.session_minutes,
  };
}
export function demoGoalPercent(value: number, target: number) {
  return target > 0 ? Math.round((value / target) * 100) : 0;
}
