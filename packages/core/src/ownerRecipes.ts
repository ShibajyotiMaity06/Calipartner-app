import type { Recipe } from './types';

export interface OwnerRecipe {
  name: string;
  region: string;
  type: string;
  time_minutes: number;
  serves: number;
  focus?: string | string[];
  ingredients: { item: string; qty: string }[];
  steps: string[];
  macros: {
    per: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g: number;
  };
}

/** Adapt supplied content without guessing meal types, difficulty, food IDs or nutrients. */
export function ownerRecipeToRecipe(input: OwnerRecipe, id: string): Recipe {
  const numbers = [
    input.time_minutes,
    input.serves,
    input.macros.calories,
    input.macros.protein_g,
    input.macros.carbs_g,
    input.macros.fat_g,
    input.macros.fiber_g,
  ];
  if (
    !input.name.trim() ||
    !numbers.every((n) => Number.isFinite(n) && n >= 0) ||
    input.serves <= 0
  )
    throw new Error('Invalid supplied recipe');
  const focus = (Array.isArray(input.focus) ? input.focus : input.focus ? [input.focus] : []).map(
    (value) => value.toLowerCase().replace(/ /g, '-').replace('fibre', 'fiber'),
  );
  const diet =
    input.type.toLowerCase() === 'veg'
      ? 'vegetarian'
      : input.type.toLowerCase() === 'egg'
        ? 'eggetarian'
        : 'non_vegetarian';
  return {
    id,
    title: input.name,
    cuisine: input.region,
    diet_tags: [diet, ...focus.map((value) => value.replaceAll('-', '_'))],
    meal_type: 'unspecified',
    difficulty: 'unspecified',
    prep_minutes: 0,
    cook_minutes: input.time_minutes,
    servings: input.serves,
    steps: input.steps,
    tips: [],
    image_urls: [],
    status: 'published',
    nutrition_per_serving: {
      calories: input.macros.calories,
      protein: input.macros.protein_g,
      carbs: input.macros.carbs_g,
      fat: input.macros.fat_g,
      fiber: input.macros.fiber_g,
    },
    source_portion: input.macros.per,
    nutrition_focus: focus,
    nutrition_override_reason: `Owner-supplied reci.txt nutrition per ${input.macros.per}`,
    version: 1,
    created_at: '2026-11-01T00:00:00Z',
    updated_at: '2026-11-01T00:00:00Z',
    ingredients: input.ingredients.map((ingredient, index) => {
      // Keep the original text for unmeasured amounts; do not invent gram equivalents.
      const match = ingredient.qty.match(/^(\d+(?:\.\d+)?)(?:\s+(\d+)\/(\d+)|\/(\d+))?\s*(.*)$/);
      const quantity = match
        ? match[4]
          ? Number(match[1]) / Number(match[4])
          : Number(match[1]) + (match[2] ? Number(match[2]) / Number(match[3]) : 0)
        : 0;
      return {
        food_id: '',
        food_name: ingredient.item,
        quantity,
        unit: match?.[5] ?? '',
        source_quantity: ingredient.qty,
        display_order: index,
      };
    }),
  };
}
