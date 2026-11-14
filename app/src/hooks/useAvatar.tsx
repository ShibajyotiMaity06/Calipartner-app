import React, { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { getSupabase } from '@/lib/supabase';
import {
  fetchAvatarState,
  reconcileAvatarRewards,
  type AvatarState,
} from '@/services/avatarService';
import { diaryEvents } from '@/services/diaryEvents';

interface AvatarContextValue {
  state: AvatarState | null;
  loading: boolean;
  error: boolean;
  refresh: () => Promise<void>;
  acknowledge: (state: AvatarState) => void;
}
const AvatarContext = createContext<AvatarContextValue>({
  state: null,
  loading: false,
  error: false,
  refresh: async () => {},
  acknowledge: () => {},
});
export function AvatarProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [result, setResult] = useState<{ owner: string; state: AvatarState } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const epoch = useRef(0);
  const pending = useRef<Promise<void> | null>(null);
  const invalidate = useCallback(() => {
    epoch.current++;
    pending.current = null;
  }, []);
  const refresh = useCallback(async () => {
    if (!userId) return;
    if (pending.current) return pending.current;
    const version = epoch.current;
    setLoading(true);
    setError(false);
    const task = (async () => {
      try {
        const client = getSupabase();
        // Reward validation is server-only; cached reads still render if offline.
        await reconcileAvatarRewards(client).catch(() => undefined);
        const state = await fetchAvatarState(client);
        if (version === epoch.current) setResult({ owner: userId, state });
      } catch {
        if (version === epoch.current) setError(true);
      } finally {
        if (version === epoch.current) {
          setLoading(false);
          pending.current = null;
        }
      }
    })();
    pending.current = task;
    return task;
  }, [userId]);
  useEffect(() => {
    invalidate();
    setResult(null);
    setError(false);
    setLoading(false);
    void refresh();
    return invalidate;
  }, [refresh, invalidate]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void refresh();
    });
    return () => sub.remove();
  }, [refresh]);
  useEffect(() => diaryEvents.subscribe(() => void refresh()), [refresh]);
  const acknowledge = useCallback(
    (state: AvatarState) => {
      if (userId && (!state.profile || state.profile.user_id === userId)) {
        epoch.current++;
        pending.current = null;
        setLoading(false);
        setError(false);
        setResult({ owner: userId, state });
      }
    },
    [userId],
  );
  return (
    <AvatarContext.Provider
      value={{
        state: result && result.owner === userId ? result.state : null,
        loading,
        error,
        refresh,
        acknowledge,
      }}
    >
      {children}
    </AvatarContext.Provider>
  );
}
export const useAvatar = () => useContext(AvatarContext);
