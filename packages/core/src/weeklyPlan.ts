export const WEEK_DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;
export function weeklyPlanDayIndex(localDate: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate)) throw new Error('INVALID_DATE');
  const date = new Date(localDate + 'T12:00:00Z');
  if (!Number.isFinite(date.getTime())) throw new Error('INVALID_DATE');
  return (date.getUTCDay() + 6) % 7;
}
export const PLAN_EQUIPMENT = [
  'bodyweight',
  'dumbbell',
  'barbell',
  'bench',
  'band',
  'pullup',
  'cable',
  'legpress',
  'treadmill',
  'bike',
] as const;
export type PlanEquipment = (typeof PLAN_EQUIPMENT)[number];
export interface PlanPreferences {
  workout_days: number[];
  location: 'home' | 'basic' | 'advanced';
  equipment: PlanEquipment[];
  experience: 'beginner' | 'intermediate' | 'experienced';
  session_minutes: number;
  limitations: string;
  country: string;
  cuisine: string;
  diet: 'mixed' | 'vegetarian' | 'vegan' | 'pescatarian';
  allergies: string[];
  exclusions: string[];
  meals_per_day: number;
  cooking_minutes: number;
  budget: 'economical' | 'flexible';
}
export interface PlanExercise {
  name: string;
  equipment: PlanEquipment;
  sets: number;
  reps: number;
  rest_seconds: number;
}
export interface PlanMeal {
  name: string;
  ingredients: string[];
  portion: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}
export interface PlanDay {
  day: number;
  workout: { title: string; minutes: number; exercises: PlanExercise[] };
  meals: PlanMeal[];
}
export interface WeeklyPlanContent {
  days: PlanDay[];
  workout_tips: string[];
  diet_tips: string[];
}
export interface WeeklyPlanView {
  id: string;
  preferences: PlanPreferences;
  days: PlanDay[];
  workout_tips: string[];
  diet_tips: string[];
  full_access: boolean;
  revision: number;
}
export interface PlanGoals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  calorie_floor: number;
}
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_PLAN');
  return value as Record<string, unknown>;
};
const text = (value: unknown, max = 250, empty = false): string => {
  if (typeof value !== 'string' || value.length > max || (!empty && !value.trim()))
    throw new Error('INVALID_PLAN');
  return value.trim();
};
const number = (value: unknown, min: number, max: number, integer = true): number => {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    (integer && !Number.isInteger(value))
  )
    throw new Error('INVALID_PLAN');
  return value;
};
function choice<T extends string>(value: unknown, choices: readonly T[]): T {
  if (!choices.includes(value as T)) throw new Error('INVALID_PLAN');
  return value as T;
}
const strings = (value: unknown, min: number, max: number, length = 250) => {
  if (!Array.isArray(value) || value.length < min || value.length > max)
    throw new Error('INVALID_PLAN');
  return value.map((item) => text(item, length));
};
export function validatePlanPreferences(input: unknown): PlanPreferences {
  const p = object(input);
  if (
    !Array.isArray(p.workout_days) ||
    p.workout_days.length < 1 ||
    p.workout_days.length > 6 ||
    new Set(p.workout_days).size !== p.workout_days.length
  )
    throw new Error('INVALID_PLAN');
  const location = choice(p.location, ['home', 'basic', 'advanced']);
  const equipment = strings(p.equipment, 1, PLAN_EQUIPMENT.length).map((e) =>
    choice(e, PLAN_EQUIPMENT),
  );
  if (location !== 'advanced' && equipment.some((e) => ['cable', 'legpress'].includes(e)))
    throw new Error('INVALID_PLAN');
  return {
    workout_days: p.workout_days.map((day) => number(day, 0, 6)).sort(),
    location,
    equipment: [...new Set(equipment)],
    experience: choice(p.experience, ['beginner', 'intermediate', 'experienced']),
    session_minutes: number(p.session_minutes, 15, 90),
    limitations: text(p.limitations, 500, true),
    country: text(p.country, 80),
    cuisine: text(p.cuisine, 200),
    diet: choice(p.diet, ['mixed', 'vegetarian', 'vegan', 'pescatarian']),
    allergies: strings(p.allergies, 0, 20, 80),
    exclusions: strings(p.exclusions, 0, 20, 80),
    meals_per_day: number(p.meals_per_day, 3, 5),
    cooking_minutes: number(p.cooking_minutes, 5, 90),
    budget: choice(p.budget, ['economical', 'flexible']),
  };
}
export function validatePlanExercises(
  input: unknown,
  preferences: PlanPreferences,
): PlanExercise[] {
  if (!Array.isArray(input) || input.length > 8) throw new Error('INVALID_PLAN');
  return input.map((value) => {
    const e = object(value),
      equipment = choice(e.equipment, preferences.equipment);
    return {
      name: text(e.name, 100),
      equipment,
      sets: number(e.sets, 1, 5),
      reps: number(e.reps, 5, 30),
      rest_seconds: number(e.rest_seconds, 30, 180),
    };
  });
}
/** All model arithmetic and constraints are checked before private storage. */
export function validateWeeklyPlan(
  input: unknown,
  preferences: PlanPreferences,
  goals: PlanGoals,
): WeeklyPlanContent {
  const plan = object(input);
  if (!Array.isArray(plan.days) || plan.days.length !== 7) throw new Error('INVALID_PLAN');
  const forbidden = [...preferences.allergies, ...preferences.exclusions].filter(
    (value) => !/^none$/i.test(value),
  );
  const meat = ['chicken', 'beef', 'pork', 'mutton', 'lamb', 'turkey', 'bacon', 'gelatin'];
  if (preferences.diet !== 'mixed') forbidden.push(...meat);
  if (['vegetarian', 'vegan'].includes(preferences.diet))
    forbidden.push('fish', 'salmon', 'tuna', 'shrimp', 'prawn');
  if (preferences.diet === 'vegan')
    forbidden.push(
      'milk',
      'cheese',
      'paneer',
      'yogurt',
      'yoghurt',
      'butter',
      'ghee',
      'egg',
      'honey',
      'whey',
    );
  const allergenAliases: Record<string, string[]> = {
    milk: ['milk', 'cheese', 'paneer', 'yogurt', 'yoghurt', 'butter', 'ghee', 'whey', 'cream'],
    dairy: ['milk', 'cheese', 'paneer', 'yogurt', 'yoghurt', 'butter', 'ghee', 'whey', 'cream'],
    nuts: ['almond', 'walnut', 'cashew', 'peanut', 'pistachio', 'pecan', 'hazelnut'],
    gluten: ['wheat', 'barley', 'rye', 'bread', 'pasta', 'semolina', 'couscous'],
    soy: ['soy', 'tofu', 'tempeh', 'edamame'],
    eggs: ['egg', 'mayonnaise'],
  };
  for (const allergy of preferences.allergies)
    forbidden.push(...(allergenAliases[allergy.toLowerCase()] ?? []));
  const safeText = (value: string) => {
    const lower = value.toLowerCase();
    if (
      forbidden.some((word) =>
        new RegExp(
          `\\b${word.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:s|es)?\\b`,
          'i',
        ).test(lower),
      )
    )
      throw new Error('INVALID_PLAN');
    if (/detox|cure|crash diet|skip meals|starv|ignore pain|no pain no gain/i.test(lower))
      throw new Error('INVALID_PLAN');
    return value;
  };
  const days = plan.days.map((value, index): PlanDay => {
    const d = object(value),
      workout = object(d.workout);
    if (d.day !== index) throw new Error('INVALID_PLAN');
    const exercises = validatePlanExercises(workout.exercises, preferences);
    const training = preferences.workout_days.includes(index);
    if (training !== exercises.length > 0) throw new Error('INVALID_PLAN');
    const minutes = number(
      workout.minutes,
      training ? 15 : 0,
      training ? preferences.session_minutes : 0,
    );
    if (!Array.isArray(d.meals) || d.meals.length !== preferences.meals_per_day)
      throw new Error('INVALID_PLAN');
    const meals = d.meals.map((value): PlanMeal => {
      const m = object(value);
      const name = safeText(text(m.name, 120)),
        ingredients = strings(m.ingredients, 1, 20, 150).map(safeText),
        portion = safeText(text(m.portion, 250));
      const calories = number(m.calories, 50, 3000, false),
        protein = number(m.protein, 0, 200, false),
        carbs = number(m.carbs, 0, 400, false),
        fat = number(m.fat, 0, 150, false);
      const macroCalories = 4 * (protein + carbs) + 9 * fat;
      if (Math.abs(macroCalories - calories) > Math.max(30, calories * 0.2))
        throw new Error('INVALID_PLAN');
      return { name, ingredients, portion, calories, protein, carbs, fat };
    });
    const total = meals.reduce((sum, meal) => sum + meal.calories, 0);
    if (
      total < Math.max(goals.calorie_floor, goals.calories * 0.9) ||
      total > goals.calories * 1.15
    )
      throw new Error('INVALID_PLAN');
    for (const macro of ['protein', 'carbs', 'fat'] as const) {
      const totalMacro = meals.reduce((sum, meal) => sum + meal[macro], 0);
      if (Math.abs(totalMacro - goals[macro]) > Math.max(10, goals[macro] * 0.3))
        throw new Error('INVALID_PLAN');
    }
    return {
      day: index,
      workout: {
        title: text(workout.title, 120),
        minutes,
        exercises: exercises.map((e) => ({ ...e, name: safeText(e.name) })),
      },
      meals,
    };
  });
  return {
    days,
    workout_tips: strings(plan.workout_tips, 1, 5, 400).map(safeText),
    diet_tips: strings(plan.diet_tips, 1, 5, 400).map(safeText),
  };
}
export function planDayNutrition(day: PlanDay) {
  return day.meals.reduce(
    (total, meal) => ({
      calories: total.calories + meal.calories,
      protein: total.protein + meal.protein,
      carbs: total.carbs + meal.carbs,
      fat: total.fat + meal.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}
