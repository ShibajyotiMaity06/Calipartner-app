import { useCallback, useEffect, useState } from 'react';
import type { IndividualFastingProgress, ProgressDateRange } from '@calipartner/core';
import { getDb } from '@/db';
import { getFastingProgressWeekly } from '@/services/fastingService';

export interface UseFastingProgressOptions {
  userId: string;
  range?: ProgressDateRange;
}

/**
 * Hook providing fasting progress data (fasting hours/week, daily hours breakdown)
 * for the Progress tab and charts (PRD 6.20 FST-7).
 */
export function useFastingProgress({
  userId,
  range = '30d',
}: UseFastingProgressOptions) {
  const [data, setData] = useState<IndividualFastingProgress | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProgress = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const db = await getDb();

      const now = new Date();
      const endStr = now.toISOString().slice(0, 10);
      let daysBack = 30;
      if (range === '7d') daysBack = 7;
      else if (range === '30d') daysBack = 30;
      else if (range === '90d') daysBack = 90;
      else if (range === '6m') daysBack = 180;
      else if (range === '1y') daysBack = 365;
      else if (range === 'all') daysBack = 730;

      const startDate = new Date(now);
      startDate.setUTCDate(startDate.getUTCDate() - (daysBack - 1));
      const startStr = startDate.toISOString().slice(0, 10);

      const progress = await getFastingProgressWeekly(db, userId, startStr, endStr);
      setData(progress);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [userId, range]);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  return {
    data,
    loading,
    error,
    refresh: fetchProgress,
  };
}
