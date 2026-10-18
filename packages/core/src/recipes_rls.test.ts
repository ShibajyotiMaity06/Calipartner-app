import { describe, expect, it } from 'vitest';
import type { Recipe, RecipeFavorite, RecipeIngredient, RecipeReport } from './types';

/**
 * In-memory simulation of Row-Level Security policies for Phase 12 tables:
 * - recipes: published readable by any authenticated user; drafts & writes ONLY via service role (scripts).
 * - recipe_ingredients: readable by authenticated users only if parent recipe is published; writes ONLY via service role.
 * - recipe_favorites: users can select/insert/delete ONLY their own rows (user_id === callerId).
 * - recipe_reports: users can select/insert ONLY their own rows (user_id === callerId); no updates/deletes.
 */
class InMemoryRecipeSecurityDb {
  recipes: Recipe[] = [];
  ingredients: RecipeIngredient[] = [];
  favorites: RecipeFavorite[] = [];
  reports: RecipeReport[] = [];

  // --- Recipes ---
  insertRecipe(callerRole: 'authenticated' | 'service_role', recipe: Recipe): Recipe {
    if (callerRole !== 'service_role') {
      throw new Error(
        'RLS check violation: authenticated users cannot insert recipes (service role only)',
      );
    }
    this.recipes.push(recipe);
    return recipe;
  }

  updateRecipe(
    callerRole: 'authenticated' | 'service_role',
    id: string,
    updates: Partial<Recipe>,
  ): Recipe {
    if (callerRole !== 'service_role') {
      throw new Error(
        'RLS check violation: authenticated users cannot update recipes (service role only)',
      );
    }
    const existing = this.recipes.find((r) => r.id === id);
    if (!existing) throw new Error('Recipe not found');
    Object.assign(existing, updates, { updated_at: new Date().toISOString() });
    return existing;
  }

  deleteRecipe(callerRole: 'authenticated' | 'service_role', id: string): void {
    if (callerRole !== 'service_role') {
      throw new Error(
        'RLS check violation: authenticated users cannot delete recipes (service role only)',
      );
    }
    const existing = this.recipes.find((r) => r.id === id);
    if (!existing) return;
    existing.deleted_at = new Date().toISOString();
  }

  selectRecipes(
    callerRole: 'authenticated' | 'service_role',
    _callerUserId: string | null,
  ): Recipe[] {
    if (callerRole === 'service_role') {
      return this.recipes.filter((r) => !r.deleted_at);
    }
    // Authenticated users: published only (drafts invisible)
    return this.recipes.filter((r) => r.status === 'published' && !r.deleted_at);
  }

  // --- Recipe Ingredients ---
  insertIngredient(
    callerRole: 'authenticated' | 'service_role',
    ingredient: RecipeIngredient,
  ): RecipeIngredient {
    if (callerRole !== 'service_role') {
      throw new Error(
        'RLS check violation: authenticated users cannot insert recipe ingredients (service role only)',
      );
    }
    this.ingredients.push(ingredient);
    return ingredient;
  }

  selectIngredients(
    callerRole: 'authenticated' | 'service_role',
    recipeId: string,
  ): RecipeIngredient[] {
    if (callerRole === 'service_role') {
      return this.ingredients.filter((i) => i.recipe_id === recipeId);
    }
    // Only return ingredients if parent recipe is published
    const parent = this.recipes.find(
      (r) => r.id === recipeId && r.status === 'published' && !r.deleted_at,
    );
    if (!parent) return [];
    return this.ingredients.filter((i) => i.recipe_id === recipeId);
  }

  // --- Recipe Favorites ---
  insertFavorite(callerUserId: string, favorite: RecipeFavorite): RecipeFavorite {
    if (favorite.user_id !== callerUserId) {
      throw new Error('RLS check violation: cannot favorite recipes on behalf of another user');
    }
    this.favorites.push(favorite);
    return favorite;
  }

  selectFavorites(callerUserId: string): RecipeFavorite[] {
    return this.favorites.filter((f) => f.user_id === callerUserId);
  }

  deleteFavorite(callerUserId: string, recipeId: string): void {
    const idx = this.favorites.findIndex(
      (f) => f.user_id === callerUserId && f.recipe_id === recipeId,
    );
    if (idx !== -1) {
      this.favorites.splice(idx, 1);
    }
  }

  // --- Recipe Reports ---
  insertReport(callerUserId: string, report: RecipeReport): RecipeReport {
    if (report.user_id !== callerUserId) {
      throw new Error('RLS check violation: cannot file recipe reports for another user');
    }
    this.reports.push(report);
    return report;
  }

  selectReports(
    callerRole: 'authenticated' | 'service_role',
    callerUserId: string,
  ): RecipeReport[] {
    if (callerRole === 'service_role') {
      return this.reports;
    }
    return this.reports.filter((r) => r.user_id === callerUserId);
  }

  updateReport(callerRole: 'authenticated' | 'service_role', _reportId: string): void {
    if (callerRole !== 'service_role') {
      throw new Error('RLS check violation: authenticated users cannot modify recipe reports');
    }
  }
}

describe('Phase 12: Recipe Database RLS Security Policies', () => {
  const db = new InMemoryRecipeSecurityDb();
  const userA = 'user-a-1111';
  const userB = 'user-b-2222';

  // Seed 1 published recipe and 1 draft recipe via service_role
  db.insertRecipe('service_role', {
    id: 'r-published-1',
    title: 'Published Paneer Bhurji',
    cuisine: 'North Indian',
    diet_tags: ['vegetarian', 'high-protein'],
    meal_type: 'breakfast',
    prep_minutes: 10,
    cook_minutes: 15,
    difficulty: 'easy',
    servings: 2,
    steps: ['Cook'],
    tips: [],
    image_urls: ['url1'],
    status: 'published',
    nutrition_per_serving: { calories: 435, protein: 24, carbs: 10, fat: 33, fiber: 1.5 },
    version: 1,
    created_at: '2026-10-17T00:00:00Z',
    updated_at: '2026-10-17T00:00:00Z',
  });

  db.insertIngredient('service_role', {
    recipe_id: 'r-published-1',
    food_id: 'f-ifct-paneer-raw',
    quantity: 250,
    unit: 'g',
  });

  db.insertRecipe('service_role', {
    id: 'r-draft-2',
    title: 'Secret Draft Recipe Under Review',
    cuisine: 'North Indian',
    diet_tags: ['vegetarian'],
    meal_type: 'dinner',
    prep_minutes: 20,
    cook_minutes: 30,
    difficulty: 'hard',
    servings: 4,
    steps: ['Work in progress'],
    tips: [],
    image_urls: ['url2'],
    status: 'draft',
    nutrition_per_serving: { calories: 300, protein: 15, carbs: 20, fat: 10, fiber: 2 },
    version: 1,
    created_at: '2026-10-17T00:00:00Z',
    updated_at: '2026-10-17T00:00:00Z',
  });

  db.insertIngredient('service_role', {
    recipe_id: 'r-draft-2',
    food_id: 'f-ifct-soya-chunks',
    quantity: 100,
    unit: 'g',
  });

  it('allows authenticated users to view published recipes', () => {
    const recipes = db.selectRecipes('authenticated', userA);
    expect(recipes.some((r) => r.id === 'r-published-1')).toBe(true);
  });

  it('keeps draft recipes completely invisible to regular users', () => {
    const recipesA = db.selectRecipes('authenticated', userA);
    const recipesB = db.selectRecipes('authenticated', userB);
    expect(recipesA.some((r) => r.id === 'r-draft-2')).toBe(false);
    expect(recipesB.some((r) => r.id === 'r-draft-2')).toBe(false);

    // But service_role can see draft recipes
    const adminRecipes = db.selectRecipes('service_role', null);
    expect(adminRecipes.some((r) => r.id === 'r-draft-2')).toBe(true);
  });

  it('prevents regular users from reading ingredients of draft recipes', () => {
    // Published recipe ingredients are readable
    const pubIngs = db.selectIngredients('authenticated', 'r-published-1');
    expect(pubIngs).toHaveLength(1);
    expect(pubIngs[0]!.food_id).toBe('f-ifct-paneer-raw');

    // Draft recipe ingredients are hidden
    const draftIngs = db.selectIngredients('authenticated', 'r-draft-2');
    expect(draftIngs).toHaveLength(0);
  });

  it('prevents authenticated users from creating, modifying, or deleting recipes', () => {
    expect(() => {
      db.insertRecipe('authenticated', {
        id: 'r-hacked',
        title: 'User Hacked Recipe',
        cuisine: 'Fusion',
        diet_tags: [],
        meal_type: 'lunch',
        prep_minutes: 0,
        cook_minutes: 0,
        difficulty: 'easy',
        servings: 1,
        steps: [],
        tips: [],
        image_urls: [],
        status: 'published',
        nutrition_per_serving: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
        version: 1,
        created_at: '',
        updated_at: '',
      });
    }).toThrow('RLS check violation');

    expect(() => {
      db.updateRecipe('authenticated', 'r-published-1', { title: 'Defaced Title' });
    }).toThrow('RLS check violation');

    expect(() => {
      db.deleteRecipe('authenticated', 'r-published-1');
    }).toThrow('RLS check violation');

    expect(() => {
      db.insertIngredient('authenticated', {
        recipe_id: 'r-published-1',
        food_id: 'f-fake',
        quantity: 1,
        unit: 'g',
      });
    }).toThrow('RLS check violation');
  });

  it('allows users to manage only their own favorites', () => {
    db.insertFavorite(userA, {
      user_id: userA,
      recipe_id: 'r-published-1',
      created_at: '2026-10-17T01:00:00Z',
    });

    // User A can see their favorite
    const aFavs = db.selectFavorites(userA);
    expect(aFavs).toHaveLength(1);
    expect(aFavs[0]!.recipe_id).toBe('r-published-1');

    // User B cannot see User A favorite
    const bFavs = db.selectFavorites(userB);
    expect(bFavs).toHaveLength(0);

    // User B cannot insert a favorite for User A
    expect(() => {
      db.insertFavorite(userB, {
        user_id: userA,
        recipe_id: 'r-published-1',
        created_at: '2026-10-17T01:00:00Z',
      });
    }).toThrow('RLS check violation');

    // User A can unfavorite
    db.deleteFavorite(userA, 'r-published-1');
    expect(db.selectFavorites(userA)).toHaveLength(0);
  });

  it('allows users to create and view only their own recipe error reports', () => {
    db.insertReport(userA, {
      id: 'rep-1',
      recipe_id: 'r-published-1',
      user_id: userA,
      reason: 'Incorrect unit for salt',
      details: 'Should be tsp not tbsp',
      status: 'open',
      created_at: '2026-10-17T01:00:00Z',
    });

    // User A can see their own report
    const aReps = db.selectReports('authenticated', userA);
    expect(aReps).toHaveLength(1);
    expect(aReps[0]!.id).toBe('rep-1');

    // User B cannot see User A report
    const bReps = db.selectReports('authenticated', userB);
    expect(bReps).toHaveLength(0);

    // User B cannot insert a report as User A
    expect(() => {
      db.insertReport(userB, {
        id: 'rep-forged',
        recipe_id: 'r-published-1',
        user_id: userA,
        reason: 'Hacked',
        status: 'open',
        created_at: '2026-10-17T01:00:00Z',
      });
    }).toThrow('RLS check violation');

    // Authenticated users cannot update reports (e.g. resolve them)
    expect(() => {
      db.updateReport('authenticated', 'rep-1');
    }).toThrow('RLS check violation');
  });
});
