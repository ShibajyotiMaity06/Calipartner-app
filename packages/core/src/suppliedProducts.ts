import type { Food } from './types';

export interface SuppliedFoodProduct {
  id: number;
  brand: string;
  product: string;
  category: string;
  origin: string;
  serving_size_g: number;
  serving_description: string;
  calories_kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  sugar_g: number;
  fibre_g: number;
  bcaa_g: number | null;
  protein_per_100g: number | null;
}

/** Normalize provided serving nutrition; the original optional label values remain intact. */
export function suppliedProductToFood(product: SuppliedFoodProduct, id: string): Food {
  if (
    !product.brand.trim() ||
    !product.product.trim() ||
    !product.serving_description.trim() ||
    !Number.isFinite(product.serving_size_g) ||
    product.serving_size_g <= 0
  )
    throw new Error('INVALID_SUPPLIED_FOOD');
  for (const value of [
    product.calories_kcal,
    product.protein_g,
    product.fat_g,
    product.carbs_g,
    product.sugar_g,
    product.fibre_g,
  ])
    if (!Number.isFinite(value) || value < 0) throw new Error('INVALID_SUPPLIED_FOOD');
  for (const value of [product.bcaa_g, product.protein_per_100g])
    if (value !== null && (!Number.isFinite(value) || value < 0))
      throw new Error('INVALID_SUPPLIED_FOOD');
  const per100 = (value: number) => (value * 100) / product.serving_size_g;
  return {
    id,
    source: 'supplied',
    name: product.product,
    brand: product.brand,
    barcode: null,
    owner_id: null,
    serving_units: [
      { unit: product.serving_description, grams: product.serving_size_g },
      { unit: 'g', grams: 1 },
    ],
    calories_per_100g: per100(product.calories_kcal),
    protein_per_100g: per100(product.protein_g),
    carbs_per_100g: per100(product.carbs_g),
    fat_per_100g: per100(product.fat_g),
    sugar_per_100g: per100(product.sugar_g),
    fiber_per_100g: per100(product.fibre_g),
    sodium_mg_per_100g: 0,
    nutrition_details: {
      bcaa_g: product.bcaa_g === null ? null : per100(product.bcaa_g),
      label_protein_per_100g: product.protein_per_100g,
      saturated_fat: null,
      cholesterol_mg: null,
      not_provided: ['sodium_mg'],
    },
    attribution: `Owner-supplied food (1).txt; approximate per-serving label data; ${product.category}; ${product.origin}; verify flavour/batch against the pack`,
  };
}
