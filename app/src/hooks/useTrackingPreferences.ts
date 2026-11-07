import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_TRACKING, type TrackingPreferences } from '@calipartner/core';
import { useAuth } from '@/contexts/AuthContext';
import {
  readTrackingPreferences,
  saveTrackingPreferences,
} from '@/services/trackingPreferencesService';
import { generateClientUuid } from '@/services/foodService';

export function useTrackingPreferences() {
  const { user } = useAuth();
  const id = user?.id;
  const owner = useRef(id);
  owner.current = id;
  const pending = useRef<{ fingerprint: string; id: string } | null>(null);
  const [state, setState] = useState<{
    owner?: string;
    enabled: TrackingPreferences;
    loading: boolean;
    error: boolean;
  }>({ enabled: DEFAULT_TRACKING, loading: true, error: false });
  const refresh = useCallback(async () => {
    if (!id) {
      setState({ enabled: DEFAULT_TRACKING, loading: false, error: false });
      return;
    }
    setState((previous) => ({
      owner: id,
      enabled: previous.owner === id ? previous.enabled : DEFAULT_TRACKING,
      loading: true,
      error: false,
    }));
    try {
      const enabled = await readTrackingPreferences(id);
      if (owner.current === id) setState({ owner: id, enabled, loading: false, error: false });
    } catch {
      if (owner.current === id)
        setState((previous) => ({ ...previous, owner: id, loading: false, error: true }));
    }
  }, [id]);
  useEffect(() => {
    pending.current = null;
    void refresh();
  }, [refresh]);
  const save = async (enabled: TrackingPreferences) => {
    if (!id) throw new Error('UNAUTHENTICATED');
    const fingerprint = JSON.stringify([id, enabled]);
    if (pending.current?.fingerprint !== fingerprint)
      pending.current = { fingerprint, id: generateClientUuid() };
    const saved = await saveTrackingPreferences(id, enabled, pending.current.id);
    if (owner.current !== id) throw new Error('ACCOUNT_CHANGED');
    setState({ owner: id, enabled: saved, loading: false, error: false });
    pending.current = null;
  };
  return {
    ...state,
    loading: state.loading || state.owner !== id,
    enabled: state.owner === id ? state.enabled : DEFAULT_TRACKING,
    refresh,
    save,
  };
}
