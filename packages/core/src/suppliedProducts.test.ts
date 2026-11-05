import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { suppliedProductToFood, type SuppliedFoodProduct } from './suppliedProducts';
import { scaleNutrients, foodFromEntrySnapshot } from './food';
import {
  parseNutritionDetails,
  resizeNutrientSnapshot,
  restrictFoodNutrition,
  sumNutrientSnapshots,
} from './advancedNutrition';
import type { Food, FoodEntry } from './types';

const data = JSON.parse(
  readFileSync(
    new URL('../../../datasets/supplied_food_products_2026_11_05.json', import.meta.url),
    'utf8',
  ),
) as {
  metadata: { count: number; original_header_count: number };
  products: SuppliedFoodProduct[];
};
const foods = JSON.parse(
  readFileSync(new URL('../../../app/assets/supplied_food_products.json', import.meta.url), 'utf8'),
) as Food[];
it('imports all 156 complete source products with stable UUIDs, retaining explicit unknown label values', () => {
  expect(data.metadata).toMatchObject({ count: 156, original_header_count: 67 });
  expect(foods).toHaveLength(156);
  expect(new Set(foods.map((food) => food.id)).size).toBe(156);
  for (const [index, product] of data.products.entries()) {
    expect(product.id).toBe(index + 1);
    const food = foods[index]!;
    expect(food.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(food).toMatchObject({
      name: product.product,
      brand: product.brand,
      source: 'supplied',
      owner_id: null,
    });
    const portion = scaleNutrients(food, 1, product.serving_description);
    const rounded = (value: number) => Math.round(value * 10) / 10;
    expect(portion).toMatchObject({
      calories: rounded(product.calories_kcal),
      protein: rounded(product.protein_g),
      carbs: rounded(product.carbs_g),
      fat: rounded(product.fat_g),
      sugar: rounded(product.sugar_g),
      fiber: rounded(product.fibre_g),
    });
    expect(portion.nutrition_details?.bcaa_g).toBe(
      product.bcaa_g === null ? null : rounded(product.bcaa_g),
    );
    expect(portion.nutrition_details?.label_protein_per_100g).toBe(product.protein_per_100g);
  }
  expect(foods.filter((food) => food.nutrition_details?.bcaa_g === null)).toHaveLength(94);
});
it('scales known BCAA with the portion but retains original label reference values and nulls', () => {
  const food = suppliedProductToFood(data.products[0]!, 'fixture');
  const portion = scaleNutrients(food, 1, food.serving_units[0]!.unit);
  expect(portion).toMatchObject({
    calories: 135,
    protein: 24,
    nutrition_details: { bcaa_g: 5.5, label_protein_per_100g: 72.7, not_provided: ['sodium_mg'] },
  });
  expect(resizeNutrientSnapshot(portion, 1, 2).nutrition_details).toMatchObject({
    bcaa_g: 11,
    label_protein_per_100g: 72.7,
  });
  const shake = foods[57]!;
  expect(scaleNutrients(shake, 1, shake.serving_units[0]!.unit)).toMatchObject({
    calories: 160,
    protein: 30,
    nutrition_details: { bcaa_g: null, label_protein_per_100g: null },
  });
});
it('preserves unknowns when summing and keeps label references out of mixed-food totals', () => {
  const first = scaleNutrients(foods[0]!, 1, foods[0]!.serving_units[0]!.unit);
  const missing = scaleNutrients(foods[3]!, 1, foods[3]!.serving_units[0]!.unit);
  expect(sumNutrientSnapshots([first, first]).nutrition_details?.bcaa_g).toBe(11);
  expect(sumNutrientSnapshots([first, missing]).nutrition_details).toMatchObject({
    bcaa_g: null,
    not_provided: ['sodium_mg'],
  });
  expect(
    sumNutrientSnapshots([first, first]).nutrition_details?.label_protein_per_100g,
  ).toBeUndefined();
  expect(restrictFoodNutrition(foods[0]!, false).nutrition_details).toEqual({ locked: true });
});
it('keeps metadata through JSON/cache parsing and large-portion snapshot reconstruction', () => {
  const details = {
    bcaa_g: 0.25,
    label_protein_per_100g: null,
    not_provided: ['sodium_mg'] as const,
  };
  expect(parseNutritionDetails(JSON.stringify(details))).toEqual(details);
  expect(
    parseNutritionDetails({
      bcaa_g: 'null',
      label_protein_per_100g: NaN,
      not_provided: ['invalid', 1],
    }),
  ).toEqual({ not_provided: [] });
  const portion = {
    ...scaleNutrients(foods[0]!, 1000, 'g'),
    nutrition_details: { bcaa_g: 2.5, saturated_fat: 2.5, label_protein_per_100g: null },
  };
  const food = foodFromEntrySnapshot({
    ...portion,
    quantity: 1000,
    unit: 'g',
    id: 'snapshot',
    food_name: 'Food',
    user_id: 'owner',
    brand_name: null,
  } as FoodEntry);
  expect(scaleNutrients(food, 1000, 'g').nutrition_details).toMatchObject(
    portion.nutrition_details,
  );
});
it.each([0, -1, NaN])(
  'rejects an invalid supplied serving size (%s) instead of inventing nutrition',
  (serving_size_g) => {
    expect(() =>
      suppliedProductToFood({ ...data.products[0]!, serving_size_g }, 'fixture'),
    ).toThrow('INVALID_SUPPLIED_FOOD');
  },
);
