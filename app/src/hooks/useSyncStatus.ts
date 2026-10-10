import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getDb } from '@/db';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { getSupabase } from '@/lib/supabase';
import { diaryEvents } from '@/services/diaryEvents';
import {
  getSyncStatus,
  syncAll,
} from '@/services/syncService';

export type SyncUiState = 'synced' | 'pending' | 'syncing' | 'failed';

export function useSyncStatus() {
  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();
  const [uiState, setUiState] = useState<SyncUiState>('synced');
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  const checkStatus = useCallback(async () => {
    try {
      const db = await getDb();
      const s = await getSyncStatus(db);
      setPendingCount(s.pendingCount);
      setFailedCount(s.failedCount);

      if (s.failedCount > 0) {
        setUiState('failed');
      } else if (s.pendingCount > 0) {
        setUiState('pending');
      } else {
        setUiState('synced');
      }
    } catch {
      // Fallback
    }
  }, []);

  const triggerSync = useCallback(async () => {
    if (!isOnline || !user?.id) return;
    try {
      setUiState('syncing');
      const db = await getDb();
      await syncAll(db, getSupabase());
      setLastSyncTime(new Date());
      await checkStatus();
      diaryEvents.emitChange();
    } catch {
      setUiState('failed');
    }
  }, [isOnline, user?.id, checkStatus]);

  useEffect(() => {
    void checkStatus();
    const unsub = diaryEvents.subscribe(() => {
      void checkStatus();
    });
    return unsub;
  }, [checkStatus]);

  // When coming back online, auto trigger sync
  useEffect(() => {
    if (isOnline && pendingCount > 0) {
      void triggerSync();
    }
  }, [isOnline, pendingCount, triggerSync]);

  return {
    uiState,
    pendingCount,
    failedCount,
    lastSyncTime,
    triggerSync,
    refreshStatus: checkStatus,
  };
}
