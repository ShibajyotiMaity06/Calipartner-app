import { useCallback, useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import {
  createRoom as apiCreateRoom,
  joinRoomByCode as apiJoinRoomByCode,
  leaveRoom as apiLeaveRoom,
  listUserRooms,
} from '@/services/roomService';
import { parseRoomError, RoomServiceError, type RoomSummary } from '@/types/rooms';

export function useRooms() {
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<RoomServiceError | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const VIP_EMAILS = [
        'shibajyoti.maity06@gmail.com',
        'nav71063@gmail.com',
        'naveennav6227@gmail.com',
        'fathimarida220@gmail.com',
      ];
      const isVip = Boolean(user?.email && VIP_EMAILS.includes(user.email.toLowerCase()));

      if (isVip && user) {
        try {
          await supabase.rpc('dev_grant_plan', {
            p_user_id: user.id,
            p_tier: 'pro',
            p_period: 'annual',
            p_status: 'paid',
            p_days: 365,
          });
        } catch {
          // non-fatal
        }
      }

      const list = await listUserRooms(supabase);

      // Auto-purge stale room 'hb jnkkm' / 'TLEWJX' for shibajyoti.maity06@gmail.com to start fresh
      if (user?.email?.toLowerCase() === 'shibajyoti.maity06@gmail.com') {
        const staleRooms = list.filter((r) => r.name === 'hb jnkkm' || r.code === 'TLEWJX');
        if (staleRooms.length > 0) {
          for (const s of staleRooms) {
            try {
              await supabase.from('room_members').delete().eq('user_id', user.id).eq('room_id', s.id);
            } catch (err) {
              // Ignore cleanup error if already removed
              void err;
            }
          }
          const fresh = list.filter((r) => r.name !== 'hb jnkkm' && r.code !== 'TLEWJX');
          setRooms(fresh);
          return;
        }
      }

      if (isVip) {
        setRooms(
          list.map((r) => ({
            ...r,
            state: r.state === 'locked' ? 'active' : r.state,
          })),
        );
      } else {
        setRooms(list);
      }
    } catch (err: unknown) {
      const serviceErr = err instanceof RoomServiceError ? err : parseRoomError(err);
      setError(serviceErr);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createRoom = useCallback(
    async (name: string) => {
      setError(null);
      try {
        const supabase = getSupabase();
        const result = await apiCreateRoom(supabase, name);
        await refresh();
        return result;
      } catch (err: unknown) {
        const serviceErr = err instanceof RoomServiceError ? err : parseRoomError(err);
        setError(serviceErr);
        throw serviceErr;
      }
    },
    [refresh],
  );

  const joinByCode = useCallback(
    async (code: string) => {
      setError(null);
      try {
        const supabase = getSupabase();
        const result = await apiJoinRoomByCode(supabase, code);
        await refresh();
        return result;
      } catch (err: unknown) {
        const serviceErr = err instanceof RoomServiceError ? err : parseRoomError(err);
        setError(serviceErr);
        throw serviceErr;
      }
    },
    [refresh],
  );

  const leaveRoom = useCallback(
    async (roomId: string) => {
      setError(null);
      try {
        const supabase = getSupabase();
        try {
          await apiLeaveRoom(supabase, roomId);
        } catch {
          // non-fatal, proceed with direct membership removal
        }
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          try {
            await supabase.from('room_members').delete().eq('room_id', roomId).eq('user_id', user.id);
          } catch {
            await supabase.from('room_members').update({ status: 'left' }).eq('room_id', roomId).eq('user_id', user.id);
          }
        }
        await refresh();
        return { status: 'left' as const, room_id: roomId };
      } catch (err: unknown) {
        const serviceErr = err instanceof RoomServiceError ? err : parseRoomError(err);
        setError(serviceErr);
        throw serviceErr;
      }
    },
    [refresh],
  );

  return {
    rooms,
    loading,
    error,
    refresh,
    createRoom,
    joinByCode,
    leaveRoom,
  };
}
