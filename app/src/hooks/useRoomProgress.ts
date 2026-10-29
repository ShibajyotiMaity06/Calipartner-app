import { useCallback, useEffect, useRef, useState } from 'react';
import type { RoomProgressData, RoomProgressDateRange } from '@calipartner/core';
import { getSupabase } from '@/lib/supabase';
import {
  fetchRoomProgress,
  parseProgressError,
  ProgressServiceError,
  searchRoomMembersForProgress,
} from '@/services/progressService';

export function useRoomProgress(
  roomId: string | null,
  initialRange: RoomProgressDateRange = '30d',
) {
  const requestVersion = useRef(0);
  const invalidate = useCallback(() => {
    requestVersion.current++;
  }, []);
  const [range, setRange] = useState<RoomProgressDateRange>(initialRange);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [data, setData] = useState<RoomProgressData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ProgressServiceError | null>(null);

  const refresh = useCallback(async () => {
    const version = ++requestVersion.current;
    if (!roomId) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const result = await fetchRoomProgress(
        supabase,
        roomId,
        range,
        selectedMemberIds.length > 0 ? selectedMemberIds : undefined,
      );
      if (version !== requestVersion.current) return;
      setData(result);
      if (result.is_large_room)
        setSelectedMemberIds((previous) =>
          previous.length ? previous : result.selected_member_ids,
        );
    } catch (err: unknown) {
      const parsed = err instanceof ProgressServiceError ? err : parseProgressError(err);
      if (version === requestVersion.current) setError(parsed);
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [roomId, range, selectedMemberIds]);

  useEffect(() => {
    refresh();
    return () => {
      invalidate();
    };
  }, [refresh, invalidate]);

  const searchMembers = useCallback(
    async (query: string) => {
      if (!roomId) return [];
      const supabase = getSupabase();
      return searchRoomMembersForProgress(supabase, roomId, query);
    },
    [roomId],
  );

  const toggleMemberSelection = useCallback((memberId: string) => {
    setSelectedMemberIds((prev) => {
      if (prev.includes(memberId)) {
        return prev.filter((id) => id !== memberId);
      }
      if (prev.length >= 8) {
        return prev;
      }
      return [...prev, memberId];
    });
  }, []);

  return {
    range,
    setRange,
    selectedMemberIds,
    setSelectedMemberIds,
    toggleMemberSelection,
    data,
    loading,
    error,
    refresh,
    searchMembers,
  };
}
