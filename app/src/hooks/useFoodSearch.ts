import { useEffect, useState } from 'react';
import type { Food } from '@calipartner/core';
import { useAuth } from '@/contexts/AuthContext';
import { getDb } from '@/db';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { getSupabase } from '@/lib/supabase';
import {
  ensureBundledFoodsSeeded,
  lookupRemoteFood,
  searchLocalFoods,
} from '@/services/foodService';

export function useFoodSearch() {
  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Food[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    const trimmed = query.trim();

    if (!trimmed) {
      setResults([]);
      setLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const db = await getDb();
        await ensureBundledFoodsSeeded(db);

        // 1. Instant local search first
        const localMatches = await searchLocalFoods(db, trimmed, user?.id);
        if (!isCurrent) return;
        setResults(localMatches);

        // 2. If online and fewer than 5 results, query remote Edge Function
        if (isOnline && localMatches.length < 5) {
          const remote = await lookupRemoteFood(getSupabase(), { text: trimmed });
          if (!isCurrent) return;

          if (remote && !localMatches.some((f) => f.name.toLowerCase() === remote.name.toLowerCase())) {
            setResults((prev) => [...prev, remote]);
          }
        }
      } catch {
        // Fallback gracefully
      } finally {
        if (isCurrent) setLoading(false);
      }
    }, 250);

    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [query, isOnline, user?.id]);

  return { query, setQuery, results, loading };
}
