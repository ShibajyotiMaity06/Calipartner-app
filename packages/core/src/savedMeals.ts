import type { Food, SavedMealItem } from './types.ts';
import { scaleNutrients, applyNutrientCorrection, type NutrientCorrection } from './food.ts';
import { sumNutrientSnapshots, scaleNutritionDetails } from './advancedNutrition.ts';

export interface MealSelection {
  food: Food;
  quantity: number;
  unit: string;
  nutrientOverrides?: NutrientCorrection;
}
export function savedMealItems(selection: MealSelection[]): SavedMealItem[] {
  if (!selection.length || selection.length > 50) throw new Error('INVALID_MEAL');
  return selection.map((item) => {
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) throw new Error('INVALID_QUANTITY');
    const snapshot = applyNutrientCorrection(
      scaleNutrients(item.food, item.quantity, item.unit),
      item.nutrientOverrides,
    );
    return {
      food_id: item.food.id,
      food_name: item.food.name,
      brand_name: item.food.brand,
      quantity: item.quantity,
      unit: item.unit,
      ...snapshot,
    };
  });
}
export function savedMealTotals(items: SavedMealItem[]) {
  const totals = sumNutrientSnapshots(
    items.map((item) => ({ ...item, fiber: item.fiber ?? 0, sugar: 0, sodium_mg: 0 })),
  );
  return {
    total_calories: totals.calories,
    total_protein: totals.protein,
    total_carbs: totals.carbs,
    total_fat: totals.fat,
  };
}
/** Reconstruct a serving from the saved snapshot without changing its original portion. */
export function savedMealFood(item: SavedMealItem): Food {
  if (!Number.isFinite(item.quantity) || item.quantity <= 0) throw new Error('INVALID_QUANTITY');
  const scale = 100 / item.quantity;
  return {
    id: item.food_id,
    name: item.food_name,
    brand: item.brand_name ?? null,
    source: 'user',
    owner_id: null,
    barcode: null,
    attribution: 'Saved meal',
    serving_units: [{ unit: item.unit, grams: 1 }],
    calories_per_100g: item.calories * scale,
    protein_per_100g: item.protein * scale,
    carbs_per_100g: item.carbs * scale,
    fat_per_100g: item.fat * scale,
    fiber_per_100g: (item.fiber ?? 0) * scale,
    sugar_per_100g: (item.sugar ?? 0) * scale,
    sodium_mg_per_100g: (item.sodium_mg ?? 0) * scale,
    nutrition_details: {
      ...scaleNutritionDetails(item.nutrition_details ?? {}, scale, false),
      not_provided: [
        ...(item.nutrition_details?.not_provided ?? []),
        ...(item.sugar === undefined ? ['sugar' as const] : []),
        ...(item.sodium_mg === undefined ? ['sodium_mg' as const] : []),
        ...(item.fiber === undefined ? ['fiber' as const] : []),
      ],
    },
  };
}
