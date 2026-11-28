import {
  savedMealItems,
  savedMealTotals,
  savedMealFood,
  type MealSelection,
  type SavedMeal,
  type MealSection,
} from '@calipartner/core';
import { getSupabase } from '@/lib/supabase';
import { cachedRead } from './offlineReadService';
import { invalidateReadCache } from './readCache';
import { logFoodEntry } from './foodService';
import { withOnlineSave, type LocalDb } from './accountDataService';

async function clientFor(owner: string) {
  const client = getSupabase();
  if ((await client.auth.getUser()).data.user?.id !== owner) throw new Error('ACCOUNT_CHANGED');
  return client;
}
export async function saveMyMeal(
  owner: string,
  id: string,
  name: string,
  selection: MealSelection[],
  defaultMealSection?: MealSection | null,
): Promise<void> {
  if (!name.trim() || name.trim().length > 100) throw new Error('INVALID_MEAL');
  const items = savedMealItems(selection);
  const client = await clientFor(owner);
  const { data, error } = await client
    .from('saved_meals')
    .upsert({
      id,
      user_id: owner,
      name: name.trim(),
      items,
      ...savedMealTotals(items),
      ...(defaultMealSection ? { default_meal_section: defaultMealSection } : {}),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    })
    .select('id')
    .single();
  if (error) throw error;
  if (data?.id !== id) throw new Error('MISSING_ACKNOWLEDGEMENT');
  invalidateReadCache('my-meals', owner);
}
export async function loadMyMeals(owner: string): Promise<SavedMeal[]> {
  return cachedRead(getSupabase(), 'my-meals', async () => {
    const client = await clientFor(owner);
    const { data, error } = await client
      .from('saved_meals')
      .select('*')
      .eq('user_id', owner)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    return data as SavedMeal[];
  });
}
export async function deleteMyMeal(owner: string, id: string): Promise<void> {
  const client = await clientFor(owner);
  const { data, error } = await client
    .from('saved_meals')
    .update({ deleted_at: new Date().toISOString() })
    .eq('user_id', owner)
    .eq('id', id)
    .select('id')
    .single();
  if (error) throw error;
  if (data?.id !== id) throw new Error('MISSING_ACKNOWLEDGEMENT');
  invalidateReadCache('my-meals', owner);
}
export async function logMyMeal(
  db: LocalDb,
  owner: string,
  meal: SavedMeal,
  section: MealSection,
  date: string,
  entryIds: string[],
): Promise<void> {
  if (meal.user_id !== owner || entryIds.length !== meal.items.length || !entryIds.length)
    throw new Error('INVALID_MEAL');
  await withOnlineSave(db, async (transaction) => {
    for (const [index, item] of meal.items.entries()) {
      await logFoodEntry(transaction, {
        id: entryIds[index]!,
        userId: owner,
        food: savedMealFood(item),
        quantity: item.quantity,
        unit: item.unit,
        mealSection: section,
        localDate: date,
        source: 'copy',
      });
    }
  });
}
