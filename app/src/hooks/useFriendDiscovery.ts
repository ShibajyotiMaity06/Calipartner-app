import { useCallback, useEffect, useRef, useState } from 'react';
import type { SocialProfile } from '@calipartner/core';
import { useAuth } from '@/contexts/AuthContext';
import { getDb } from '@/db';
import { getSupabase } from '@/lib/supabase';
import { browseSocialProfiles } from '@/services/friendsService';
import { useNetworkStatus } from './useNetworkStatus';

export type FriendGoal = 'bulk' | 'cut' | 'maintain' | null;
export function useFriendDiscovery(goal: FriendGoal, query: string, random = false) {
  const { user } = useAuth();
  const id = user?.id;
  const { isOnline } = useNetworkStatus();
  const [people, setPeople] = useState<SocialProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [cached, setCached] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [dataKey, setDataKey] = useState('');
  const key = JSON.stringify([id, goal, query, random]);
  const version = useRef(0);
  const cursor = useRef('');
  const loadingRef = useRef(false);
  const load = useCallback(
    async (more = false) => {
      if (!id || (more && loadingRef.current)) return;
      const current = ++version.current;
      loadingRef.current = true;
      setLoading(true);
      setError(false);
      try {
        const result = await browseSocialProfiles(
          await getDb(),
          getSupabase(),
          id,
          Boolean(isOnline),
          goal,
          query,
          more ? cursor.current : '',
          random,
        );
        if (current !== version.current) return;
        cursor.current = result.data.at(-1)?.username ?? '';
        setDataKey(key);
        setPeople((previous) =>
          more
            ? [
                ...previous,
                ...result.data.filter(
                  (person) => !previous.some((existing) => existing.id === person.id),
                ),
              ]
            : result.data,
        );
        setHasMore(!random && Boolean(query.trim().replace(/^@/, '')) && result.data.length === 30);
        setCached(result.cached);
      } catch {
        if (current === version.current) setError(true);
      } finally {
        if (current === version.current) {
          setLoading(false);
          loadingRef.current = false;
        }
      }
    },
    [id, isOnline, goal, query, random, key],
  );
  useEffect(() => {
    setPeople([]);
    setHasMore(false);
    setLoading(Boolean(id));
    setError(false);
    setCached(false);
    const timer = setTimeout(() => void load(), 250);
    return () => {
      clearTimeout(timer);
      version.current++;
      loadingRef.current = false;
    };
  }, [load, id]);
  return { people: dataKey === key ? people : [], loading, error, cached, hasMore, load };
}
