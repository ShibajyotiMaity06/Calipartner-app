import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import type { SyncDb } from './syncService';
import {
  cacheRecipeLocally,
  getFavoriteRecipes,
  getRecentlyViewedRecipes,
  getRecipeDetail,
  getRecipes,
  logRecipe,
  reportRecipe,
  scaleRecipe,
  toggleRecipeFavorite,
} from './recipeService';
import type { Recipe } from '@calipartner/core';

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

    CREATE TABLE local_recipes (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      cuisine TEXT NOT NULL,
      diet_tags TEXT NOT NULL,
      meal_type TEXT NOT NULL,
      prep_minutes INTEGER NOT NULL DEFAULT 0,
      cook_minutes INTEGER NOT NULL DEFAULT 0,
      difficulty TEXT NOT NULL,
      servings REAL NOT NULL,
      steps TEXT NOT NULL,
      tips TEXT NOT NULL,
      image_urls TEXT NOT NULL,
      status TEXT NOT NULL,
      nutrition_per_serving TEXT NOT NULL,
      nutrition_override_reason TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      cached_at TEXT NOT NULL
    );

    CREATE TABLE local_recipe_ingredients (
      id TEXT PRIMARY KEY NOT NULL,
      recipe_id TEXT NOT NULL,
      food_id TEXT NOT NULL,
      food_name TEXT,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      note TEXT,
      display_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE local_recipe_favorites (
      user_id TEXT NOT NULL,
      recipe_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      sync_state TEXT NOT NULL DEFAULT 'synced',
      deleted_at TEXT,
      PRIMARY KEY (user_id, recipe_id)
    );

    CREATE TABLE local_recipe_recently_viewed (
      user_id TEXT NOT NULL,
      recipe_id TEXT NOT NULL,
      viewed_at TEXT NOT NULL,
      PRIMARY KEY (user_id, recipe_id)
    );

    CREATE TABLE local_recipe_reports (
      id TEXT PRIMARY KEY NOT NULL,
      recipe_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      details TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL,
      sync_state TEXT NOT NULL DEFAULT 'pending'
    );
  `);

  return {
    async runAsync(sql: string, ...params: unknown[]) {
      const flat = Array.isArray(params[0]) ? params[0] : params;
      const stmt = sqlite.prepare(sql);
      const res = stmt.run(...flat);
      return { changes: res.changes, lastInsertRowid: res.lastInsertRowid };
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
      return ((rows && rows[0]) as T) ?? null;
    },
  };
}

describe('Phase 12: Recipe Service & Offline Sync', () => {
  let db: SyncDb;
  const user1 = 'user-test-1';

  beforeEach(() => {
    db = createTestDb();
  });

  const sampleRecipe: Recipe = {
    id: 'recipe-test-paneer-bhurji',
    title: 'High-Protein Paneer Bhurji',
    description: 'Scrambled cottage cheese with spices',
    cuisine: 'North Indian',
    diet_tags: ['vegetarian', 'high-protein'],
    meal_type: 'breakfast',
    prep_minutes: 10,
    cook_minutes: 15,
    difficulty: 'easy',
    servings: 2,
    steps: ['Heat pan', 'Add paneer', 'Serve'],
    tips: ['Do not overcook'],
    image_urls: ['https://pub-r2.calipartner.com/recipes/paneer-bhurji.jpg'],
    status: 'published',
    nutrition_per_serving: {
      calories: 435.1,
      protein: 23.9,
      carbs: 10.6,
      fat: 33.3,
      fiber: 1.5,
      sugar: 6.5,
      sodium_mg: 32,
    },
    version: 1,
    created_at: '2026-10-17T00:00:00Z',
    updated_at: '2026-10-17T00:00:00Z',
    ingredients: [
      {
        food_id: 'f-ifct-paneer-raw',
        food_name: 'Paneer (Raw)',
        quantity: 250,
        unit: 'g',
        note: 'crumbled',
      },
      {
        food_id: 'f-ifct-onion-raw',
        food_name: 'Onion (Raw)',
        quantity: 100,
        unit: 'g',
        note: 'chopped',
      },
    ],
  };

  it('caches viewed recipe into local_recipes and local_recipe_ingredients', async () => {
    await cacheRecipeLocally(db, sampleRecipe);

    const detail = await getRecipeDetail(db, sampleRecipe.id, user1);
    expect(detail).not.toBeNull();
    expect(detail!.title).toBe('High-Protein Paneer Bhurji');
    expect(detail!.ingredients).toHaveLength(2);
    expect(detail!.ingredients![0]!.food_name).toBe('Paneer (Raw)');

    // Recently viewed tracking
    const recent = await getRecentlyViewedRecipes(db, user1);
    expect(recent).toHaveLength(1);
    expect(recent[0]!.id).toBe(sampleRecipe.id);
  });

  it('searches and filters recipes offline using cached and bundled recipes (RCP-4)', async () => {
    await cacheRecipeLocally(db, sampleRecipe);

    // Search by name
    const foundByName = await getRecipes(db, { query: 'bhurji' }, user1);
    expect(foundByName.length).toBeGreaterThan(0);
    expect(foundByName[0]!.id).toBe(sampleRecipe.id);

    // Search by diet tag
    const foundByDiet = await getRecipes(db, { diet: 'high-protein' }, user1);
    expect(foundByDiet.some((r) => r.id === sampleRecipe.id)).toBe(true);

    // Filter by cuisine
    const foundByCuisine = await getRecipes(db, { cuisine: 'North Indian' }, user1);
    expect(foundByCuisine.some((r) => r.id === sampleRecipe.id)).toBe(true);
  });

  it('scales servings accurately, keeping per-serving nutrition unchanged (RCP-5)', async () => {
    const scaled = scaleRecipe(sampleRecipe, 4);

    expect(scaled.targetServings).toBe(4);
    expect(scaled.scaledIngredients[0]!.scaled_quantity).toBe(500); // 250 * 2
    expect(scaled.scaledIngredients[1]!.scaled_quantity).toBe(200); // 100 * 2
    expect(scaled.nutritionPerServing.calories).toBe(435.1);
    expect(scaled.totalNutrition.calories).toBe(1740.4);
  });

  it('logs recipe with 1.5 servings = 1.5x nutrients and queues in outbox (RCP-6)', async () => {
    await cacheRecipeLocally(db, sampleRecipe);

    const entry = await logRecipe(db, {
      userId: user1,
      recipeId: sampleRecipe.id,
      servings: 1.5,
      mealSection: 'breakfast',
      localDate: '2026-10-17',
    });

    // 1. Check returned entry nutrients
    expect(entry.quantity).toBe(1.5);
    expect(entry.source).toBe('recipe');
    expect(entry.food_name).toBe('High-Protein Paneer Bhurji');
    expect(entry.meal_section).toBe('breakfast');

    // 435.1 * 1.5 = 652.65 -> 652.7
    expect(entry.calories).toBe(652.7);
    // 23.9 * 1.5 = 35.85 -> 35.9
    expect(entry.protein).toBe(35.9);
    // 10.6 * 1.5 = 15.9
    expect(entry.carbs).toBe(15.9);
    // 33.3 * 1.5 = 49.95 -> 50.0
    expect(entry.fat).toBe(50.0);
    // 1.5 * 1.5 = 2.25 -> 2.3
    expect(entry.fiber).toBe(2.3);

    // 2. Check local_food_entries table insertion
    const saved = await db.getFirstAsync<{ id: string; calories: number }>(
      `SELECT id, calories FROM local_food_entries WHERE id = ?`,
      [entry.id],
    );
    expect(saved).not.toBeNull();
    expect(saved!.calories).toBe(652.7);

    // 3. Check outbox queue insertion
    const outboxItems = await db.getAllAsync<{ entity: string; payload: string }>(
      `SELECT entity, payload FROM outbox WHERE id = ?`,
      [entry.id],
    );
    expect(outboxItems).toHaveLength(1);
    expect(outboxItems[0]!.entity).toBe('food_entries');
    const parsedPayload = JSON.parse(outboxItems[0]!.payload);
    expect(parsedPayload.calories).toBe(652.7);
    expect(parsedPayload.source).toBe('recipe');
  });

  it('manages favorite toggle and sync outbox queue (RCP-7)', async () => {
    await cacheRecipeLocally(db, sampleRecipe);

    // 1. Favorite
    await toggleRecipeFavorite(db, user1, sampleRecipe.id, true);

    const favs = await getFavoriteRecipes(db, user1);
    expect(favs).toHaveLength(1);
    expect(favs[0]!.id).toBe(sampleRecipe.id);
    expect(favs[0]!.is_favorite).toBe(true);

    // Verify outbox queued favorite
    const outboxFav = await db.getFirstAsync<{ entity: string; operation: string }>(
      `SELECT entity, operation FROM outbox WHERE id = ?`,
      [`recipe_fav:${user1}:${sampleRecipe.id}`],
    );
    expect(outboxFav).not.toBeNull();
    expect(outboxFav!.entity).toBe('recipe_favorites');
    expect(outboxFav!.operation).toBe('upsert');

    // 2. Unfavorite
    await toggleRecipeFavorite(db, user1, sampleRecipe.id, false);

    const remaining = await getFavoriteRecipes(db, user1);
    expect(remaining).toHaveLength(0);

    const outboxUnfav = await db.getFirstAsync<{ entity: string; operation: string }>(
      `SELECT entity, operation FROM outbox WHERE id = ?`,
      [`recipe_fav:${user1}:${sampleRecipe.id}`],
    );
    expect(outboxUnfav!.operation).toBe('delete');
  });

  it('submits recipe error report and queues in outbox (RCP-9)', async () => {
    const report = await reportRecipe(db, {
      userId: user1,
      recipeId: sampleRecipe.id,
      reason: 'Missing salt quantity in ingredients',
      details: 'Should specify 1/2 tsp salt in the ingredient list',
    });

    expect(report.id).toBeDefined();
    expect(report.status).toBe('open');

    // Verify local report row
    const row = await db.getFirstAsync<{ reason: string }>(
      `SELECT reason FROM local_recipe_reports WHERE id = ?`,
      [report.id],
    );
    expect(row).not.toBeNull();
    expect(row!.reason).toBe('Missing salt quantity in ingredients');

    // Verify outbox
    const outboxRow = await db.getFirstAsync<{ entity: string }>(
      `SELECT entity FROM outbox WHERE id = ?`,
      [report.id],
    );
    expect(outboxRow).not.toBeNull();
    expect(outboxRow!.entity).toBe('recipe_reports');
  });
});
