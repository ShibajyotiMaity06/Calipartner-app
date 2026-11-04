import { loadAccountTable } from '@/services/accountDataService';
import { useCallback, useEffect, useState } from 'react';
import type { DiaryDaySummary } from '@calipartner/core';
import { useAuth } from '@/contexts/AuthContext';
import { getDb } from '@/db';
import { diaryEvents } from '@/services/diaryEvents';
import { ensureBundledFoodsSeeded, getDiaryDaySummary } from '@/services/foodService';
import { getSupabase } from '@/lib/supabase';

export interface UseDiaryResult {
  daySummary: DiaryDaySummary;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useDiary(localDate?: string): UseDiaryResult {
  const { user } = useAuth();
  const userId = user?.id || 'guest-user';
  const targetDate = localDate ?? new Date().toISOString().slice(0, 10);

  const [daySummary, setDaySummary] = useState<DiaryDaySummary>(() => ({
    local_date: targetDate,
    sections: {
      breakfast: {
        section: 'breakfast',
        entries: [],
        count: 0,
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        sugar: 0,
        sodium_mg: 0,
      },
      lunch: {
        section: 'lunch',
        entries: [],
        count: 0,
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        sugar: 0,
        sodium_mg: 0,
      },
      dinner: {
        section: 'dinner',
        entries: [],
        count: 0,
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        sugar: 0,
        sodium_mg: 0,
      },
      snacks: {
        section: 'snacks',
        entries: [],
        count: 0,
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        sugar: 0,
        sodium_mg: 0,
      },
      extra: {
        section: 'extra',
        entries: [],
        count: 0,
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        sugar: 0,
        sodium_mg: 0,
      },
    },
    totals: {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sugar: 0,
      sodium_mg: 0,
      entryCount: 0,
    },
  }));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const db = await getDb();
      await loadAccountTable(db, 'food_entries', userId);
      await ensureBundledFoodsSeeded(db);
      let summary = await getDiaryDaySummary(db, userId, targetDate);
      const missing = Object.values(summary.sections)
        .flatMap((section) => section.entries)
        .filter((entry) => entry.calories === 0 && entry.protein + entry.carbs + entry.fat > 0);
      if (missing.length) {
        const ids = [
          ...new Set(
            missing.map((entry) => entry.food_id).filter((id): id is string => Boolean(id)),
          ),
        ].slice(0, 5);
        for (const id of ids) {
          const { error } = await getSupabase().functions.invoke('food-lookup', {
            body: { repair_food_id: id },
          });
          if (error) throw new Error('FOOD_ENERGY_UNAVAILABLE');
        }
        await loadAccountTable(db, 'food_entries', userId);
        summary = await getDiaryDaySummary(db, userId, targetDate);
        if (
          Object.values(summary.sections).some((section) =>
            section.entries.some(
              (entry) => entry.calories === 0 && entry.protein + entry.carbs + entry.fat > 0,
            ),
          )
        )
          throw new Error('FOOD_ENERGY_UNAVAILABLE');
      }
      setDaySummary(summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load diary');
    } finally {
      setLoading(false);
    }
  }, [userId, targetDate]);

  useEffect(() => {
    void loadData();
    const unsubscribe = diaryEvents.subscribe(() => {
      void loadData();
    });
    return unsubscribe;
  }, [loadData]);

  return {
    daySummary,
    loading,
    error,
    refresh: loadData,
  };
}
