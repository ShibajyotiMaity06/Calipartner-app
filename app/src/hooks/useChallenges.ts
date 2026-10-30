import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { ChallengeHome, ChallengeMutation } from '@calipartner/core';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useNetworkStatus } from './useNetworkStatus';
import { getDb } from '@/db';
import { getSupabase } from '@/lib/supabase';
import { generateClientUuid } from '@/services/foodService';
import {
  cachedChallenges,
  loadChallenges,
  queueChallenge,
  challengeOutbox,
  flushChallenges,
  dismissChallengeWrite,
  type ChallengePending,
} from '@/services/challengeService';

export function useChallenges() {
  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();
  const id = user?.id;
  const owner = useRef(id);
  owner.current = id;
  const [home, setHome] = useState<ChallengeHome | null>(null);
  const [dataOwner, setDataOwner] = useState<string>();
  const [pending, setPending] = useState<ChallengePending[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef<string | null>(null);
  const acting = useRef<Promise<string> | null>(null);
  const refresh = useCallback(async () => {
    if (!id || lock.current === id) return;
    lock.current = id;
    try {
      const db = await getDb();
      const local = await cachedChallenges(db, id).catch(() => null);
      if (owner.current !== id) return;
      if (local) {
        setHome(local);
        setDataOwner(id);
        setCached(true);
      } else {
        setHome(null);
        setDataOwner(id);
        setLoading(!!isOnline);
      }
      if (isOnline) {
        // Reading is independent of an unavailable queued upload/reset check.
        await flushChallenges(db, getSupabase(), id).catch(() => undefined);
        const fresh = await loadChallenges(db, getSupabase(), id);
        if (owner.current !== id) return;
        setHome(fresh);
        setDataOwner(id);
        setCached(false);
        setError(null);
      }
      const outbox = await challengeOutbox(db, id);
      if (owner.current === id) setPending(outbox);
    } catch (e) {
      if (owner.current === id) setError(e instanceof Error ? e.message : 'CHALLENGE_UNAVAILABLE');
    } finally {
      if (lock.current === id) lock.current = null;
      if (owner.current === id) setLoading(false);
    }
  }, [id, isOnline]);
  useEffect(() => {
    setHome(null);
    setPending([]);
    setDataOwner(undefined);
    setLoading(!!id);
    if (!id) setLoading(false);
    void refresh();
  }, [id, refresh]);
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );
  const poll = home?.catalog.config.poll_seconds;
  useEffect(() => {
    if (!id || !isOnline || !poll) return;
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void refresh();
    }, poll * 1000);
    const sub = getSupabase()
      .channel(`challenges:${id}`)
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
    const state = AppState.addEventListener('change', (value) => {
      if (value === 'active') void refresh();
    });
    return () => {
      clearInterval(timer);
      state.remove();
      void getSupabase().removeChannel(sub);
    };
  }, [id, isOnline, poll, refresh]);
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
            const db = await getDb();
            const request = await queueChallenge(db, id, mutation);
            if (isOnline) await flushChallenges(db, getSupabase(), id);
            const queued = await challengeOutbox(db, id);
            if (owner.current === id) setPending(queued);
            const failed = queued.find((item) => item.id === request && item.status === 'failed');
            if (failed) throw new Error(failed.last_error ?? 'CHALLENGE_UNAVAILABLE');
            await refresh();
            return queued.some((item) => item.id === request) ? 'pending' : 'synced';
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
  const dismiss = useCallback(
    async (request: string) => {
      if (id) {
        await dismissChallengeWrite(await getDb(), id, request);
        await refresh();
      }
    },
    [id, refresh],
  );
  const track = useCallback(
    (event: string, challenge?: string) => {
      if (!id) return;
      void getDb()
        .then(async (db) => {
          await queueChallenge(db, id, {
            action: 'track',
            request_id: generateClientUuid(),
            event,
            id: challenge,
          });
          if (isOnline) await flushChallenges(db, getSupabase(), id);
        })
        .catch(() => {});
    },
    [id, isOnline],
  );
  return {
    home: dataOwner === id ? home : null,
    pending: dataOwner === id ? pending : [],
    loading,
    error,
    cached,
    busy,
    isOnline: !!isOnline,
    refresh,
    mutate,
    dismiss,
    userId: id,
    track,
  };
}
