import { useCallback, useEffect, useState } from 'react';
import type { LeaderboardResponse } from '@calipartner/core';
import { getSupabase } from '@/lib/supabase';
import {
  fetchLeaderboard,
  LeaderboardServiceError,
  parseLeaderboardError,
  setLeaderboardOptOut as apiSetLeaderboardOptOut,
} from '@/services/leaderboardService';

export function useLeaderboard(weekStartDate?: string) {
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<LeaderboardServiceError | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const res = await fetchLeaderboard(supabase, weekStartDate);
      setData(res);
    } catch (err: unknown) {
      const parsed = err instanceof LeaderboardServiceError ? err : parseLeaderboardError(err);
      setError(parsed);
    } finally {
      setLoading(false);
    }
  }, [weekStartDate]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setOptOut = useCallback(
    async (optedOut: boolean) => {
      setError(null);
      try {
        const supabase = getSupabase();
        await apiSetLeaderboardOptOut(supabase, optedOut);
        await refresh();
      } catch (err: unknown) {
        const parsed = err instanceof LeaderboardServiceError ? err : parseLeaderboardError(err);
        setError(parsed);
        throw parsed;
      }
    },
    [refresh],
  );

  return {
    data,
    loading,
    error,
    refresh,
    setOptOut,
  };
}
