import {
  calculateDiaryTotals,
  copyEntries,
  DEV_100_FOOD_SEED,
  getMealSectionForTime,
  scaleNutrients,
  type CreateFoodInput,
  type DiaryDaySummary,
  type EntrySource,
  type Food,
  type FoodEntry,
  type FoodSource,
  type MealSection,
  type SavedMeal,
  type UpdateFoodEntryInput,
  type UpdateFoodInput,
  type UserFoodStats,
} from '@calipartner/core';
import { createLogger } from '@/lib/logger';
import {
  enqueueOutbox,
  type SyncDb,
} from './syncService';
import bundledFoodsJson from '../../assets/bundled_foods.json';

const log = createLogger('foodService');

/** Simple client-side UUID v4 generator for offline idempotency */
export function generateClientUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Initializes local bundled foods if local_foods is currently empty.
 * Populates from bundled_foods.json (2,351 Indian foods & barcodes) shipped inside the app bundle,
 * with DEV_100_FOOD_SEED fallback.
 */
export async function ensureBundledFoodsSeeded(db: SyncDb): Promise<number> {
  const countRow = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM local_foods WHERE source != 'user'`,
  );

  if (countRow && countRow.count > 0) {
    return 0; // Already seeded
  }

  const foodsToSeed =
    Array.isArray(bundledFoodsJson) && bundledFoodsJson.length > 0
      ? (bundledFoodsJson as unknown as CreateFoodInput[])
      : DEV_100_FOOD_SEED;

  const now = new Date().toISOString();
  let inserted = 0;
  const BATCH_SIZE = 40;

  for (let i = 0; i < foodsToSeed.length; i += BATCH_SIZE) {
    const chunk = foodsToSeed.slice(i, i + BATCH_SIZE);
    const placeholders: string[] = [];
    const values: unknown[] = [];

    for (const f of chunk) {
      const foodId = f.id || `f-bundled-${inserted + 1}`;
      const unitsJson = JSON.stringify(f.serving_units ?? [{ unit: 'g', grams: 1 }]);
      placeholders.push('(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, NULL, \'synced\')');
      values.push(
        foodId,
        f.source ?? 'ifct',
        f.name,
        f.brand ?? null,
        f.barcode ?? null,
        unitsJson,
        f.calories_per_100g,
        f.protein_per_100g,
        f.carbs_per_100g,
        f.fat_per_100g,
        f.fiber_per_100g ?? 0,
        f.sugar_per_100g ?? 0,
        f.sodium_mg_per_100g ?? 0,
        f.attribution ?? null,
        now,
        now,
      );
      inserted += 1;
    }

    const sql = `INSERT INTO local_foods (
      id, source, name, brand, barcode, serving_units,
      calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g,
      fiber_per_100g, sugar_per_100g, sodium_mg_per_100g,
      owner_id, attribution, created_at, updated_at, deleted_at, sync_state
    ) VALUES ${placeholders.join(', ')}
    ON CONFLICT (id) DO NOTHING`;

    await db.runAsync(sql, ...values);
  }

  log.info(`Seeded ${inserted} bundled foods into local SQLite`);
  return inserted;
}

export interface RawFoodRow {
  id: string;
  source: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  serving_units: string;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  fiber_per_100g: number;
  sugar_per_100g: number;
  sodium_mg_per_100g: number;
  owner_id: string | null;
  attribution: string | null;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

/**
 * Parses raw local_foods row into typed Food object.
 */
export function mapRowToFood(row: RawFoodRow): Food {
  let servingUnits: Food['serving_units'] = [];
  try {
    servingUnits = typeof row.serving_units === 'string'
      ? JSON.parse(row.serving_units)
      : row.serving_units || [];
  } catch {
    servingUnits = [{ unit: 'g', grams: 1 }];
  }

  return {
    id: row.id,
    source: (row.source as FoodSource) || 'ifct',
    name: row.name,
    brand: row.brand ?? null,
    barcode: row.barcode ?? null,
    serving_units: servingUnits,
    calories_per_100g: Number(row.calories_per_100g) || 0,
    protein_per_100g: Number(row.protein_per_100g) || 0,
    carbs_per_100g: Number(row.carbs_per_100g) || 0,
    fat_per_100g: Number(row.fat_per_100g) || 0,
    fiber_per_100g: Number(row.fiber_per_100g) || 0,
    sugar_per_100g: Number(row.sugar_per_100g) || 0,
    sodium_mg_per_100g: Number(row.sodium_mg_per_100g) || 0,
    owner_id: row.owner_id ?? null,
    attribution: row.attribution ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at ?? null,
  };
}

/**
 * Searches local foods (custom foods, cached foods, bundled foods).
 * PRD LOG-1 order: custom foods first, then database foods.
 */
export async function searchLocalFoods(
  db: SyncDb,
  query: string,
  userId?: string,
  limit = 40,
): Promise<Food[]> {
  const cleanQuery = query.trim().toLowerCase();
  if (!cleanQuery) return [];

  const pattern = `%${cleanQuery}%`;
  const rows = await db.getAllAsync<RawFoodRow>(
    `SELECT * FROM local_foods
     WHERE deleted_at IS NULL
       AND (LOWER(name) LIKE ? OR (brand IS NOT NULL AND LOWER(brand) LIKE ?))
       AND (owner_id IS NULL OR owner_id = ?)
     ORDER BY
       CASE WHEN owner_id IS NOT NULL AND owner_id = ? THEN 0 ELSE 1 END ASC,
       CASE WHEN LOWER(name) = ? THEN 0 WHEN LOWER(name) LIKE ? THEN 1 ELSE 2 END ASC,
       name ASC
     LIMIT ?`,
    [pattern, pattern, userId ?? '', userId ?? '', cleanQuery, `${cleanQuery}%`, limit],
  );

  return rows.map(mapRowToFood);
}

/**
 * Looks up food by barcode in local database.
 */
export async function findLocalFoodByBarcode(
  db: SyncDb,
  barcode: string,
): Promise<Food | null> {
  const clean = barcode.trim();
  if (!clean) return null;

  const row = await db.getFirstAsync<RawFoodRow>(
    `SELECT * FROM local_foods WHERE barcode = ? AND deleted_at IS NULL LIMIT 1`,
    [clean],
  );

  return row ? mapRowToFood(row) : null;
}

/**
 * Fetches remote food details via Edge Function `food-lookup` or Supabase.
 */
export async function lookupRemoteFood(
  supabase: { functions?: { invoke: (fn: string, opts: { body: Record<string, unknown> }) => Promise<{ data?: Record<string, unknown> | null; error?: unknown }> } },
  params: { barcode?: string; text?: string },
): Promise<Food | null> {
  try {
    if (!supabase.functions) return null;
    const { data, error } = await supabase.functions.invoke('food-lookup', {
      body: params,
    });

    if (error || !data) {
      return null;
    }

    if (data.product) {
      return data.product as Food;
    }
    if (Array.isArray(data.results) && data.results.length > 0) {
      return data.results[0] as Food;
    }
    return null;
  } catch (e) {
    log.info(`Remote lookup failed or offline: ${e}`);
    return null;
  }
}

/**
 * Saves or updates a custom food.
 * Custom foods have source='user', owner_id=userId, and are enqueued into outbox.
 */
export async function saveCustomFood(
  db: SyncDb,
  userId: string,
  input: CreateFoodInput | (UpdateFoodInput & { id: string }),
): Promise<Food> {
  const now = new Date().toISOString();
  const id = ('id' in input && input.id) ? input.id : generateClientUuid();
  const servingUnits = input.serving_units ?? [{ unit: 'serving', grams: 100 }, { unit: 'g', grams: 1 }];
  const unitsJson = JSON.stringify(servingUnits);

  const food: Food = {
    id,
    source: 'user',
    name: input.name ?? 'Custom Food',
    brand: input.brand ?? null,
    barcode: input.barcode ?? null,
    serving_units: servingUnits,
    calories_per_100g: input.calories_per_100g ?? 0,
    protein_per_100g: input.protein_per_100g ?? 0,
    carbs_per_100g: input.carbs_per_100g ?? 0,
    fat_per_100g: input.fat_per_100g ?? 0,
    fiber_per_100g: input.fiber_per_100g ?? 0,
    sugar_per_100g: input.sugar_per_100g ?? 0,
    sodium_mg_per_100g: input.sodium_mg_per_100g ?? 0,
    owner_id: userId,
    attribution: 'User custom food',
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };

  await db.runAsync(
    `INSERT INTO local_foods (
      id, source, name, brand, barcode, serving_units,
      calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g,
      fiber_per_100g, sugar_per_100g, sodium_mg_per_100g,
      owner_id, attribution, created_at, updated_at, deleted_at, sync_state
    ) VALUES (?, 'user', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'pending')
    ON CONFLICT (id) DO UPDATE SET
      name = excluded.name,
      brand = excluded.brand,
      barcode = excluded.barcode,
      serving_units = excluded.serving_units,
      calories_per_100g = excluded.calories_per_100g,
      protein_per_100g = excluded.protein_per_100g,
      carbs_per_100g = excluded.carbs_per_100g,
      fat_per_100g = excluded.fat_per_100g,
      fiber_per_100g = excluded.fiber_per_100g,
      sugar_per_100g = excluded.sugar_per_100g,
      sodium_mg_per_100g = excluded.sodium_mg_per_100g,
      updated_at = excluded.updated_at,
      sync_state = 'pending'`,
    [
      food.id,
      food.name,
      food.brand,
      food.barcode,
      unitsJson,
      food.calories_per_100g,
      food.protein_per_100g,
      food.carbs_per_100g,
      food.fat_per_100g,
      food.fiber_per_100g,
      food.sugar_per_100g,
      food.sodium_mg_per_100g,
      userId,
      food.attribution,
      now,
      now,
    ],
  );

  // Enqueue to outbox for sync
  await enqueueOutbox(db, {
    id: food.id,
    entity: 'foods',
    operation: 'upsert',
    payload: {
      id: food.id,
      source: 'user',
      name: food.name,
      brand: food.brand,
      barcode: food.barcode,
      serving_units: food.serving_units,
      calories_per_100g: food.calories_per_100g,
      protein_per_100g: food.protein_per_100g,
      carbs_per_100g: food.carbs_per_100g,
      fat_per_100g: food.fat_per_100g,
      fiber_per_100g: food.fiber_per_100g,
      sugar_per_100g: food.sugar_per_100g,
      sodium_mg_per_100g: food.sodium_mg_per_100g,
      owner_id: userId,
      attribution: food.attribution,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    },
  });

  return food;
}

/**
 * Fetches all custom foods created by user.
 */
export async function getCustomFoods(db: SyncDb, userId: string): Promise<Food[]> {
  const rows = await db.getAllAsync<RawFoodRow>(
    `SELECT * FROM local_foods WHERE owner_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC`,
    [userId],
  );
  return rows.map(mapRowToFood);
}

/**
 * Adds a food entry to the local diary, computes nutrient snapshot,
 * updates user food stats, and enqueues sync.
 */
export async function logFoodEntry(
  db: SyncDb,
  input: {
    userId: string;
    food: Food;
    mealSection?: MealSection;
    quantity: number;
    unit: string;
    localDate?: string;
    source?: EntrySource;
    sharedMealId?: string | null;
  },
): Promise<FoodEntry> {
  const id = generateClientUuid();
  const now = new Date().toISOString();
  const localDate = input.localDate ?? now.slice(0, 10);
  const section = input.mealSection ?? getMealSectionForTime(now);
  const source = input.source ?? 'search';

  // Compute live nutrient snapshot via core formula
  const nutrients = scaleNutrients(input.food, input.quantity, input.unit);

  const entry: FoodEntry = {
    id,
    user_id: input.userId,
    food_id: input.food.id,
    meal_section: section,
    quantity: input.quantity,
    unit: input.unit,
    calories: nutrients.calories,
    protein: nutrients.protein,
    carbs: nutrients.carbs,
    fat: nutrients.fat,
    fiber: nutrients.fiber,
    sugar: nutrients.sugar,
    sodium_mg: nutrients.sodium_mg,
    food_name: input.food.name,
    brand_name: input.food.brand ?? null,
    logged_at: now,
    local_date: localDate,
    source,
    shared_meal_id: input.sharedMealId ?? null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };

  // 1. Insert local entry
  await db.runAsync(
    `INSERT INTO local_food_entries (
      id, user_id, food_id, meal_section, quantity, unit,
      calories, protein, carbs, fat, fiber, sugar, sodium_mg,
      food_name, brand_name, logged_at, local_date, source,
      shared_meal_id, created_at, updated_at, deleted_at, sync_state
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'pending')`,
    [
      entry.id,
      entry.user_id,
      entry.food_id,
      entry.meal_section,
      entry.quantity,
      entry.unit,
      entry.calories,
      entry.protein,
      entry.carbs,
      entry.fat,
      entry.fiber,
      entry.sugar,
      entry.sodium_mg,
      entry.food_name,
      entry.brand_name,
      entry.logged_at,
      entry.local_date,
      entry.source,
      entry.shared_meal_id,
      entry.created_at,
      entry.updated_at,
    ],
  );

  // 2. Update user food stats (for smart suggestions & previously logged)
  if (input.food.id) {
    await db.runAsync(
      `INSERT INTO local_user_food_stats (
        user_id, food_id, use_count, last_used_at, last_quantity, last_unit, last_meal_section, hidden, updated_at, sync_state
      ) VALUES (?, ?, 1, ?, ?, ?, ?, 0, ?, 'pending')
      ON CONFLICT (user_id, food_id) DO UPDATE SET
        use_count = local_user_food_stats.use_count + 1,
        last_used_at = excluded.last_used_at,
        last_quantity = excluded.last_quantity,
        last_unit = excluded.last_unit,
        last_meal_section = excluded.last_meal_section,
        hidden = 0,
        updated_at = excluded.updated_at,
        sync_state = 'pending'`,
      [
        input.userId,
        input.food.id,
        now,
        input.quantity,
        input.unit,
        section,
        now,
      ],
    );

    // Enqueue stats to outbox
    const statsRow = await db.getFirstAsync<{
      user_id: string;
      food_id: string;
      use_count: number;
      last_used_at: string;
      last_quantity: number;
      last_unit: string;
      last_meal_section: MealSection;
      hidden: number;
      updated_at: string;
    }>(
      `SELECT * FROM local_user_food_stats WHERE user_id = ? AND food_id = ?`,
      [input.userId, input.food.id],
    );
    if (statsRow) {
      await enqueueOutbox(db, {
        id: `stats-${input.userId}-${input.food.id}`,
        entity: 'user_food_stats',
        operation: 'upsert',
        payload: {
          user_id: input.userId,
          food_id: input.food.id,
          use_count: statsRow.use_count,
          last_used_at: statsRow.last_used_at,
          last_quantity: statsRow.last_quantity,
          last_unit: statsRow.last_unit,
          last_meal_section: statsRow.last_meal_section,
          hidden: Boolean(statsRow.hidden),
          updated_at: statsRow.updated_at,
        },
      });
    }
  }

  // 3. Enqueue entry to outbox
  await enqueueOutbox(db, {
    id: entry.id,
    entity: 'food_entries',
    operation: 'upsert',
    payload: {
      id: entry.id,
      user_id: entry.user_id,
      food_id: entry.food_id,
      meal_section: entry.meal_section,
      quantity: entry.quantity,
      unit: entry.unit,
      calories: entry.calories,
      protein: entry.protein,
      carbs: entry.carbs,
      fat: entry.fat,
      fiber: entry.fiber,
      sugar: entry.sugar,
      sodium_mg: entry.sodium_mg,
      food_name: entry.food_name,
      brand_name: entry.brand_name,
      logged_at: entry.logged_at,
      local_date: entry.local_date,
      source: entry.source,
      shared_meal_id: entry.shared_meal_id,
      updated_at: entry.updated_at,
      deleted_at: null,
    },
  });

  return entry;
}

/**
 * Edits an existing food entry.
 * Recalculates nutrient snapshot if quantity, unit or food changed.
 */
export async function editFoodEntry(
  db: SyncDb,
  entryId: string,
  updates: UpdateFoodEntryInput,
  food?: Food | null,
): Promise<FoodEntry | null> {
  const current = await db.getFirstAsync<FoodEntry>(
    `SELECT * FROM local_food_entries WHERE id = ? AND deleted_at IS NULL`,
    [entryId],
  );
  if (!current) return null;

  const now = new Date().toISOString();
  const quantity = updates.quantity ?? current.quantity;
  const unit = updates.unit ?? current.unit;
  const mealSection = updates.meal_section ?? current.meal_section;
  const localDate = updates.local_date ?? current.local_date;

  let calories = current.calories;
  let protein = current.protein;
  let carbs = current.carbs;
  let fat = current.fat;
  let fiber = current.fiber;
  let sugar = current.sugar;
  let sodiumMg = current.sodium_mg;

  // Recalculate nutrients if food provided or if quantity changed
  if (food) {
    const scaled = scaleNutrients(food, quantity, unit);
    calories = scaled.calories;
    protein = scaled.protein;
    carbs = scaled.carbs;
    fat = scaled.fat;
    fiber = scaled.fiber;
    sugar = scaled.sugar;
    sodiumMg = scaled.sodium_mg;
  } else if (updates.quantity !== undefined && current.quantity > 0) {
    // Proportional scaling
    const factor = updates.quantity / current.quantity;
    calories = Math.round(current.calories * factor * 10) / 10;
    protein = Math.round(current.protein * factor * 10) / 10;
    carbs = Math.round(current.carbs * factor * 10) / 10;
    fat = Math.round(current.fat * factor * 10) / 10;
  }

  await db.runAsync(
    `UPDATE local_food_entries SET
      quantity = ?,
      unit = ?,
      meal_section = ?,
      local_date = ?,
      calories = ?,
      protein = ?,
      carbs = ?,
      fat = ?,
      fiber = ?,
      sugar = ?,
      sodium_mg = ?,
      updated_at = ?,
      sync_state = 'pending'
     WHERE id = ?`,
    [
      quantity,
      unit,
      mealSection,
      localDate,
      calories,
      protein,
      carbs,
      fat,
      fiber,
      sugar,
      sodiumMg,
      now,
      entryId,
    ],
  );

  const updatedEntry: FoodEntry = {
    ...current,
    quantity,
    unit,
    meal_section: mealSection,
    local_date: localDate,
    calories,
    protein,
    carbs,
    fat,
    fiber,
    sugar,
    sodium_mg: sodiumMg,
    updated_at: now,
  };

  await enqueueOutbox(db, {
    id: entryId,
    entity: 'food_entries',
    operation: 'upsert',
    payload: {
      id: updatedEntry.id,
      user_id: updatedEntry.user_id,
      food_id: updatedEntry.food_id,
      meal_section: updatedEntry.meal_section,
      quantity: updatedEntry.quantity,
      unit: updatedEntry.unit,
      calories: updatedEntry.calories,
      protein: updatedEntry.protein,
      carbs: updatedEntry.carbs,
      fat: updatedEntry.fat,
      fiber: updatedEntry.fiber,
      sugar: updatedEntry.sugar,
      sodium_mg: updatedEntry.sodium_mg,
      food_name: updatedEntry.food_name,
      brand_name: updatedEntry.brand_name,
      logged_at: updatedEntry.logged_at,
      local_date: updatedEntry.local_date,
      source: updatedEntry.source,
      shared_meal_id: updatedEntry.shared_meal_id,
      updated_at: updatedEntry.updated_at,
      deleted_at: null,
    },
  });

  return updatedEntry;
}

/**
 * Soft deletes a food entry (sets deleted_at = now() and enqueues sync).
 */
export async function deleteFoodEntry(db: SyncDb, entryId: string): Promise<boolean> {
  const current = await db.getFirstAsync<FoodEntry>(
    `SELECT * FROM local_food_entries WHERE id = ?`,
    [entryId],
  );
  if (!current) return false;

  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE local_food_entries SET deleted_at = ?, updated_at = ?, sync_state = 'pending' WHERE id = ?`,
    [now, now, entryId],
  );

  await enqueueOutbox(db, {
    id: entryId,
    entity: 'food_entries',
    operation: 'delete',
    payload: {
      id: entryId,
      deleted_at: now,
      updated_at: now,
    },
  });

  return true;
}

/**
 * Loads all active food entries for a specific user and local date.
 */
export async function getEntriesForDate(
  db: SyncDb,
  userId: string,
  localDate: string,
): Promise<FoodEntry[]> {
  const rows = await db.getAllAsync<FoodEntry>(
    `SELECT * FROM local_food_entries
     WHERE user_id = ? AND local_date = ? AND deleted_at IS NULL
     ORDER BY logged_at ASC`,
    [userId, localDate],
  );

  return rows.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    food_id: r.food_id ?? null,
    meal_section: r.meal_section as MealSection,
    quantity: Number(r.quantity),
    unit: r.unit,
    calories: Number(r.calories),
    protein: Number(r.protein),
    carbs: Number(r.carbs),
    fat: Number(r.fat),
    fiber: Number(r.fiber) || 0,
    sugar: Number(r.sugar) || 0,
    sodium_mg: Number(r.sodium_mg) || 0,
    food_name: r.food_name,
    brand_name: r.brand_name ?? null,
    logged_at: r.logged_at,
    local_date: r.local_date,
    source: r.source as EntrySource,
    shared_meal_id: r.shared_meal_id ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at,
    deleted_at: r.deleted_at ?? null,
  }));
}

/**
 * Returns complete diary summary (sections & totals) for a date.
 */
export async function getDiaryDaySummary(
  db: SyncDb,
  userId: string,
  localDate: string,
): Promise<DiaryDaySummary> {
  const entries = await getEntriesForDate(db, userId, localDate);
  return calculateDiaryTotals(entries, localDate);
}

interface HistoryJoinedRow {
  user_id: string;
  food_id: string;
  use_count: number;
  last_used_at: string;
  last_quantity: number;
  last_unit: string;
  last_meal_section: string;
  hidden: number;
  updated_at: string;
  f_id: string;
  f_source: string;
  f_name: string;
  f_brand: string | null;
  f_barcode: string | null;
  f_units: string;
  f_cal: number;
  f_pro: number;
  f_carb: number;
  f_fat: number;
  f_fib: number;
  f_sug: number;
  f_sod: number;
  f_owner: string | null;
  f_attr: string | null;
  f_created?: string;
  f_updated?: string;
  f_deleted?: string | null;
}

/**
 * Fetches previously logged foods with usage stats.
 */
export async function getPreviouslyLoggedItems(
  db: SyncDb,
  userId: string,
): Promise<Array<{ stats: UserFoodStats; food: Food }>> {
  const rows = await db.getAllAsync<HistoryJoinedRow>(
    `SELECT s.*, f.id as f_id, f.source as f_source, f.name as f_name, f.brand as f_brand,
            f.barcode as f_barcode, f.serving_units as f_units, f.calories_per_100g as f_cal,
            f.protein_per_100g as f_pro, f.carbs_per_100g as f_carb, f.fat_per_100g as f_fat,
            f.fiber_per_100g as f_fib, f.sugar_per_100g as f_sug, f.sodium_mg_per_100g as f_sod,
            f.owner_id as f_owner, f.attribution as f_attr, f.created_at as f_created,
            f.updated_at as f_updated, f.deleted_at as f_deleted
     FROM local_user_food_stats s
     JOIN local_foods f ON s.food_id = f.id
     WHERE s.user_id = ? AND s.hidden = 0 AND f.deleted_at IS NULL
     ORDER BY s.last_used_at DESC`,
    [userId],
  );

  return rows.map((r) => {
    let units: Food['serving_units'] = [];
    try {
      units = typeof r.f_units === 'string' ? JSON.parse(r.f_units) : r.f_units || [];
    } catch {
      units = [{ unit: 'g', grams: 1 }];
    }

    const food: Food = {
      id: r.f_id,
      source: (r.f_source as FoodSource) || 'ifct',
      name: r.f_name,
      brand: r.f_brand ?? null,
      barcode: r.f_barcode ?? null,
      serving_units: units,
      calories_per_100g: Number(r.f_cal) || 0,
      protein_per_100g: Number(r.f_pro) || 0,
      carbs_per_100g: Number(r.f_carb) || 0,
      fat_per_100g: Number(r.f_fat) || 0,
      fiber_per_100g: Number(r.f_fib) || 0,
      sugar_per_100g: Number(r.f_sug) || 0,
      sodium_mg_per_100g: Number(r.f_sod) || 0,
      owner_id: r.f_owner ?? null,
      attribution: r.f_attr ?? null,
      created_at: r.f_created,
      updated_at: r.f_updated,
      deleted_at: r.f_deleted ?? null,
    };

    const stats: UserFoodStats = {
      user_id: r.user_id,
      food_id: r.food_id,
      use_count: r.use_count,
      last_used_at: r.last_used_at,
      last_quantity: Number(r.last_quantity),
      last_unit: r.last_unit,
      last_meal_section: r.last_meal_section as MealSection,
      hidden: Boolean(r.hidden),
      updated_at: r.updated_at,
    };

    return { stats, food };
  });
}

/**
 * Removes a food from history by setting hidden = 1 in stats without deleting entries (PRD LOG-15).
 */
export async function hideFoodFromHistory(
  db: SyncDb,
  userId: string,
  foodId: string,
): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE local_user_food_stats SET hidden = 1, updated_at = ?, sync_state = 'pending' WHERE user_id = ? AND food_id = ?`,
    [now, userId, foodId],
  );

  await enqueueOutbox(db, {
    id: `stats-${userId}-${foodId}`,
    entity: 'user_food_stats',
    operation: 'upsert',
    payload: {
      user_id: userId,
      food_id: foodId,
      hidden: true,
      updated_at: now,
    },
  });
}

/**
 * Copies a single meal section from one date to another date/section (PRD LOG-7).
 */
export async function copyMealSection(
  db: SyncDb,
  userId: string,
  sourceDate: string,
  sourceSection: MealSection,
  targetDate: string,
  targetSection?: MealSection,
): Promise<FoodEntry[]> {
  const sourceEntries = (await getEntriesForDate(db, userId, sourceDate)).filter(
    (e) => e.meal_section === sourceSection,
  );

  const copied = copyEntries(sourceEntries, {
    local_date: targetDate,
    meal_section: targetSection ?? sourceSection,
    user_id: userId,
    newIdGenerator: generateClientUuid,
  });

  for (const entry of copied) {
    await db.runAsync(
      `INSERT INTO local_food_entries (
        id, user_id, food_id, meal_section, quantity, unit,
        calories, protein, carbs, fat, fiber, sugar, sodium_mg,
        food_name, brand_name, logged_at, local_date, source,
        shared_meal_id, created_at, updated_at, deleted_at, sync_state
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'copy', NULL, ?, ?, NULL, 'pending')`,
      [
        entry.id,
        entry.user_id,
        entry.food_id,
        entry.meal_section,
        entry.quantity,
        entry.unit,
        entry.calories,
        entry.protein,
        entry.carbs,
        entry.fat,
        entry.fiber,
        entry.sugar,
        entry.sodium_mg,
        entry.food_name,
        entry.brand_name,
        entry.logged_at,
        entry.local_date,
        entry.created_at,
        entry.updated_at,
      ],
    );

    await enqueueOutbox(db, {
      id: entry.id,
      entity: 'food_entries',
      operation: 'upsert',
      payload: {
        id: entry.id,
        user_id: entry.user_id,
        food_id: entry.food_id,
        meal_section: entry.meal_section,
        quantity: entry.quantity,
        unit: entry.unit,
        calories: entry.calories,
        protein: entry.protein,
        carbs: entry.carbs,
        fat: entry.fat,
        fiber: entry.fiber,
        sugar: entry.sugar,
        sodium_mg: entry.sodium_mg,
        food_name: entry.food_name,
        brand_name: entry.brand_name,
        logged_at: entry.logged_at,
        local_date: entry.local_date,
        source: 'copy',
        shared_meal_id: null,
        updated_at: entry.updated_at,
        deleted_at: null,
      },
    });
  }

  return copied;
}

/**
 * Copies an entire day's meals to another date (PRD LOG-7).
 */
export async function copyEntireDay(
  db: SyncDb,
  userId: string,
  sourceDate: string,
  targetDate: string,
): Promise<FoodEntry[]> {
  const sourceEntries = await getEntriesForDate(db, userId, sourceDate);

  const copied = copyEntries(sourceEntries, {
    local_date: targetDate,
    user_id: userId,
    newIdGenerator: generateClientUuid,
  });

  for (const entry of copied) {
    await db.runAsync(
      `INSERT INTO local_food_entries (
        id, user_id, food_id, meal_section, quantity, unit,
        calories, protein, carbs, fat, fiber, sugar, sodium_mg,
        food_name, brand_name, logged_at, local_date, source,
        shared_meal_id, created_at, updated_at, deleted_at, sync_state
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'copy', NULL, ?, ?, NULL, 'pending')`,
      [
        entry.id,
        entry.user_id,
        entry.food_id,
        entry.meal_section,
        entry.quantity,
        entry.unit,
        entry.calories,
        entry.protein,
        entry.carbs,
        entry.fat,
        entry.fiber,
        entry.sugar,
        entry.sodium_mg,
        entry.food_name,
        entry.brand_name,
        entry.logged_at,
        entry.local_date,
        entry.created_at,
        entry.updated_at,
      ],
    );

    await enqueueOutbox(db, {
      id: entry.id,
      entity: 'food_entries',
      operation: 'upsert',
      payload: {
        id: entry.id,
        user_id: entry.user_id,
        food_id: entry.food_id,
        meal_section: entry.meal_section,
        quantity: entry.quantity,
        unit: entry.unit,
        calories: entry.calories,
        protein: entry.protein,
        carbs: entry.carbs,
        fat: entry.fat,
        fiber: entry.fiber,
        sugar: entry.sugar,
        sodium_mg: entry.sodium_mg,
        food_name: entry.food_name,
        brand_name: entry.brand_name,
        logged_at: entry.logged_at,
        local_date: entry.local_date,
        source: 'copy',
        shared_meal_id: null,
        updated_at: entry.updated_at,
        deleted_at: null,
      },
    });
  }

  return copied;
}

/**
 * Creates and saves a reusable meal (PRD LOG-8).
 */
export async function saveMeal(
  db: SyncDb,
  userId: string,
  name: string,
  entries: FoodEntry[],
): Promise<SavedMeal> {
  const id = generateClientUuid();
  const now = new Date().toISOString();

  let total_calories = 0;
  let total_protein = 0;
  let total_carbs = 0;
  let total_fat = 0;

  const items = entries.map((e) => {
    total_calories += e.calories;
    total_protein += e.protein;
    total_carbs += e.carbs;
    total_fat += e.fat;
    return {
      food_id: e.food_id ?? '',
      food_name: e.food_name,
      brand_name: e.brand_name,
      quantity: e.quantity,
      unit: e.unit,
      calories: e.calories,
      protein: e.protein,
      carbs: e.carbs,
      fat: e.fat,
      fiber: e.fiber,
    };
  });

  const savedMeal: SavedMeal = {
    id,
    user_id: userId,
    name,
    items,
    total_calories: Math.round(total_calories * 10) / 10,
    total_protein: Math.round(total_protein * 10) / 10,
    total_carbs: Math.round(total_carbs * 10) / 10,
    total_fat: Math.round(total_fat * 10) / 10,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };

  await db.runAsync(
    `INSERT INTO local_saved_meals (
      id, user_id, name, items, total_calories, total_protein, total_carbs, total_fat, created_at, updated_at, deleted_at, sync_state
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'pending')`,
    [
      savedMeal.id,
      savedMeal.user_id,
      savedMeal.name,
      JSON.stringify(savedMeal.items),
      savedMeal.total_calories,
      savedMeal.total_protein,
      savedMeal.total_carbs,
      savedMeal.total_fat,
      now,
      now,
    ],
  );

  await enqueueOutbox(db, {
    id: savedMeal.id,
    entity: 'saved_meals',
    operation: 'upsert',
    payload: {
      ...savedMeal,
    },
  });

  return savedMeal;
}

export interface RawSavedMealRow {
  id: string;
  user_id: string;
  name: string;
  items: string;
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/**
 * Gets all saved meals for user.
 */
export async function getSavedMeals(db: SyncDb, userId: string): Promise<SavedMeal[]> {
  const rows = await db.getAllAsync<RawSavedMealRow>(
    `SELECT * FROM local_saved_meals WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`,
    [userId],
  );

  return rows.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    name: r.name,
    items: JSON.parse(r.items),
    total_calories: Number(r.total_calories),
    total_protein: Number(r.total_protein),
    total_carbs: Number(r.total_carbs),
    total_fat: Number(r.total_fat),
    created_at: r.created_at,
    updated_at: r.updated_at,
    deleted_at: r.deleted_at ?? null,
  }));
}
