import { describe, expect, it } from 'vitest';
import {
  filterRecipes,
  scaleLoggedRecipeNutrients,
  scaleRecipeServings,
  type Recipe,
} from '@calipartner/core';
import { en } from '@/i18n/en';
import { t } from '@/i18n';
import bundledRecipes from '../../../assets/bundled_recipes.json';

describe('Phase 12 Prompt B — Recipe Library View Layer Tests', () => {
  const sampleRecipe: Recipe = {
    id: 'rec-test-1',
    title: 'High Protein Paneer Bhurji',
    description: 'Quick scrambled paneer with onions, tomatoes and green chilies.',
    cuisine: 'North Indian',
    diet_tags: ['vegetarian', 'high_protein'],
    meal_type: 'breakfast',
    prep_minutes: 10,
    cook_minutes: 15,
    difficulty: 'easy',
    servings: 2,
    steps: [
      'Heat oil in a pan and add cumin seeds.',
      'Sauté onions, ginger, and green chilies until translucent.',
      'Add tomatoes, turmeric, and chili powder.',
      'Crumble paneer into the pan and mix well.',
      'Garnish with fresh coriander and serve hot.',
    ],
    tips: ['Do not overcook paneer or it becomes rubbery.'],
    image_urls: ['https://images.calipartner.com/recipes/paneer_bhurji.jpg'],
    status: 'published',
    nutrition_per_serving: {
      calories: 280,
      protein: 22,
      carbs: 8,
      fat: 18,
      fiber: 2.5,
    },
    version: 1,
    created_at: '2026-10-10T00:00:00Z',
    updated_at: '2026-10-10T00:00:00Z',
    ingredients: [
      {
        id: 'ing-1',
        recipe_id: 'rec-test-1',
        food_id: 'food-paneer',
        food_name: 'Paneer',
        quantity: 200,
        unit: 'g',
        note: 'crumbled',
        display_order: 1,
      },
      {
        id: 'ing-2',
        recipe_id: 'rec-test-1',
        food_id: 'food-onion',
        food_name: 'Onion',
        quantity: 1,
        unit: 'medium',
        note: 'finely chopped',
        display_order: 2,
      },
    ],
  };

  const sampleRecipe2: Recipe = {
    id: 'rec-test-2',
    title: 'Chicken Tikka Rice Bowl',
    description: 'Marinated roasted chicken breast with spiced basmati rice.',
    cuisine: 'North Indian',
    diet_tags: ['non-veg', 'high_protein'],
    meal_type: 'dinner',
    prep_minutes: 15,
    cook_minutes: 25,
    difficulty: 'medium',
    servings: 1,
    steps: ['Marinate chicken with yogurt and spices.', 'Bake at 200C for 20 mins.'],
    tips: ['Baste with a little butter for extra flavor.'],
    image_urls: ['https://images.calipartner.com/recipes/chicken_bowl.jpg'],
    status: 'published',
    nutrition_per_serving: {
      calories: 450,
      protein: 42,
      carbs: 45,
      fat: 10,
      fiber: 4,
    },
    version: 1,
    created_at: '2026-10-10T00:00:00Z',
    updated_at: '2026-10-10T00:00:00Z',
  };

  describe('1. i18n Translations Completeness & Interpolation', () => {
    it('has all required recipe browsing and card keys', () => {
      expect(en.recipes.browse.title).toBe('Recipe Library');
      expect(en.recipes.browse.tabAll).toBe('All Recipes');
      expect(en.recipes.browse.tabFavorites).toBe('Favourites');
      expect(en.recipes.browse.emptyAllTitle).toBe('No recipes found');
      expect(en.recipes.browse.emptyFavTitle).toBe('No favourite recipes yet');
      expect(en.recipes.card.offlineBadge).toBe('Offline Ready');
      expect(en.recipes.card.time).toContain('{mins}');
      expect(en.recipes.card.calories).toContain('{cal}');
      expect(en.recipes.card.protein).toContain('{p}');
    });

    it('has detail, scaler, report, and logSheet keys', () => {
      expect(en.recipes.detail.servingsScalerHint).toBe(
        'Ingredients scale automatically. Nutrition values below are per serving.',
      );
      expect(en.recipes.detail.logRecipeCta).toBe('Log this recipe');
      expect(en.recipes.detail.reportErrorCta).toBe('Report an error');
      expect(en.recipes.logSheet.title).toBe('Log Recipe to Diary');
      expect(en.recipes.logSheet.submitButton).toContain('{servings}');
      expect(en.recipes.report.title).toBe('Report Recipe Issue');
      expect(en.recipes.report.reasonOptions.incorrect_ingredient).toBeDefined();
    });

    it('has entry point keys for FoodLogModal tabs, logSheet, and today screen', () => {
      expect(en.foodLog.tabs.recipes).toBe('Recipes');
      expect(en.workouts.logSheet.recipeOption).toBe('Recipe Library');
      expect(en.today.recipesCard.title).toBe('Recipe Library');
      expect(en.today.recipesCard.cta).toBe('Explore Recipes');
    });

    it('interpolates card and logSheet strings correctly via t()', () => {
      const timeStr = t('recipes.card.time', { mins: 25 });
      expect(timeStr).toBe('25 min');

      const calStr = t('recipes.card.calories', { cal: 350 });
      expect(calStr).toBe('350 kcal');

      const pStr = t('recipes.card.protein', { p: 28 });
      expect(pStr).toBe('28g protein');

      const submitStr = t('recipes.logSheet.submitButton', { servings: 1.5, calories: 420 });
      expect(submitStr).toBe('Log 1.5 Servings (420 kcal)');
    });
  });

  describe('2. Servings Scaler & Ingredient Quantities (RCP-5)', () => {
    it('scales ingredient amounts linearly when changing servings while nutrition stays per serving', () => {
      // Base recipe is for 2 servings (200g paneer, 1 onion)
      expect(sampleRecipe.servings).toBe(2);

      // Scale to 4 servings (double)
      const res4 = scaleRecipeServings(sampleRecipe, 4);
      expect(res4.scaledIngredients[0]!.scaled_quantity).toBe(400); // 200 * (4/2) = 400g
      expect(res4.scaledIngredients[1]!.scaled_quantity).toBe(2); // 1 * (4/2) = 2 onions

      // Scale to 1 serving (half)
      const res1 = scaleRecipeServings(sampleRecipe, 1);
      expect(res1.scaledIngredients[0]!.scaled_quantity).toBe(100); // 200 * (1/2) = 100g
      expect(res1.scaledIngredients[1]!.scaled_quantity).toBe(0.5); // 1 * (1/2) = 0.5 onion

      // Nutrition per serving is untouched
      expect(sampleRecipe.nutrition_per_serving.calories).toBe(280);
      expect(sampleRecipe.nutrition_per_serving.protein).toBe(22);
    });
  });

  describe('3. "Log this recipe" Nutrient Snapshot Scaling (RCP-6)', () => {
    it('correctly calculates 1.5 servings nutrient snapshot for diary entry', () => {
      const perServing = sampleRecipe.nutrition_per_serving;
      const servings = 1.5;

      const loggedSnapshot = scaleLoggedRecipeNutrients(perServing, servings);

      // Calories: 280 * 1.5 = 420
      expect(loggedSnapshot.calories).toBe(420);
      // Protein: 22 * 1.5 = 33
      expect(loggedSnapshot.protein).toBe(33);
      // Carbs: 8 * 1.5 = 12
      expect(loggedSnapshot.carbs).toBe(12);
      // Fat: 18 * 1.5 = 27
      expect(loggedSnapshot.fat).toBe(27);
      // Fiber: 2.5 * 1.5 = 3.75 -> 3.8
      expect(loggedSnapshot.fiber).toBe(3.8);
    });

    it('correctly calculates 0.5 servings nutrient snapshot', () => {
      const perServing = sampleRecipe2.nutrition_per_serving;
      const servings = 0.5;

      const loggedSnapshot = scaleLoggedRecipeNutrients(perServing, servings);

      expect(loggedSnapshot.calories).toBe(225);
      expect(loggedSnapshot.protein).toBe(21);
      expect(loggedSnapshot.carbs).toBe(22.5);
      expect(loggedSnapshot.fat).toBe(5);
      expect(loggedSnapshot.fiber).toBe(2);
    });
  });

  describe('4. Recipe Filter Criteria & Search (RCP-4)', () => {
    const list = [sampleRecipe, sampleRecipe2];

    it('filters by query across title, description, and cuisine', () => {
      const paneerResults = filterRecipes(list, { query: 'paneer' });
      expect(paneerResults).toHaveLength(1);
      expect(paneerResults[0]!.id).toBe('rec-test-1');

      const chickenResults = filterRecipes(list, { query: 'chicken' });
      expect(chickenResults).toHaveLength(1);
      expect(chickenResults[0]!.id).toBe('rec-test-2');
    });

    it('filters by meal type', () => {
      const breakfasts = filterRecipes(list, { meal_type: 'breakfast' });
      expect(breakfasts).toHaveLength(1);
      expect(breakfasts[0]!.title).toBe('High Protein Paneer Bhurji');

      const dinners = filterRecipes(list, { meal_type: 'dinner' });
      expect(dinners).toHaveLength(1);
      expect(dinners[0]!.title).toBe('Chicken Tikka Rice Bowl');
    });

    it('filters by diet tag', () => {
      const veg = filterRecipes(list, { diet: 'vegetarian' });
      expect(veg).toHaveLength(1);
      expect(veg[0]!.id).toBe('rec-test-1');

      const nonVeg = filterRecipes(list, { diet: 'non-veg' });
      expect(nonVeg).toHaveLength(1);
      expect(nonVeg[0]!.id).toBe('rec-test-2');
    });

    it('filters by minimum protein', () => {
      const ultraHighProtein = filterRecipes(list, { min_protein: 30 });
      expect(ultraHighProtein).toHaveLength(1);
      expect(ultraHighProtein[0]!.id).toBe('rec-test-2'); // 42g protein
    });

    it('filters by max preparation + cook time', () => {
      // sampleRecipe = 10 + 15 = 25 mins
      // sampleRecipe2 = 15 + 25 = 40 mins
      const quick = filterRecipes(list, { max_time_minutes: 30 });
      expect(quick).toHaveLength(1);
      expect(quick[0]!.id).toBe('rec-test-1');
    });

    it('filters by max calories', () => {
      const under300 = filterRecipes(list, { max_calories: 300 });
      expect(under300).toHaveLength(1);
      expect(under300[0]!.id).toBe('rec-test-1'); // 280 kcal
    });
  });

  describe('5. Empty and Error State Handling', () => {
    it('returns empty array when no recipes match multiple tight filters', () => {
      const emptyResults = filterRecipes([sampleRecipe, sampleRecipe2], {
        query: 'chocolate cake',
      });
      expect(emptyResults).toHaveLength(0);
    });

    it('supports offline fallback data if network and cache are unavailable', () => {
      // Verifies bundled recipes array is non-empty
      expect(Array.isArray(bundledRecipes)).toBe(true);
      expect(bundledRecipes.length).toBeGreaterThanOrEqual(5);
    });
  });
});
