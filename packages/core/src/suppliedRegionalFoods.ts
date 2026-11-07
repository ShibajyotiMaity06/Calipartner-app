import type { Food } from './types';

export interface SuppliedRegionalFood {
  name: string;
  brand: string | null;
  amount: number;
  unit: 'g' | 'ml';
  calories_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fibre_g: number;
  sugar_g?: number;
  attribution: string;
}
/** Source volumes stay in ml. The catalogue's per-100 fields support both g and ml. */
export function suppliedRegionalFoodToCatalog(input: SuppliedRegionalFood, id: string): Food {
  if (
    !input.name.trim() ||
    !input.attribution.trim() ||
    !['g', 'ml'].includes(input.unit) ||
    !Number.isFinite(input.amount) ||
    input.amount <= 0
  )
    throw new Error('INVALID_SUPPLIED_FOOD');
  for (const value of [
    input.calories_kcal,
    input.protein_g,
    input.carbs_g,
    input.fat_g,
    input.fibre_g,
    ...(input.sugar_g === undefined ? [] : [input.sugar_g]),
  ]) {
    if (!Number.isFinite(value) || value < 0) throw new Error('INVALID_SUPPLIED_FOOD');
  }
  const per100 = (value: number) => Math.round(((value * 100) / input.amount) * 100) / 100;
  return {
    id,
    source: 'supplied',
    name: input.name,
    brand: input.brand,
    barcode: null,
    owner_id: null,
    serving_units: [
      { unit: `${input.amount} ${input.unit} serving`, grams: input.amount },
      { unit: input.unit, grams: 1 },
    ],
    calories_per_100g: per100(input.calories_kcal),
    protein_per_100g: per100(input.protein_g),
    carbs_per_100g: per100(input.carbs_g),
    fat_per_100g: per100(input.fat_g),
    fiber_per_100g: per100(input.fibre_g),
    sugar_per_100g: input.sugar_g === undefined ? 0 : per100(input.sugar_g),
    sodium_mg_per_100g: 0,
    nutrition_details: {
      saturated_fat: null,
      cholesterol_mg: null,
      not_provided: input.sugar_g === undefined ? ['sodium_mg', 'sugar'] : ['sodium_mg'],
    },
    attribution: input.attribution,
  };
}
