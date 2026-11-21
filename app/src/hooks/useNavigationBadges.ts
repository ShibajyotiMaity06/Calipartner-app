import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { getSupabase } from '@/lib/supabase';
import { subscribeRequestInbox } from '@/services/requestInboxEvents';
import type { TabId } from '@calipartner/ui';

export interface TabBadges {
  chat: number;
  room: number;
  feed: number;
  today: number;
  progress: number;
}

const DEFAULT_BADGES: TabBadges = {
  chat: 0,
  room: 0,
  feed: 0,
  today: 0,
  progress: 0,
};

export function useNavigationBadges(): Partial<Record<TabId, number>> {
  const { user } = useAuth();
  const userId = user?.id;
  const [badges, setBadges] = useState<TabBadges>(DEFAULT_BADGES);
  const isFetching = useRef(false);

  const fetchBadges = useCallback(async () => {
    if (!userId || isFetching.current) return;
    isFetching.current = true;
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.rpc('get_user_navigation_badges');
      if (!error && data && typeof data === 'object') {
        const payload = data as Record<string, unknown>;
        setBadges({
          chat: typeof payload.chat === 'number' ? Math.max(0, payload.chat) : 0,
          room: typeof payload.room === 'number' ? Math.max(0, payload.room) : 0,
          feed: typeof payload.feed === 'number' ? Math.max(0, payload.feed) : 0,
          today: typeof payload.today === 'number' ? Math.max(0, payload.today) : 0,
          progress: typeof payload.progress === 'number' ? Math.max(0, payload.progress) : 0,
        });
      }
    } catch {
      // Graceful silence on network/offline
    } finally {
      isFetching.current = false;
    }
  }, [userId]);

  // Initial & user changes
  useEffect(() => {
    if (!userId) {
      setBadges(DEFAULT_BADGES);
      return;
    }
    void fetchBadges();
  }, [userId, fetchBadges]);

  // Subscribe to friend & room request inbox invalidation events
  useEffect(() => {
    if (!userId) return;
    const unsubscribe = subscribeRequestInbox(() => {
      void fetchBadges();
    });
    return unsubscribe;
  }, [userId, fetchBadges]);

  // Refetch on app foreground
  useEffect(() => {
    if (!userId) return;
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        void fetchBadges();
      }
    };
    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [userId, fetchBadges]);

  // Periodic poll every 30s while active
  useEffect(() => {
    if (!userId) return;
    const timer = setInterval(() => {
      void fetchBadges();
    }, 30000);
    return () => clearInterval(timer);
  }, [userId, fetchBadges]);

  return badges;
}
