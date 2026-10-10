import { describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import {
  copyEntireDay,
  copyMealSection,
  deleteFoodEntry,
  editFoodEntry,
  ensureBundledFoodsSeeded,
  findLocalFoodByBarcode,
  getDiaryDaySummary,
  getEntriesForDate,
  getPreviouslyLoggedItems,
  hideFoodFromHistory,
  logFoodEntry,
  saveCustomFood,
  searchLocalFoods,
} from './foodService';
import { getPendingOutboxItems, type SyncDb } from './syncService';

function createTestDb(): SyncDb {
  const sqlite = new DatabaseSync(':memory:');

  sqlite.exec(`
    CREATE TABLE outbox (
      id TEXT PRIMARY KEY NOT NULL,
      entity TEXT NOT NULL,
      operation TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      next_retry_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE local_foods (
      id TEXT PRIMARY KEY NOT NULL,
      source TEXT NOT NULL,
      name TEXT NOT NULL,
      brand TEXT,
      barcode TEXT,
      serving_units TEXT NOT NULL,
      calories_per_100g REAL NOT NULL,
      protein_per_100g REAL NOT NULL,
      carbs_per_100g REAL NOT NULL,
      fat_per_100g REAL NOT NULL,
      fiber_per_100g REAL NOT NULL DEFAULT 0,
      sugar_per_100g REAL NOT NULL DEFAULT 0,
      sodium_mg_per_100g REAL NOT NULL DEFAULT 0,
      owner_id TEXT,
      attribution TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      sync_state TEXT NOT NULL DEFAULT 'synced'
    );

    CREATE TABLE local_food_entries (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      food_id TEXT,
      meal_section TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      calories REAL NOT NULL,
      protein REAL NOT NULL,
      carbs REAL NOT NULL,
      fat REAL NOT NULL,
      fiber REAL NOT NULL DEFAULT 0,
      sugar REAL NOT NULL DEFAULT 0,
      sodium_mg REAL NOT NULL DEFAULT 0,
      food_name TEXT NOT NULL,
      brand_name TEXT,
      logged_at TEXT NOT NULL,
      local_date TEXT NOT NULL,
      source TEXT NOT NULL,
      shared_meal_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      sync_state TEXT NOT NULL DEFAULT 'pending'
    );

    CREATE TABLE local_user_food_stats (
      user_id TEXT NOT NULL,
      food_id TEXT NOT NULL,
      use_count INTEGER NOT NULL DEFAULT 1,
      last_used_at TEXT NOT NULL,
      last_quantity REAL NOT NULL,
      last_unit TEXT NOT NULL,
      last_meal_section TEXT NOT NULL,
      hidden INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      sync_state TEXT NOT NULL DEFAULT 'pending',
      PRIMARY KEY (user_id, food_id)
    );

    CREATE TABLE local_saved_meals (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      items TEXT NOT NULL,
      total_calories REAL NOT NULL DEFAULT 0,
      total_protein REAL NOT NULL DEFAULT 0,
      total_carbs REAL NOT NULL DEFAULT 0,
      total_fat REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      sync_state TEXT NOT NULL DEFAULT 'pending'
    );

    CREATE TABLE sync_cursors (
      entity TEXT PRIMARY KEY NOT NULL,
      last_pulled_at TEXT NOT NULL
    );
  `);

  return {
    async runAsync(sql: string, ...params: unknown[]) {
      const flat = Array.isArray(params[0]) ? params[0] : params;
      const stmt = sqlite.prepare(sql);
      const res = stmt.run(...flat);
      return { changes: res.changes, lastInsertRowId: res.lastInsertRowid };
    },
    async getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]> {
      const flat = Array.isArray(params[0]) ? params[0] : params;
      const stmt = sqlite.prepare(sql);
      return stmt.all(...flat) as T[];
    },
    async getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null> {
      const flat = Array.isArray(params[0]) ? params[0] : params;
      const stmt = sqlite.prepare(sql);
      const rows = stmt.all(...flat);
      return (rows[0] as T) || null;
    },
  };
}

describe('Food Service & Local Database', () => {
  it('seeds bundled foods on initial run and is idempotent', async () => {
    const db = createTestDb();

    const seededFirst = await ensureBundledFoodsSeeded(db);
    expect(seededFirst).toBeGreaterThan(50);

    const seededSecond = await ensureBundledFoodsSeeded(db);
    expect(seededSecond).toBe(0); // already seeded
  });

  it('searches bundled foods instantly offline', async () => {
    const db = createTestDb();
    await ensureBundledFoodsSeeded(db);

    const results = await searchLocalFoods(db, 'roti');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.name.toLowerCase()).toContain('roti');
  });

  it('searches IFCT foods and Indian recipes by regional aliases', async () => {
    const db = createTestDb();
    await ensureBundledFoodsSeeded(db);

    // Search for Poha (from IFCT rice flakes / recipes)
    const pohaResults = await searchLocalFoods(db, 'poha');
    expect(pohaResults.length).toBeGreaterThan(0);

    // Search for Idli (from recipes)
    const idliResults = await searchLocalFoods(db, 'idli');
    expect(idliResults.length).toBeGreaterThan(0);
  });

  it('looks up barcoded packaged foods locally without internet', async () => {
    const db = createTestDb();
    await ensureBundledFoodsSeeded(db);

    // 0035988971028 is Amul Cool KoKo in barcode_products.csv
    const food = await findLocalFoodByBarcode(db, '0035988971028');
    expect(food).not.toBeNull();
    expect(food?.brand).toBe('Amul');
    expect(food?.calories_per_100g).toBeGreaterThan(0);
  });

  it('prioritizes user custom foods over database foods in search', async () => {
    const db = createTestDb();
    await ensureBundledFoodsSeeded(db);

    // Save user custom food
    await saveCustomFood(db, 'user-1', {
      name: 'Custom Roti Special',
      calories_per_100g: 250,
      protein_per_100g: 8,
      carbs_per_100g: 45,
      fat_per_100g: 3,
    });

    const searchRes = await searchLocalFoods(db, 'roti', 'user-1');
    expect(searchRes[0]!.name).toBe('Custom Roti Special');
    expect(searchRes[0]!.owner_id).toBe('user-1');
  });

  it('logs food entry with live scaled snapshot and updates user food stats', async () => {
    const db = createTestDb();
    await ensureBundledFoodsSeeded(db);

    const foods = await searchLocalFoods(db, 'roti');
    const roti = foods[0]!;

    const entry = await logFoodEntry(db, {
      userId: 'user-1',
      food: roti,
      mealSection: 'breakfast',
      quantity: 2,
      unit: 'piece', // each piece is 40g -> 80g total
      localDate: '2026-10-08',
    });

    expect(entry.quantity).toBe(2);
    expect(entry.unit).toBe('piece');
    expect(entry.calories).toBeGreaterThan(0);
    expect(entry.protein).toBeGreaterThan(0);

    // Verify stats were updated
    const stats = await getPreviouslyLoggedItems(db, 'user-1');
    expect(stats).toHaveLength(1);
    expect(stats[0]!.stats.use_count).toBe(1);
    expect(stats[0]!.stats.last_quantity).toBe(2);
    expect(stats[0]!.stats.last_unit).toBe('piece');
    expect(stats[0]!.stats.last_meal_section).toBe('breakfast');

    // Verify outbox queued entry & stats
    const outbox = await getPendingOutboxItems(db);
    expect(outbox.some((o) => o.entity === 'food_entries' && o.id === entry.id)).toBe(true);
    expect(outbox.some((o) => o.entity === 'user_food_stats')).toBe(true);
  });

  it('calculates diary day summary with section subtotals and totals', async () => {
    const db = createTestDb();
    await ensureBundledFoodsSeeded(db);

    const [paneer] = await searchLocalFoods(db, 'paneer');
    const [roti] = await searchLocalFoods(db, 'roti');

    await logFoodEntry(db, {
      userId: 'user-1',
      food: roti!,
      mealSection: 'lunch',
      quantity: 2,
      unit: 'piece',
      localDate: '2026-10-08',
    });

    await logFoodEntry(db, {
      userId: 'user-1',
      food: paneer!,
      mealSection: 'lunch',
      quantity: 100,
      unit: 'g',
      localDate: '2026-10-08',
    });

    const summary = await getDiaryDaySummary(db, 'user-1', '2026-10-08');
    expect(summary.sections.lunch.count).toBe(2);
    expect(summary.sections.lunch.calories).toBeGreaterThan(0);
    expect(summary.sections.breakfast.count).toBe(0);
    expect(summary.totals.entryCount).toBe(2);
    expect(summary.totals.calories).toBe(summary.sections.lunch.calories);
  });

  it('edits and soft deletes entries correctly', async () => {
    const db = createTestDb();
    await ensureBundledFoodsSeeded(db);

    const [egg] = await searchLocalFoods(db, 'egg');

    const entry = await logFoodEntry(db, {
      userId: 'user-1',
      food: egg!,
      mealSection: 'breakfast',
      quantity: 1,
      unit: 'piece',
      localDate: '2026-10-08',
    });

    // Edit quantity to 2
    const edited = await editFoodEntry(db, entry.id, { quantity: 2 }, egg);
    expect(edited?.quantity).toBe(2);
    expect(edited?.calories).toBeCloseTo(entry.calories * 2, 0);

    // Soft delete
    const deleted = await deleteFoodEntry(db, entry.id);
    expect(deleted).toBe(true);

    const entriesAfter = await getEntriesForDate(db, 'user-1', '2026-10-08');
    expect(entriesAfter).toHaveLength(0);
  });

  it('hides food from history without deleting past diary entries', async () => {
    const db = createTestDb();
    await ensureBundledFoodsSeeded(db);

    const [banana] = await searchLocalFoods(db, 'banana');

    await logFoodEntry(db, {
      userId: 'user-1',
      food: banana!,
      mealSection: 'snacks',
      quantity: 1,
      unit: 'piece',
      localDate: '2026-10-08',
    });

    // Hide from history
    await hideFoodFromHistory(db, 'user-1', banana!.id);

    const history = await getPreviouslyLoggedItems(db, 'user-1');
    expect(history).toHaveLength(0);

    // But diary entry remains intact!
    const diary = await getEntriesForDate(db, 'user-1', '2026-10-08');
    expect(diary).toHaveLength(1);
    expect(diary[0]!.food_name).toBe(banana!.name);
  });

  it('copies meal section and entire day with fresh client UUIDs', async () => {
    const db = createTestDb();
    await ensureBundledFoodsSeeded(db);

    const [roti] = await searchLocalFoods(db, 'roti');

    await logFoodEntry(db, {
      userId: 'user-1',
      food: roti!,
      mealSection: 'lunch',
      quantity: 3,
      unit: 'piece',
      localDate: '2026-10-08',
    });

    // Copy lunch to dinner on tomorrow
    const copiedMeal = await copyMealSection(db, 'user-1', '2026-10-08', 'lunch', '2026-10-09', 'dinner');
    expect(copiedMeal).toHaveLength(1);
    expect(copiedMeal[0]!.meal_section).toBe('dinner');
    expect(copiedMeal[0]!.local_date).toBe('2026-10-09');
    expect(copiedMeal[0]!.source).toBe('copy');

    // Copy entire day to 2026-10-10
    const copiedDay = await copyEntireDay(db, 'user-1', '2026-10-08', '2026-10-10');
    expect(copiedDay).toHaveLength(1);
    expect(copiedDay[0]!.local_date).toBe('2026-10-10');
    expect(copiedDay[0]!.id).not.toBe(copiedMeal[0]!.id);
  });
});
