import { useCallback, useEffect, useRef, useState } from 'react';
import type { FocusSession, FocusSessionMode } from '@calipartner/core';
import { calculateFocusedSeconds } from '@calipartner/core';
import { getDb } from '@/db';
import {
  endPersonalSession,
  getLocalActivePersonalSession,
  getServerCorrectedNow,
  pausePersonalSession,
  resumePersonalSession,
  startPersonalSession,
  syncServerClock,
} from '@/services/focusService';

export interface UsePersonalFocusOptions {
  userId: string;
}

export function usePersonalFocus({ userId }: UsePersonalFocusOptions) {
  const [session, setSession] = useState<FocusSession | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Initial load: sync server clock & query local active session
  const refreshSession = useCallback(async () => {
    if (!userId) {
      setSession(null);
      setLoading(false);
      return;
    }

    try {
      await syncServerClock();
      const db = await getDb();
      const active = await getLocalActivePersonalSession(db, userId);
      setSession(active);
    } catch {
      // Ignore initial error
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  // Live timer tick
  useEffect(() => {
    if (!session || session.status === 'ended' || session.status === 'auto_ended') {
      setElapsedSeconds(0);
      setRemainingSeconds(null);
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const updateTimes = () => {
      const now = getServerCorrectedNow();
      let totalPaused = session.paused_seconds || 0;
      if (session.status === 'paused' && session.last_paused_at) {
        const pStart = new Date(session.last_paused_at).getTime();
        totalPaused += Math.max(0, Math.floor((now.getTime() - pStart) / 1000));
      }

      const netElapsed = calculateFocusedSeconds(session.started_at, now, totalPaused);
      setElapsedSeconds(netElapsed);

      if (session.mode === 'timer' && session.planned_seconds) {
        const remaining = Math.max(0, session.planned_seconds - netElapsed);
        setRemainingSeconds(remaining);
      } else {
        setRemainingSeconds(null);
      }
    };

    updateTimes();
    timerRef.current = setInterval(updateTimes, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [session]);

  const start = useCallback(
    async (mode: FocusSessionMode, label?: string | null, plannedSeconds?: number | null) => {
      const db = await getDb();
      const newSession = await startPersonalSession(db, {
        userId,
        mode,
        label,
        plannedSeconds,
      });
      setSession(newSession);
      return newSession;
    },
    [userId],
  );

  const pause = useCallback(async () => {
    if (!session) return;
    const db = await getDb();
    await pausePersonalSession(db, session.id);
    const nowIso = getServerCorrectedNow().toISOString();
    setSession((prev) =>
      prev ? { ...prev, status: 'paused', last_paused_at: nowIso } : null,
    );
  }, [session]);

  const resume = useCallback(async () => {
    if (!session) return;
    const db = await getDb();
    await resumePersonalSession(db, session);
    const now = getServerCorrectedNow();
    let addPause = 0;
    if (session.last_paused_at) {
      addPause = Math.max(0, Math.floor((now.getTime() - new Date(session.last_paused_at).getTime()) / 1000));
    }
    setSession((prev) =>
      prev
        ? {
            ...prev,
            status: 'active',
            paused_seconds: (prev.paused_seconds || 0) + addPause,
            last_paused_at: null,
          }
        : null,
    );
  }, [session]);

  const end = useCallback(async () => {
    if (!session) return;
    const db = await getDb();
    await endPersonalSession(db, session.id, session);
    setSession(null);
  }, [session]);

  return {
    session,
    loading,
    elapsedSeconds,
    remainingSeconds,
    isActive: session?.status === 'active',
    isPaused: session?.status === 'paused',
    start,
    pause,
    resume,
    end,
    refreshSession,
  };
}
