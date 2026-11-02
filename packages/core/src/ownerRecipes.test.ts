import { describe, expect, it } from 'vitest';
import { ownerRecipeToRecipe } from './ownerRecipes';
import { filterRecipes, scaleRecipeServings } from './recipes';
import recipes from '../../../datasets/owner_recipes.json';

describe('owner supplied recipes', () => {
  const adapted = recipes.map((recipe) => ownerRecipeToRecipe(recipe, recipe.id));
  it('preserves every supplied nutrient, region, time, portion and instruction without guessing missing fields', () => {
    expect(adapted).toHaveLength(267);
    expect(new Set(adapted.map((recipe) => recipe.id)).size).toBe(267);
    recipes.forEach((source, index) => {
      const recipe = adapted[index]!;
      expect(recipe.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(recipe.nutrition_per_serving).toEqual({
        calories: source.macros.calories,
        protein: source.macros.protein_g,
        carbs: source.macros.carbs_g,
        fat: source.macros.fat_g,
        fiber: source.macros.fiber_g,
      });
      expect(recipe.source_portion).toBe(source.macros.per);
      expect(recipe.cuisine).toBe(source.region);
      expect(recipe.cook_minutes).toBe(source.time_minutes);
      expect(recipe.steps).toEqual(source.steps);
      expect(recipe.meal_type).toBe('unspecified');
      expect(recipe.difficulty).toBe('unspecified');
      expect(recipe.image_urls).toEqual([]);
    });
  });
  it('keeps vegetarian filters from matching non-vegetarian and composes region, focus and time filters', () => {
    const vegetarian = filterRecipes(adapted, { diet: 'vegetarian' });
    expect(vegetarian).toHaveLength(172);
    expect(filterRecipes(adapted, { diet: 'non_vegetarian' })).toHaveLength(85);
    expect(filterRecipes(adapted, { diet: 'eggetarian' })).toHaveLength(10);
    const selected = filterRecipes(adapted, {
      cuisine: 'North',
      nutrition_focus: 'high-protein',
      max_time_minutes: 30,
    });
    expect(selected.length).toBeGreaterThan(0);
    expect(
      selected.every(
        (recipe) =>
          recipe.cuisine === 'North' &&
          recipe.nutrition_focus?.includes('high-protein') &&
          recipe.cook_minutes <= 30,
      ),
    ).toBe(true);
    expect(
      filterRecipes(adapted, { query: 'parsley' }).some(
        (recipe) => recipe.title === 'Grilled Chicken with Chimichurri',
      ),
    ).toBe(true);
  });
  it('scales measurable quantities and preserves unmeasured source amounts', () => {
    const recipe = adapted[0]!;
    const scaled = scaleRecipeServings(recipe, recipe.servings * 1.5);
    expect(scaled.scaledIngredients[0]!.scaled_quantity).toBe(600);
    expect(
      recipe.ingredients!.find((ingredient) => ingredient.source_quantity === 'to taste')?.quantity,
    ).toBe(0);
    expect(scaled.scaledIngredients.every((ingredient) => ingredient.food_id === '')).toBe(true);
  });
});
