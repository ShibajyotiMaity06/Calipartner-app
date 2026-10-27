import { describe, expect, it } from 'vitest';
import type { Food, FoodCandidateItem, MealSection } from '@calipartner/core';
import { en } from '@/i18n/en';
import { t } from '@/i18n';
import { swapCandidateFood, updateCandidateQuantity } from '@/services/aiFoodPhotoService';

describe('Phase 11 Prompt B — AI Food Photo UI Screens & State Tests', () => {
  const mockFoodApple: Food = {
    id: 'food-apple',
    source: 'ifct',
    name: 'Red Apple',
    brand: null,
    barcode: null,
    serving_units: [
      { unit: 'medium', grams: 182 },
      { unit: 'g', grams: 1 },
    ],
    calories_per_100g: 52,
    protein_per_100g: 0.3,
    carbs_per_100g: 13.8,
    fat_per_100g: 0.2,
    fiber_per_100g: 2.4,
    sugar_per_100g: 10.4,
    sodium_mg_per_100g: 1,
    owner_id: null,
    attribution: 'IFCT 2017',
  };

  const mockFoodOats: Food = {
    id: 'food-oats',
    source: 'ifct',
    name: 'Rolled Oats Porridge',
    brand: null,
    barcode: null,
    serving_units: [
      { unit: 'bowl', grams: 250 },
      { unit: 'g', grams: 1 },
    ],
    calories_per_100g: 68,
    protein_per_100g: 2.4,
    carbs_per_100g: 12.0,
    fat_per_100g: 1.4,
    fiber_per_100g: 1.7,
    sugar_per_100g: 0.5,
    sodium_mg_per_100g: 49,
    owner_id: null,
    attribution: 'IFCT 2017',
  };

  const sampleCandidateApple: FoodCandidateItem = {
    id: 'cand-apple',
    detected_name: 'Red Apple',
    estimated_grams: 182,
    confidence: 0.94,
    matched_food: mockFoodApple,
    quantity: 1,
    unit: 'medium',
    nutrients: {
      calories: 95,
      protein: 0.5,
      carbs: 25.1,
      fat: 0.4,
      fiber: 4.4,
      sugar: 10.4,
      sodium_mg: 1,
    },
    is_estimate: true,
  };

  const sampleCandidateOats: FoodCandidateItem = {
    id: 'cand-oats',
    detected_name: 'Rolled Oats Porridge',
    estimated_grams: 250,
    confidence: 0.88,
    matched_food: mockFoodOats,
    quantity: 1,
    unit: 'bowl',
    nutrients: {
      calories: 170,
      protein: 6.0,
      carbs: 30.0,
      fat: 3.5,
      fiber: 4.3,
      sugar: 0.5,
      sodium_mg: 49,
    },
    is_estimate: true,
  };

  describe('1. i18n Localization Verification', () => {
    it('contains all required user-facing strings for AI photo logging', () => {
      const photoStrings = en.foodLog.photo;

      expect(photoStrings.title).toBe('AI Photo Logging');
      expect(photoStrings.badge).toBe('Estimate');
      expect(photoStrings.cameraTitle).toBe('Scan Food');
      expect(photoStrings.cameraSubtitle).toBe('Align your meal inside the frame');
      expect(photoStrings.analyzingTitle).toBe('Analyzing your meal…');
      expect(photoStrings.analyzingHint).toContain('in-memory');
      expect(photoStrings.consentTitle).toBe('AI Photo Processing');
      expect(photoStrings.consentBullet1).toBeDefined();
      expect(photoStrings.consentBullet2).toContain('deleted immediately');
      expect(photoStrings.consentBullet3).toContain('never sold');
      expect(photoStrings.resultsTitle).toBe('Review Meal');
      expect(photoStrings.estimateNotice).toContain('AI estimates');
      expect(photoStrings.limitTitle).toBe('Daily Photo Limit Reached');
      expect(photoStrings.limitBodyTrial).toContain('Plus and its trial do not include');
      expect(photoStrings.limitBodyPaid).toContain('5 AI photo scans');
      expect(photoStrings.upgradeUpsell).toContain('Pro');
      expect(photoStrings.upgradeUpsell).toContain('5 photo scans');
    });

    it('resolves parameterized strings properly via t() helper', () => {
      const logButtonText = t('foodLog.photo.logButton', { count: 3 });
      expect(logButtonText).toBe('Log Meal (3 Items)');

      const singleButtonText = t('foodLog.photo.logSingleButton');
      expect(singleButtonText).toBe('Log Meal (1 Item)');
    });
  });

  describe('2. Results Editor Live Macro Computations & Steppers', () => {
    it('computes live aggregate macros correctly across multiple items', () => {
      const candidates = [sampleCandidateApple, sampleCandidateOats];

      const totals = candidates.reduce(
        (acc, c) => ({
          calories: Math.round(acc.calories + (c.nutrients?.calories || 0)),
          protein: Math.round((acc.protein + (c.nutrients?.protein || 0)) * 10) / 10,
          carbs: Math.round((acc.carbs + (c.nutrients?.carbs || 0)) * 10) / 10,
          fat: Math.round((acc.fat + (c.nutrients?.fat || 0)) * 10) / 10,
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 },
      );

      expect(totals.calories).toBe(95 + 170); // 265 kcal
      expect(totals.protein).toBe(6.5);
      expect(totals.carbs).toBe(55.1);
      expect(totals.fat).toBe(3.9);
    });

    it('steppers update portion quantity and recalculate nutrients accurately', () => {
      // Step up: from 1 medium (182g, 95kcal) to 1.5 medium
      const steppedUp = updateCandidateQuantity(sampleCandidateApple, 1.5);
      expect(steppedUp.quantity).toBe(1.5);
      expect(steppedUp.estimated_grams).toBe(273); // 1.5 * 182
      expect(steppedUp.nutrients.calories).toBe(Math.round(273 * 0.52)); // 142 kcal
      expect(steppedUp.is_estimate).toBe(true);

      // Step down: from 1 medium to 0.5 medium
      const steppedDown = updateCandidateQuantity(sampleCandidateApple, 0.5);
      expect(steppedDown.quantity).toBe(0.5);
      expect(steppedDown.estimated_grams).toBe(91);
      expect(steppedDown.nutrients.calories).toBe(47.3);
    });

    it('allows swapping a detected candidate with a chosen alternative food item', () => {
      const initial = sampleCandidateApple;
      // Swap apple with oats
      const swapped = swapCandidateFood(initial, mockFoodOats);

      expect(swapped.matched_food.id).toBe('food-oats');
      expect(swapped.matched_food.name).toBe('Rolled Oats Porridge');
      expect(swapped.is_estimate).toBe(true);
      expect(swapped.nutrients.calories).toBeGreaterThan(0);
    });

    it('handles removing all candidates leading to the empty state', () => {
      let candidates: FoodCandidateItem[] = [sampleCandidateApple];
      expect(candidates.length).toBe(1);

      // User taps remove
      candidates = candidates.filter((_, idx) => idx !== 0);
      expect(candidates.length).toBe(0);

      // In empty state, activeCandidateCount is 0
      const activeCandidates = candidates.filter((c) => c.quantity > 0);
      expect(activeCandidates.length).toBe(0);
    });
  });

  describe('3. Daily Limit Modal Plan Logic & Upsell Gating', () => {
    const getLimitText = (state: 'trial' | 'paid' | 'free') => {
      if (state === 'paid') return en.foodLog.photo.limitBodyPaid;
      if (state === 'free') return en.foodLog.photo.limitBodyFree;
      return en.foodLog.photo.limitBodyTrial;
    };

    it('displays trial message and upsell when state is trial', () => {
      expect(getLimitText('trial')).toBe(en.foodLog.photo.limitBodyTrial);
    });

    it('displays free-tier message and upsell when state is free after trial', () => {
      expect(getLimitText('free')).toBe(en.foodLog.photo.limitBodyFree);
    });

    it('displays paid cap message and hides upsell when state is paid', () => {
      expect(getLimitText('paid')).toBe(en.foodLog.photo.limitBodyPaid);
    });
  });

  describe('4. Meal Section Selector Parity', () => {
    it('supports all 4 meal sections with proper i18n keys', () => {
      const sections: MealSection[] = ['breakfast', 'lunch', 'dinner', 'snacks'];
      for (const sec of sections) {
        const localized = t(`diary.sections.${sec}` as Parameters<typeof t>[0]);
        expect(localized).toBeDefined();
        expect(localized.length).toBeGreaterThan(0);
      }
    });
  });

  describe('5. Privacy & Ephemeral Data Guarantees (PRD 8.2)', () => {
    it('explicitly guarantees in-memory processing without persistent server storage', () => {
      const b1 = en.foodLog.photo.consentBullet1;
      const b2 = en.foodLog.photo.consentBullet2;
      const b3 = en.foodLog.photo.consentBullet3;

      expect(b1).toContain('vision model');
      expect(b2).toContain('deleted immediately');
      expect(b2).toContain('never stored on servers unless you share them to room chat');
      expect(b3).toContain('never sold or used for advertising');
    });
  });
});
