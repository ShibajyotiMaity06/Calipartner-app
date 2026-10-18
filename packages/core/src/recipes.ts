import { resolveUnitGrams } from './food';
import type {
  CreateFoodInput,
  Food,
  NutrientSnapshot,
  Recipe,
  RecipeFilterCriteria,
  RecipeImportInput,
  RecipeNutritionSnapshot,
  RecipeValidationResult,
  ScaledRecipeIngredient,
} from './types';

function roundOneDecimal(num: number): number {
  return Math.round((num + 1e-9) * 10) / 10;
}

function roundTwoDecimals(num: number): number {
  return Math.round((num + 1e-9) * 100) / 100;
}

/**
 * Calculates recipe nutrition per serving from its ingredients.
 * Follows PRD 6.21 RCP-3:
 * "Nutrition per serving is calculated automatically from the linked ingredient
 * foods and quantities when the recipe is published, and stored as a snapshot.
 * Manual overrides require a written reason."
 */
export function calculateRecipeNutrition(
  ingredients: readonly {
    food: Pick<
      Food,
      | 'calories_per_100g'
      | 'protein_per_100g'
      | 'carbs_per_100g'
      | 'fat_per_100g'
      | 'fiber_per_100g'
      | 'sugar_per_100g'
      | 'sodium_mg_per_100g'
      | 'serving_units'
    >;
    quantity: number;
    unit: string;
  }[],
  servings: number,
  manualOverride?: Partial<RecipeNutritionSnapshot> | null,
  overrideReason?: string | null,
): RecipeNutritionSnapshot {
  if (servings <= 0) {
    throw new Error('Recipe servings must be greater than zero');
  }

  // Handle manual override
  if (manualOverride && Object.keys(manualOverride).length > 0) {
    const trimmedReason = overrideReason ? overrideReason.trim() : '';
    if (!trimmedReason) {
      throw new Error('Manual nutrition override requires a written reason (RCP-3)');
    }
    return {
      calories: Math.max(0, roundOneDecimal(manualOverride.calories ?? 0)),
      protein: Math.max(0, roundOneDecimal(manualOverride.protein ?? 0)),
      carbs: Math.max(0, roundOneDecimal(manualOverride.carbs ?? 0)),
      fat: Math.max(0, roundOneDecimal(manualOverride.fat ?? 0)),
      fiber: Math.max(0, roundOneDecimal(manualOverride.fiber ?? 0)),
      sugar:
        manualOverride.sugar !== undefined
          ? Math.max(0, roundOneDecimal(manualOverride.sugar))
          : undefined,
      sodium_mg:
        manualOverride.sodium_mg !== undefined
          ? Math.max(0, roundOneDecimal(manualOverride.sodium_mg))
          : undefined,
    };
  }

  let totalCalories = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  let totalFiber = 0;
  let totalSugar = 0;
  let totalSodiumMg = 0;

  for (const item of ingredients) {
    if (item.quantity <= 0) continue;
    const gramsPerUnit = resolveUnitGrams(item.food, item.unit);
    const totalGrams = item.quantity * gramsPerUnit;
    const factor = totalGrams / 100;

    totalCalories += (item.food.calories_per_100g || 0) * factor;
    totalProtein += (item.food.protein_per_100g || 0) * factor;
    totalCarbs += (item.food.carbs_per_100g || 0) * factor;
    totalFat += (item.food.fat_per_100g || 0) * factor;
    totalFiber += (item.food.fiber_per_100g || 0) * factor;
    totalSugar += (item.food.sugar_per_100g || 0) * factor;
    totalSodiumMg += (item.food.sodium_mg_per_100g || 0) * factor;
  }

  return {
    calories: roundOneDecimal(totalCalories / servings),
    protein: roundOneDecimal(totalProtein / servings),
    carbs: roundOneDecimal(totalCarbs / servings),
    fat: roundOneDecimal(totalFat / servings),
    fiber: roundOneDecimal(totalFiber / servings),
    sugar: roundOneDecimal(totalSugar / servings),
    sodium_mg: roundOneDecimal(totalSodiumMg / servings),
  };
}

/**
 * Scales recipe ingredients when servings change.
 * Follows PRD 6.21 RCP-5:
 * "Servings scaler: changing servings scales the ingredient amounts;
 * nutrition per serving stays the same."
 */
export function scaleRecipeServings(
  recipe: Recipe,
  targetServings: number,
): {
  recipe: Recipe;
  targetServings: number;
  scaledIngredients: ScaledRecipeIngredient[];
  nutritionPerServing: RecipeNutritionSnapshot;
  totalNutrition: RecipeNutritionSnapshot;
} {
  if (targetServings <= 0) {
    throw new Error('Target servings must be greater than zero');
  }

  const baseServings = recipe.servings > 0 ? recipe.servings : 1;
  const scaleRatio = targetServings / baseServings;

  const scaledIngredients: ScaledRecipeIngredient[] = (recipe.ingredients || []).map((ing) => ({
    ...ing,
    base_quantity: ing.quantity,
    scaled_quantity: roundTwoDecimals(ing.quantity * scaleRatio),
  }));

  const totalNutrition: RecipeNutritionSnapshot = {
    calories: roundOneDecimal(recipe.nutrition_per_serving.calories * targetServings),
    protein: roundOneDecimal(recipe.nutrition_per_serving.protein * targetServings),
    carbs: roundOneDecimal(recipe.nutrition_per_serving.carbs * targetServings),
    fat: roundOneDecimal(recipe.nutrition_per_serving.fat * targetServings),
    fiber: roundOneDecimal(recipe.nutrition_per_serving.fiber * targetServings),
    sugar:
      recipe.nutrition_per_serving.sugar !== undefined
        ? roundOneDecimal(recipe.nutrition_per_serving.sugar * targetServings)
        : undefined,
    sodium_mg:
      recipe.nutrition_per_serving.sodium_mg !== undefined
        ? roundOneDecimal(recipe.nutrition_per_serving.sodium_mg * targetServings)
        : undefined,
  };

  return {
    recipe,
    targetServings,
    scaledIngredients,
    nutritionPerServing: recipe.nutrition_per_serving,
    totalNutrition,
  };
}

/**
 * Calculates nutrient snapshot when logging a recipe into food diary.
 * Follows PRD 6.21 RCP-6:
 * "Log this recipe: choose servings (for example 1.5) and a meal section,
 * creating a diary entry with a nutrient snapshot."
 */
export function scaleLoggedRecipeNutrients(
  nutritionPerServing: RecipeNutritionSnapshot,
  servings: number,
): NutrientSnapshot {
  const s = Math.max(0, servings);
  return {
    calories: roundOneDecimal(nutritionPerServing.calories * s),
    protein: roundOneDecimal(nutritionPerServing.protein * s),
    carbs: roundOneDecimal(nutritionPerServing.carbs * s),
    fat: roundOneDecimal(nutritionPerServing.fat * s),
    fiber: roundOneDecimal(nutritionPerServing.fiber * s),
    sugar:
      nutritionPerServing.sugar !== undefined ? roundOneDecimal(nutritionPerServing.sugar * s) : 0,
    sodium_mg:
      nutritionPerServing.sodium_mg !== undefined
        ? roundOneDecimal(nutritionPerServing.sodium_mg * s)
        : 0,
  };
}

/**
 * Filters a list of recipes according to criteria.
 * Follows PRD 6.21 RCP-4:
 * "Browse and search by name, ingredient and tag.
 * Filters: meal type, diet, calorie range, minimum protein, time and cuisine."
 */
export function filterRecipes(
  recipes: readonly Recipe[],
  criteria: RecipeFilterCriteria,
): Recipe[] {
  const normQuery = criteria.query?.trim().toLowerCase();
  const normDiet = criteria.diet?.trim().toLowerCase();
  const normCuisine = criteria.cuisine?.trim().toLowerCase();

  return recipes.filter((recipe) => {
    // 1. Text Query (name, description, cuisine, diet tags, ingredient names)
    if (normQuery) {
      const matchTitle = recipe.title.toLowerCase().includes(normQuery);
      const matchDesc = recipe.description?.toLowerCase().includes(normQuery) ?? false;
      const matchCuisine = recipe.cuisine.toLowerCase().includes(normQuery);
      const matchTags = recipe.diet_tags.some((t) => t.toLowerCase().includes(normQuery));
      const matchIngredients = (recipe.ingredients || []).some((ing) =>
        (ing.food_name || ing.food_id).toLowerCase().includes(normQuery),
      );

      if (!matchTitle && !matchDesc && !matchCuisine && !matchTags && !matchIngredients) {
        return false;
      }
    }

    // 2. Meal Type Filter
    if (criteria.meal_type && recipe.meal_type !== criteria.meal_type) {
      return false;
    }

    // 3. Diet Filter (tag match)
    if (normDiet) {
      const hasTag = recipe.diet_tags.some(
        (t) => t.toLowerCase() === normDiet || t.toLowerCase().includes(normDiet),
      );
      if (!hasTag) return false;
    }

    // 4. Calorie Range (per serving)
    const cal = recipe.nutrition_per_serving.calories;
    if (criteria.min_calories !== undefined && cal < criteria.min_calories) {
      return false;
    }
    if (criteria.max_calories !== undefined && cal > criteria.max_calories) {
      return false;
    }

    // 5. Minimum Protein (per serving)
    if (
      criteria.min_protein !== undefined &&
      recipe.nutrition_per_serving.protein < criteria.min_protein
    ) {
      return false;
    }

    // 6. Max Time (prep + cook)
    if (criteria.max_time_minutes !== undefined) {
      const totalTime = (recipe.prep_minutes || 0) + (recipe.cook_minutes || 0);
      if (totalTime > criteria.max_time_minutes) {
        return false;
      }
    }

    // 7. Cuisine Filter
    if (normCuisine && recipe.cuisine.toLowerCase() !== normCuisine) {
      return false;
    }

    return true;
  });
}

/**
 * Computes Levenshtein distance between two strings.
 */
function levenshteinDistance(a: string, b: string): number {
  const an = a.length;
  const bn = b.length;
  if (an === 0) return bn;
  if (bn === 0) return an;

  const matrix: number[][] = [];
  for (let i = 0; i <= bn; i++) matrix[i] = [i];
  for (let j = 0; j <= an; j++) matrix[0]![j] = j;

  for (let i = 1; i <= bn; i++) {
    for (let j = 1; j <= an; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i]![j] = matrix[i - 1]![j - 1]!;
      } else {
        matrix[i]![j] = Math.min(
          matrix[i - 1]![j - 1]! + 1, // substitution
          Math.min(
            matrix[i]![j - 1]! + 1, // insertion
            matrix[i - 1]![j]! + 1, // deletion
          ),
        );
      }
    }
  }
  return matrix[bn]![an]!;
}

/**
 * Computes similarity score between 0.0 and 1.0.
 */
function stringSimilarity(s1: string, s2: string): number {
  const a = s1.trim().toLowerCase();
  const b = s2.trim().toLowerCase();
  if (a === b) return 1.0;
  if (a.includes(b) || b.includes(a)) return 0.85;

  // Token overlap
  const tokensA = new Set(a.split(/[\s,()/-]+/));
  const tokensB = new Set(b.split(/[\s,()/-]+/));
  let common = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) common++;
  }
  const tokenScore = common / Math.max(tokensA.size, tokensB.size);
  if (tokenScore > 0.5) return 0.75 + tokenScore * 0.2;

  const dist = levenshteinDistance(a, b);
  const maxLen = Math.max(a.length, b.length);
  return Math.max(0, 1 - dist / maxLen);
}

/**
 * Finds top fuzzy-match suggestions for an unknown food item query.
 */
export function findFuzzyFoodSuggestions(
  query: string,
  availableFoods: readonly (Food | CreateFoodInput)[],
  maxSuggestions = 3,
): { food: Food | CreateFoodInput; score: number }[] {
  const scored = availableFoods
    .map((food) => {
      const scoreId = stringSimilarity(query, food.id || '');
      const scoreName = stringSimilarity(query, food.name);
      const best = Math.max(scoreId, scoreName);
      return { food, score: best };
    })
    .filter((item) => item.score >= 0.25)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, maxSuggestions);
}

/**
 * Validates a recipe input document against requirements (RCP-8).
 * Checks that:
 * - every ingredient maps to a food id (fuzzy-match suggestions on failure)
 * - units are convertible to grams
 * - image is present
 * - servings > 0
 * - computes nutrition per serving from ingredients
 * - checks manual overrides require written reason
 */
export function validateRecipeInput(
  input: RecipeImportInput,
  foodsCatalog: readonly (Food | CreateFoodInput)[],
): RecipeValidationResult {
  const errors: string[] = [];
  const suggestions: Record<string, string[]> = {};

  // 1. Basic properties
  if (!input.title || input.title.trim().length === 0) {
    errors.push('Recipe title is required');
  }
  if (!input.cuisine || input.cuisine.trim().length === 0) {
    errors.push('Recipe cuisine is required');
  }
  if (!input.servings || input.servings <= 0) {
    errors.push('Recipe servings must be greater than zero');
  }
  if (input.prep_minutes < 0 || input.cook_minutes < 0) {
    errors.push('Prep and cook minutes must be non-negative');
  }
  if (!['easy', 'medium', 'hard'].includes(input.difficulty)) {
    errors.push(`Invalid difficulty "${input.difficulty}". Must be easy, medium, or hard.`);
  }
  if (
    !input.meal_type ||
    !['breakfast', 'lunch', 'dinner', 'snack', 'dessert', 'beverage'].includes(input.meal_type)
  ) {
    errors.push(`Invalid meal_type "${input.meal_type}"`);
  }

  // 2. Images requirement: "image present"
  const validImages = (input.images || []).filter(
    (img) => typeof img === 'string' && img.trim().length > 0,
  );
  if (validImages.length === 0) {
    errors.push('Recipe must have at least one image present');
  }

  // 3. Steps requirement
  if (!input.steps || input.steps.length === 0) {
    errors.push('Recipe must have at least one step');
  }

  // 4. Ingredients requirement: "every ingredient must map to a food id, units convertible to grams"
  if (!input.ingredients || input.ingredients.length === 0) {
    errors.push('Recipe must have at least one ingredient');
  }

  // Map foods by id and lowercase name for fast matching
  const foodById = new Map<string, Food | CreateFoodInput>();
  const foodByName = new Map<string, Food | CreateFoodInput>();
  for (const f of foodsCatalog) {
    if (f.id) foodById.set(f.id.toLowerCase(), f);
    foodByName.set(f.name.toLowerCase().trim(), f);
  }

  const resolvedIngredients: {
    food: Food;
    quantity: number;
    unit: string;
  }[] = [];

  for (let idx = 0; idx < (input.ingredients || []).length; idx++) {
    const ing = input.ingredients[idx]!;
    const foodKey = (ing.food_id || '').trim();

    // Check if food exists
    const matched = foodById.get(foodKey.toLowerCase()) || foodByName.get(foodKey.toLowerCase());

    if (!matched) {
      const fuzzy = findFuzzyFoodSuggestions(foodKey, foodsCatalog, 3);
      suggestions[foodKey] = fuzzy.map((f) => `${f.food.id || ''} (${f.food.name})`);
      errors.push(
        `Ingredient #${idx + 1} "${foodKey}": unknown food ID. Did you mean: ${
          fuzzy.map((f) => `"${f.food.id}" (${f.food.name})`).join(', ') || 'none found'
        }?`,
      );
      continue;
    }

    if (!ing.quantity || ing.quantity <= 0) {
      errors.push(`Ingredient #${idx + 1} (${matched.name}): quantity must be greater than zero`);
    }

    // Check unit convertibility
    const grams = resolveUnitGrams(matched as Food, ing.unit);
    if (grams <= 0) {
      errors.push(
        `Ingredient #${idx + 1} (${matched.name}): unit "${ing.unit}" cannot be converted to grams`,
      );
    }

    resolvedIngredients.push({
      food: matched as Food,
      quantity: ing.quantity,
      unit: ing.unit,
    });
  }

  // 5. Manual override reason requirement
  if (input.manual_nutrition_override && Object.keys(input.manual_nutrition_override).length > 0) {
    if (!input.nutrition_override_reason || input.nutrition_override_reason.trim().length === 0) {
      errors.push('Manual nutrition override requires a written reason field (RCP-3)');
    }
  }

  let computedNutrition: RecipeNutritionSnapshot = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
  };

  if (errors.length === 0 && input.servings > 0) {
    try {
      computedNutrition = calculateRecipeNutrition(
        resolvedIngredients,
        input.servings,
        input.manual_nutrition_override,
        input.nutrition_override_reason,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to compute recipe nutrition';
      errors.push(msg);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    suggestions,
    computedNutrition,
  };
}
