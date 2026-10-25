import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { getDb } from '@/db';
import { getSupabase } from '@/lib/supabase';
import { flushSocialOutbox } from '@/services/friendsService';

/** Queued actions resume on reconnect/foreground and retain their original actor. */
export function FriendsSyncGate() {
  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();
  useEffect(() => {
    if (!user?.id || !isOnline) return;
    let active = true;
    const sync = async () => {
      try {
        const db = await getDb();
        if (active) await flushSocialOutbox(db, getSupabase(), user.id);
      } catch {
        /* Pending actions remain on device. */
      }
    };
    void sync();
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') void sync();
    });
    return () => {
      active = false;
      listener.remove();
    };
  }, [user?.id, isOnline]);
  return null;
}
