import { describe, expect, it } from 'vitest';
import type { Food, FoodEntry, SavedMeal, UserFoodStats } from './types';

/**
 * In-memory simulation of Row-Level Security policies for Phase 3 tables:
 * - foods: global (owner_id == null) readable by all; custom (owner_id != null) readable/writable ONLY by owner
 * - food_entries: strictly owner_id === callerId
 * - user_food_stats: strictly user_id === callerId
 * - saved_meals: strictly user_id === callerId
 */
class InMemoryFoodSecurityDb {
  foods: Food[] = [];
  entries: FoodEntry[] = [];
  userStats: UserFoodStats[] = [];
  savedMeals: SavedMeal[] = [];

  insertFood(callerId: string | null, food: Food): Food {
    // If food has owner_id, caller must match owner_id
    if (food.owner_id !== null && callerId !== food.owner_id) {
      throw new Error('RLS check violation: cannot insert custom food for another user');
    }
    // Only service role (callerId == null) can insert global food
    if (food.owner_id === null && callerId !== null && callerId !== 'service_role') {
      throw new Error('RLS check violation: authenticated user cannot insert global food directly');
    }
    this.foods.push(food);
    return food;
  }

  selectFoods(callerId: string | null): Food[] {
    if (callerId === null) {
      // Anonymous cannot read custom foods; only public global foods
      return this.foods.filter((f) => f.owner_id === null && !f.deleted_at);
    }
    return this.foods.filter(
      (f) => (f.owner_id === null || f.owner_id === callerId) && !f.deleted_at,
    );
  }

  insertEntry(callerId: string, entry: FoodEntry): FoodEntry {
    if (callerId !== entry.user_id) {
      throw new Error('RLS check violation: cannot insert food entry for another user');
    }
    this.entries.push(entry);
    return entry;
  }

  selectEntries(callerId: string): FoodEntry[] {
    return this.entries.filter((e) => e.user_id === callerId && !e.deleted_at);
  }

  updateEntry(callerId: string, id: string, updates: Partial<FoodEntry>): FoodEntry {
    const entry = this.entries.find((e) => e.id === id);
    if (!entry) {
      throw new Error('Not found');
    }
    if (entry.user_id !== callerId) {
      throw new Error('RLS check violation: cannot update another user entry');
    }
    Object.assign(entry, updates, { updated_at: new Date().toISOString() });
    return entry;
  }

  deleteEntry(callerId: string, id: string): void {
    const entry = this.entries.find((e) => e.id === id);
    if (!entry) return;
    if (entry.user_id !== callerId) {
      throw new Error('RLS check violation: cannot delete another user entry');
    }
    entry.deleted_at = new Date().toISOString();
  }
}

describe('Phase 3 Database RLS Security Policies', () => {
  const db = new InMemoryFoodSecurityDb();
  const userA = 'user-a-1111';
  const userB = 'user-b-2222';

  // Seed global food
  db.insertFood('service_role', {
    id: 'f-global-apple',
    source: 'ifct',
    name: 'Apple',
    brand: null,
    barcode: '1234567890',
    serving_units: [{ unit: 'piece', grams: 120 }],
    calories_per_100g: 52,
    protein_per_100g: 0.3,
    carbs_per_100g: 14,
    fat_per_100g: 0.2,
    fiber_per_100g: 2.4,
    sugar_per_100g: 10,
    sodium_mg_per_100g: 1,
    owner_id: null,
    attribution: 'ICMR-NIN IFCT 2017',
  });

  it('allows User A to create and view their custom food', () => {
    db.insertFood(userA, {
      id: 'f-custom-protein-bar',
      source: 'user',
      name: 'Custom Protein Bar',
      brand: 'MyBrand',
      barcode: null,
      serving_units: [{ unit: 'piece', grams: 60 }],
      calories_per_100g: 350,
      protein_per_100g: 33,
      carbs_per_100g: 30,
      fat_per_100g: 10,
      fiber_per_100g: 5,
      sugar_per_100g: 2,
      sodium_mg_per_100g: 150,
      owner_id: userA,
      attribution: null,
    });

    const userAFoods = db.selectFoods(userA);
    expect(userAFoods.some((f) => f.id === 'f-custom-protein-bar')).toBe(true);
    expect(userAFoods.some((f) => f.id === 'f-global-apple')).toBe(true);
  });

  it('prevents User B from seeing User A custom food', () => {
    const userBFoods = db.selectFoods(userB);
    // Can see global apple
    expect(userBFoods.some((f) => f.id === 'f-global-apple')).toBe(true);
    // Cannot see User A custom food
    expect(userBFoods.some((f) => f.id === 'f-custom-protein-bar')).toBe(false);
  });

  it('allows User A to insert and read their diary entries', () => {
    db.insertEntry(userA, {
      id: 'entry-a-1',
      user_id: userA,
      food_id: 'f-global-apple',
      meal_section: 'breakfast',
      quantity: 1,
      unit: 'piece',
      calories: 62.4,
      protein: 0.4,
      carbs: 16.8,
      fat: 0.2,
      fiber: 2.9,
      sugar: 12,
      sodium_mg: 1.2,
      food_name: 'Apple',
      brand_name: null,
      logged_at: '2026-10-08T08:00:00Z',
      local_date: '2026-10-08',
      source: 'search',
      shared_meal_id: null,
      updated_at: '2026-10-08T08:00:00Z',
      deleted_at: null,
    });

    const aEntries = db.selectEntries(userA);
    expect(aEntries).toHaveLength(1);
    expect(aEntries[0]!.id).toBe('entry-a-1');
  });

  it('prevents User B from reading User A diary entries', () => {
    const bEntries = db.selectEntries(userB);
    expect(bEntries).toHaveLength(0);
  });

  it('prevents User B from inserting an entry belonging to User A', () => {
    expect(() => {
      db.insertEntry(userB, {
        id: 'entry-forged',
        user_id: userA,
        food_id: 'f-global-apple',
        meal_section: 'lunch',
        quantity: 1,
        unit: 'piece',
        calories: 62.4,
        protein: 0.4,
        carbs: 16.8,
        fat: 0.2,
        fiber: 2.9,
        sugar: 12,
        sodium_mg: 1.2,
        food_name: 'Apple',
        brand_name: null,
        logged_at: '2026-10-08T12:00:00Z',
        local_date: '2026-10-08',
        source: 'search',
        shared_meal_id: null,
        updated_at: '2026-10-08T12:00:00Z',
        deleted_at: null,
      });
    }).toThrow('RLS check violation');
  });

  it('prevents User B from modifying or deleting User A diary entries', () => {
    expect(() => {
      db.updateEntry(userB, 'entry-a-1', { calories: 999 });
    }).toThrow('RLS check violation');

    expect(() => {
      db.deleteEntry(userB, 'entry-a-1');
    }).toThrow('RLS check violation');

    // Verify entry is unchanged
    const aEntries = db.selectEntries(userA);
    expect(aEntries[0]!.calories).toBe(62.4);
    expect(aEntries[0]!.deleted_at).toBeNull();
  });

  it('allows User A to update and soft-delete their own diary entry', () => {
    db.updateEntry(userA, 'entry-a-1', { quantity: 2, calories: 124.8 });
    expect(db.selectEntries(userA)[0]!.calories).toBe(124.8);

    db.deleteEntry(userA, 'entry-a-1');
    expect(db.selectEntries(userA)).toHaveLength(0);
  });
});
