import { describe, expect, it } from 'vitest';
import {
  parseNutritionDetails,
  resizeNutrientSnapshot,
  restrictFoodNutrition,
  restrictNutritionSnapshot,
  sumNutrientSnapshots,
} from './advancedNutrition';
import { foodFromEntrySnapshot, scaleNutrients } from './food';
import { mapVisionItemToFood } from './ai_food_photo';
import type { Food, FoodEntry } from './types';

const food: Food = {
  id: 'scan',
  source: 'off',
  name: 'Cereal',
  brand: null,
  barcode: null,
  owner_id: null,
  attribution: null,
  serving_units: [{ unit: 'g', grams: 1 }],
  calories_per_100g: 400,
  protein_per_100g: 12,
  carbs_per_100g: 70,
  fat_per_100g: 7,
  fiber_per_100g: 9,
  sugar_per_100g: 11,
  sodium_mg_per_100g: 350,
  nutrition_details: { saturated_fat: 2, cholesterol_mg: null },
};
describe('scan nutrition', () => {
  it('reopens an existing gram portion without multiplying its calories or losing advanced nutrients', () => {
    const portion = scaleNutrients(food, 40, 'g');
    const entry: FoodEntry = {
      ...portion,
      id: 'entry',
      food_id: food.id,
      user_id: 'owner',
      food_name: food.name,
      brand_name: null,
      quantity: 40,
      unit: 'g',
      meal_section: 'lunch',
      logged_at: '2026-10-27T00:00:00Z',
      local_date: '2026-10-27',
      source: 'scan',
      shared_meal_id: null,
      updated_at: '2026-10-27T00:00:00Z',
      deleted_at: null,
    };
    const editable = foodFromEntrySnapshot(entry);
    expect(scaleNutrients(editable, 40, 'g')).toEqual(portion);
    expect(scaleNutrients(editable, 80, 'g').calories).toBe(320);
  });
  it('uses catalog macros and fills missing extra nutrients from the labelled photo estimate', () => {
    const catalog = { ...food, nutrition_details: null };
    const result = mapVisionItemToFood(
      {
        food_name: food.name,
        estimated_grams: 50,
        confidence: 0.9,
        nutrition_per_100g: {
          calories: 450,
          protein: 10,
          carbs: 65,
          fat: 8,
          sugar: 12,
          sodium_mg: 300,
          saturated_fat: 2,
          cholesterol_mg: 10,
        },
      },
      [catalog],
      'candidate',
    );
    expect(result.nutrients).toMatchObject({
      calories: 200,
      nutrition_details: { saturated_fat: 1, cholesterol_mg: 5 },
    });
    expect(result.is_estimate).toBe(true);
    expect(catalog.nutrition_details).toBeNull();
  });
  it('scales available nutrients and preserves unknown values rather than inventing zero', () => {
    const portion = scaleNutrients(food, 50, 'g');
    expect(portion).toMatchObject({
      calories: 200,
      fiber: 4.5,
      sugar: 5.5,
      sodium_mg: 175,
      nutrition_details: { saturated_fat: 1, cholesterol_mg: null },
    });
    expect(resizeNutrientSnapshot(portion, 50, 100)).toEqual(scaleNutrients(food, 100, 'g'));
    expect(sumNutrientSnapshots([portion, portion])).toMatchObject({
      fiber: 9,
      sugar: 11,
      nutrition_details: { saturated_fat: 2, cholesterol_mg: null },
    });
  });
  it('redacts advanced fields without changing basic macros or mutating catalog values', () => {
    const hidden = restrictFoodNutrition(food, false);
    expect(hidden).toMatchObject({
      protein_per_100g: 12,
      fiber_per_100g: 0,
      nutrition_details: { locked: true },
    });
    expect(hidden.nutrition_details?.saturated_fat).toBeUndefined();
    expect(restrictNutritionSnapshot(scaleNutrients(food, 100, 'g'), false)).toMatchObject({
      calories: 400,
      sugar: 0,
      sodium_mg: 0,
      nutrition_details: { locked: true },
    });
    expect(food.fiber_per_100g).toBe(9);
    expect(restrictFoodNutrition(food, true)).toBe(food);
  });
  it('parses durable metadata and fails closed for malformed local JSON', () => {
    expect(parseNutritionDetails('{"saturated_fat":2,"cholesterol_mg":null}')).toEqual(
      food.nutrition_details,
    );
    expect(parseNutritionDetails('{broken')).toBeNull();
    expect(
      parseNutritionDetails({ saturated_fat: -2, cholesterol_mg: Infinity, locked: true }),
    ).toEqual({ locked: true });
  });
});
