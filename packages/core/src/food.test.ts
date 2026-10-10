import { describe, expect, it } from 'vitest';
import {
  calculateDiaryTotals,
  calculateSectionSuggestions,
  copyEntries,
  filterAndSortHistory,
  getMealSectionForTime,
  resolveUnitGrams,
  scaleNutrients,
} from './food';
import type { Food, FoodEntry, UserFoodStats } from './types';

describe('Food core calculations', () => {
  const sampleRoti: Food = {
    id: 'food-roti',
    source: 'ifct',
    name: 'Roti / Chapati (Whole Wheat)',
    brand: null,
    barcode: null,
    serving_units: [
      { unit: 'piece', grams: 40, description: '1 medium roti (~40g)' },
      { unit: 'g', grams: 1 },
    ],
    calories_per_100g: 297,
    protein_per_100g: 9.6,
    carbs_per_100g: 55.4,
    fat_per_100g: 3.8,
    fiber_per_100g: 9.8,
    sugar_per_100g: 1.2,
    sodium_mg_per_100g: 120,
    owner_id: null,
    attribution: 'ICMR-NIN IFCT 2017',
  };

  const sampleDal: Food = {
    id: 'food-dal',
    source: 'ifct',
    name: 'Dal Tadka',
    brand: null,
    barcode: null,
    serving_units: [
      { unit: 'katori', grams: 150, description: '1 standard katori (~150g)' },
      { unit: 'bowl', grams: 200, description: '1 bowl (~200g)' },
      { unit: 'tbsp', grams: 15 },
    ],
    calories_per_100g: 110,
    protein_per_100g: 5.5,
    carbs_per_100g: 14.0,
    fat_per_100g: 3.5,
    fiber_per_100g: 3.2,
    sugar_per_100g: 0.8,
    sodium_mg_per_100g: 340,
    owner_id: null,
    attribution: 'ICMR-NIN IFCT 2017',
  };

  describe('resolveUnitGrams', () => {
    it('uses food custom serving units first', () => {
      expect(resolveUnitGrams(sampleRoti, 'piece')).toBe(40);
      expect(resolveUnitGrams(sampleDal, 'katori')).toBe(150);
      expect(resolveUnitGrams(sampleDal, 'bowl')).toBe(200);
      expect(resolveUnitGrams(sampleRoti, 'g')).toBe(1);
    });

    it('falls back to standard household units when food has no custom unit', () => {
      expect(resolveUnitGrams(sampleRoti, 'cup')).toBe(240);
      expect(resolveUnitGrams(sampleRoti, 'tbsp')).toBe(15);
      expect(resolveUnitGrams(sampleRoti, 'slice')).toBe(30);
      expect(resolveUnitGrams(sampleRoti, 'plate')).toBe(300);
      expect(resolveUnitGrams(sampleRoti, 'glass')).toBe(250);
    });

    it('falls back to 100 for unknown units', () => {
      expect(resolveUnitGrams(sampleRoti, 'mystery_portion')).toBe(100);
    });
  });

  describe('scaleNutrients', () => {
    it('accurately scales nutrients for 2 pieces of roti (80g)', () => {
      // 80g is 0.8 factor
      // calories = 297 * 0.8 = 237.6
      // protein = 9.6 * 0.8 = 7.7
      // carbs = 55.4 * 0.8 = 44.3
      // fat = 3.8 * 0.8 = 3.0
      // fiber = 9.8 * 0.8 = 7.8
      const scaled = scaleNutrients(sampleRoti, 2, 'piece');
      expect(scaled.calories).toBe(237.6);
      expect(scaled.protein).toBe(7.7);
      expect(scaled.carbs).toBe(44.3);
      expect(scaled.fat).toBe(3);
      expect(scaled.fiber).toBe(7.8);
      expect(scaled.sodium_mg).toBe(96);
    });

    it('accurately scales nutrients for 1 katori of dal (150g)', () => {
      // factor = 1.5
      // calories = 110 * 1.5 = 165
      // protein = 5.5 * 1.5 = 8.3
      // carbs = 14 * 1.5 = 21
      // fat = 3.5 * 1.5 = 5.3
      const scaled = scaleNutrients(sampleDal, 1, 'katori');
      expect(scaled.calories).toBe(165);
      expect(scaled.protein).toBe(8.3);
      expect(scaled.carbs).toBe(21);
      expect(scaled.fat).toBe(5.3);
    });

    it('returns zero for quantity 0 or negative', () => {
      const zero = scaleNutrients(sampleRoti, 0, 'piece');
      expect(zero.calories).toBe(0);
      expect(zero.protein).toBe(0);

      const negative = scaleNutrients(sampleRoti, -2, 'piece');
      expect(negative.calories).toBe(0);
    });
  });

  describe('calculateDiaryTotals', () => {
    const entries: FoodEntry[] = [
      {
        id: 'entry-1',
        user_id: 'user-1',
        food_id: 'food-roti',
        meal_section: 'breakfast',
        quantity: 2,
        unit: 'piece',
        calories: 237.6,
        protein: 7.7,
        carbs: 44.3,
        fat: 3.0,
        fiber: 7.8,
        sugar: 1.0,
        sodium_mg: 96,
        food_name: 'Roti',
        brand_name: null,
        logged_at: '2026-10-08T03:30:00Z',
        local_date: '2026-10-08',
        source: 'search',
        shared_meal_id: null,
        updated_at: '2026-10-08T03:30:00Z',
        deleted_at: null,
      },
      {
        id: 'entry-2',
        user_id: 'user-1',
        food_id: 'food-dal',
        meal_section: 'lunch',
        quantity: 1,
        unit: 'katori',
        calories: 165,
        protein: 8.3,
        carbs: 21,
        fat: 5.3,
        fiber: 4.8,
        sugar: 1.2,
        sodium_mg: 510,
        food_name: 'Dal Tadka',
        brand_name: null,
        logged_at: '2026-10-08T07:30:00Z',
        local_date: '2026-10-08',
        source: 'search',
        shared_meal_id: null,
        updated_at: '2026-10-08T07:30:00Z',
        deleted_at: null,
      },
      {
        id: 'entry-deleted',
        user_id: 'user-1',
        food_id: 'food-roti',
        meal_section: 'breakfast',
        quantity: 1,
        unit: 'piece',
        calories: 118.8,
        protein: 3.8,
        carbs: 22.2,
        fat: 1.5,
        fiber: 3.9,
        sugar: 0.5,
        sodium_mg: 48,
        food_name: 'Roti',
        brand_name: null,
        logged_at: '2026-10-08T03:00:00Z',
        local_date: '2026-10-08',
        source: 'search',
        shared_meal_id: null,
        updated_at: '2026-10-08T03:10:00Z',
        deleted_at: '2026-10-08T03:15:00Z',
      },
    ];

    it('correctly calculates subtotals per section and excludes deleted entries', () => {
      const summary = calculateDiaryTotals(entries, '2026-10-08');

      expect(summary.local_date).toBe('2026-10-08');
      expect(summary.sections.breakfast.count).toBe(1);
      expect(summary.sections.breakfast.calories).toBe(237.6);
      expect(summary.sections.breakfast.entries).toHaveLength(1);

      expect(summary.sections.lunch.count).toBe(1);
      expect(summary.sections.lunch.calories).toBe(165);

      expect(summary.sections.dinner.count).toBe(0);
      expect(summary.sections.snacks.count).toBe(0);
      expect(summary.sections.extra.count).toBe(0);

      // Totals:
      expect(summary.totals.entryCount).toBe(2);
      expect(summary.totals.calories).toBe(402.6);
      expect(summary.totals.protein).toBe(16);
      expect(summary.totals.carbs).toBe(65.3);
      expect(summary.totals.fat).toBe(8.3);
    });
  });

  describe('getMealSectionForTime', () => {
    it('maps morning times to breakfast', () => {
      const d = new Date('2026-10-08T08:30:00');
      expect(getMealSectionForTime(d)).toBe('breakfast');
    });

    it('maps midday times to lunch', () => {
      const d = new Date('2026-10-08T13:15:00');
      expect(getMealSectionForTime(d)).toBe('lunch');
    });

    it('maps afternoon times to snacks', () => {
      const d = new Date('2026-10-08T16:45:00');
      expect(getMealSectionForTime(d)).toBe('snacks');
    });

    it('maps evening times to dinner', () => {
      const d = new Date('2026-10-08T20:00:00');
      expect(getMealSectionForTime(d)).toBe('dinner');
    });

    it('maps late night times to extra', () => {
      const d = new Date('2026-10-08T23:30:00');
      expect(getMealSectionForTime(d)).toBe('extra');
      const earlyMorning = new Date('2026-10-08T02:00:00');
      expect(getMealSectionForTime(earlyMorning)).toBe('extra');
    });
  });

  describe('filterAndSortHistory', () => {
    const statsRoti: UserFoodStats = {
      user_id: 'u1',
      food_id: 'food-roti',
      use_count: 5,
      last_used_at: '2026-10-07T12:00:00Z',
      last_quantity: 2,
      last_unit: 'piece',
      last_meal_section: 'dinner',
      hidden: false,
      updated_at: '2026-10-07T12:00:00Z',
    };

    const statsDal: UserFoodStats = {
      user_id: 'u1',
      food_id: 'food-dal',
      use_count: 12,
      last_used_at: '2026-10-06T12:00:00Z',
      last_quantity: 1,
      last_unit: 'katori',
      last_meal_section: 'lunch',
      hidden: false,
      updated_at: '2026-10-06T12:00:00Z',
    };

    const statsHidden: UserFoodStats = {
      user_id: 'u1',
      food_id: 'food-hidden',
      use_count: 20,
      last_used_at: '2026-10-08T12:00:00Z',
      last_quantity: 1,
      last_unit: 'piece',
      last_meal_section: 'lunch',
      hidden: true, // hidden from history!
      updated_at: '2026-10-08T12:00:00Z',
    };

    const hiddenFood: Food = { ...sampleRoti, id: 'food-hidden', name: 'Hidden Item' };

    const items = [
      { stats: statsRoti, food: sampleRoti },
      { stats: statsDal, food: sampleDal },
      { stats: statsHidden, food: hiddenFood },
    ];

    it('filters out hidden stats', () => {
      const res = filterAndSortHistory(items);
      expect(res).toHaveLength(2);
      expect(res.find((r) => r.stats.food_id === 'food-hidden')).toBeUndefined();
    });

    it('sorts by recent (latest last_used_at first)', () => {
      const res = filterAndSortHistory(items, { sort: 'recent' });
      expect(res[0]!.stats.food_id).toBe('food-roti'); // Oct 7 > Oct 6
      expect(res[1]!.stats.food_id).toBe('food-dal');
    });

    it('sorts by frequent (highest use_count first)', () => {
      const res = filterAndSortHistory(items, { sort: 'frequent' });
      expect(res[0]!.stats.food_id).toBe('food-dal'); // 12 > 5
      expect(res[1]!.stats.food_id).toBe('food-roti');
    });

    it('sorts alphabetically by food name', () => {
      const res = filterAndSortHistory(items, { sort: 'alpha' });
      expect(res[0]!.food.name).toBe('Dal Tadka');
      expect(res[1]!.food.name).toBe('Roti / Chapati (Whole Wheat)');
    });

    it('filters by meal section', () => {
      const res = filterAndSortHistory(items, { section: 'lunch' });
      expect(res).toHaveLength(1);
      expect(res[0]!.stats.food_id).toBe('food-dal');
    });

    it('filters by query substring', () => {
      const res = filterAndSortHistory(items, { query: 'tadka' });
      expect(res).toHaveLength(1);
      expect(res[0]!.food.name).toBe('Dal Tadka');
    });
  });

  describe('calculateSectionSuggestions', () => {
    it('aggregates frequency over 30 days deterministically', () => {
      const entries: FoodEntry[] = [
        {
          id: 'e1',
          user_id: 'u1',
          food_id: 'f-oats',
          food_name: 'Oats with Milk',
          brand_name: null,
          meal_section: 'breakfast',
          quantity: 1,
          unit: 'bowl',
          calories: 250,
          protein: 10,
          carbs: 40,
          fat: 5,
          fiber: 4,
          sugar: 6,
          sodium_mg: 80,
          logged_at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
          local_date: '2026-10-06',
          source: 'search',
          shared_meal_id: null,
          updated_at: new Date().toISOString(),
          deleted_at: null,
        },
        {
          id: 'e2',
          user_id: 'u1',
          food_id: 'f-oats',
          food_name: 'Oats with Milk',
          brand_name: null,
          meal_section: 'breakfast',
          quantity: 1.5,
          unit: 'bowl',
          calories: 375,
          protein: 15,
          carbs: 60,
          fat: 7.5,
          fiber: 6,
          sugar: 9,
          sodium_mg: 120,
          logged_at: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
          local_date: '2026-10-07',
          source: 'history',
          shared_meal_id: null,
          updated_at: new Date().toISOString(),
          deleted_at: null,
        },
        {
          id: 'e3',
          user_id: 'u1',
          food_id: 'f-eggs',
          food_name: 'Boiled Eggs',
          brand_name: null,
          meal_section: 'breakfast',
          quantity: 2,
          unit: 'piece',
          calories: 140,
          protein: 12,
          carbs: 1,
          fat: 10,
          fiber: 0,
          sugar: 0,
          sodium_mg: 120,
          logged_at: new Date().toISOString(),
          local_date: '2026-10-08',
          source: 'search',
          shared_meal_id: null,
          updated_at: new Date().toISOString(),
          deleted_at: null,
        },
        {
          id: 'e4-lunch',
          user_id: 'u1',
          food_id: 'f-dal',
          food_name: 'Dal',
          brand_name: null,
          meal_section: 'lunch', // different section
          quantity: 1,
          unit: 'bowl',
          calories: 150,
          protein: 8,
          carbs: 20,
          fat: 4,
          fiber: 3,
          sugar: 1,
          sodium_mg: 300,
          logged_at: new Date().toISOString(),
          local_date: '2026-10-08',
          source: 'search',
          shared_meal_id: null,
          updated_at: new Date().toISOString(),
          deleted_at: null,
        },
      ];

      const suggestions = calculateSectionSuggestions(entries, 'breakfast');
      expect(suggestions).toHaveLength(2);
      expect(suggestions[0]!.food_id).toBe('f-oats');
      expect(suggestions[0]!.count).toBe(2);
      expect(suggestions[0]!.last_quantity).toBe(1.5); // latest logged quantity
      expect(suggestions[1]!.food_id).toBe('f-eggs');
      expect(suggestions[1]!.count).toBe(1);
    });
  });

  describe('copyEntries', () => {
    it('creates independent copies with new IDs, source=copy, and target date', () => {
      const original: FoodEntry[] = [
        {
          id: 'original-1',
          user_id: 'user-a',
          food_id: 'food-roti',
          meal_section: 'dinner',
          quantity: 2,
          unit: 'piece',
          calories: 237.6,
          protein: 7.7,
          carbs: 44.3,
          fat: 3.0,
          fiber: 7.8,
          sugar: 1.0,
          sodium_mg: 96,
          food_name: 'Roti',
          brand_name: null,
          logged_at: '2026-10-07T14:00:00Z',
          local_date: '2026-10-07',
          source: 'search',
          shared_meal_id: null,
          updated_at: '2026-10-07T14:00:00Z',
          deleted_at: null,
        },
      ];

      let idCounter = 100;
      const copies = copyEntries(original, {
        local_date: '2026-10-08',
        meal_section: 'lunch',
        newIdGenerator: () => `new-id-${++idCounter}`,
        timestampGenerator: () => '2026-10-08T07:00:00Z',
      });

      expect(copies).toHaveLength(1);
      const copied = copies[0]!;
      expect(copied.id).toBe('new-id-101');
      expect(copied.local_date).toBe('2026-10-08');
      expect(copied.meal_section).toBe('lunch');
      expect(copied.source).toBe('copy');
      expect(copied.calories).toBe(237.6);
      expect(copied.logged_at).toBe('2026-10-08T07:00:00Z');
      expect(copied.deleted_at).toBeNull();
    });
  });
});
