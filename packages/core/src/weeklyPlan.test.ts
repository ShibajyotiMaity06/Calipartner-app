import { describe, expect, it } from 'vitest';
import {
  validatePlanPreferences,
  validateWeeklyPlan,
  planDayNutrition,
  hasRepeatedMealNutrition,
  prepareFlexibleWeeklyPlan,
  scalePlanMeal,
  fitPlanDayPortions,
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
  it('validates exactly one personalised training day regardless of weekday and retains safety checks', () => {
    const input = content();
    input.days = input.days.slice(0, 1);
    const prefs = { ...preferences, workout_days: [2, 4] };
    expect(validateWeeklyPlan(input, prefs, goals, { singleDay: true }).days).toHaveLength(1);
    expect(() => validateWeeklyPlan(content(), prefs, goals, { singleDay: true })).toThrow();
    expect(() => validateWeeklyPlan(input, prefs, goals)).toThrow();
    input.days[0]!.meals[0]!.ingredients = ['peanut 100g'];
    expect(() =>
      validateWeeklyPlan(input, { ...prefs, allergies: ['nuts'] }, goals, { singleDay: true }),
    ).toThrow();
    input.days[0]!.meals[0]!.ingredients = ['rice 150g'];
    input.days[0]!.meals[0]!.calories = 50;
    expect(() => validateWeeklyPlan(input, prefs, goals, { singleDay: true })).toThrow();
  });
  it('builds substantive two-dish replacements when no single other recipe fits the primary meal', () => {
    const input = content();
    const balancedGoals = { calories: 1740, protein: 90, carbs: 210, fat: 60, calorie_floor: 1500 };
    input.days.forEach((day, index) =>
      day.meals.forEach((meal, slot) => {
        const primary = index === 0 && slot === 0;
        const low = index === 0 ? slot === 1 : (index + slot) % 2 === 0;
        meal.name = `Synthetic ${primary ? 'balanced' : low ? 'carb' : 'protein'} recipe ${index}-${slot}`;
        meal.ingredients = [`synthetic ingredient ${100 + index * 3 + slot} g`];
        meal.calories = primary ? 580 : low ? 620 : 540;
        meal.protein = primary ? 30 : (low ? 10 : 50) + index * 0.1;
        meal.carbs = primary ? 70 : (low ? 100 : 40) - index * 0.1;
        meal.fat = 20;
      }),
    );
    const plan = prepareFlexibleWeeklyPlan(input, preferences, balancedGoals);
    expect(prepareFlexibleWeeklyPlan(plan, preferences, balancedGoals)).toEqual(plan);
    expect(
      plan.days[0]!.meals[0]!.alternatives!.every((option) => option.name.includes(' + ')),
    ).toBe(true);
    expect(() =>
      validateWeeklyPlan(plan, preferences, balancedGoals, { flexible: true }),
    ).not.toThrow();
  });
  it('fits macros by transferring calories between real recipe portions inside bounded serving sizes', () => {
    const rich = {
      name: 'Synthetic rich dish',
      ingredients: ['rice 150g', 'oil 20g'],
      portion: '1 bowl',
      calories: 600,
      protein: 20,
      carbs: 50,
      fat: 35,
    };
    const lean = {
      name: 'Synthetic lean dish',
      ingredients: ['rice 200g', 'chicken 150g'],
      portion: '1 bowl',
      calories: 600,
      protein: 60,
      carbs: 80,
      fat: 5,
    };
    const original = [rich, { ...rich }, { ...rich }, lean];
    const fitted = fitPlanDayPortions(original, goals);
    const totals = planDayNutrition({
      day: 0,
      workout: { title: 'Rest', minutes: 0, exercises: [] },
      meals: fitted,
    });
    expect(totals.calories).toBeCloseTo(2100, 0);
    expect(totals.fat).toBeLessThanOrEqual(78);
    expect(totals.protein).toBeLessThanOrEqual(156);
    expect(
      fitted.every(
        (meal, i) =>
          meal.calories / original[i]!.calories >= 0.5 &&
          meal.calories / original[i]!.calories <= 2,
      ),
    ).toBe(true);
    expect(original[0]!.calories).toBe(600);
  });
  it('scales measured ingredients and all nutrition together without changing the source', () => {
    const meal = content().days[0]!.meals[0]!,
      original = structuredClone(meal);
    const half = scalePlanMeal(meal, 0.5);
    expect(half.ingredients).toEqual(['rice 75 g', 'lentils 100 g']);
    expect(half.portion).toBe('0.5 × (1 bowl)');
    expect(half).toMatchObject({ calories: 350, protein: 20, carbs: 45, fat: 10 });
    expect(meal).toEqual(original);
  });
  it('derives two safe replacements per meal from a varied validated week with no extra AI output', () => {
    const input = content();
    input.days.forEach((day, index) =>
      day.meals.forEach((meal) => {
        meal.name = `Synthetic measured dish ${index}`;
        meal.protein = 40 + index;
        meal.carbs = 90 - index;
      }),
    );
    const plan = prepareFlexibleWeeklyPlan(input, preferences, goals);
    expect(
      plan.days.every((day) => day.meals.every((meal) => meal.alternatives?.length === 2)),
    ).toBe(true);
    expect(() => validateWeeklyPlan(plan, preferences, goals, { flexible: true })).not.toThrow();
    expect(plan.days[0]!.meals[0]!.alternatives![0]!.name).not.toBe(plan.days[0]!.meals[0]!.name);
    expect(input.days[0]!.meals[0]).not.toHaveProperty('alternatives');
  });
  it('rejects a week with no compatible replacements instead of inventing foods or nutrition', () => {
    expect(() => prepareFlexibleWeeklyPlan(content(), preferences, goals)).toThrow('INVALID_PLAN');
  });
  it('fits complete measured portions to the daily target before deriving replacements, preserving the raw validation', () => {
    const input = content();
    input.days.forEach((day, index) =>
      day.meals.forEach((meal) => {
        meal.name = `Synthetic varied dish ${index}`;
        meal.calories = 600;
        meal.protein = 35 + index * 0.5;
        meal.carbs = 70 - index * 0.5;
        meal.fat = 20;
      }),
    );
    expect(() => validateWeeklyPlan(input, preferences, goals)).toThrow('INVALID_PLAN');
    const plan = prepareFlexibleWeeklyPlan(input, preferences, goals);
    expect(planDayNutrition(plan.days[0]!).calories).toBe(2100);
    expect(plan.days[0]!.meals[0]!.ingredients).toEqual(['rice 175 g', 'lentils 233.33 g']);
    expect(input.days[0]!.meals[0]!.ingredients).toEqual(['rice 150g', 'lentils 200g']);
    expect(() => validateWeeklyPlan(plan, preferences, goals, { flexible: true })).not.toThrow();
  });
  const flexible = () => {
    const plan = content();
    return {
      ...plan,
      days: plan.days.map((day, index) => ({
        ...day,
        meals: day.meals.map((meal) => ({
          ...meal,
          name: index % 2 ? 'Lentil khichdi' : meal.name,
          alternatives: [
            {
              ...meal,
              name: 'Potato and lentils',
              ingredients: ['potato 180g', 'lentils 250g'],
              protein: 42,
              carbs: 88,
            },
            {
              ...meal,
              name: 'Chickpea rice',
              ingredients: ['chickpea 180g', 'rice 140g'],
              protein: 38,
              carbs: 92,
            },
          ],
        })),
      })),
    };
  };
  it('validates varied full-week meals and independently measured replacements', () => {
    const plan = validateWeeklyPlan(flexible(), preferences, goals, { flexible: true });
    expect(
      plan.days.every((day) => day.meals.every((meal) => meal.alternatives?.length === 2)),
    ).toBe(true);
    expect(planDayNutrition(plan.days[0]!)).toEqual({
      calories: 2100,
      protein: 120,
      carbs: 270,
      fat: 60,
    });
  });
  it('rejects missing replacements, consecutive repeated mains and allergens in an alternative', () => {
    expect(() => validateWeeklyPlan(content(), preferences, goals, { flexible: true })).toThrow();
    const repeated = flexible();
    repeated.days[1]!.meals[0]!.name = repeated.days[0]!.meals[0]!.name;
    expect(() => validateWeeklyPlan(repeated, preferences, goals, { flexible: true })).toThrow();
    const allergen = flexible();
    allergen.days[0]!.meals[0]!.alternatives[0]!.ingredients = ['cashew 50g'];
    expect(() =>
      validateWeeklyPlan(allergen, { ...preferences, allergies: ['nuts'] }, goals, {
        flexible: true,
      }),
    ).toThrow();
  });
  it('rejects alternatives whose combined swaps would drop a day below its floor', () => {
    const plan = flexible();
    plan.days.forEach((day) =>
      day.meals.forEach((meal) => {
        meal.calories = 630;
        meal.protein = 36;
        meal.carbs = 81;
        meal.fat = 18;
        meal.alternatives.forEach((option) => {
          option.calories = 570;
          option.protein = 34;
          option.carbs = 73;
          option.fat = 16;
        });
      }),
    );
    expect(() => validateWeeklyPlan(plan, preferences, goals, { flexible: true })).toThrow();
  });
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
