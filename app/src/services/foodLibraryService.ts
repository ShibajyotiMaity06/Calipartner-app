import { foodFavoriteKey, type Food } from '@calipartner/core';
import { getSupabase } from '@/lib/supabase';
export interface FoodLibrary {
  foods: Food[];
  searches: string[];
}
export interface FoodLibraryClient {
  auth: { getUser(): Promise<{ data: { user: { id: string } | null }; error?: unknown }> };
  rpc(name: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>;
}
async function request(
  owner: string,
  name: string,
  args?: Record<string, unknown>,
  client: FoodLibraryClient = getSupabase(),
) {
  const actor = await client.auth.getUser();
  if (actor.error || actor.data.user?.id !== owner) throw new Error('ACCOUNT_CHANGED');
  const result = await client.rpc(name, args);
  if (result.error) throw new Error('FOOD_LIBRARY_UNAVAILABLE');
  return result.data;
}
export async function loadFoodLibrary(
  owner: string,
  client?: FoodLibraryClient,
): Promise<FoodLibrary> {
  const result = (await request(owner, 'get_food_library', undefined, client)) as FoodLibrary;
  if (!Array.isArray(result?.foods) || !Array.isArray(result?.searches))
    throw new Error('FOOD_LIBRARY_UNAVAILABLE');
  return result;
}
export async function setFoodFavorite(
  owner: string,
  food: Food,
  favorite: boolean,
  client?: FoodLibraryClient,
): Promise<void> {
  const key = foodFavoriteKey(food);
  const result = (await request(
    owner,
    'set_food_favorite',
    { p_food_key: key, p_food: food, p_favorite: favorite },
    client,
  )) as { food_key?: string; favorite?: boolean };
  if (result?.food_key !== key || result?.favorite !== favorite)
    throw new Error('SAVE_UNCONFIRMED');
}
export async function recordFoodSearch(
  owner: string,
  query: string,
  client?: FoodLibraryClient,
): Promise<string> {
  const normalized = query.trim().toLowerCase();
  const result = (await request(owner, 'record_food_search', { p_query: normalized }, client)) as {
    query?: string;
  };
  if (result?.query !== normalized) throw new Error('SAVE_UNCONFIRMED');
  return normalized;
}
export async function clearFoodSearchHistory(
  owner: string,
  client?: FoodLibraryClient,
): Promise<void> {
  const result = (await request(owner, 'clear_food_search_history', undefined, client)) as {
    cleared?: boolean;
  };
  if (result?.cleared !== true) throw new Error('SAVE_UNCONFIRMED');
}
