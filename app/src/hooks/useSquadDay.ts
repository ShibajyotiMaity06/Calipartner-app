import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getDb } from '@/db';
import { getSupabase } from '@/lib/supabase';
import { useCurrentLocalDate } from './useCurrentLocalDate';
import type { SquadDayMember } from '@/services/checkInService';
import { diaryEvents } from '@/services/diaryEvents';

export function useSquadDay(roomId: string | null, visible = true) {
  const { user, profile } = useAuth();
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
      const db = await getDb();
      const local = await db.getFirstAsync<{
        activities: string;
        note: string;
        occurred_at: string;
        sync_state: string;
      }>('SELECT * FROM local_squad_check_ins WHERE user_id=? AND room_id=? AND local_date=?', [
        user.id,
        roomId,
        localDate,
      ]);
      if (local && local.sync_state !== 'synced') {
        const own = remote.find((member) => member.user_id === user.id);
        if (own)
          Object.assign(own, {
            checked_in: true,
            activities: JSON.parse(local.activities),
            note: local.note,
            occurred_at: local.occurred_at,
          });
      }
      if (request === version.current) setMembers(remote);
    } catch {
      if (request === version.current) {
        setError(true);
        // Keep only this account's own durable check-in while offline.
        try {
          const db = await getDb();
          const local = await db.getFirstAsync<{
            activities: string;
            note: string;
            occurred_at: string;
          }>('SELECT * FROM local_squad_check_ins WHERE user_id=? AND room_id=? AND local_date=?', [
            user.id,
            roomId,
            localDate,
          ]);
          if (request === version.current)
            setMembers(
              local
                ? [
                    {
                      user_id: user.id,
                      nickname: profile?.nickname ?? '',
                      is_self: true,
                      checked_in: true,
                      activities: JSON.parse(local.activities),
                      note: local.note,
                      occurred_at: local.occurred_at,
                    },
                  ]
                : [],
            );
        } catch {
          if (request === version.current) setMembers([]);
        }
      }
    } finally {
      if (request === version.current) setLoading(false);
    }
  }, [roomId, user?.id, profile?.nickname, localDate, visible]);
  useEffect(() => {
    setMembers([]);
    if (!visible || !roomId) return;
    void refresh();
    // Refresh on room visibility and after background sync without subscribing to private tables.
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
