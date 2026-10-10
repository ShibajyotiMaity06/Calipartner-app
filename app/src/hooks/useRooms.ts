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
      const list = await listUserRooms(supabase);
      setRooms(list);
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
        const result = await apiLeaveRoom(supabase, roomId);
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
