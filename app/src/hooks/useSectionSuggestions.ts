import { useCallback, useEffect, useState } from 'react';
import {
  calculateSectionSuggestions,
  type FoodEntry,
  type MealSection,
} from '@calipartner/core';
import { useAuth } from '@/contexts/AuthContext';
import { getDb } from '@/db';
import { diaryEvents } from '@/services/diaryEvents';

export interface SectionSuggestion {
  food_id: string;
  food_name: string;
  brand_name: string | null;
  count: number;
  last_quantity: number;
  last_unit: string;
}

interface LocalEntryRow {
  id: string;
  user_id: string;
  food_id: string | null;
  meal_section: MealSection;
  quantity: number | string;
  unit: string;
  calories: number | string;
  protein: number | string;
  carbs: number | string;
  fat: number | string;
  fiber: number | string | null;
  sugar: number | string | null;
  sodium_mg: number | string | null;
  food_name: string;
  brand_name: string | null;
  logged_at: string;
  local_date: string;
  source: FoodEntry['source'];
  shared_meal_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export function useSectionSuggestions(section: MealSection) {
  const { user } = useAuth();
  const userId = user?.id || 'guest-user';
  const [suggestions, setSuggestions] = useState<SectionSuggestion[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSuggestions = useCallback(async () => {
    try {
      setLoading(true);
      const db = await getDb();
      // Fetch entries from last 30 days
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const rows = await db.getAllAsync<LocalEntryRow>(
        `SELECT * FROM local_food_entries
         WHERE user_id = ? AND meal_section = ? AND logged_at >= ? AND deleted_at IS NULL
         ORDER BY logged_at DESC`,
        [userId, section, cutoff],
      );

      const entries: FoodEntry[] = rows.map((r) => ({
        id: r.id,
        user_id: r.user_id,
        food_id: r.food_id,
        meal_section: r.meal_section,
        quantity: Number(r.quantity),
        unit: r.unit,
        calories: Number(r.calories),
        protein: Number(r.protein),
        carbs: Number(r.carbs),
        fat: Number(r.fat),
        fiber: Number(r.fiber) || 0,
        sugar: Number(r.sugar) || 0,
        sodium_mg: Number(r.sodium_mg) || 0,
        food_name: r.food_name,
        brand_name: r.brand_name,
        logged_at: r.logged_at,
        local_date: r.local_date,
        source: r.source,
        shared_meal_id: r.shared_meal_id,
        created_at: r.created_at,
        updated_at: r.updated_at,
        deleted_at: r.deleted_at,
      }));

      const top = calculateSectionSuggestions(entries, section, 30);
      setSuggestions(top);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  }, [userId, section]);

  useEffect(() => {
    void loadSuggestions();
    const unsub = diaryEvents.subscribe(() => {
      void loadSuggestions();
    });
    return unsub;
  }, [loadSuggestions]);

  return { suggestions, loading, refresh: loadSuggestions };
}
