import type { CreateFoodInput, ServingUnit } from './types';

// In-memory sliding-window rate limiter (60 requests per minute per IP / token)
const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 60;
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();

export function checkRateLimit(clientId: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(clientId);

  if (!record || now - record.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(clientId, { count: 1, windowStart: now });
    return true;
  }

  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  record.count += 1;
  return true;
}

export function resetRateLimits(): void {
  rateLimitMap.clear();
}

/**
 * Maps an Open Food Facts product JSON to our standard food schema.
 */
export function mapOpenFoodFactsProduct(
  barcode: string,
  product: Record<string, unknown>,
): CreateFoodInput {
  const nutriments = (product.nutriments as Record<string, unknown> | undefined) || {};

  const name =
    (product.product_name as string) ||
    (product.product_name_en as string) ||
    (product.generic_name as string) ||
    'Unknown Product';
  const brand = (product.brands as string) || (product.brand_owner as string) || null;

  // Energy in kcal
  let calories = Number(
    nutriments['energy-kcal_100g'] ??
      nutriments['energy-kcal'] ??
      (nutriments['energy_100g'] ? Number(nutriments['energy_100g']) / 4.184 : 0),
  );
  if (isNaN(calories) || calories < 0) calories = 0;

  const protein = Math.max(0, Number(nutriments.proteins_100g ?? 0) || 0);
  const carbs = Math.max(0, Number(nutriments.carbohydrates_100g ?? 0) || 0);
  const fat = Math.max(0, Number(nutriments.fat_100g ?? 0) || 0);
  const fiber = Math.max(0, Number(nutriments.fiber_100g ?? 0) || 0);
  const sugar = Math.max(0, Number(nutriments.sugars_100g ?? 0) || 0);

  // Sodium in mg
  let sodiumMg = 0;
  if (nutriments.sodium_100g !== undefined) {
    sodiumMg = Number(nutriments.sodium_100g) * 1000;
  } else if (nutriments.salt_100g !== undefined) {
    sodiumMg = Number(nutriments.salt_100g) * 400; // ~400mg sodium per 1g salt
  }
  if (isNaN(sodiumMg) || sodiumMg < 0) sodiumMg = 0;

  const servingUnits: ServingUnit[] = [{ unit: 'g', grams: 1 }];

  if (product.serving_quantity) {
    const qty = Number(product.serving_quantity);
    if (!isNaN(qty) && qty > 0) {
      servingUnits.push({
        unit: 'serving',
        grams: qty,
        description: (product.serving_size as string) || `1 serving (${qty}g)`,
      });
    }
  }

  return {
    source: 'off',
    name: name.trim(),
    brand: brand ? String(brand).trim() : null,
    barcode: barcode.trim(),
    serving_units: servingUnits,
    calories_per_100g: Math.round(calories * 10) / 10,
    protein_per_100g: Math.round(protein * 10) / 10,
    carbs_per_100g: Math.round(carbs * 10) / 10,
    fat_per_100g: Math.round(fat * 10) / 10,
    fiber_per_100g: Math.round(fiber * 10) / 10,
    sugar_per_100g: Math.round(sugar * 10) / 10,
    sodium_mg_per_100g: Math.round(sodiumMg * 10) / 10,
    owner_id: null,
    attribution: 'Open Food Facts (ODbL)',
  };
}

/**
 * Maps a USDA FoodData Central item JSON to our standard food schema.
 */
export function mapUsdaFoodItem(item: Record<string, unknown>): CreateFoodInput {
  const nutrients = ((item.foodNutrients as unknown[]) || []) as Array<{
    nutrientId?: number;
    nutrientNumber?: string;
    value?: number;
  }>;

  const getNutrient = (id: number): number => {
    const found = nutrients.find((n) => n.nutrientId === id);
    return found?.value && !isNaN(found.value) && found.value >= 0 ? found.value : 0;
  };

  const calories = getNutrient(1008); // Energy (kcal)
  const protein = getNutrient(1003); // Protein (g)
  const fat = getNutrient(1004); // Total lipid (fat) (g)
  const carbs = getNutrient(1005); // Carbohydrate, by difference (g)
  const fiber = getNutrient(1079); // Fiber, total dietary (g)
  const sugar = getNutrient(2000); // Sugars, total (g)
  const sodium = getNutrient(1093); // Sodium, Na (mg)

  const servingUnits: ServingUnit[] = [{ unit: 'g', grams: 1 }];

  const householdText = typeof item.householdServingFullText === 'string' ? item.householdServingFullText : undefined;
  if (item.servingSize && Number(item.servingSize) > 0) {
    const sGrams = Number(item.servingSize);
    servingUnits.push({
      unit: 'serving',
      grams: sGrams,
      description: householdText || `1 serving (${sGrams}g)`,
    });
  }

  const desc = typeof item.description === 'string' ? item.description.trim() : 'Unknown Food';
  const brand = (typeof item.brandOwner === 'string' ? item.brandOwner : typeof item.brandName === 'string' ? item.brandName : null) || null;
  const barcode = typeof item.gtinUpc === 'string' ? item.gtinUpc : null;

  return {
    source: 'usda',
    name: desc,
    brand,
    barcode,
    serving_units: servingUnits,
    calories_per_100g: Math.round(calories * 10) / 10,
    protein_per_100g: Math.round(protein * 10) / 10,
    carbs_per_100g: Math.round(carbs * 10) / 10,
    fat_per_100g: Math.round(fat * 10) / 10,
    fiber_per_100g: Math.round(fiber * 10) / 10,
    sugar_per_100g: Math.round(sugar * 10) / 10,
    sodium_mg_per_100g: Math.round(sodium * 10) / 10,
    owner_id: null,
    attribution: 'USDA FoodData Central',
  };
}
