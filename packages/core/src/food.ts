import type {
  DiaryDaySummary,
  DiarySectionSummary,
  Food,
  FoodEntry,
  MealSection,
  NutrientSnapshot,
  UserFoodStats,
} from './types';

/** Standard conversion map in grams (or ml) for common household units */
export const STANDARD_SERVING_GRAMS: Readonly<Record<string, number>> = {
  g: 1,
  gram: 1,
  grams: 1,
  ml: 1,
  milliliter: 1,
  milliliters: 1,
  piece: 100,
  pc: 100,
  bowl: 150,
  katori: 150,
  cup: 240,
  tbsp: 15,
  tablespoon: 15,
  tsp: 5,
  teaspoon: 5,
  slice: 30,
  plate: 300,
  glass: 250,
  scoop: 30,
  serving: 100,
};

export const MEAL_SECTIONS: readonly MealSection[] = [
  'breakfast',
  'lunch',
  'dinner',
  'snacks',
  'extra',
] as const;

/**
 * Resolves how many grams a single unit represents for a given food.
 * Checks the food's custom serving_units first, then falls back to standard household units.
 */
export function resolveUnitGrams(
  food: Pick<Food, 'serving_units'> | null | undefined,
  unit: string,
): number {
  const normalized = unit.trim().toLowerCase();

  if (food?.serving_units && food.serving_units.length > 0) {
    const matched = food.serving_units.find(
      (su) => su.unit.trim().toLowerCase() === normalized,
    );
    if (matched && matched.grams > 0) {
      return matched.grams;
    }
  }

  const standard = STANDARD_SERVING_GRAMS[normalized];
  if (standard !== undefined && standard > 0) {
    return standard;
  }

  // Default fallback if totally unrecognized
  return 100;
}

function roundOneDecimal(num: number): number {
  return Math.round(num * 10) / 10;
}

/**
 * Scales nutrient values per 100g according to the quantity and chosen unit.
 */
export function scaleNutrients(
  food: Food,
  quantity: number,
  unit: string,
): NutrientSnapshot {
  if (quantity <= 0) {
    return {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sugar: 0,
      sodium_mg: 0,
    };
  }

  const gramsPerUnit = resolveUnitGrams(food, unit);
  const totalGrams = quantity * gramsPerUnit;
  const factor = totalGrams / 100;

  return {
    calories: roundOneDecimal(food.calories_per_100g * factor),
    protein: roundOneDecimal(food.protein_per_100g * factor),
    carbs: roundOneDecimal(food.carbs_per_100g * factor),
    fat: roundOneDecimal(food.fat_per_100g * factor),
    fiber: roundOneDecimal((food.fiber_per_100g || 0) * factor),
    sugar: roundOneDecimal((food.sugar_per_100g || 0) * factor),
    sodium_mg: roundOneDecimal((food.sodium_mg_per_100g || 0) * factor),
  };
}

/**
 * Calculates per-section subtotals and whole-day totals from a list of food entries.
 * Soft-deleted entries (deleted_at != null) are excluded.
 */
export function calculateDiaryTotals(
  entries: readonly FoodEntry[],
  localDate?: string,
): DiaryDaySummary {
  const activeEntries = entries.filter((e) => !e.deleted_at);

  const initSection = (section: MealSection): DiarySectionSummary => ({
    section,
    entries: [],
    count: 0,
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    sugar: 0,
    sodium_mg: 0,
  });

  const sections: Record<MealSection, DiarySectionSummary> = {
    breakfast: initSection('breakfast'),
    lunch: initSection('lunch'),
    dinner: initSection('dinner'),
    snacks: initSection('snacks'),
    extra: initSection('extra'),
  };

  const totals = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    sugar: 0,
    sodium_mg: 0,
    entryCount: 0,
  };

  for (const entry of activeEntries) {
    const sec = sections[entry.meal_section] ?? sections.extra;
    sec.entries.push(entry);
    sec.count += 1;
    sec.calories = roundOneDecimal(sec.calories + entry.calories);
    sec.protein = roundOneDecimal(sec.protein + entry.protein);
    sec.carbs = roundOneDecimal(sec.carbs + entry.carbs);
    sec.fat = roundOneDecimal(sec.fat + entry.fat);
    sec.fiber = roundOneDecimal(sec.fiber + (entry.fiber || 0));
    sec.sugar = roundOneDecimal(sec.sugar + (entry.sugar || 0));
    sec.sodium_mg = roundOneDecimal(sec.sodium_mg + (entry.sodium_mg || 0));

    totals.calories = roundOneDecimal(totals.calories + entry.calories);
    totals.protein = roundOneDecimal(totals.protein + entry.protein);
    totals.carbs = roundOneDecimal(totals.carbs + entry.carbs);
    totals.fat = roundOneDecimal(totals.fat + entry.fat);
    totals.fiber = roundOneDecimal(totals.fiber + (entry.fiber || 0));
    totals.sugar = roundOneDecimal(totals.sugar + (entry.sugar || 0));
    totals.sodium_mg = roundOneDecimal(totals.sodium_mg + (entry.sodium_mg || 0));
    totals.entryCount += 1;
  }

  const determinedDate =
    localDate ?? activeEntries[0]?.local_date ?? new Date().toISOString().slice(0, 10);

  return {
    local_date: determinedDate,
    sections,
    totals,
  };
}

/**
 * Determines default meal section based on the time of day:
 * 05:00 - 10:59: Breakfast
 * 11:00 - 15:29: Lunch
 * 15:30 - 18:29: Snacks
 * 18:30 - 22:59: Dinner
 * 23:00 - 04:59: Extra
 */
export function getMealSectionForTime(
  dateOrIso?: Date | string,
  timezone?: string,
): MealSection {
  const d = dateOrIso
    ? typeof dateOrIso === 'string'
      ? new Date(dateOrIso)
      : dateOrIso
    : new Date();

  let hour = d.getHours();
  let minute = d.getMinutes();

  if (timezone) {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        minute: 'numeric',
        hour12: false,
      }).formatToParts(d);

      const hPart = parts.find((p) => p.type === 'hour');
      const mPart = parts.find((p) => p.type === 'minute');
      if (hPart && mPart) {
        hour = parseInt(hPart.value, 10) % 24;
        minute = parseInt(mPart.value, 10);
      }
    } catch {
      // Fallback to local system time
    }
  }

  const minutesFromMidnight = hour * 60 + minute;

  // 05:00 = 300, 11:00 = 660, 15:30 = 930, 18:30 = 1110, 23:00 = 1380
  if (minutesFromMidnight >= 300 && minutesFromMidnight < 660) {
    return 'breakfast';
  }
  if (minutesFromMidnight >= 660 && minutesFromMidnight < 930) {
    return 'lunch';
  }
  if (minutesFromMidnight >= 930 && minutesFromMidnight < 1110) {
    return 'snacks';
  }
  if (minutesFromMidnight >= 1110 && minutesFromMidnight < 1380) {
    return 'dinner';
  }
  return 'extra';
}

/**
 * Filters and sorts previously logged items according to PRD 6.3 LOG-12.
 * Sort options: Recent, Frequent, A-Z.
 * Optional filter by meal section and search query.
 */
export function filterAndSortHistory<T extends { stats: UserFoodStats; food: Food }>(
  items: readonly T[],
  options: {
    sort?: 'recent' | 'frequent' | 'alpha';
    section?: MealSection;
    query?: string;
  } = {},
): T[] {
  const { sort = 'recent', section, query } = options;

  let filtered = items.filter((item) => !item.stats.hidden && !item.food.deleted_at);

  if (section) {
    filtered = filtered.filter((item) => item.stats.last_meal_section === section);
  }

  if (query && query.trim().length > 0) {
    const q = query.trim().toLowerCase();
    filtered = filtered.filter(
      (item) =>
        item.food.name.toLowerCase().includes(q) ||
        (item.food.brand && item.food.brand.toLowerCase().includes(q)),
    );
  }

  return [...filtered].sort((a, b) => {
    if (sort === 'frequent') {
      if (b.stats.use_count !== a.stats.use_count) {
        return b.stats.use_count - a.stats.use_count;
      }
      return new Date(b.stats.last_used_at).getTime() - new Date(a.stats.last_used_at).getTime();
    }
    if (sort === 'alpha') {
      return a.food.name.localeCompare(b.food.name);
    }
    // Default 'recent'
    return new Date(b.stats.last_used_at).getTime() - new Date(a.stats.last_used_at).getTime();
  });
}

/**
 * Returns top foods per section over the last 30 days by frequency count (PRD 6.3 LOG-14).
 * Deterministic frequency count, not AI.
 */
export function calculateSectionSuggestions(
  entries: readonly FoodEntry[],
  section: MealSection,
  cutoffDays = 30,
): Array<{
  food_id: string;
  food_name: string;
  brand_name: string | null;
  count: number;
  last_quantity: number;
  last_unit: string;
}> {
  const now = Date.now();
  const cutoffTime = now - cutoffDays * 24 * 60 * 60 * 1000;

  const relevant = entries.filter((e) => {
    if (e.deleted_at) return false;
    if (e.meal_section !== section) return false;
    if (!e.food_id) return false;
    const t = new Date(e.logged_at).getTime();
    return !isNaN(t) && t >= cutoffTime;
  });

  const map = new Map<
    string,
    {
      food_id: string;
      food_name: string;
      brand_name: string | null;
      count: number;
      last_quantity: number;
      last_unit: string;
      last_logged_time: number;
    }
  >();

  for (const entry of relevant) {
    const foodId = entry.food_id!;
    const entryTime = new Date(entry.logged_at).getTime();
    const existing = map.get(foodId);

    if (!existing) {
      map.set(foodId, {
        food_id: foodId,
        food_name: entry.food_name,
        brand_name: entry.brand_name,
        count: 1,
        last_quantity: entry.quantity,
        last_unit: entry.unit,
        last_logged_time: entryTime,
      });
    } else {
      existing.count += 1;
      if (entryTime >= existing.last_logged_time) {
        existing.last_quantity = entry.quantity;
        existing.last_unit = entry.unit;
        existing.food_name = entry.food_name;
        existing.brand_name = entry.brand_name;
        existing.last_logged_time = entryTime;
      }
    }
  }

  return Array.from(map.values())
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return b.last_logged_time - a.last_logged_time;
    })
    .slice(0, 10)
    .map(({ food_id, food_name, brand_name, count, last_quantity, last_unit }) => ({
      food_id,
      food_name,
      brand_name,
      count,
      last_quantity,
      last_unit,
    }));
}

/**
 * Copies a list of food entries to a target date and/or section.
 * PRD 6.3 LOG-7: Each copied entry gets a new client UUID, source='copy', and logged_at=now.
 */
export function copyEntries(
  entries: readonly FoodEntry[],
  target: {
    local_date: string;
    meal_section?: MealSection;
    user_id?: string;
    newIdGenerator: () => string;
    timestampGenerator?: () => string;
  },
): FoodEntry[] {
  const now = target.timestampGenerator ? target.timestampGenerator() : new Date().toISOString();

  return entries
    .filter((e) => !e.deleted_at)
    .map((e) => ({
      id: target.newIdGenerator(),
      user_id: target.user_id ?? e.user_id,
      food_id: e.food_id,
      meal_section: target.meal_section ?? e.meal_section,
      quantity: e.quantity,
      unit: e.unit,
      calories: e.calories,
      protein: e.protein,
      carbs: e.carbs,
      fat: e.fat,
      fiber: e.fiber,
      sugar: e.sugar,
      sodium_mg: e.sodium_mg,
      food_name: e.food_name,
      brand_name: e.brand_name,
      logged_at: now,
      local_date: target.local_date,
      source: 'copy' as const,
      shared_meal_id: null,
      updated_at: now,
      deleted_at: null,
      created_at: now,
    }));
}
