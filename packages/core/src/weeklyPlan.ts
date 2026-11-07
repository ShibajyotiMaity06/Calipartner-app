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
  section?: 'breakfast' | 'lunch' | 'dinner' | 'snacks';
  alternatives?: Omit<PlanMeal, 'alternatives'>[];
  name: string;
  ingredients: string[];
  portion: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}
export const ONE_DAY_MEAL_SECTIONS = ['breakfast', 'lunch', 'dinner', 'snacks'] as const;
export function hasStructuredDayMeals(day: Pick<PlanDay, 'meals'>): boolean {
  return (
    day.meals.length === 4 &&
    ONE_DAY_MEAL_SECTIONS.every((section, index) => day.meals[index]?.section === section)
  );
}
export interface PlanDay {
  day: number;
  workout: { title: string; minutes: number; exercises: PlanExercise[] };
  meals: PlanMeal[];
}

/** Explicit meal labels win; ambiguous dishes use the caller's stored-zone meal time. */
export function plannedMealSection(
  name: string,
  fallback: 'breakfast' | 'lunch' | 'dinner' | 'snacks',
): 'breakfast' | 'lunch' | 'dinner' | 'snacks' {
  if (/\bbreakfast\b/i.test(name)) return 'breakfast';
  if (/\blunch\b/i.test(name)) return 'lunch';
  if (/\bdinner\b/i.test(name)) return 'dinner';
  if (/\bsnacks?\b/i.test(name)) return 'snacks';
  if (/\b(oats?|eggs?|smoothie)\b/i.test(name)) return 'breakfast';
  if (/\b(salad|sandwich|wrap)\b/i.test(name)) return 'lunch';
  if (/\b(steak|rice|curry|chicken)\b/i.test(name)) return 'dinner';
  return fallback;
}

/** Uses only days already disclosed by the server's access-filtered plan response. */
export function weeklyGroceryItems(days: readonly PlanDay[]): string[] {
  const unique = new Map<string, string>();
  for (const day of days) {
    for (const meal of day.meals) {
      for (const value of meal.ingredients) {
        const item = value.trim().replace(/\s+/g, ' ');
        const key = item.toLocaleLowerCase('en');
        if (item && !unique.has(key)) unique.set(key, item);
      }
    }
  }
  return [...unique.values()].sort((a, b) => a.localeCompare(b, 'en'));
}
export interface WeeklyPlanContent {
  days: PlanDay[];
  workout_tips: string[];
  diet_tips: string[];
}
export interface WeeklyPlanView {
  scope?: 'day' | 'week';
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
export class WeeklyPlanValidationError extends Error {
  constructor(
    readonly reason:
      | 'shape'
      | 'text_limits'
      | 'numeric_limits'
      | 'unsupported_choice'
      | 'list_limits'
      | 'week_days'
      | 'training_schedule'
      | 'meal_count'
      | 'excluded_ingredient'
      | 'unsafe_copy'
      | 'meal_energy'
      | 'repeated_meal_nutrition'
      | 'daily_energy'
      | 'daily_macro'
      | 'exercise_sets'
      | 'exercise_reps'
      | 'exercise_rest'
      | 'workout_minutes'
      | 'meal_calories'
      | 'meal_macro',

    readonly repair?: string,
  ) {
    super('INVALID_PLAN');
  }
}
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new WeeklyPlanValidationError('shape');
  return value as Record<string, unknown>;
};
const text = (value: unknown, max = 250, empty = false): string => {
  if (typeof value !== 'string' || value.length > max || (!empty && !value.trim()))
    throw new WeeklyPlanValidationError('text_limits');
  return value.trim();
};
const number = (
  value: unknown,
  min: number,
  max: number,
  integer = true,
  reason: WeeklyPlanValidationError['reason'] = 'numeric_limits',
): number => {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    (integer && !Number.isInteger(value))
  )
    throw new WeeklyPlanValidationError(reason);
  return value;
};
function choice<T extends string>(value: unknown, choices: readonly T[]): T {
  if (!choices.includes(value as T)) throw new WeeklyPlanValidationError('unsupported_choice');
  return value as T;
}
const strings = (value: unknown, min: number, max: number, length = 250) => {
  if (!Array.isArray(value) || value.length < min || value.length > max)
    throw new WeeklyPlanValidationError('list_limits');
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
      sets: number(e.sets, 1, 5, true, 'exercise_sets'),
      reps: number(e.reps, 5, 30, true, 'exercise_reps'),
      rest_seconds: number(e.rest_seconds, 30, 180, true, 'exercise_rest'),
    };
  });
}
/** Detect blanket nutrition copied onto different measured recipes, while allowing batch meals. */
export function hasRepeatedMealNutrition(days: readonly Pick<PlanDay, 'meals'>[]): boolean {
  const recipesByNutrition = new Map<string, Set<string>>();
  const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');
  for (const day of days) {
    const dailyNutrition = new Set<string>(),
      dailyRecipes = new Set<string>();
    for (const meal of day.meals) {
      const nutrition = JSON.stringify([meal.calories, meal.protein, meal.carbs, meal.fat]);
      // Labels alone can change for the same food. Ingredient order is not a new recipe.
      const recipe = JSON.stringify([
        meal.ingredients.map(normalize).sort(),
        normalize(meal.portion),
      ]);
      dailyNutrition.add(nutrition);
      dailyRecipes.add(recipe);
      const recipes = recipesByNutrition.get(nutrition) ?? new Set<string>();
      recipes.add(recipe);
      recipesByNutrition.set(nutrition, recipes);
      if (recipes.size >= 3) return true;
    }
    if (day.meals.length >= 3 && dailyNutrition.size === 1 && dailyRecipes.size > 1) return true;
  }
  return false;
}
/** All model arithmetic and constraints are checked before private storage. */
export function validateWeeklyPlan(
  input: unknown,
  preferences: PlanPreferences,
  goals: PlanGoals,
  options: { flexible?: boolean; normalizePortions?: boolean; singleDay?: boolean } = {},
): WeeklyPlanContent {
  const plan = object(input);
  if (!Array.isArray(plan.days) || plan.days.length !== (options.singleDay ? 1 : 7))
    throw new WeeklyPlanValidationError('week_days');
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
      throw new WeeklyPlanValidationError('excluded_ingredient');
    if (/detox|cure|crash diet|skip meals|starv|ignore pain|no pain no gain/i.test(lower))
      throw new WeeklyPlanValidationError('unsafe_copy');
    return value;
  };
  const unscaledDays: Pick<PlanDay, 'meals'>[] = [];
  const days = plan.days.map((value, index): PlanDay => {
    const d = object(value),
      workout = object(d.workout);
    if (d.day !== index) throw new WeeklyPlanValidationError('week_days');
    const exercises = validatePlanExercises(workout.exercises, preferences);
    const training = options.singleDay
      ? preferences.workout_days.length > 0
      : preferences.workout_days.includes(index);
    if (training !== exercises.length > 0) throw new WeeklyPlanValidationError('training_schedule');
    const minutes = number(
      workout.minutes,
      training ? 15 : 0,
      training ? preferences.session_minutes : 0,
      true,
      'workout_minutes',
    );
    if (
      !Array.isArray(d.meals) ||
      d.meals.length !== (options.singleDay ? 4 : preferences.meals_per_day)
    )
      throw new WeeklyPlanValidationError('meal_count');
    const parseMeal = (value: unknown, mealIndex: number): PlanMeal => {
      const m = object(value);
      const section = options.singleDay ? ONE_DAY_MEAL_SECTIONS[mealIndex] : undefined;
      if (options.singleDay && m.section !== section)
        throw new WeeklyPlanValidationError(
          'meal_count',
          'Provide exactly four meals in this order, each with its section: breakfast, lunch, dinner, snacks. Choose dishes appropriate to each section and the saved dietary preferences.',
        );
      const name = safeText(text(m.name, 120)),
        ingredients = strings(m.ingredients, 1, 20, 150).map(safeText),
        portion = safeText(text(m.portion, 250));
      const calories = number(m.calories, 50, 3000, false, 'meal_calories'),
        protein = number(m.protein, 0, 200, false, 'meal_macro'),
        carbs = number(m.carbs, 0, 400, false, 'meal_macro'),
        fat = number(m.fat, 0, 150, false, 'meal_macro');
      const macroCalories = 4 * (protein + carbs) + 9 * fat;
      if (Math.abs(macroCalories - calories) > Math.max(30, calories * 0.2))
        throw new WeeklyPlanValidationError(
          'meal_energy',
          `Day ${index}, meal ${mealIndex}: reported ${calories} kcal but 4*protein+4*carbs+9*fat is ${macroCalories} kcal. Re-estimate this meal from its measured ingredients and correct the inconsistent nutrition, then recheck the daily totals.`,
        );
      return {
        ...(section ? { section } : {}),
        name,
        ingredients,
        portion,
        calories,
        protein,
        carbs,
        fat,
      };
    };
    let meals = d.meals.map((value, mealIndex): PlanMeal => {
      const meal = parseMeal(value, mealIndex);
      const alternatives = object(value).alternatives;
      if (options.flexible && (!Array.isArray(alternatives) || alternatives.length !== 2))
        throw new WeeklyPlanValidationError(
          'list_limits',
          'Every meal needs exactly two measured alternatives, each with its own ingredients, portion and nutrition.',
        );
      if (alternatives !== undefined) {
        if (!Array.isArray(alternatives) || alternatives.length > 2)
          throw new WeeklyPlanValidationError('list_limits');
        meal.alternatives = alternatives.map((option) => parseMeal(option, mealIndex));
        if (
          new Set([meal, ...meal.alternatives].map((option) => option.name.trim().toLowerCase()))
            .size !==
          meal.alternatives.length + 1
        )
          throw new WeeklyPlanValidationError(
            'list_limits',
            'Use different dishes for each alternative.',
          );
        for (const option of meal.alternatives) {
          if (
            Math.abs(option.calories - meal.calories) > meal.calories * 0.1 ||
            (['protein', 'carbs', 'fat'] as const).some(
              (key) => Math.abs(option[key] - meal[key]) > Math.max(10, meal[key] * 0.25),
            )
          )
            throw new WeeklyPlanValidationError(
              'daily_macro',
              'Adjust measured alternative portions to stay within 10% of the main meal calories and within 25% or 10g of each macro.',
            );
        }
        if (hasRepeatedMealNutrition([{ meals: [meal, ...meal.alternatives] }]))
          throw new WeeklyPlanValidationError(
            'repeated_meal_nutrition',
            'Calculate each replacement from its own ingredients; do not copy the main meal nutrition.',
          );
      }
      return meal;
    });
    unscaledDays.push({ meals });
    let total = meals.reduce((sum, meal) => sum + meal.calories, 0);
    if (options.normalizePortions) {
      meals = fitPlanDayPortions(meals, goals);
      total = meals.reduce((sum, meal) => sum + meal.calories, 0);
    }
    if (
      total < Math.max(goals.calorie_floor, goals.calories * 0.9) ||
      total > goals.calories * 1.15
    )
      throw new WeeklyPlanValidationError(
        'daily_energy',
        `Day ${index}: meal calories sum to ${total}; required range is ${Math.max(goals.calorie_floor, goals.calories * 0.9)} to ${goals.calories * 1.15} kcal. Adjust actual measured portions or ingredients and recalculate, without changing saved goals.`,
      );
    for (const macro of ['protein', 'carbs', 'fat'] as const) {
      const totalMacro = meals.reduce((sum, meal) => sum + meal[macro], 0);
      if (Math.abs(totalMacro - goals[macro]) > Math.max(10, goals[macro] * 0.3))
        throw new WeeklyPlanValidationError(
          'daily_macro',
          `Day ${index}: ${macro} sums to ${totalMacro}g versus saved goal ${goals[macro]}g, outside the allowed difference of ${Math.max(10, goals[macro] * 0.3)}g. Adjust measured ingredients/portions and recheck all meal energy and daily totals.`,
        );
    }
    if (options.flexible) {
      const range = (key: 'calories' | 'protein' | 'carbs' | 'fat', select: typeof Math.min) =>
        meals.reduce(
          (sum, meal) =>
            sum + select(...[meal, ...(meal.alternatives ?? [])].map((option) => option[key])),
          0,
        );
      if (
        range('calories', Math.min) < Math.max(goals.calorie_floor, goals.calories * 0.9) ||
        range('calories', Math.max) > goals.calories * 1.15 ||
        (['protein', 'carbs', 'fat'] as const).some(
          (key) =>
            range(key, Math.min) < goals[key] - Math.max(10, goals[key] * 0.3) ||
            range(key, Math.max) > goals[key] + Math.max(10, goals[key] * 0.3),
        )
      )
        throw new WeeklyPlanValidationError(
          'daily_macro',
          'Every combination of one option per meal must meet the daily calorie floor, daily energy range and macro limits. Rebalance actual portions of the alternatives.',
        );
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
  if (hasRepeatedMealNutrition(unscaledDays) || hasRepeatedMealNutrition(days))
    throw new WeeklyPlanValidationError('repeated_meal_nutrition');
  if (options.flexible) {
    for (let i = 1; i < days.length; i++) {
      const previous = new Set(days[i - 1]!.meals.map((meal) => meal.name.toLowerCase().trim()));
      if (days[i]!.meals.some((meal) => previous.has(meal.name.toLowerCase().trim())))
        throw new WeeklyPlanValidationError(
          'list_limits',
          'Do not repeat a main dish from the previous day. Plan different meals across the week.',
        );
    }
  }
  return {
    days,
    workout_tips: strings(plan.workout_tips, 1, 5, 400).map(safeText),
    diet_tips: strings(plan.diet_tips, 1, 5, 400).map(safeText),
  };
}
/** Scale actual measured ingredients and their existing estimates together; never synthesize nutrition. */
export function scalePlanMeal(meal: PlanMeal, factor: number): Omit<PlanMeal, 'alternatives'> {
  if (!Number.isFinite(factor) || factor < 0.1 || factor > 2)
    throw new WeeklyPlanValidationError('numeric_limits');
  const round = (value: number) => Math.round(value * 10) / 10;
  const multiplier = Math.round(factor * 1000) / 1000;
  const measured = (value: string) => {
    let changed = false;
    const result = value.replace(
      /(\d+(?:\.\d+)?)\s*((?:(?:small|medium|large|whole|cooked|raw)\s+)?(?:kg|grams?|g|ml|litres?|liters?|l|tablespoons?|teaspoons?|tbsp|tsp|cups?|bowls?|servings?|pieces?|slices?|eggs?))\b/gi,
      (_match, amount: string, unit: string) => {
        changed = true;
        return `${Math.round(Number(amount) * factor * 100) / 100} ${unit}`;
      },
    );
    return changed ? result : `${multiplier} × (${value})`;
  };
  return {
    ...(meal.section ? { section: meal.section } : {}),
    name: meal.name,
    ingredients: meal.ingredients.map(measured),
    portion: factor === 1 ? meal.portion : `${multiplier} × (${meal.portion})`,
    calories: round(meal.calories * factor),
    protein: round(meal.protein * factor),
    carbs: round(meal.carbs * factor),
    fat: round(meal.fat * factor),
  };
}

/** Bounded calorie transfers fit actual recipe portions; the final validator still enforces every target. */
export function fitPlanDayPortions(meals: PlanMeal[], goals: PlanGoals): PlanMeal[] {
  const sum = meals.reduce((total, meal) => total + meal.calories, 0),
    factor = goals.calories / sum;
  if (!Number.isFinite(factor) || factor < 0.5 || factor > 2)
    throw new WeeklyPlanValidationError('daily_energy');
  const keys = ['protein', 'carbs', 'fat'] as const;
  const calories = meals.map((meal) => meal.calories * factor);
  const density = meals.map((meal) =>
    keys.map((key) => meal[key] / meal.calories / Math.max(10, goals[key])),
  );
  for (let iteration = 0; iteration < 64; iteration++) {
    const error = keys.map(
      (key, k) =>
        calories.reduce((total, value, i) => total + value * density[i]![k]!, 0) -
        goals[key] / Math.max(10, goals[key]),
    );
    let best: { from: number; to: number; amount: number; improvement: number } | null = null;
    for (let from = 0; from < meals.length; from++)
      for (let to = from + 1; to < meals.length; to++) {
        const direction = keys.map((_, k) => density[to]![k]! - density[from]![k]!);
        const square = direction.reduce((total, value) => total + value * value, 0);
        if (square < 1e-12) continue;
        const dot = error.reduce((total, value, k) => total + value * direction[k]!, 0);
        const lower = -Math.min(
          meals[from]!.calories * 2 - calories[from]!,
          calories[to]! - meals[to]!.calories * 0.5,
        );
        const upper = Math.min(
          calories[from]! - meals[from]!.calories * 0.5,
          meals[to]!.calories * 2 - calories[to]!,
        );
        const amount = Math.max(lower, Math.min(upper, -dot / square));
        const improvement = -(2 * amount * dot + amount * amount * square);
        if (improvement > 1e-9 && (!best || improvement > best.improvement))
          best = { from, to, amount, improvement };
      }
    if (!best) break;
    calories[best.from]! -= best.amount;
    calories[best.to]! += best.amount;
  }
  return meals.map((meal, i) => {
    const scale = Math.max(0.5, Math.min(2, calories[i]! / meal.calories));
    if (Math.abs(scale - 1) < 1e-8) return meal;
    return {
      ...scalePlanMeal(meal, scale),
      ...(meal.alternatives
        ? { alternatives: meal.alternatives.map((option) => scalePlanMeal(option, scale)) }
        : {}),
    };
  });
}

/** Derive two replacements from the AI's validated varied week, without tripling provider output. */
export function prepareFlexibleWeeklyPlan(
  input: unknown,
  preferences: PlanPreferences,
  goals: PlanGoals,
): WeeklyPlanContent {
  const suppliedDays = object(input).days;
  if (
    Array.isArray(suppliedDays) &&
    suppliedDays.length === 7 &&
    suppliedDays.every((value) => {
      const meals = object(value).meals;
      return (
        Array.isArray(meals) &&
        meals.every((value) => {
          const alternatives = object(value).alternatives;
          return Array.isArray(alternatives) && alternatives.length === 2;
        })
      );
    })
  )
    return validateWeeklyPlan(input, preferences, goals, { flexible: true });
  const plan = validateWeeklyPlan(input, preferences, goals, { normalizePortions: true });
  if (plan.days.every((day) => day.meals.every((meal) => meal.alternatives?.length === 2)))
    return validateWeeklyPlan(plan, preferences, goals, { flexible: true });
  const pool = plan.days.flatMap((day) => day.meals);
  const macroKeys = ['protein', 'carbs', 'fat'] as const;
  const fitsDay = (day: PlanDay) => {
    const range = (key: 'calories' | (typeof macroKeys)[number], select: typeof Math.min) =>
      day.meals.reduce(
        (sum, meal) =>
          sum + select(...[meal, ...(meal.alternatives ?? [])].map((option) => option[key])),
        0,
      );
    return (
      range('calories', Math.min) >= Math.max(goals.calorie_floor, goals.calories * 0.9) &&
      range('calories', Math.max) <= goals.calories * 1.15 &&
      macroKeys.every(
        (key) =>
          range(key, Math.min) >= goals[key] - Math.max(10, goals[key] * 0.3) &&
          range(key, Math.max) <= goals[key] + Math.max(10, goals[key] * 0.3),
      )
    );
  };
  for (const day of plan.days) {
    for (const [slot, meal] of day.meals.entries()) {
      const names = new Set([meal.name.toLowerCase().trim()]);
      const candidates = pool.flatMap((candidate) => {
        const name = candidate.name.toLowerCase().trim();
        if (names.has(name)) return [];
        const factor = meal.calories / candidate.calories;
        if (factor < 0.5 || factor > 2) return [];
        const option = scalePlanMeal(candidate, factor);
        if (
          macroKeys.some(
            (key) => Math.abs(option[key] - meal[key]) > Math.max(10, meal[key] * 0.25),
          ) ||
          macroKeys.every((key) => option[key] === meal[key])
        )
          return [];
        names.add(name);
        return [option];
      });
      // A replacement can combine two other validated dishes from the same meal slot.
      // Each contributes at least a quarter of the meal; no token sprinkling of the original.
      const sameSlot = plan.days
        .map((other) => other.meals[slot]!)
        .filter((other) => other.name.toLowerCase().trim() !== meal.name.toLowerCase().trim());
      const pairOptions = new Map<string, Omit<PlanMeal, 'alternatives'>>();
      const distance = (option: Omit<PlanMeal, 'alternatives'>) =>
        macroKeys.reduce(
          (sum, key) => sum + Math.abs(option[key] - meal[key]) / Math.max(10, meal[key]),
          0,
        );
      for (let a = 0; a < sameSlot.length; a++)
        for (let b = a + 1; b < sameSlot.length; b++)
          for (const share of [0.25, 0.5, 0.75]) {
            const first = sameSlot[a]!,
              second = sameSlot[b]!;
            if (first.name.toLowerCase().trim() === second.name.toLowerCase().trim()) continue;
            const firstScale = (meal.calories * share) / first.calories,
              secondScale = (meal.calories * (1 - share)) / second.calories;
            if (firstScale < 0.1 || firstScale > 2 || secondScale < 0.1 || secondScale > 2)
              continue;
            const one = scalePlanMeal(first, firstScale),
              two = scalePlanMeal(second, secondScale);
            const option = {
              name: first.name.slice(0, 55) + ' + ' + second.name.slice(0, 55),
              portion: one.portion + ' + ' + two.portion,
              ingredients: [...one.ingredients, ...two.ingredients],
              calories: Math.round((one.calories + two.calories) * 10) / 10,
              protein: Math.round((one.protein + two.protein) * 10) / 10,
              carbs: Math.round((one.carbs + two.carbs) * 10) / 10,
              fat: Math.round((one.fat + two.fat) * 10) / 10,
            };
            if (
              option.ingredients.length > 20 ||
              option.portion.length > 250 ||
              macroKeys.some(
                (key) => Math.abs(option[key] - meal[key]) > Math.max(10, meal[key] * 0.25),
              ) ||
              macroKeys.every((key) => option[key] === meal[key])
            )
              continue;
            const key = option.name.toLowerCase().trim(),
              existing = pairOptions.get(key);
            if (!existing || distance(option) < distance(existing)) pairOptions.set(key, option);
          }
      candidates.push(...pairOptions.values());
      candidates.sort(
        (a, b) =>
          macroKeys.reduce(
            (sum, key) => sum + Math.abs(a[key] - meal[key]) / Math.max(5, meal[key]),
            0,
          ) -
          macroKeys.reduce(
            (sum, key) => sum + Math.abs(b[key] - meal[key]) / Math.max(5, meal[key]),
            0,
          ),
      );
      let found = false;
      for (let first = 0; first < candidates.length && !found; first++)
        for (let second = first + 1; second < candidates.length && !found; second++) {
          meal.alternatives = [candidates[first]!, candidates[second]!];
          if (fitsDay(day)) found = true;
        }
      if (!found)
        throw new WeeklyPlanValidationError(
          'daily_macro',
          'Provide more varied dishes with nutritionally similar corresponding meal slots across days. Two different dishes must be substitutable for every meal after proportional portion scaling, within 25% or 10g of each macro. Do not copy nutrition tuples or generate alternatives separately.',
        );
    }
  }
  return validateWeeklyPlan(plan, preferences, goals, { flexible: true });
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
