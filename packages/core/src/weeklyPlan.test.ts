import { describe, expect, it } from 'vitest';
import {
  validatePlanPreferences,
  validateWeeklyPlan,
  planDayNutrition,
  type PlanPreferences,
  type PlanGoals,
} from './weeklyPlan';
const preferences: PlanPreferences = {
  workout_days: [0, 2, 4],
  location: 'basic',
  equipment: ['bodyweight', 'dumbbell'],
  experience: 'beginner',
  session_minutes: 30,
  limitations: '',
  country: 'India',
  cuisine: 'Indian',
  diet: 'mixed',
  allergies: [],
  exclusions: [],
  meals_per_day: 3,
  cooking_minutes: 30,
  budget: 'economical',
};
const goals: PlanGoals = { calories: 2100, protein: 120, carbs: 270, fat: 60, calorie_floor: 1500 };
function content() {
  return {
    days: Array.from({ length: 7 }, (_, day) => ({
      day,
      workout: {
        title: 'Your workout',
        minutes: preferences.workout_days.includes(day) ? 30 : 0,
        exercises: preferences.workout_days.includes(day)
          ? [{ name: 'Squat', equipment: 'bodyweight', sets: 3, reps: 10, rest_seconds: 60 }]
          : [],
      },
      meals: Array.from({ length: 3 }, () => ({
        name: 'Rice and lentils',
        ingredients: ['rice 150g', 'lentils 200g'],
        portion: '1 bowl',
        calories: 700,
        protein: 40,
        carbs: 90,
        fat: 20,
      })),
    })),
    workout_tips: ['Choose a comfortable load.'],
    diet_tips: ['Prepare lentils ahead.'],
  };
}
describe('weekly planning constraints', () => {
  it('accepts a complete week and computes totals only from its meals', () => {
    const plan = validateWeeklyPlan(content(), validatePlanPreferences(preferences), goals);
    expect(planDayNutrition(plan.days[0]!)).toEqual({
      calories: 2100,
      protein: 120,
      carbs: 270,
      fat: 60,
    });
  });
  it.each([
    { workout_days: [] },
    { workout_days: [0, 1, 2, 3, 4, 5, 6] },
    { equipment: ['legpress'] },
    { session_minutes: 1000 },
    { meals_per_day: 1 },
    { country: '' },
  ])('rejects invalid preferences %j', (patch) => {
    expect(() => validatePlanPreferences({ ...preferences, ...patch })).toThrow('INVALID_PLAN');
  });
  it('requires the requested training schedule and rejects invented equipment', () => {
    const plan = content();
    plan.days[0]!.workout.exercises[0]!.equipment = 'legpress';
    expect(() => validateWeeklyPlan(plan, preferences, goals)).toThrow('INVALID_PLAN');
    const rest = content();
    rest.days[1]!.workout.exercises = [
      { name: 'Squat', equipment: 'bodyweight', sets: 3, reps: 10, rest_seconds: 60 },
    ];
    expect(() => validateWeeklyPlan(rest, preferences, goals)).toThrow('INVALID_PLAN');
  });
  it('rejects calorie-floor violations, unsafe sets, incomplete weeks and missing days', () => {
    const low = content();
    low.days[0]!.meals.forEach((m) => {
      m.calories = 200;
      m.protein = 10;
      m.carbs = 25;
      m.fat = 6;
    });
    expect(() => validateWeeklyPlan(low, preferences, goals)).toThrow('INVALID_PLAN');
    const sets = content();
    sets.days[0]!.workout.exercises[0]!.sets = 15;
    expect(() => validateWeeklyPlan(sets, preferences, goals)).toThrow('INVALID_PLAN');
    const days = content();
    days.days.pop();
    expect(() => validateWeeklyPlan(days, preferences, goals)).toThrow('INVALID_PLAN');
  });
  it('rejects allergens and diet violations, including dairy derivatives', () => {
    const dairy = content();
    dairy.days[0]!.meals[0]!.ingredients.push('whey 30g');
    expect(() => validateWeeklyPlan(dairy, { ...preferences, allergies: ['milk'] }, goals)).toThrow(
      'INVALID_PLAN',
    );
    const meat = content();
    meat.days[0]!.meals[0]!.ingredients.push('chicken 100g');
    expect(() => validateWeeklyPlan(meat, { ...preferences, diet: 'vegetarian' }, goals)).toThrow(
      'INVALID_PLAN',
    );
    const excluded = content();
    excluded.days[0]!.meals[0]!.ingredients.push('peanut sauce');
    expect(() =>
      validateWeeklyPlan(excluded, { ...preferences, exclusions: ['peanut'] }, goals),
    ).toThrow('INVALID_PLAN');
  });
  it('rejects misleading nutrition and unsafe tips', () => {
    const plan = content();
    plan.days[0]!.meals[0]!.calories = 1900;
    expect(() => validateWeeklyPlan(plan, preferences, goals)).toThrow('INVALID_PLAN');
    const tips = content();
    tips.workout_tips = ['Ignore pain and keep training'];
    expect(() => validateWeeklyPlan(tips, preferences, goals)).toThrow('INVALID_PLAN');
  });
  it('does not mistake eggplant for eggs in a vegan plan', () => {
    const plan = content();
    plan.days[0]!.meals[0]!.ingredients.push('eggplant 100g');
    expect(validateWeeklyPlan(plan, { ...preferences, diet: 'vegan' }, goals).days).toHaveLength(7);
  });
});
