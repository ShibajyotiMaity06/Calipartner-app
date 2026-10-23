import type { SupabaseClient } from '@supabase/supabase-js';
import { filterRecipes, scaleLoggedRecipeNutrients, scaleRecipeServings } from '@calipartner/core';
import type {
  FoodEntry,
  MealSection,
  Recipe,
  RecipeFilterCriteria,
  RecipeNutritionSnapshot,
  RecipeReport,
  ScaledRecipeIngredient,
} from '@calipartner/core';
import { createLogger } from '@/lib/logger';
import { enqueueOutbox, type SyncDb } from './syncService';
import bundledRecipesData from '../../assets/bundled_recipes.json';

const log = createLogger('recipeService');

/** Deterministic/standard client-side UUID generator for offline idempotency */
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

export interface RecipeDb {
  runAsync(sql: string, ...params: unknown[]): Promise<unknown>;
  getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null>;
}

export type SupabaseRecipeClient = SupabaseClient;

export interface LocalRecipeRow {
  id: string;
  title: string;
  description: string | null;
  cuisine: string;
  diet_tags: string;
  meal_type: string;
  prep_minutes: number;
  cook_minutes: number;
  difficulty: string;
  servings: number;
  steps: string;
  tips: string;
  image_urls: string;
  status: string;
  nutrition_per_serving: string;
  nutrition_override_reason: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  cached_at: string;
}

export interface LocalRecipeIngredientRow {
  id: string;
  recipe_id: string;
  food_id: string;
  food_name: string | null;
  quantity: number;
  unit: string;
  note: string | null;
  display_order: number;
}

export interface LogRecipeInput {
  userId: string;
  recipeId: string;
  servings: number;
  mealSection: MealSection;
  localDate: string;
  sharedMealId?: string | null;
  loggedAt?: string;
}

export interface ReportRecipeInput {
  userId: string;
  recipeId: string;
  reason: string;
  details?: string | null;
}

/**
 * Parses a SQLite row into a strongly typed Recipe object.
 */
export function parseLocalRecipeRow(row: LocalRecipeRow): Recipe {
  const safeJson = <T>(val: unknown, fallback: T): T => {
    if (!val) return fallback;
    if (typeof val !== 'string') return val as T;
    try {
      return JSON.parse(val) as T;
    } catch {
      return fallback;
    }
  };

  const parseDietTags = (val: unknown): string[] => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    const str = String(val).trim();
    if (str.startsWith('[')) {
      try {
        return JSON.parse(str);
      } catch {
        // fallback
      }
    }
    return str
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  };

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    cuisine: row.cuisine,
    diet_tags: parseDietTags(row.diet_tags),
    meal_type: row.meal_type as Recipe['meal_type'],
    prep_minutes: row.prep_minutes,
    cook_minutes: row.cook_minutes,
    difficulty: row.difficulty as Recipe['difficulty'],
    servings: row.servings,
    steps: safeJson<string[]>(row.steps, []),
    tips: safeJson<string[]>(row.tips, []),
    image_urls: safeJson<string[]>(row.image_urls, []),
    status: row.status as Recipe['status'],
    nutrition_per_serving: safeJson<RecipeNutritionSnapshot>(row.nutrition_per_serving, {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
    }),
    nutrition_override_reason: row.nutrition_override_reason,
    version: row.version,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * Caches a recipe and its ingredients into local SQLite.
 */
export async function cacheRecipeLocally(db: RecipeDb, recipe: Recipe): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO local_recipes (
      id, title, description, cuisine, diet_tags, meal_type,
      prep_minutes, cook_minutes, difficulty, servings,
      steps, tips, image_urls, status, nutrition_per_serving,
      nutrition_override_reason, version, created_at, updated_at, cached_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      description = excluded.description,
      cuisine = excluded.cuisine,
      diet_tags = excluded.diet_tags,
      meal_type = excluded.meal_type,
      prep_minutes = excluded.prep_minutes,
      cook_minutes = excluded.cook_minutes,
      difficulty = excluded.difficulty,
      servings = excluded.servings,
      steps = excluded.steps,
      tips = excluded.tips,
      image_urls = excluded.image_urls,
      status = excluded.status,
      nutrition_per_serving = excluded.nutrition_per_serving,
      nutrition_override_reason = excluded.nutrition_override_reason,
      version = excluded.version,
      updated_at = excluded.updated_at,
      cached_at = excluded.cached_at`,
    [
      recipe.id,
      recipe.title,
      recipe.description ?? null,
      recipe.cuisine,
      JSON.stringify(recipe.diet_tags || []),
      recipe.meal_type,
      recipe.prep_minutes,
      recipe.cook_minutes,
      recipe.difficulty,
      recipe.servings,
      JSON.stringify(recipe.steps || []),
      JSON.stringify(recipe.tips || []),
      JSON.stringify(recipe.image_urls || []),
      recipe.status,
      JSON.stringify(recipe.nutrition_per_serving),
      recipe.nutrition_override_reason ?? null,
      recipe.version,
      recipe.created_at,
      recipe.updated_at,
      now,
    ],
  );

  if (recipe.ingredients && recipe.ingredients.length > 0) {
    await db.runAsync(`DELETE FROM local_recipe_ingredients WHERE recipe_id = ?`, [recipe.id]);

    for (let i = 0; i < recipe.ingredients.length; i++) {
      const ing = recipe.ingredients[i]!;
      const ingId = ing.id || `${recipe.id}-ing-${i}`;
      await db.runAsync(
        `INSERT INTO local_recipe_ingredients (
          id, recipe_id, food_id, food_name, quantity, unit, note, display_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          ingId,
          recipe.id,
          ing.food_id,
          ing.food_name ?? null,
          ing.quantity,
          ing.unit,
          ing.note ?? null,
          i,
        ],
      );
    }
  }
}

/**
 * Pre-caches images for offline browsing (RCP-7).
 */
export async function cacheRecipeImages(imageUrls: string[]): Promise<void> {
  // Gracefully handles mobile or web caching
  try {
    for (const url of imageUrls) {
      if (typeof fetch !== 'undefined' && url.startsWith('http')) {
        // Simple fetch pre-warm to prime the cache
        fetch(url, { method: 'HEAD' }).catch(() => {
          // ignore offline pre-fetch errors
        });
      }
    }
  } catch (err) {
    log.warn('cacheRecipeImages error (non-blocking)', err);
  }
}

/**
 * Searches and browses recipes with filters.
 * Falls back to local SQLite cache or bundled recipes when offline.
 */
export async function getRecipes(
  db: RecipeDb,
  criteria: RecipeFilterCriteria = {},
  userId?: string,
  supabase?: SupabaseRecipeClient | null,
): Promise<Recipe[]> {
  let allRecipes: Recipe[] = [];

  // Try fetching from remote Supabase if online
  if (supabase) {
    try {
      const res = await supabase
        .from('recipes')
        .select(
          `
          id, title, description, cuisine, diet_tags, meal_type,
          prep_minutes, cook_minutes, difficulty, servings,
          steps, tips, image_urls, status, nutrition_per_serving,
          nutrition_override_reason, version, created_at, updated_at
        `,
        )
        .eq('status', 'published')
        .is('deleted_at', null)
        .order('updated_at', { ascending: false });

      if (!res.error && res.data && res.data.length > 0) {
        allRecipes = (res.data as Record<string, unknown>[]).map((r) => ({
          ...(r as unknown as Recipe),
          diet_tags: Array.isArray(r.diet_tags) ? (r.diet_tags as string[]) : [],
          steps: Array.isArray(r.steps) ? (r.steps as string[]) : [],
          tips: Array.isArray(r.tips) ? (r.tips as string[]) : [],
          image_urls: Array.isArray(r.image_urls) ? (r.image_urls as string[]) : [],
        }));

        // Cache fetched recipes locally
        for (const recipe of allRecipes) {
          await cacheRecipeLocally(db, recipe);
        }
      }
    } catch (err) {
      log.info('Supabase getRecipes failed or offline, falling back to local database', err);
    }
  }

  // Fallback and merge with local SQLite cache and bundled recipes
  const rows = await db.getAllAsync<LocalRecipeRow>(
    `SELECT * FROM local_recipes WHERE status = 'published' ORDER BY updated_at DESC`,
  );

  const recipeMap = new Map<string, Recipe>();

  // 1. Seed bundled Indian recipes (93 complete items from reciepes.csv)
  const bundled = (bundledRecipesData as unknown as Recipe[]).filter(
    (r) => r.status === 'published',
  );
  for (const b of bundled) {
    recipeMap.set(b.id, b);
  }

  // 2. Prioritize local SQLite rows (explicitly cached or updated)
  const localParsed: Recipe[] = [];
  if (rows && rows.length > 0) {
    for (const r of rows) {
      try {
        const parsed = parseLocalRecipeRow(r);
        recipeMap.set(parsed.id, parsed);
        localParsed.push(parsed);
      } catch {
        // skip corrupted row
      }
    }
  }

  // 3. Overlay any remote Supabase rows
  for (const r of allRecipes) {
    recipeMap.set(r.id, r);
  }

  const localSet = new Set(localParsed.map((l) => l.id));
  const remainder = Array.from(recipeMap.values()).filter((r) => !localSet.has(r.id));
  allRecipes = [...localParsed, ...remainder];

  // Apply deterministic core filters (RCP-4)
  const filtered = filterRecipes(allRecipes, criteria);

  // Decorate with user's favorite status if userId provided
  if (userId) {
    const favoriteRows = await db.getAllAsync<{ recipe_id: string }>(
      `SELECT recipe_id FROM local_recipe_favorites WHERE user_id = ? AND deleted_at IS NULL`,
      [userId],
    );
    const favoriteSet = new Set(favoriteRows.map((f) => f.recipe_id));
    return filtered.map((r) => ({
      ...r,
      is_favorite: favoriteSet.has(r.id),
    }));
  }

  return filtered;
}

/**
 * Gets recipe detail including ingredients.
 * Records the view into local_recipe_recently_viewed.
 */
export async function getRecipeDetail(
  db: RecipeDb,
  recipeId: string,
  userId?: string,
  supabase?: SupabaseRecipeClient | null,
): Promise<Recipe | null> {
  let recipe: Recipe | null = null;

  // 1. Check local SQLite
  const row = await db.getFirstAsync<LocalRecipeRow>(`SELECT * FROM local_recipes WHERE id = ?`, [
    recipeId,
  ]);

  if (row) {
    recipe = parseLocalRecipeRow(row);
    const ingredientRows = await db.getAllAsync<LocalRecipeIngredientRow>(
      `SELECT * FROM local_recipe_ingredients WHERE recipe_id = ? ORDER BY display_order ASC`,
      [recipeId],
    );
    recipe.ingredients = ingredientRows.map((i) => ({
      id: i.id,
      recipe_id: i.recipe_id,
      food_id: i.food_id,
      food_name: i.food_name ?? undefined,
      quantity: i.quantity,
      unit: i.unit,
      note: i.note,
      display_order: i.display_order,
    }));
  }

  // 2. If not found locally or if remote client provided, try Supabase
  if (!recipe && supabase) {
    try {
      const res = await supabase
        .from('recipes')
        .select('*')
        .eq('id', recipeId)
        .eq('status', 'published');

      if (!res.error && res.data && res.data[0]) {
        const r = res.data[0];
        recipe = {
          ...r,
          diet_tags: Array.isArray(r.diet_tags) ? r.diet_tags : [],
          steps: Array.isArray(r.steps) ? r.steps : [],
          tips: Array.isArray(r.tips) ? r.tips : [],
          image_urls: Array.isArray(r.image_urls) ? r.image_urls : [],
        };

        // Fetch ingredients
        const ingRes = await supabase
          .from('recipe_ingredients')
          .select('*')
          .eq('recipe_id', recipeId);

        if (!ingRes.error && ingRes.data) {
          recipe!.ingredients = ingRes.data;
        }

        await cacheRecipeLocally(db, recipe!);
      }
    } catch (err) {
      log.warn('Failed to fetch recipe detail from Supabase', err);
    }
  }

  // 3. Fallback to bundled dataset
  if (!recipe) {
    const bundled = (bundledRecipesData as unknown as Recipe[]).find((r) => r.id === recipeId);
    if (bundled) {
      recipe = bundled;
      await cacheRecipeLocally(db, recipe);
    }
  }

  if (!recipe) return null;

  // Track recently viewed and favorite state if user is logged in (RCP-7)
  if (userId) {
    const now = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO local_recipe_recently_viewed (user_id, recipe_id, viewed_at)
       VALUES (?, ?, ?)
       ON CONFLICT(user_id, recipe_id) DO UPDATE SET viewed_at = excluded.viewed_at`,
      [userId, recipe.id, now],
    );

    const fav = await db.getFirstAsync<{ recipe_id: string }>(
      `SELECT recipe_id FROM local_recipe_favorites WHERE user_id = ? AND recipe_id = ? AND deleted_at IS NULL`,
      [userId, recipe.id],
    );
    recipe.is_favorite = !!fav;
  }

  // Pre-cache images
  if (recipe.image_urls && recipe.image_urls.length > 0) {
    cacheRecipeImages(recipe.image_urls);
  }

  return recipe;
}

/**
 * Scales a recipe's ingredient amounts for a chosen target number of servings.
 */
export function scaleRecipe(
  recipe: Recipe,
  targetServings: number,
): {
  recipe: Recipe;
  targetServings: number;
  scaledIngredients: ScaledRecipeIngredient[];
  nutritionPerServing: RecipeNutritionSnapshot;
  totalNutrition: RecipeNutritionSnapshot;
} {
  return scaleRecipeServings(recipe, targetServings);
}

/**
 * Logs a recipe into the user's food diary (PRD 6.21 RCP-6).
 * Creates a food_entries row with nutrient snapshot and source='recipe'.
 * Syncs seamlessly via the offline outbox queue.
 */
export async function logRecipe(db: RecipeDb, input: LogRecipeInput): Promise<FoodEntry> {
  if (input.servings <= 0) {
    throw new Error('Servings must be greater than zero');
  }

  const recipe = await getRecipeDetail(db, input.recipeId, input.userId);
  if (!recipe) {
    throw new Error(`Recipe with ID "${input.recipeId}" not found`);
  }

  const scaledNutrients = scaleLoggedRecipeNutrients(recipe.nutrition_per_serving, input.servings);

  const entryId = generateClientUuid();
  const now = input.loggedAt || new Date().toISOString();
  const unitLabel = input.servings === 1 ? 'serving' : 'servings';

  const entry: FoodEntry = {
    id: entryId,
    user_id: input.userId,
    food_id: null,
    meal_section: input.mealSection,
    quantity: input.servings,
    unit: unitLabel,
    calories: scaledNutrients.calories,
    protein: scaledNutrients.protein,
    carbs: scaledNutrients.carbs,
    fat: scaledNutrients.fat,
    fiber: scaledNutrients.fiber ?? 0,
    sugar: scaledNutrients.sugar ?? 0,
    sodium_mg: scaledNutrients.sodium_mg ?? 0,
    food_name: recipe.title,
    brand_name: recipe.cuisine,
    logged_at: now,
    local_date: input.localDate,
    source: 'recipe',
    shared_meal_id: input.sharedMealId ?? null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };

  // 1. Insert into local SQLite
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

  // 2. Enqueue in outbox for background remote sync
  await enqueueOutbox(db as unknown as SyncDb, {
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
      created_at: entry.created_at,
      updated_at: entry.updated_at,
      deleted_at: null,
    },
  });

  log.info(
    `Logged recipe "${recipe.title}" (${input.servings} servings) in section "${input.mealSection}"`,
  );
  return entry;
}

/**
 * Toggles favorite state of a recipe for the user.
 * Writes to local SQLite and enqueues to outbox for sync (RCP-7).
 */
export async function toggleRecipeFavorite(
  db: RecipeDb,
  userId: string,
  recipeId: string,
  isFavorite: boolean,
  _supabase?: SupabaseRecipeClient,
): Promise<void> {
  const now = new Date().toISOString();
  const outboxId = `recipe_fav:${userId}:${recipeId}`;

  if (isFavorite) {
    await db.runAsync(
      `INSERT INTO local_recipe_favorites (user_id, recipe_id, created_at, sync_state, deleted_at)
       VALUES (?, ?, ?, 'pending', NULL)
       ON CONFLICT(user_id, recipe_id) DO UPDATE SET sync_state = 'pending', deleted_at = NULL`,
      [userId, recipeId, now],
    );

    await enqueueOutbox(db as unknown as SyncDb, {
      id: outboxId,
      entity: 'recipe_favorites',
      operation: 'upsert',
      payload: {
        user_id: userId,
        recipe_id: recipeId,
        created_at: now,
      },
    });
  } else {
    await db.runAsync(
      `UPDATE local_recipe_favorites SET deleted_at = ?, sync_state = 'pending'
       WHERE user_id = ? AND recipe_id = ?`,
      [now, userId, recipeId],
    );

    await enqueueOutbox(db as unknown as SyncDb, {
      id: outboxId,
      entity: 'recipe_favorites',
      operation: 'delete',
      payload: {
        user_id: userId,
        recipe_id: recipeId,
      },
    });
  }
}

/**
 * Gets user's favorite recipes.
 */
export async function getFavoriteRecipes(db: RecipeDb, userId: string): Promise<Recipe[]> {
  const rows = await db.getAllAsync<LocalRecipeRow>(
    `SELECT r.* FROM local_recipes r
     JOIN local_recipe_favorites f ON f.recipe_id = r.id
     WHERE f.user_id = ? AND f.deleted_at IS NULL AND r.status = 'published'
     ORDER BY f.created_at DESC`,
    [userId],
  );

  return rows.map((r) => ({
    ...parseLocalRecipeRow(r),
    is_favorite: true,
  }));
}

/**
 * Gets user's recently viewed recipes.
 */
export async function getRecentlyViewedRecipes(
  db: RecipeDb,
  userId: string,
  limit = 10,
): Promise<Recipe[]> {
  const rows = await db.getAllAsync<LocalRecipeRow>(
    `SELECT r.* FROM local_recipes r
     JOIN local_recipe_recently_viewed v ON v.recipe_id = r.id
     WHERE v.user_id = ? AND r.status = 'published'
     ORDER BY v.viewed_at DESC
     LIMIT ?`,
    [userId, limit],
  );

  return rows.map(parseLocalRecipeRow);
}

/**
 * Reports an error or issue in a recipe (RCP-9).
 * Inserts into local_recipe_reports and enqueues to outbox.
 */
export async function reportRecipe(db: RecipeDb, input: ReportRecipeInput): Promise<RecipeReport> {
  const reasonTrimmed = input.reason.trim();
  if (reasonTrimmed.length < 3) {
    throw new Error('Report reason must be at least 3 characters');
  }

  const id = generateClientUuid();
  const now = new Date().toISOString();

  const report: RecipeReport = {
    id,
    recipe_id: input.recipeId,
    user_id: input.userId,
    reason: reasonTrimmed,
    details: input.details?.trim() || null,
    status: 'open',
    created_at: now,
  };

  await db.runAsync(
    `INSERT INTO local_recipe_reports (
      id, recipe_id, user_id, reason, details, status, created_at, sync_state
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [
      report.id,
      report.recipe_id,
      report.user_id,
      report.reason,
      report.details,
      report.status,
      report.created_at,
    ],
  );

  await enqueueOutbox(db as unknown as SyncDb, {
    id: report.id,
    entity: 'recipe_reports',
    operation: 'upsert',
    payload: {
      id: report.id,
      recipe_id: report.recipe_id,
      user_id: report.user_id,
      reason: report.reason,
      details: report.details,
      status: report.status,
      created_at: report.created_at,
    },
  });

  return report;
}
