import { expect, it } from 'vitest';
import { savedMealFood, savedMealItems, savedMealTotals } from './savedMeals';
import { scaleNutrients } from './food';
import type { Food } from './types';
const food: Food = {
  id: 'oats',
  source: 'user',
  name: 'Oats',
  brand: null,
  barcode: null,
  owner_id: null,
  attribution: null,
  serving_units: [{ unit: 'bowl', grams: 50 }],
  calories_per_100g: 400,
  protein_per_100g: 20,
  carbs_per_100g: 60,
  fat_per_100g: 10,
  fiber_per_100g: 5,
  sugar_per_100g: 0,
  sodium_mg_per_100g: 0,
};
it('preserves selected portions and corrected macros through a saved-meal round trip', () => {
  const items = savedMealItems([
    { food, quantity: 2, unit: 'bowl', nutrientOverrides: { protein: 25 } },
    { food, quantity: 50, unit: 'g' },
  ]);
  expect(savedMealTotals(items)).toEqual({
    total_calories: 600,
    total_protein: 35,
    total_carbs: 90,
    total_fat: 15,
  });
  const restored = scaleNutrients(savedMealFood(items[0]!), 2, 'bowl');
  expect(restored.calories).toBe(400);
  expect(restored.protein).toBe(25);
});
it('rejects empty meals and invalid portions', () => {
  expect(() => savedMealItems([])).toThrow();
  expect(() => savedMealItems([{ food, quantity: NaN, unit: 'g' }])).toThrow();
  expect(() =>
    savedMealFood({
      food_id: '',
      food_name: '',
      quantity: 0,
      unit: 'g',
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    }),
  ).toThrow();
});
