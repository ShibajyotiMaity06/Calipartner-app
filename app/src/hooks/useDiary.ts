import { useCallback, useEffect, useState } from 'react';
import type { DiaryDaySummary } from '@calipartner/core';
import { useAuth } from '@/contexts/AuthContext';
import { getDb } from '@/db';
import { diaryEvents } from '@/services/diaryEvents';
import { ensureBundledFoodsSeeded, getDiaryDaySummary } from '@/services/foodService';

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
      breakfast: { section: 'breakfast', entries: [], count: 0, calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium_mg: 0 },
      lunch: { section: 'lunch', entries: [], count: 0, calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium_mg: 0 },
      dinner: { section: 'dinner', entries: [], count: 0, calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium_mg: 0 },
      snacks: { section: 'snacks', entries: [], count: 0, calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium_mg: 0 },
      extra: { section: 'extra', entries: [], count: 0, calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium_mg: 0 },
    },
    totals: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium_mg: 0, entryCount: 0 },
  }));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const db = await getDb();
      await ensureBundledFoodsSeeded(db);
      const summary = await getDiaryDaySummary(db, userId, targetDate);
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
