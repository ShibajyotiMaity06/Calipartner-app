import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { ChallengeHome, ChallengeMutation } from '@calipartner/core';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useNetworkStatus } from './useNetworkStatus';
import { getDb } from '@/db';
import { getSupabase } from '@/lib/supabase';
import { generateClientUuid } from '@/services/foodService';
import { loadChallenges, saveChallenge } from '@/services/challengeService';

export function useChallenges() {
  const channelInstance = useId();
  const channelAttempt = useRef(0);
  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();
  const id = user?.id;
  const owner = useRef(id);
  owner.current = id;
  const [home, setHome] = useState<ChallengeHome | null>(null);
  const [dataOwner, setDataOwner] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);
  const [busy, setBusy] = useState(false);
  const readGeneration = useRef(0);
  const invalidateReads = useCallback(() => {
    readGeneration.current++;
  }, []);
  const reads = useRef(new Map<string, { generation: number; promise: Promise<void> }>());
  const acting = useRef<Promise<string> | null>(null);
  const refresh = useCallback(async (): Promise<void> => {
    if (!id) return;
    const generation = readGeneration.current;
    const previous = reads.current.get(id);
    if (previous) {
      await previous.promise;
      if (owner.current !== id || readGeneration.current !== generation) return;
      // A reconnect must get a fresh request after the old connection's request finishes.
      if (previous.generation !== generation) await refresh();
      return;
    }
    const request = (async () => {
      try {
        const db = await getDb();
        if (isOnline === false) throw new Error('NETWORK_UNAVAILABLE');
        const fresh = await loadChallenges(db, getSupabase(), id);
        if (owner.current !== id || readGeneration.current !== generation) return;
        setHome(fresh);
        setDataOwner(id);
        setCached(false);
        setError(null);
      } catch (e) {
        if (owner.current === id && readGeneration.current === generation)
          setError(e instanceof Error ? e.message : 'CHALLENGE_UNAVAILABLE');
      } finally {
        if (reads.current.get(id)?.generation === generation) reads.current.delete(id);
        if (owner.current === id && readGeneration.current === generation) setLoading(false);
      }
    })();
    reads.current.set(id, { generation, promise: request });
    await request;
  }, [id, isOnline]);
  useEffect(() => {
    invalidateReads();
    setHome(null);
    setDataOwner(undefined);
    setError(null);
    setLoading(!!id);
    if (!id) setLoading(false);
    void refresh();
    return invalidateReads;
  }, [id, refresh, invalidateReads]);
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );
  useEffect(() => {
    const state = AppState.addEventListener('change', (value) => {
      if (value !== 'active') return;
      invalidateReads();
      setError(null);
      setLoading(!!id);
      void refresh();
    });
    return () => state.remove();
  }, [id, refresh, invalidateReads]);
  const poll = home?.catalog.config.poll_seconds;
  useEffect(() => {
    if (!id || !isOnline || !poll) return;
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void refresh();
    }, poll * 1000);
    const sub = getSupabase()
      .channel(`challenges:${id}:${channelInstance}:${++channelAttempt.current}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'challenge_participants',
          filter: `user_id=eq.${id}`,
        },
        () => {
          void getDb()
            .then((db) => loadChallenges(db, getSupabase(), id, false))
            .then((fresh) => {
              if (owner.current === id) {
                setHome(fresh);
                setDataOwner(id);
                setCached(false);
              }
            })
            .catch(() => {});
        },
      )
      .subscribe();
    return () => {
      clearInterval(timer);
      void getSupabase().removeChannel(sub);
    };
  }, [id, isOnline, poll, refresh, channelInstance]);
  const mutate = useCallback(
    async (mutation: ChallengeMutation) => {
      if (!id) throw new Error('ACCOUNT_CHANGED');
      const previous = acting.current;
      const task = (previous ?? Promise.resolve(''))
        .catch(() => {})
        .then(async () => {
          if (owner.current !== id) throw new Error('ACCOUNT_CHANGED');
          setBusy(true);
          try {
            if (!isOnline) throw new Error('NETWORK_UNAVAILABLE');
            await saveChallenge(getSupabase(), id, mutation);
            await refresh();
            return 'saved';
          } finally {
            if (owner.current === id) setBusy(false);
          }
        });
      acting.current = task;
      try {
        return await task;
      } finally {
        if (acting.current === task) acting.current = null;
      }
    },
    [id, isOnline, refresh],
  );
  const track = useCallback(
    (event: string, challenge?: string) => {
      if (!id) return;
      if (!isOnline) return;
      void saveChallenge(getSupabase(), id, {
        action: 'track',
        request_id: generateClientUuid(),
        event,
        id: challenge,
      }).catch(() => {});
    },
    [id, isOnline],
  );
  return {
    home: dataOwner === id ? home : null,
    loading,
    error,
    cached,
    busy,
    isOnline: !!isOnline,
    refresh,
    mutate,
    userId: id,
    track,
  };
}
