import { describe, expect, it } from 'vitest';
import {
  applyNutrientCorrection,
  customFoodNutritionForPortion,
  foodFavoriteKey,
  scaleNutrients,
} from './food';
import type { Food } from './types';
const snapshot = {
  calories: 450,
  protein: 55,
  carbs: 30,
  fat: 10,
  fiber: 4,
  sugar: 2,
  sodium_mg: 30,
  nutrition_details: { saturated_fat: 2, cholesterol_mg: 10 },
};
describe('per-portion nutrition corrections', () => {
  it('keeps the requested 50g of protein and all other nutrients without mutating the source', () => {
    expect(applyNutrientCorrection(snapshot, { protein: 50 })).toEqual({
      ...snapshot,
      protein: 50,
    });
    expect(snapshot.protein).toBe(55);
  });
  it.each([NaN, Infinity, -1, 100001])('rejects invalid corrected numbers %s', (protein) =>
    expect(() => applyNutrientCorrection(snapshot, { protein })).toThrow(),
  );
  it('validates calories and preserves zero macros as intentional corrections', () => {
    expect(applyNutrientCorrection(snapshot, { protein: 0 }).protein).toBe(0);
    expect(() => applyNutrientCorrection(snapshot, { calories: 0 })).toThrow(
      'FOOD_ENERGY_UNAVAILABLE',
    );
  });
  it('converts custom food portions centrally and never treats one gram as 100 grams', () => {
    const nutrition = customFoodNutritionForPortion({ ...snapshot, protein: 50 }, 100, 'g');
    const food = {
      id: 'food',
      source: 'user',
      name: 'My food',
      brand: null,
      barcode: null,
      owner_id: 'owner',
      attribution: null,
      ...nutrition,
    } as Food;
    expect(scaleNutrients(food, 1, 'serving').protein).toBe(50);
    expect(scaleNutrients(food, 100, 'g').protein).toBe(50);
    expect(scaleNutrients(food, 1, 'g').protein).toBe(0.5);
  });
  it('rejects negative or non-finite custom-food amounts', () => {
    expect(() => customFoodNutritionForPortion({ ...snapshot, fat: -1 }, 100, 'g')).toThrow();
    expect(() => customFoodNutritionForPortion(snapshot, 0, 'g')).toThrow();
  });
  it('uses stable natural keys when remote searches assign new UUIDs', () => {
    const food = { id: 'one', source: 'usda', name: 'Chicken', brand: null, barcode: null } as Food;
    expect(foodFavoriteKey(food)).toBe(foodFavoriteKey({ ...food, id: 'two' }));
  });
});
