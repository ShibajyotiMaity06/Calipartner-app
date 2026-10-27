import { useCallback, useEffect, useRef, useState } from 'react';
import { generateClientUuid } from '@/services/foodService';
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
      setRooms(await listUserRooms(supabase));
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

  const createRequest = useRef<{ name: string; id: string } | null>(null);
  const createRoom = useCallback(
    async (name: string, friendIds?: string[]) => {
      setError(null);
      try {
        const supabase = getSupabase();
        if (createRequest.current?.name !== name)
          createRequest.current = { name, id: generateClientUuid() };
        const result = await apiCreateRoom(
          supabase,
          name,
          undefined,
          createRequest.current.id,
          friendIds,
        );
        createRequest.current = null;
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
            await supabase
              .from('room_members')
              .delete()
              .eq('room_id', roomId)
              .eq('user_id', user.id);
          } catch {
            await supabase
              .from('room_members')
              .update({ status: 'left' })
              .eq('room_id', roomId)
              .eq('user_id', user.id);
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
