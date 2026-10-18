import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { FocusSessionMode, RoomFocusState } from '@calipartner/core';
import {
  calculateParticipantFocusedSeconds,
  calculateRemainingTimerSeconds,
} from '@calipartner/core';
import { createLogger } from '@/lib/logger';
import { getSupabase } from '@/lib/supabase';
import type { FocusError } from '@/services/focusService';
import {
  endRoomFocus,
  getRoomFocus,
  getServerCorrectedNow,
  joinRoomFocus,
  leaveRoomFocus,
  parseFocusError,
  pauseMyRoomFocus,
  resumeMyRoomFocus,
  startRoomFocus,
  syncServerClock,
} from '@/services/focusService';

const log = createLogger('useRoomFocus');

export interface UseRoomFocusOptions {
  userId?: string | null;
  isVisible?: boolean;
}

export function useRoomFocus(roomId: string | null, options: UseRoomFocusOptions = {}) {
  const { userId, isVisible = true } = options;

  const [focusState, setFocusState] = useState<RoomFocusState>({
    active_session: null,
    recent_sessions: [],
  });
  const [loading, setLoading] = useState<boolean>(Boolean(roomId && isVisible));
  const [error, setError] = useState<FocusError | null>(null);

  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [myElapsedSeconds, setMyElapsedSeconds] = useState<number>(0);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch initial room focus state
  const refresh = useCallback(async () => {
    if (!roomId) {
      setFocusState({ active_session: null, recent_sessions: [] });
      setLoading(false);
      return;
    }

    try {
      await syncServerClock();
      const state = await getRoomFocus(roomId);
      setFocusState(state);
      setError(null);
    } catch (err) {
      setError(parseFocusError(err));
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  // Realtime subscription ONLY while screen/strip is visible (PRD 7.13, FOC-5)
  useEffect(() => {
    if (!roomId || !isVisible) {
      if (channelRef.current) {
        log.info(`Leaving focus realtime channel for room ${roomId}`);
        getSupabase().removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    refresh();

    const supabase = getSupabase();
    const channelName = `focus:room:${roomId}`;
    log.info(`Subscribing to realtime channel ${channelName}`);

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_focus_sessions',
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          log.info('room_focus_sessions changed, refreshing');
          refresh();
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_focus_participants',
        },
        () => {
          log.info('room_focus_participants changed, refreshing');
          refresh();
        },
      );

    // Realtime presence tracking for viewing/focusing
    if (userId) {
      channel.on('presence', { event: 'sync' }, () => {
        // Can inspect active presence state if needed
      });
      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: userId,
            viewing_focus: true,
            online_at: new Date().toISOString(),
          });
        }
      });
    } else {
      channel.subscribe();
    }

    channelRef.current = channel;

    return () => {
      log.info(`Unmounting focus channel ${channelName}`);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomId, isVisible, userId, refresh]);

  // Live timer tick for active session
  useEffect(() => {
    const active = focusState.active_session;
    if (!active || active.session.status !== 'active') {
      setRemainingSeconds(null);
      setMyElapsedSeconds(0);
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const updateTimes = () => {
      const now = getServerCorrectedNow();

      // Remaining timer
      if (active.session.mode === 'timer' && active.session.ends_at) {
        const remaining = calculateRemainingTimerSeconds(active.session.ends_at, now);
        setRemainingSeconds(remaining);
        if (remaining <= 0) {
          refresh(); // Auto refresh if timer ended
        }
      } else {
        setRemainingSeconds(null);
      }

      // My participant elapsed time
      if (active.my_participant && active.my_participant.status !== 'left') {
        const p = active.my_participant;
        let totalPaused = p.paused_seconds || 0;
        if (p.status === 'break' && p.last_paused_at) {
          totalPaused += Math.max(
            0,
            Math.floor((now.getTime() - new Date(p.last_paused_at).getTime()) / 1000),
          );
        }
        const net = calculateParticipantFocusedSeconds(p.joined_at, now, totalPaused);
        setMyElapsedSeconds(net);
      } else {
        setMyElapsedSeconds(0);
      }
    };

    updateTimes();
    timerRef.current = setInterval(updateTimes, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [focusState.active_session, refresh]);

  // Actions
  const start = useCallback(
    async (mode: FocusSessionMode, label?: string | null, plannedSeconds?: number | null) => {
      if (!roomId) return;
      setError(null);
      try {
        const sessionId = await startRoomFocus(roomId, mode, label, plannedSeconds);
        await refresh();
        return sessionId;
      } catch (err) {
        const parsed = parseFocusError(err);
        setError(parsed);
        throw parsed;
      }
    },
    [roomId, refresh],
  );

  const join = useCallback(async () => {
    const sessionId = focusState.active_session?.session.id;
    if (!sessionId) return;
    setError(null);
    try {
      await joinRoomFocus(sessionId);
      await refresh();
    } catch (err) {
      const parsed = parseFocusError(err);
      setError(parsed);
      throw parsed;
    }
  }, [focusState.active_session?.session.id, refresh]);

  const leave = useCallback(async () => {
    const sessionId = focusState.active_session?.session.id;
    if (!sessionId) return;
    setError(null);
    try {
      await leaveRoomFocus(sessionId);
      await refresh();
    } catch (err) {
      const parsed = parseFocusError(err);
      setError(parsed);
      throw parsed;
    }
  }, [focusState.active_session?.session.id, refresh]);

  const pause = useCallback(async () => {
    const sessionId = focusState.active_session?.session.id;
    if (!sessionId) return;
    setError(null);
    try {
      await pauseMyRoomFocus(sessionId);
      await refresh();
    } catch (err) {
      const parsed = parseFocusError(err);
      setError(parsed);
      throw parsed;
    }
  }, [focusState.active_session?.session.id, refresh]);

  const resume = useCallback(async () => {
    const sessionId = focusState.active_session?.session.id;
    if (!sessionId) return;
    setError(null);
    try {
      await resumeMyRoomFocus(sessionId);
      await refresh();
    } catch (err) {
      const parsed = parseFocusError(err);
      setError(parsed);
      throw parsed;
    }
  }, [focusState.active_session?.session.id, refresh]);

  const end = useCallback(async () => {
    const sessionId = focusState.active_session?.session.id;
    if (!sessionId) return;
    setError(null);
    try {
      await endRoomFocus(sessionId);
      await refresh();
    } catch (err) {
      const parsed = parseFocusError(err);
      setError(parsed);
      throw parsed;
    }
  }, [focusState.active_session?.session.id, refresh]);

  return {
    activeSession: focusState.active_session?.session || null,
    participants: focusState.active_session?.participants || [],
    recentSessions: focusState.recent_sessions || [],
    isStarter: Boolean(focusState.active_session?.is_starter),
    isParticipating: Boolean(focusState.active_session?.is_participating),
    myParticipant: focusState.active_session?.my_participant || null,
    remainingSeconds,
    myElapsedSeconds,
    loading,
    error,
    start,
    join,
    leave,
    pause,
    resume,
    end,
    refresh,
  };
}
