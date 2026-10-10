import { describe, expect, it } from 'vitest';
import {
  checkRateLimit,
  mapOpenFoodFactsProduct,
  mapUsdaFoodItem,
  resetRateLimits,
} from './food_lookup';

describe('food-lookup Mapping and Rate Limiting', () => {
  it('correctly maps Open Food Facts product structure with nutriments and serving size', () => {
    const rawOffProduct = {
      product_name: 'Greek Yogurt Plain',
      brands: 'Epigamia',
      serving_size: '100g',
      serving_quantity: 100,
      nutriments: {
        'energy-kcal_100g': 85,
        proteins_100g: 8.0,
        carbohydrates_100g: 5.5,
        fat_100g: 3.2,
        fiber_100g: 0,
        sugars_100g: 4.8,
        salt_100g: 0.1, // ~40mg sodium
      },
    };

    const mapped = mapOpenFoodFactsProduct('8906077630019', rawOffProduct);
    expect(mapped.source).toBe('off');
    expect(mapped.name).toBe('Greek Yogurt Plain');
    expect(mapped.brand).toBe('Epigamia');
    expect(mapped.barcode).toBe('8906077630019');
    expect(mapped.calories_per_100g).toBe(85);
    expect(mapped.protein_per_100g).toBe(8);
    expect(mapped.carbs_per_100g).toBe(5.5);
    expect(mapped.fat_per_100g).toBe(3.2);
    expect(mapped.sodium_mg_per_100g).toBe(40);
    expect(mapped.attribution).toBe('Open Food Facts (ODbL)');
    expect(mapped.serving_units).toHaveLength(2); // g + serving
  });

  it('correctly maps USDA FoodData Central item with foodNutrients IDs', () => {
    const rawUsdaItem = {
      description: 'Oats, rolled, whole grain',
      brandOwner: 'Quaker Oats Company',
      gtinUpc: '030000010402',
      servingSize: 40,
      householdServingFullText: '1/2 cup (40g)',
      foodNutrients: [
        { nutrientId: 1008, value: 389 }, // Energy
        { nutrientId: 1003, value: 16.9 }, // Protein
        { nutrientId: 1004, value: 6.9 }, // Fat
        { nutrientId: 1005, value: 66.3 }, // Carbs
        { nutrientId: 1079, value: 10.6 }, // Fiber
        { nutrientId: 2000, value: 1.0 }, // Sugar
        { nutrientId: 1093, value: 6.0 }, // Sodium
      ],
    };

    const mapped = mapUsdaFoodItem(rawUsdaItem);
    expect(mapped.source).toBe('usda');
    expect(mapped.name).toBe('Oats, rolled, whole grain');
    expect(mapped.brand).toBe('Quaker Oats Company');
    expect(mapped.barcode).toBe('030000010402');
    expect(mapped.calories_per_100g).toBe(389);
    expect(mapped.protein_per_100g).toBe(16.9);
    expect(mapped.fat_per_100g).toBe(6.9);
    expect(mapped.carbs_per_100g).toBe(66.3);
    expect(mapped.fiber_per_100g).toBe(10.6);
    expect(mapped.sugar_per_100g).toBe(1);
    expect(mapped.sodium_mg_per_100g).toBe(6);
    expect(mapped.attribution).toBe('USDA FoodData Central');
    expect(mapped.serving_units?.some((u) => u.unit === 'serving' && u.grams === 40)).toBe(true);
  });

  it('enforces rate limiting per client IP/ID', () => {
    resetRateLimits();
    const testIp = 'test-client-ip-999';
    // First 60 requests should succeed
    for (let i = 0; i < 60; i++) {
      expect(checkRateLimit(testIp)).toBe(true);
    }
    // 61st request should be blocked
    expect(checkRateLimit(testIp)).toBe(false);
  });
});
