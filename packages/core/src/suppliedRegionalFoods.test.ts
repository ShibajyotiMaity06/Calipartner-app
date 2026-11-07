import { expect, it } from 'vitest';
import { suppliedRegionalFoodToCatalog } from './suppliedRegionalFoods';
const food = {
  name: 'Regional dish',
  brand: null,
  amount: 200,
  unit: 'g' as const,
  calories_kcal: 230,
  protein_g: 5,
  fat_g: 1.5,
  carbs_g: 50,
  fibre_g: 3.5,
  attribution: 'Supplied estimate',
};
it('normalises serving estimates and marks missing values without changing serving units', () => {
  expect(suppliedRegionalFoodToCatalog(food, 'id')).toMatchObject({
    calories_per_100g: 115,
    protein_per_100g: 2.5,
    nutrition_details: { not_provided: ['sodium_mg', 'sugar'] },
    serving_units: [
      { unit: '200 g serving', grams: 200 },
      { unit: 'g', grams: 1 },
    ],
  });
  expect(suppliedRegionalFoodToCatalog({ ...food, unit: 'ml', sugar_g: 4 }, 'id')).toMatchObject({
    sugar_per_100g: 2,
    serving_units: [
      { unit: '200 ml serving', grams: 200 },
      { unit: 'ml', grams: 1 },
    ],
    nutrition_details: { not_provided: ['sodium_mg'] },
  });
});
it('rejects malformed serving bases and nutrition', () => {
  for (const invalid of [{ amount: 0 }, { protein_g: -1 }, { calories_kcal: NaN }, { name: '' }])
    expect(() => suppliedRegionalFoodToCatalog({ ...food, ...invalid }, 'id')).toThrow();
});
