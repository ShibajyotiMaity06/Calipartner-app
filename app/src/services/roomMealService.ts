import type { FoodEntry, MealSection } from '@calipartner/core';
import { getSupabase } from '@/lib/supabase';
import { getDb } from '@/db';
import { diaryEvents } from './diaryEvents';

export interface RoomMeal {
  id: string;
  food_name: string;
  meal_section: MealSection;
  quantity: number;
  unit: string;
  local_date: string;
  can_copy: boolean;
}
export async function getRoomMeals(roomId: string, memberId: string): Promise<RoomMeal[]> {
  const { data, error } = await getSupabase().rpc('get_room_meals_today', {
    p_room_id: roomId,
    p_member_id: memberId,
  });
  if (error) throw error;
  return data ?? [];
}
export async function copyRoomMeal(
  clientId: string,
  roomId: string,
  memberId: string,
  entryId: string,
  section: MealSection,
) {
  const { data, error } = await getSupabase().rpc('copy_room_meal', {
    p_client_id: clientId,
    p_room_id: roomId,
    p_member_id: memberId,
    p_entry_id: entryId,
    p_meal_section: section,
  });
  if (error) throw error;
  const entry = data as FoodEntry;
  const db = await getDb();
  // The RPC creates our independent entry. Mirror it locally immediately without another upload.
  const fields = [
    'id',
    'user_id',
    'food_id',
    'food_name',
    'brand_name',
    'meal_section',
    'quantity',
    'unit',
    'calories',
    'protein',
    'carbs',
    'fat',
    'fiber',
    'sugar',
    'sodium_mg',
    'nutrition_details',
    'logged_at',
    'local_date',
    'source',
    'shared_meal_id',
    'created_at',
    'updated_at',
    'deleted_at',
  ] as const;
  await db.runAsync(
    `INSERT INTO local_food_entries (${fields.join(',')},sync_state) VALUES (${fields.map(() => '?').join(',')},'synced') ON CONFLICT(id) DO UPDATE SET updated_at=excluded.updated_at`,
    fields.map((field) =>
      field === 'nutrition_details' ? JSON.stringify(entry[field] ?? null) : (entry[field] ?? null),
    ),
  );
  diaryEvents.emitChange();
  return entry;
}
