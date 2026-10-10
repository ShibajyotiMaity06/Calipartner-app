import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { RoomSnapshot } from '@calipartner/core';
import { getSupabase } from '@/lib/supabase';
import { getRoomSnapshot as apiGetRoomSnapshot } from '@/services/roomService';
import { parseRoomError, RoomServiceError } from '@/types/rooms';

/**
 * Hook to fetch room snapshot and keep it fresh via Supabase Realtime.
 * Strictly adheres to rule: subscribes ONLY while the Room screen is visible (isVisible = true).
 */
export function useRoomSnapshot(
  roomId: string | null,
  isVisible = true,
  options?: {
    selectedUserId?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  },
) {
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(roomId && isVisible));
  const [error, setError] = useState<RoomServiceError | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const selectedUserId = options?.selectedUserId;
  const search = options?.search;
  const page = options?.page;
  const pageSize = options?.pageSize;

  const refresh = useCallback(async () => {
    if (!roomId) {
      setSnapshot(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const data = await apiGetRoomSnapshot(supabase, roomId, {
        selectedUserId,
        search,
        page,
        pageSize,
      });
      setSnapshot(data);
    } catch (err: unknown) {
      const serviceErr = err instanceof RoomServiceError ? err : parseRoomError(err);
      setError(serviceErr);
    } finally {
      setLoading(false);
    }
  }, [roomId, selectedUserId, search, page, pageSize]);

  useEffect(() => {
    // If room is not visible or no roomId is specified, do not fetch or subscribe
    if (!roomId || !isVisible) {
      if (channelRef.current) {
        const supabase = getSupabase();
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    // Initial fetch when becoming visible
    refresh();

    // Subscribe to realtime changes for this room
    const supabase = getSupabase();
    const channelName = `room_realtime:${roomId}:${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_members',
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          refresh();
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_events',
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          refresh();
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${roomId}`,
        },
        () => {
          refresh();
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [roomId, isVisible, refresh]);

  return {
    snapshot,
    loading,
    error,
    refresh,
  };
}
