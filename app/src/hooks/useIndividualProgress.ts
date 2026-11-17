import { useCallback, useEffect, useRef, useState } from 'react';
import type { IndividualProgressData, ProgressDateRange } from '@calipartner/core';
import { useAuth } from '@/contexts/AuthContext';
import { getSupabase } from '@/lib/supabase';
import {
  fetchIndividualProgress,
  parseProgressError,
  ProgressServiceError,
} from '@/services/progressService';

export function useIndividualProgress(initialRange: ProgressDateRange = '30d') {
  const { session } = useAuth();
  const owner = session?.user.id;
  const [range, setRange] = useState<ProgressDateRange>(initialRange);
  const [state, setState] = useState<{
    owner?: string;
    range: ProgressDateRange;
    data: IndividualProgressData | null;
    loading: boolean;
    error: ProgressServiceError | null;
  }>({ range, data: null, loading: true, error: null });
  const generation = useRef({ value: 0 }).current;
  const refresh = useCallback(async () => {
    const request = ++generation.value;
    setState({ owner, range, data: null, loading: !!owner, error: null });
    if (!owner) return;
    try {
      const data = await fetchIndividualProgress(getSupabase(), range);
      if (generation.value === request)
        setState({ owner, range, data, loading: false, error: null });
    } catch (err: unknown) {
      if (generation.value === request)
        setState({
          owner,
          range,
          data: null,
          loading: false,
          error: err instanceof ProgressServiceError ? err : parseProgressError(err),
        });
    }
  }, [range, owner, generation]);
  useEffect(() => {
    void refresh();
    return () => {
      generation.value++;
    };
  }, [refresh, generation]);
  const current = state.owner === owner && state.range === range;
  return {
    range,
    setRange,
    data: current ? state.data : null,
    loading: !current || state.loading,
    error: current ? state.error : null,
    refresh,
  };
}
