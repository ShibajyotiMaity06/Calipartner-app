import type { Food, NutrientSnapshot, NutritionDetails } from './types';

/** Extra gram/mg amounts scale with the portion; label reference values and unknowns do not. */
export function scaleNutritionDetails(
  value: NutritionDetails,
  factor: number,
  roundPortion = true,
): NutritionDetails {
  const scaled = (amount: number | null | undefined) =>
    amount == null ? null : roundPortion ? Math.round(amount * factor * 10) / 10 : amount * factor;
  return {
    ...(value.locked ? { locked: true } : {}),
    saturated_fat: scaled(value.saturated_fat),
    cholesterol_mg: scaled(value.cholesterol_mg),
    ...('bcaa_g' in value ? { bcaa_g: scaled(value.bcaa_g) } : {}),
    ...('label_protein_per_100g' in value
      ? { label_protein_per_100g: value.label_protein_per_100g }
      : {}),
    ...(value.not_provided ? { not_provided: [...value.not_provided] } : {}),
  };
}

export function restrictFoodNutrition(food: Food, allowed: boolean): Food {
  return allowed
    ? food
    : {
        ...food,
        fiber_per_100g: 0,
        sugar_per_100g: 0,
        sodium_mg_per_100g: 0,
        nutrition_details: { locked: true },
      };
}
export function restrictNutritionSnapshot(
  value: NutrientSnapshot,
  allowed: boolean,
): NutrientSnapshot {
  return allowed
    ? value
    : { ...value, fiber: 0, sugar: 0, sodium_mg: 0, nutrition_details: { locked: true } };
}

/** Resize an already logged portion when the original catalog food is unavailable offline. */
export function resizeNutrientSnapshot(
  value: NutrientSnapshot,
  previousQuantity: number,
  nextQuantity: number,
): NutrientSnapshot {
  const factor =
    previousQuantity > 0 && Number.isFinite(nextQuantity)
      ? Math.max(0, nextQuantity) / previousQuantity
      : 0;
  const scaled = (amount: number) => Math.round(amount * factor * 10) / 10;
  return {
    ...value,
    calories: scaled(value.calories),
    protein: scaled(value.protein),
    carbs: scaled(value.carbs),
    fat: scaled(value.fat),
    fiber: scaled(value.fiber),
    sugar: scaled(value.sugar),
    sodium_mg: scaled(value.sodium_mg),
    ...(value.nutrition_details
      ? {
          nutrition_details: scaleNutritionDetails(value.nutrition_details, factor),
        }
      : {}),
  };
}

export function sumNutrientSnapshots(values: readonly NutrientSnapshot[]): NutrientSnapshot {
  const round = (value: number) => Math.round(value * 10) / 10;
  const sum = (key: 'calories' | 'protein' | 'carbs' | 'fat' | 'fiber' | 'sugar' | 'sodium_mg') =>
    round(values.reduce((total, item) => total + item[key], 0));
  const extra = (key: 'saturated_fat' | 'cholesterol_mg' | 'bcaa_g') =>
    values.some((item) => item.nutrition_details?.[key] == null)
      ? null
      : round(values.reduce((total, item) => total + (item.nutrition_details?.[key] ?? 0), 0));
  return {
    calories: sum('calories'),
    protein: sum('protein'),
    carbs: sum('carbs'),
    fat: sum('fat'),
    fiber: sum('fiber'),
    sugar: sum('sugar'),
    sodium_mg: sum('sodium_mg'),
    nutrition_details: {
      saturated_fat: extra('saturated_fat'),
      cholesterol_mg: extra('cholesterol_mg'),
      ...(values.some((item) => item.nutrition_details && 'bcaa_g' in item.nutrition_details)
        ? { bcaa_g: extra('bcaa_g') }
        : {}),
      ...(values.some((item) => item.nutrition_details?.not_provided?.length)
        ? {
            not_provided: [
              ...new Set(values.flatMap((item) => item.nutrition_details?.not_provided ?? [])),
            ],
          }
        : {}),
      locked: values.some((item) => item.nutrition_details?.locked),
    },
  };
}

/** Parse the same JSON field from SQLite strings or Supabase objects. */
export function parseNutritionDetails(raw: unknown): NutritionDetails | null {
  try {
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const result: NutritionDetails = {};
    for (const key of [
      'saturated_fat',
      'cholesterol_mg',
      'bcaa_g',
      'label_protein_per_100g',
    ] as const) {
      const amount = value[key];
      if (amount === null || (typeof amount === 'number' && Number.isFinite(amount) && amount >= 0))
        result[key] = amount;
    }
    if (value.locked === true) result.locked = true;
    if (Array.isArray(value.not_provided)) {
      const fields: unknown[] = value.not_provided;
      result.not_provided = [
        ...new Set(
          fields.filter(
            (key: unknown): key is 'fiber' | 'sugar' | 'sodium_mg' =>
              typeof key === 'string' && ['fiber', 'sugar', 'sodium_mg'].includes(key),
          ),
        ),
      ];
    }
    return result;
  } catch {
    return null;
  }
}
