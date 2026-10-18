import { useCallback, useEffect, useState } from 'react';
import type { PersonalFocusStats, RoomWeeklyFocusStats } from '@calipartner/core';
import type { FocusError } from '@/services/focusService';
import {
  getPersonalFocusStats,
  getRoomWeeklyFocusStats,
  parseFocusError,
} from '@/services/focusService';

export function usePersonalFocusStats(startDate?: string, endDate?: string, userId?: string) {
  const [stats, setStats] = useState<PersonalFocusStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<FocusError | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPersonalFocusStats(startDate, endDate, userId);
      setStats(data);
      setError(null);
    } catch (err) {
      setError(parseFocusError(err));
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { stats, loading, error, refresh };
}

export function useRoomWeeklyFocusStats(roomId: string | null, weekStart?: string) {
  const [stats, setStats] = useState<RoomWeeklyFocusStats | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(roomId));
  const [error, setError] = useState<FocusError | null>(null);

  const refresh = useCallback(async () => {
    if (!roomId) {
      setStats(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await getRoomWeeklyFocusStats(roomId, weekStart);
      setStats(data);
      setError(null);
    } catch (err) {
      setError(parseFocusError(err));
    } finally {
      setLoading(false);
    }
  }, [roomId, weekStart]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { stats, loading, error, refresh };
}
