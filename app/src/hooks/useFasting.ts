import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  calculateScheduledWindow,
  computeFastingState,
  DEFAULT_FASTING_SETTINGS,
  evaluateFastingGating,
  type FastingComputedState,
  type FastingGatingResult,
  type FastingSession,
  type FastingSettings,
  type FastingStats,
  type FastingStreak,
  type HealthScreening,
  type ScheduledWindowModeState,
  type UpdateFastingSettingsInput,
} from '@calipartner/core';
import { getDb } from '@/db';
import { getSupabase } from '@/lib/supabase';
import {
  editFastingSession,
  endFast as serviceEndFast,
  getActiveFastingSession,
  getFastingHistory,
  getFastingStats,
  getFastingStreak,
  getLocalFastingSettings,
  parseFastingError,
  saveFastingSettings,
  startFast as serviceStartFast,
} from '@/services/fastingService';

export interface UseFastingOptions {
  userId: string;
  age?: number;
  healthScreening?: HealthScreening | null;
  lowIntakeFlagActive?: boolean;
  timezone?: string;
}

export function useFasting(options: UseFastingOptions) {
  const {
    userId,
    age = 25,
    healthScreening = null,
    lowIntakeFlagActive = false,
    timezone = 'UTC',
  } = options;

  const [settings, setSettings] = useState<FastingSettings>({
    ...DEFAULT_FASTING_SETTINGS,
    user_id: userId,
  });
  const [activeSession, setActiveSession] = useState<FastingSession | null>(null);
  const [history, setHistory] = useState<FastingSession[]>([]);
  const [stats, setStats] = useState<FastingStats>({
    total_fasts: 0,
    completed_fasts: 0,
    ended_early_fasts: 0,
    completion_rate_pct: 0,
    average_duration_minutes: 0,
    average_duration_hours: 0,
    total_fasting_hours: 0,
    longest_fast_minutes: 0,
  });
  const [streak, setStreak] = useState<FastingStreak>({
    current_streak: 0,
    longest_streak: 0,
    last_completed_date: null,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 1. Evaluate gating
  const gating: FastingGatingResult = useMemo(() => {
    return evaluateFastingGating({
      age,
      healthScreening,
      lowIntakeFlagActive,
    });
  }, [age, healthScreening, lowIntakeFlagActive]);

  // 2. Refresh fasting data from SQLite
  const refresh = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const db = await getDb();
      const localSettings = await getLocalFastingSettings(db, userId);
      const active = await getActiveFastingSession(db, userId);
      const pastSessions = await getFastingHistory(db, userId, 50);
      const computedStats = await getFastingStats(db, userId);
      const computedStreak = await getFastingStreak(db, userId, timezone);

      setSettings(localSettings);
      setActiveSession(active);
      setHistory(pastSessions);
      setStats(computedStats);
      setStreak(computedStreak);
    } catch (err) {
      const parsed = parseFastingError(err);
      setError(parsed.message);
    } finally {
      setLoading(false);
    }
  }, [userId, timezone]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // 3. Live timer tick (updates every 30 seconds for clock accuracy without battery drain)
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setCurrentTime(new Date());
    }, 15000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // 4. Computed fast state
  const computedState: FastingComputedState = useMemo(() => {
    return computeFastingState(activeSession, currentTime);
  }, [activeSession, currentTime]);

  // 5. Scheduled window mode state
  const scheduledState: ScheduledWindowModeState = useMemo(() => {
    return calculateScheduledWindow({
      eatingWindowStart: settings.eating_window_start,
      eatingWindowEnd: settings.eating_window_end,
      referenceTime: currentTime,
    });
  }, [settings.eating_window_start, settings.eating_window_end, currentTime]);

  // 6. Action handlers
  const startFast = useCallback(
    async (plannedMinutes?: number, startAt?: string) => {
      if (!gating.canAccess) {
        throw new Error(
          gating.reason === 'low_intake_paused'
            ? 'Fasting is currently paused while low-intake check-in is active.'
            : 'Fasting is not available based on your health profile.',
        );
      }

      try {
        setError(null);
        const db = await getDb();
        const supabase = getSupabase();
        const duration =
          plannedMinutes ??
          (settings.protocol === 'custom'
            ? (settings.custom_fasting_hours ?? 16) * 60
            : DEFAULT_FASTING_SETTINGS.custom_fasting_hours! * 60);

        const newSession = await serviceStartFast(db, supabase, {
          userId,
          plannedMinutes: duration,
          startAt,
          timezone,
        });

        setActiveSession(newSession);
        await refresh();
        return newSession;
      } catch (err) {
        const parsed = parseFastingError(err);
        setError(parsed.message);
        throw parsed;
      }
    },
    [userId, settings, gating, timezone, refresh],
  );

  const endFast = useCallback(
    async (endAt?: string) => {
      if (!activeSession) return null;

      try {
        setError(null);
        const db = await getDb();
        const supabase = getSupabase();
        const finished = await serviceEndFast(db, supabase, {
          sessionId: activeSession.id,
          userId,
          endAt,
        });

        setActiveSession(null);
        await refresh();
        return finished;
      } catch (err) {
        const parsed = parseFastingError(err);
        setError(parsed.message);
        throw parsed;
      }
    },
    [activeSession, userId, refresh],
  );

  const editSession = useCallback(
    async (params: {
      sessionId: string;
      startAt?: string;
      endAt?: string | null;
      plannedMinutes?: number;
      localDate?: string;
    }) => {
      try {
        setError(null);
        const db = await getDb();
        const supabase = getSupabase();
        const edited = await editFastingSession(db, supabase, {
          ...params,
          userId,
        });

        await refresh();
        return edited;
      } catch (err) {
        const parsed = parseFastingError(err);
        setError(parsed.message);
        throw parsed;
      }
    },
    [userId, refresh],
  );

  const updateSettings = useCallback(
    async (updates: Partial<UpdateFastingSettingsInput>) => {
      try {
        setError(null);
        const db = await getDb();
        const supabase = getSupabase();
        const mergedSettings: FastingSettings = {
          ...settings,
          ...updates,
          updated_at: new Date().toISOString(),
        };

        const saved = await saveFastingSettings(db, supabase, mergedSettings);
        setSettings(saved);
        return saved;
      } catch (err) {
        const parsed = parseFastingError(err);
        setError(parsed.message);
        throw parsed;
      }
    },
    [settings],
  );

  return {
    settings,
    activeSession,
    computedState,
    scheduledState,
    stats,
    streak,
    gating,
    history,
    loading,
    error,
    startFast,
    endFast,
    editSession,
    updateSettings,
    refresh,
  };
}
