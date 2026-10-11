import { useCallback, useEffect, useState } from 'react';
import type { IndividualProgressData, ProgressDateRange } from '@calipartner/core';
import { getSupabase } from '@/lib/supabase';
import {
  fetchIndividualProgress,
  parseProgressError,
  ProgressServiceError,
} from '@/services/progressService';

export function useIndividualProgress(initialRange: ProgressDateRange = '30d') {
  const [range, setRange] = useState<ProgressDateRange>(initialRange);
  const [data, setData] = useState<IndividualProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ProgressServiceError | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const result = await fetchIndividualProgress(supabase, range);
      setData(result);
    } catch (err: unknown) {
      const parsed = err instanceof ProgressServiceError ? err : parseProgressError(err);
      setError(parsed);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    range,
    setRange,
    data,
    loading,
    error,
    refresh,
  };
}
