import { expect, it } from 'vitest';
import { getRecipes, getFavoriteRecipes, type RecipeDb } from './recipeService';
it('browses real persistable recipes rather than old non-UUID offline templates', async () => {
  const db = {
    runAsync: async () => ({}),
    getFirstAsync: async () => null,
    getAllAsync: async () => [],
  } as RecipeDb;
  const catalog = await getRecipes(db, {}, undefined, null);
  expect(catalog).toHaveLength(267);
  expect(
    catalog.every((recipe) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(recipe.id),
    ),
  ).toBe(true);
});
it('restores bundled recipe favourites on a fresh device without local recipe cache rows', async () => {
  let favoriteId = '';
  const db = {
    runAsync: async () => ({}),
    getFirstAsync: async () => null,
    getAllAsync: async (sql: string) =>
      sql.includes('local_recipe_favorites') ? [{ recipe_id: favoriteId }] : [],
  } as unknown as RecipeDb;
  const catalog = await getRecipes(db, {}, undefined, null);
  expect(catalog.length).toBeGreaterThan(0);
  favoriteId = catalog[0]!.id;
  const favorites = await getFavoriteRecipes(db, 'owner');
  expect(favorites).toHaveLength(1);
  expect(favorites[0]).toMatchObject({ id: favoriteId, is_favorite: true });
});
