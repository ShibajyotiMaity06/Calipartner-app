import { describe, expect, it } from 'vitest';
import { DEV_100_FOOD_SEED } from './food_dataset';
import {
  calculateRecipeNutrition,
  filterRecipes,
  scaleLoggedRecipeNutrients,
  scaleRecipeServings,
  validateRecipeInput,
} from './recipes';
import type {
  Food,
  Recipe,
  RecipeImportInput,
} from './types';

describe('Phase 12: Recipes Core Logic', () => {
  // Food map from seed
  const foodsById = new Map<string, Food>();
  for (const f of DEV_100_FOOD_SEED) {
    if (f.id) foodsById.set(f.id, f as Food);
  }

  const paneer = foodsById.get('f-ifct-paneer-raw')!;
  const onion = foodsById.get('f-ifct-onion-raw')!;
  const tomato = foodsById.get('f-ifct-tomato-raw')!;
  const ghee = foodsById.get('f-ifct-ghee')!;

  it('calculates recipe nutrition accurately against hand-computed fixtures (RCP-3)', () => {
    // Hand-computed fixture: High-Protein Paneer Bhurji (2 servings)
    // 250g paneer raw (289 kcal, 18.3g P, 3.2g C, 22.5g F / 100g) -> 722.5 kcal, 45.75g P, 8.0g C, 56.25g F
    // 100g onion raw (40 kcal, 1.1g P, 9.3g C, 0.1g F / 100g) -> 40 kcal, 1.1g P, 9.3g C, 0.1g F
    // 100g tomato raw (18 kcal, 0.9g P, 3.9g C, 0.2g F / 100g) -> 18 kcal, 0.9g P, 3.9g C, 0.2g F
    // 10g ghee (897 kcal, 0.2g P, 0g C, 99.5g F / 100g) -> 89.7 kcal, 0.02g P, 0g C, 9.95g F
    // Totals for 2 servings:
    // Calories: 870.2 -> per serving 435.1
    // Protein: 47.77 -> per serving 23.9
    // Carbs: 21.2 -> per serving 10.6
    // Fat: 66.5 -> per serving 33.3
    // Fiber: 2.9 -> per serving 1.5

    const ingredients = [
      { food: paneer, quantity: 250, unit: 'g' },
      { food: onion, quantity: 100, unit: 'g' },
      { food: tomato, quantity: 100, unit: 'g' },
      { food: ghee, quantity: 10, unit: 'g' },
    ];

    const nutrition = calculateRecipeNutrition(ingredients, 2);

    expect(nutrition.calories).toBe(435.1);
    expect(nutrition.protein).toBe(23.9);
    expect(nutrition.carbs).toBe(10.6);
    expect(nutrition.fat).toBe(33.3);
    expect(nutrition.fiber).toBe(1.5);
  });

  it('supports manual nutrition override only with a written reason (RCP-3)', () => {
    const ingredients = [{ food: paneer, quantity: 100, unit: 'g' }];

    // Missing reason should throw
    expect(() => {
      calculateRecipeNutrition(
        ingredients,
        1,
        { calories: 300, protein: 20 },
        null,
      );
    }).toThrow('Manual nutrition override requires a written reason');

    expect(() => {
      calculateRecipeNutrition(
        ingredients,
        1,
        { calories: 300, protein: 20 },
        '   ',
      );
    }).toThrow('Manual nutrition override requires a written reason');

    // With valid reason, manual values are respected
    const overridden = calculateRecipeNutrition(
      ingredients,
      1,
      { calories: 320, protein: 22, carbs: 4, fat: 24, fiber: 0 },
      'Third-party NABL lab certified bomb calorimetry test',
    );

    expect(overridden.calories).toBe(320);
    expect(overridden.protein).toBe(22);
  });

  it('scales ingredient amounts when changing servings, keeping nutrition per serving identical (RCP-5)', () => {
    const sampleRecipe: Recipe = {
      id: 'recipe-bhurji',
      title: 'High-Protein Paneer Bhurji',
      description: 'Quick scrambled cottage cheese',
      cuisine: 'North Indian',
      diet_tags: ['vegetarian', 'high-protein'],
      meal_type: 'breakfast',
      prep_minutes: 10,
      cook_minutes: 15,
      difficulty: 'easy',
      servings: 2,
      steps: ['Heat pan', 'Add ingredients'],
      tips: ['Do not overcook'],
      image_urls: ['https://pub-r2.calipartner.com/recipes/paneer.jpg'],
      status: 'published',
      nutrition_per_serving: {
        calories: 435.1,
        protein: 23.9,
        carbs: 10.6,
        fat: 33.3,
        fiber: 1.5,
      },
      version: 1,
      created_at: '2026-10-17T00:00:00Z',
      updated_at: '2026-10-17T00:00:00Z',
      ingredients: [
        { food_id: 'f-ifct-paneer-raw', food_name: 'Paneer', quantity: 250, unit: 'g' },
        { food_id: 'f-ifct-onion-raw', food_name: 'Onion', quantity: 100, unit: 'g' },
        { food_id: 'f-ifct-ghee', food_name: 'Ghee', quantity: 10, unit: 'g' },
      ],
    };

    // Scale from 2 to 4 servings (2x)
    const scaled4 = scaleRecipeServings(sampleRecipe, 4);
    expect(scaled4.scaledIngredients[0]!.scaled_quantity).toBe(500); // 250 * 2
    expect(scaled4.scaledIngredients[1]!.scaled_quantity).toBe(200); // 100 * 2
    expect(scaled4.scaledIngredients[2]!.scaled_quantity).toBe(20); // 10 * 2
    // Per-serving nutrition must remain unchanged (RCP-5)
    expect(scaled4.nutritionPerServing.calories).toBe(435.1);
    expect(scaled4.nutritionPerServing.protein).toBe(23.9);
    // Total nutrition should reflect 4 servings
    expect(scaled4.totalNutrition.calories).toBe(1740.4);
    expect(scaled4.totalNutrition.protein).toBe(95.6);

    // Scale down to 1 serving (0.5x)
    const scaled1 = scaleRecipeServings(sampleRecipe, 1);
    expect(scaled1.scaledIngredients[0]!.scaled_quantity).toBe(125);
    expect(scaled1.scaledIngredients[1]!.scaled_quantity).toBe(50);
    expect(scaled1.scaledIngredients[2]!.scaled_quantity).toBe(5);
    expect(scaled1.nutritionPerServing.calories).toBe(435.1);
  });

  it('calculates logged nutrient snapshot for 1.5 servings = 1.5x nutrients (RCP-6)', () => {
    const nutritionPerServing = {
      calories: 400,
      protein: 30,
      carbs: 20,
      fat: 10,
      fiber: 4,
      sugar: 2,
      sodium_mg: 150,
    };

    const logged = scaleLoggedRecipeNutrients(nutritionPerServing, 1.5);

    expect(logged.calories).toBe(600); // 400 * 1.5
    expect(logged.protein).toBe(45); // 30 * 1.5
    expect(logged.carbs).toBe(30); // 20 * 1.5
    expect(logged.fat).toBe(15); // 10 * 1.5
    expect(logged.fiber).toBe(6); // 4 * 1.5
    expect(logged.sugar).toBe(3); // 2 * 1.5
    expect(logged.sodium_mg).toBe(225); // 150 * 1.5
  });

  it('searches and filters recipes across name, ingredient, diet, cuisine, and calories (RCP-4)', () => {
    const recipesList: Recipe[] = [
      {
        id: 'r1',
        title: 'High-Protein Paneer Bhurji',
        cuisine: 'North Indian',
        diet_tags: ['vegetarian', 'high-protein'],
        meal_type: 'breakfast',
        prep_minutes: 10,
        cook_minutes: 15,
        difficulty: 'easy',
        servings: 2,
        steps: ['step 1'],
        tips: [],
        image_urls: ['url1'],
        status: 'published',
        nutrition_per_serving: { calories: 435, protein: 24, carbs: 10, fat: 33, fiber: 1.5 },
        version: 1,
        created_at: '',
        updated_at: '',
        ingredients: [{ food_id: 'f-paneer', food_name: 'Paneer (Raw)', quantity: 250, unit: 'g' }],
      },
      {
        id: 'r2',
        title: 'Soya Chunks Curry',
        cuisine: 'North Indian',
        diet_tags: ['vegan', 'high-protein'],
        meal_type: 'dinner',
        prep_minutes: 15,
        cook_minutes: 20,
        difficulty: 'medium',
        servings: 3,
        steps: ['step 1'],
        tips: [],
        image_urls: ['url2'],
        status: 'published',
        nutrition_per_serving: { calories: 280, protein: 32, carbs: 18, fat: 4, fiber: 8 },
        version: 1,
        created_at: '',
        updated_at: '',
        ingredients: [{ food_id: 'f-soya', food_name: 'Soya Chunks', quantity: 100, unit: 'g' }],
      },
      {
        id: 'r3',
        title: 'South Indian Pepper Rasam',
        cuisine: 'South Indian',
        diet_tags: ['vegan', 'low-calorie'],
        meal_type: 'dinner',
        prep_minutes: 5,
        cook_minutes: 10,
        difficulty: 'easy',
        servings: 4,
        steps: ['step 1'],
        tips: [],
        image_urls: ['url3'],
        status: 'published',
        nutrition_per_serving: { calories: 45, protein: 1.2, carbs: 8, fat: 0.8, fiber: 1 },
        version: 1,
        created_at: '',
        updated_at: '',
        ingredients: [{ food_id: 'f-tomato', food_name: 'Tomato', quantity: 200, unit: 'g' }],
      },
    ];

    // Filter by name/query
    const queryResults = filterRecipes(recipesList, { query: 'bhurji' });
    expect(queryResults).toHaveLength(1);
    expect(queryResults[0]!.id).toBe('r1');

    // Filter by ingredient name in query
    const ingredientResults = filterRecipes(recipesList, { query: 'soya' });
    expect(ingredientResults).toHaveLength(1);
    expect(ingredientResults[0]!.id).toBe('r2');

    // Filter by diet tag
    const veganResults = filterRecipes(recipesList, { diet: 'vegan' });
    expect(veganResults.map((r) => r.id)).toEqual(['r2', 'r3']);

    // Filter by meal type
    const dinnerResults = filterRecipes(recipesList, { meal_type: 'dinner' });
    expect(dinnerResults.map((r) => r.id)).toEqual(['r2', 'r3']);

    // Filter by cuisine
    const southIndianResults = filterRecipes(recipesList, { cuisine: 'South Indian' });
    expect(southIndianResults).toHaveLength(1);
    expect(southIndianResults[0]!.id).toBe('r3');

    // Filter by min protein >= 20g
    const highProteinResults = filterRecipes(recipesList, { min_protein: 20 });
    expect(highProteinResults.map((r) => r.id)).toEqual(['r1', 'r2']);

    // Filter by calorie range 200 - 350 kcal
    const calRangeResults = filterRecipes(recipesList, { min_calories: 200, max_calories: 350 });
    expect(calRangeResults.map((r) => r.id)).toEqual(['r2']);

    // Filter by total time <= 20 min
    const quickResults = filterRecipes(recipesList, { max_time_minutes: 20 });
    expect(quickResults.map((r) => r.id)).toEqual(['r3']); // 5 + 10 = 15 <= 20
  });

  it('validates recipe authoring input and provides fuzzy-match suggestions on invalid food ID (RCP-8)', () => {
    const invalidInput: RecipeImportInput = {
      title: 'Tasty Paneer Bowl',
      cuisine: 'Indian',
      diet_tags: ['vegetarian'],
      meal_type: 'lunch',
      prep_minutes: 5,
      cook_minutes: 10,
      difficulty: 'easy',
      servings: 1,
      steps: ['Cook it'],
      images: ['https://pub-r2.calipartner.com/recipes/tasty.jpg'],
      ingredients: [
        // Misspelled food id
        { food_id: 'panner-raw', quantity: 100, unit: 'g' },
      ],
    };

    const result = validateRecipeInput(invalidInput, DEV_100_FOOD_SEED);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('unknown food ID');
    expect(result.errors[0]).toContain('f-ifct-paneer-raw');
    expect(result.suggestions['panner-raw']).toBeDefined();
    expect(result.suggestions['panner-raw']!.length).toBeGreaterThan(0);
  });

  it('flags errors when image is missing or servings <= 0 (RCP-8)', () => {
    const noImageInput: RecipeImportInput = {
      title: 'No Image Recipe',
      cuisine: 'Indian',
      diet_tags: ['vegetarian'],
      meal_type: 'snack',
      prep_minutes: 5,
      cook_minutes: 5,
      difficulty: 'easy',
      servings: 0, // Invalid servings
      steps: ['Step 1'],
      images: [], // Missing image
      ingredients: [{ food_id: 'f-ifct-paneer-raw', quantity: 100, unit: 'g' }],
    };

    const result = validateRecipeInput(noImageInput, DEV_100_FOOD_SEED);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Recipe servings must be greater than zero');
    expect(result.errors).toContain('Recipe must have at least one image present');
  });

  it('flags errors when manual override is provided without a written reason (RCP-3)', () => {
    const overrideInput: RecipeImportInput = {
      title: 'Overridden Recipe',
      cuisine: 'Indian',
      diet_tags: ['vegetarian'],
      meal_type: 'lunch',
      prep_minutes: 5,
      cook_minutes: 10,
      difficulty: 'easy',
      servings: 2,
      steps: ['Step 1'],
      images: ['https://pub-r2.calipartner.com/recipes/pic.jpg'],
      ingredients: [{ food_id: 'f-ifct-paneer-raw', quantity: 100, unit: 'g' }],
      manual_nutrition_override: { calories: 500, protein: 40 },
      nutrition_override_reason: '', // Empty reason
    };

    const result = validateRecipeInput(overrideInput, DEV_100_FOOD_SEED);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Manual nutrition override requires a written reason'))).toBe(true);
  });
});
