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
import { squadNameEvents } from '@/services/squadNameService';

export function useRooms() {
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<RoomServiceError | null>(null);
  const revision = useRef(0);
  const confirmedNames = useRef(new Map<string, { name: string }>());

  const refresh = useCallback(async () => {
    const request = ++revision.current;
    const namesAtStart = new Map(confirmedNames.current);
    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const data = await listUserRooms(supabase);
      if (request === revision.current)
        setRooms(
          data.map((room) => {
            const confirmed = confirmedNames.current.get(room.id);
            return confirmed && confirmed !== namesAtStart.get(room.id)
              ? { ...room, name: confirmed.name }
              : room;
          }),
        );
    } catch (err: unknown) {
      const serviceErr = err instanceof RoomServiceError ? err : parseRoomError(err);
      if (request === revision.current) setError(serviceErr);
    } finally {
      if (request === revision.current) setLoading(false);
    }
  }, []);

  useEffect(
    () =>
      squadNameEvents.subscribe(({ room_id, name }) => {
        confirmedNames.current.set(room_id, { name });
        setRooms((previous) =>
          previous.map((room) => (room.id === room_id ? { ...room, name } : room)),
        );
        setError(null);
      }),
    [],
  );

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
