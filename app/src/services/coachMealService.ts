import { validateCoachMealDraft, type CoachMealDraft, type FoodEntry } from '@calipartner/core';
import { getSupabase } from '@/lib/supabase';
import { beforeAccountWrite } from './accountDataGate';
import { diaryEvents } from './diaryEvents';
import { generateClientUuid } from './foodService';

export function prepareCoachMealSave(draft: CoachMealDraft) {
  const verified = validateCoachMealDraft(draft);
  return verified.items.map((item) => ({
    id: generateClientUuid(),
    food_name: item.name,
    meal_section: verified.mealSection,
    local_date: verified.localDate,
    quantity: item.quantity,
    unit: item.unit,
    calories: item.calories,
    protein: item.protein,
    carbs: item.carbs,
    fat: item.fat,
    fiber: item.fiber,
    sugar: item.sugar,
    sodium_mg: item.sodium_mg,
  }));
}
export type CoachMealSave = ReturnType<typeof prepareCoachMealSave>;
/** Keep this request unchanged across explicit retries, including a lost acknowledgement. */
export async function saveCoachMeal(entries: CoachMealSave): Promise<FoodEntry[]> {
  if (await beforeAccountWrite()) throw new Error('ACCOUNT_DATA_RESET');
  const { data, error } = await getSupabase().rpc('log_coach_meal', { p_entries: entries });
  if (error) throw error;
  if (
    !Array.isArray(data) ||
    data.length !== entries.length ||
    entries.some((entry) => !data.some((saved) => saved.id === entry.id))
  )
    throw new Error('SAVE_NOT_ACKNOWLEDGED');
  diaryEvents.emitChange();
  return data as FoodEntry[];
}
