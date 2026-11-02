import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getSupabase } from '@/lib/supabase';
import { useCurrentLocalDate } from './useCurrentLocalDate';
import type { SquadDayMember } from '@/services/checkInService';
import { diaryEvents } from '@/services/diaryEvents';

export function useSquadDay(roomId: string | null, visible = true) {
  const { user } = useAuth();
  const { localDate } = useCurrentLocalDate();
  const [members, setMembers] = useState<SquadDayMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const version = useRef(0);
  const invalidate = useCallback(() => {
    version.current++;
  }, []);
  const refresh = useCallback(async () => {
    const request = ++version.current;
    if (!roomId || !user?.id || !visible) return;
    setLoading(true);
    setError(false);
    try {
      const result = await getSupabase().rpc('get_squad_day', { p_room_id: roomId });
      if (result.error) throw result.error;
      const remote = (result.data?.members ?? []) as SquadDayMember[];
      if (request === version.current) setMembers(remote);
    } catch {
      if (request === version.current) {
        setError(true);
        setMembers([]);
      }
    } finally {
      if (request === version.current) setLoading(false);
    }
  }, [roomId, user?.id, localDate, visible]);
  useEffect(() => {
    setMembers([]);
    if (!visible || !roomId) return;
    void refresh();
    // Refresh on room visibility and after acknowledged saves without subscribing to private tables.
    const timer = setInterval(() => void refresh(), 30000);
    const unsubscribe = diaryEvents.subscribe(() => void refresh());
    return () => {
      invalidate();
      unsubscribe();
      clearInterval(timer);
    };
  }, [refresh, roomId, visible, invalidate]);
  return { members, loading, error, refresh };
}
