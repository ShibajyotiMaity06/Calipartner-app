import { describe, expect, it } from 'vitest';
import {
  validatePlanPreferences,
  validateWeeklyPlan,
  planDayNutrition,
  hasRepeatedMealNutrition,
  WeeklyPlanValidationError,
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
  it('identifies the failing meal and actual energy for a provider repair without changing it', () => {
    const plan = content();
    plan.days[2]!.meals[1]!.calories = 1900;
    try {
      validateWeeklyPlan(plan, preferences, goals);
      throw new Error('Expected invalid meal nutrition');
    } catch (error) {
      expect(error).toBeInstanceOf(WeeklyPlanValidationError);
      expect((error as WeeklyPlanValidationError).repair).toContain('Day 2, meal 1');
      expect((error as WeeklyPlanValidationError).repair).toContain('reported 1900 kcal');
      expect((error as WeeklyPlanValidationError).repair).toContain('is 700 kcal');
    }
    expect(plan.days[2]!.meals[1]!.calories).toBe(1900);
  });
  it('does not mistake eggplant for eggs in a vegan plan', () => {
    const plan = content();
    plan.days.forEach((day) => day.meals.forEach((meal) => meal.ingredients.push('eggplant 100g')));
    expect(validateWeeklyPlan(plan, { ...preferences, diet: 'vegan' }, goals).days).toHaveLength(7);
  });
  it('rejects identical daily macro tuples assigned to different measured foods', () => {
    const plan = content();
    plan.days[0]!.meals[1] = {
      ...plan.days[0]!.meals[1]!,
      name: 'Eggs and toast',
      ingredients: ['eggs 150g', 'toast 80g'],
    };
    expect(() => validateWeeklyPlan(plan, preferences, goals)).toThrow(
      expect.objectContaining({ reason: 'repeated_meal_nutrition' }),
    );
  });
  it('rejects nutrition copied across three different recipes even across separate days', () => {
    const plan = content();
    for (const [day, ingredient] of [
      [1, 'chicken 200g'],
      [2, 'oats 100g'],
    ] as const)
      plan.days[day]!.meals.forEach((meal) => {
        meal.ingredients = [ingredient];
      });
    expect(hasRepeatedMealNutrition(plan.days)).toBe(true);
    expect(() => validateWeeklyPlan(plan, preferences, goals)).toThrow('INVALID_PLAN');
  });
  it('allows repeated batch meals, renamed meals and reordered ingredients with the same portion', () => {
    const plan = content();
    plan.days[0]!.meals[1]!.name = 'Leftover dal rice';
    plan.days[0]!.meals[1]!.ingredients = [' LENTILS   200g ', 'rice 150g'];
    expect(hasRepeatedMealNutrition(plan.days)).toBe(false);
    expect(validateWeeklyPlan(plan, preferences, goals).days).toHaveLength(7);
  });
  it('allows an isolated coincidental nutrition match without forcing artificial differences', () => {
    const plan = content();
    plan.days[0]!.meals[1]!.ingredients = ['eggs 150g', 'toast 80g'];
    plan.days[0]!.meals[2] = {
      ...plan.days[0]!.meals[2]!,
      calories: 800,
      protein: 45,
      carbs: 100,
      fat: 24,
    };
    expect(validateWeeklyPlan(plan, preferences, goals).days[0]!.meals[1]!.calories).toBe(700);
  });
  it('retains distinct per-meal estimates and derives the daily total from them', () => {
    const plan = content();
    plan.days.forEach((day) => {
      day.meals = [
        {
          name: 'Oats',
          ingredients: ['oats 80g', 'milk 200ml'],
          portion: '1 bowl',
          calories: 500,
          protein: 30,
          carbs: 70,
          fat: 12,
        },
        {
          name: 'Dal rice',
          ingredients: ['rice 150g', 'lentils 200g'],
          portion: '1 plate',
          calories: 700,
          protein: 40,
          carbs: 90,
          fat: 20,
        },
        {
          name: 'Chicken rice',
          ingredients: ['rice 250g', 'chicken 200g', 'oil 15g'],
          portion: '1 large plate',
          calories: 900,
          protein: 50,
          carbs: 110,
          fat: 28,
        },
      ];
    });
    const saved = validateWeeklyPlan(plan, preferences, goals);
    expect(saved.days[0]!.meals.map((meal) => meal.calories)).toEqual([500, 700, 900]);
    expect(planDayNutrition(saved.days[0]!)).toEqual({
      calories: 2100,
      protein: 120,
      carbs: 270,
      fat: 60,
    });
  });
});
