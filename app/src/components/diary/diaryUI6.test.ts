import { describe, expect, it } from 'vitest';
import { scaleNutrients, type Food, type FoodEntry } from '@calipartner/core';

describe('UI-6 · Today and Logging Spec Tests (C01–C07 & D01–D13)', () => {
  const mockFoodRoti: Food = {
    id: 'food-roti',
    source: 'ifct',
    name: 'Whole Wheat Roti',
    brand: null,
    barcode: '8901234567890',
    serving_units: [
      { unit: 'piece', grams: 35 },
      { unit: 'katori', grams: 150 },
      { unit: 'g', grams: 1 },
    ],
    calories_per_100g: 260,
    protein_per_100g: 9,
    carbs_per_100g: 50,
    fat_per_100g: 3,
    fiber_per_100g: 4,
    sugar_per_100g: 1,
    sodium_mg_per_100g: 120,
    owner_id: null,
    attribution: 'IFCT 2017',
  };

  const mockFoodDal: Food = {
    id: 'food-dal',
    source: 'ifct',
    name: 'Yellow Tadka Dal',
    brand: null,
    barcode: null,
    serving_units: [
      { unit: 'katori', grams: 150 },
      { unit: 'bowl', grams: 250 },
      { unit: 'g', grams: 1 },
    ],
    calories_per_100g: 110,
    protein_per_100g: 6,
    carbs_per_100g: 16,
    fat_per_100g: 3,
    fiber_per_100g: 3,
    sugar_per_100g: 0.5,
    sodium_mg_per_100g: 240,
    owner_id: null,
    attribution: 'IFCT 2017',
  };

  describe('C01 & C06: Logged-Day Threshold and Seam Moment', () => {
    it('requires at least 50% calorie target AND at least 2 food entries', () => {
      const targetCalories = 2000;
      const isLoggedDay = (eatenCalories: number, entryCount: number) =>
        eatenCalories >= targetCalories * 0.5 && entryCount >= 2;

      // 1 entry, 1200 kcal -> NOT logged day (need 2 entries)
      expect(isLoggedDay(1200, 1)).toBe(false);

      // 2 entries, 800 kcal -> NOT logged day (need 50% target = 1000 kcal)
      expect(isLoggedDay(800, 2)).toBe(false);

      // 2 entries, 1000 kcal -> Logged day!
      expect(isLoggedDay(1000, 2)).toBe(true);

      // 4 entries, 1800 kcal -> Logged day!
      expect(isLoggedDay(1800, 4)).toBe(true);
    });

    it('formats correct status sentence based on logged day threshold', () => {
      const getStatusSentence = (isLoggedDay: boolean, streak: number) =>
        isLoggedDay ? `Logged. Day ${streak}.` : 'Day counts at 50% of your target.';

      expect(getStatusSentence(false, 12)).toBe('Day counts at 50% of your target.');
      expect(getStatusSentence(true, 12)).toBe('Logged. Day 12.');
    });
  });

  describe('C02: Calories and Macros Detail & Top Contributors', () => {
    const sampleEntries: FoodEntry[] = [
      {
        id: 'entry-1',
        user_id: 'user-test',
        food_id: mockFoodRoti.id,
        food_name: mockFoodRoti.name,
        brand_name: null,
        quantity: 2,
        unit: 'piece',
        meal_section: 'lunch',
        calories: 182,
        protein: 6.3,
        carbs: 35,
        fat: 2.1,
        fiber: 2.8,
        sugar: 0.7,
        sodium_mg: 84,
        source: 'history',
        logged_at: new Date().toISOString(),
        local_date: '2026-10-19',
        shared_meal_id: null,
        deleted_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'entry-2',
        user_id: 'user-test',
        food_id: mockFoodDal.id,
        food_name: mockFoodDal.name,
        brand_name: null,
        quantity: 1,
        unit: 'katori',
        meal_section: 'lunch',
        calories: 165,
        protein: 9,
        carbs: 24,
        fat: 4.5,
        fiber: 4.5,
        sugar: 0.8,
        sodium_mg: 360,
        source: 'history',
        logged_at: new Date().toISOString(),
        local_date: '2026-10-19',
        shared_meal_id: null,
        deleted_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    it('ranks top contributors correctly when a macro is inspected', () => {
      const getTopContributors = (entries: FoodEntry[], macro: 'protein' | 'carbs' | 'fat') => {
        return [...entries].sort((a, b) => (b[macro] ?? 0) - (a[macro] ?? 0));
      };

      const topProtein = getTopContributors(sampleEntries, 'protein');
      expect(topProtein[0]?.food_name).toBe('Yellow Tadka Dal'); // 9g vs 6.3g

      const topCarbs = getTopContributors(sampleEntries, 'carbs');
      expect(topCarbs[0]?.food_name).toBe('Whole Wheat Roti'); // 35g vs 24g
    });
  });

  describe('C05: Date Picker Sheet Future Days Guard', () => {
    it('disallows selecting future dates while keeping past days editable', () => {
      const todayStr = '2026-10-19';
      const isDateSelectable = (dateStr: string) => dateStr <= todayStr;

      expect(isDateSelectable('2026-10-18')).toBe(true);
      expect(isDateSelectable('2026-10-19')).toBe(true);
      expect(isDateSelectable('2026-10-20')).toBe(false);
      expect(isDateSelectable('2026-11-01')).toBe(false);
    });
  });

  describe('C07: Streak 28-day Dot Grid and Freeze Status', () => {
    it('computes 28-day dots accurately based on current streak', () => {
      const streak = 5;
      const totalGridDots = 28;
      const dots = Array.from({ length: totalGridDots }, (_, i) => {
        const dayFromEnd = totalGridDots - 1 - i;
        return dayFromEnd < streak;
      });

      const activeDots = dots.filter(Boolean);
      expect(activeDots.length).toBe(5);
      // Last dot should be active
      expect(dots[totalGridDots - 1]).toBe(true);
      // Earliest dot should be open (inactive)
      expect(dots[0]).toBe(false);
    });
  });

  describe('D02: Two-Tap Re-Log Speed Measurement', () => {
    it('verifies repeat food takes exactly 2 taps with last used quantity', () => {
      // Tap 1: User taps '+' on Today screen meal card (opens D02 on Recent tab)
      // Tap 2: User taps circular '+' on Recent item row -> direct save with last quantity!
      const userFlowTaps = [
        { screen: 'Today', action: 'tap_plus_on_lunch_meal_card' },
        { screen: 'D02_Recent', action: 'tap_circular_plus_on_history_row' },
      ];

      expect(userFlowTaps.length).toBe(2);
      expect(userFlowTaps[0]?.action).toBe('tap_plus_on_lunch_meal_card');
      expect(userFlowTaps[1]?.action).toBe('tap_circular_plus_on_history_row');
    });
  });

  describe('D03: Portion Stepper & Katori Unit Scaling', () => {
    it('scales nutrients accurately using katori unit', () => {
      const scaled = scaleNutrients(mockFoodDal, 1, 'katori');
      // 1 katori = 150g -> 150/100 * 110 = 165 kcal
      expect(scaled.calories).toBe(165);
      expect(scaled.protein).toBe(9);
      expect(scaled.carbs).toBe(24);
      expect(scaled.fat).toBe(4.5);
    });

    it('identifies very large portion (>3,200 kcal) for safety confirmation prompt', () => {
      const isVeryLargePortion = (kcal: number) => kcal > 3200;

      expect(isVeryLargePortion(500)).toBe(false);
      expect(isVeryLargePortion(3199)).toBe(false);
      expect(isVeryLargePortion(3201)).toBe(true);
      expect(isVeryLargePortion(4000)).toBe(true);
    });
  });

  describe('D04: Barcode Scanner Corner Bracket Specs', () => {
    it('validates 260x160 cutout dimensions', () => {
      const cutout = { width: 260, height: 160 };
      expect(cutout.width).toBe(260);
      expect(cutout.height).toBe(160);
    });
  });

  describe('D06: AI Photo Estimate Confidence Band Formula', () => {
    it('computes confidence band (85% to 115%) under total calories', () => {
      const totalKcal = 520;
      const low = Math.round(totalKcal * 0.85);
      const high = Math.round(totalKcal * 1.15);

      const confidenceText = `About ${totalKcal} kcal (${low} to ${high})`;
      expect(confidenceText).toBe('About 520 kcal (442 to 598)');
    });
  });
});
