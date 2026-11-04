import { saveHealthScreeningOnline } from '@/services/targetsService';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  calculateAge,
  calculateScheduledWindow,
  computeFastingState,
  DEFAULT_FASTING_SETTINGS,
  evaluateFastingGating,
  getProtocolPlannedMinutes,
  type FastingSession,
  type FastingSettings,
  type HealthScreening,
  type UpdateFastingSettingsInput,
} from '@calipartner/core';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from './useSubscription';
import { getDb } from '@/db';
import { getSupabase } from '@/lib/supabase';
import { loadAccountTable } from '@/services/accountDataService';
import { generateClientUuid } from '@/services/foodService';
import { calculateFastingStats, calculateFastingStreak } from '@calipartner/core';
import {
  editFastingSession,
  endFast as serviceEndFast,
  getActiveFastingSession,
  getFastingHistory,
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
export function useFasting({ userId }: UseFastingOptions) {
  const { profile } = useAuth();
  const { hasActiveAccess, currentTier, loading: planLoading } = useSubscription();
  const hasPaidAccess = hasActiveAccess && (currentTier === 'plus' || currentTier === 'pro');
  const timezone = profile?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [settings, setSettings] = useState<FastingSettings>({
    ...DEFAULT_FASTING_SETTINGS,
    user_id: userId,
  });
  const [activeSession, setActiveSession] = useState<FastingSession | null>(null);
  const [history, setHistory] = useState<FastingSession[]>([]);
  const [screening, setScreening] = useState<HealthScreening | null>(null);
  const [lowIntake, setLowIntake] = useState(false);
  const [reminders, setReminders] = useState({
    enabled: false,
    quiet: { enabled: false, start: '22:00', end: '07:00' },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const owner = useRef(userId);
  owner.current = userId;
  const generation = useRef(0);
  const pendingStart = useRef<string | null>(null);
  const pendingEnd = useRef<string | null>(null);
  const inFlight = useRef(false);
  useEffect(() => {
    setSettings({ ...DEFAULT_FASTING_SETTINGS, user_id: userId });
    setActiveSession(null);
    setHistory([]);
    setScreening(null);
    setLowIntake(false);
    pendingStart.current = null;
    pendingEnd.current = null;
  }, [userId]);
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const db = await getDb();
      await loadAccountTable(db, 'fasting_settings', userId);
      await loadAccountTable(db, 'fasting_sessions', userId);
      const client = getSupabase();
      const [localSettings, active, past, health, daily, notifications] = await Promise.all([
        getLocalFastingSettings(db, userId),
        getActiveFastingSession(db, userId),
        getFastingHistory(db, userId, 10000),
        client.from('health_screening').select('*').eq('user_id', userId).maybeSingle(),
        client
          .from('daily_summaries')
          .select('low_intake_flag')
          .eq('user_id', userId)
          .order('local_date', { ascending: false })
          .limit(1)
          .maybeSingle(),
        client
          .from('notification_settings')
          .select(
            'fasting_reminders_enabled,pause_all,quiet_hours_enabled,quiet_hours_start,quiet_hours_end',
          )
          .eq('user_id', userId)
          .maybeSingle(),
      ]);
      if (health.error || daily.error) throw new Error('FASTING_READ_FAILED');
      if (owner.current !== userId || request !== generation.current) return;
      if (past.some((session) => session.id === pendingStart.current)) pendingStart.current = null;
      setReminders({
        enabled:
          notifications.data?.fasting_reminders_enabled === true &&
          notifications.data?.pause_all !== true,
        quiet: {
          enabled: notifications.data?.quiet_hours_enabled === true,
          start: notifications.data?.quiet_hours_start ?? '22:00',
          end: notifications.data?.quiet_hours_end ?? '07:00',
        },
      });
      setSettings(localSettings);
      setActiveSession(active);
      setHistory(past);
      setScreening(health.data as HealthScreening | null);
      setLowIntake(daily.data?.low_intake_flag === true);
      setCurrentTime(new Date());
    } catch (reason) {
      if (owner.current === userId && request === generation.current)
        setError(parseFastingError(reason).code);
    } finally {
      if (owner.current === userId && request === generation.current) setLoading(false);
    }
  }, [userId]);
  useEffect(() => {
    void refresh();
    return () => {
      generation.current++;
    };
  }, [refresh]);
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 15000);
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setCurrentTime(new Date());
        void refresh();
      }
    });
    return () => {
      clearInterval(timer);
      listener.remove();
    };
  }, [refresh]);
  const gating = useMemo(
    () =>
      evaluateFastingGating({
        age: profile?.date_of_birth ? calculateAge(profile.date_of_birth, currentTime) : -1,
        healthScreening: screening,
        lowIntakeFlagActive: lowIntake,
      }),
    [profile?.date_of_birth, currentTime, screening, lowIntake],
  );
  const screeningReady = Boolean(screening);
  const computedState = useMemo(
    () => computeFastingState(activeSession, currentTime),
    [activeSession, currentTime],
  );
  const scheduledState = useMemo(
    () =>
      calculateScheduledWindow({
        eatingWindowStart: settings.eating_window_start,
        eatingWindowEnd: settings.eating_window_end,
        referenceTime: currentTime,
        timezone,
      }),
    [settings, currentTime, timezone],
  );
  const stats = useMemo(
    () => calculateFastingStats(history.filter((session) => session.status !== 'active')),
    [history],
  );
  const streak = useMemo(
    () => calculateFastingStreak(history, timezone, currentTime),
    [history, timezone, currentTime],
  );
  const run = useCallback(async <T>(action: () => Promise<T>): Promise<T> => {
    if (inFlight.current) throw new Error('SAVE_IN_PROGRESS');
    inFlight.current = true;
    setError(null);
    try {
      return await action();
    } catch (reason) {
      const parsed = parseFastingError(reason);
      setError(parsed.code);
      throw parsed;
    } finally {
      inFlight.current = false;
    }
  }, []);
  const startFast = useCallback(
    (plannedMinutes?: number, startAt?: string) =>
      run(async () => {
        if (!hasPaidAccess) throw new Error('PLUS_REQUIRED');
        if (loading || error) throw new Error('FASTING_READ_FAILED');
        if (!screeningReady) throw new Error('SCREENING_REQUIRED');
        if (!gating.canAccess)
          throw new Error(gating.isPaused ? 'LOW_INTAKE_PAUSED' : 'SCREENING_INELIGIBLE');
        pendingStart.current ??= generateClientUuid();
        const session = await serviceStartFast(await getDb(), getSupabase(), {
          userId,
          id: pendingStart.current,
          plannedMinutes:
            plannedMinutes ??
            getProtocolPlannedMinutes(settings.protocol, settings.custom_fasting_hours),
          startAt,
          timezone,
          reminders,
        });
        pendingStart.current = null;
        setActiveSession(session);
        setCurrentTime(new Date());
        await refresh();
        return session;
      }),
    [
      run,
      hasPaidAccess,
      loading,
      error,
      screeningReady,
      gating,
      userId,
      settings,
      timezone,
      refresh,
      reminders,
    ],
  );
  const endFast = useCallback(
    (endAt?: string) =>
      run(async () => {
        if (!activeSession) return null;
        pendingEnd.current ??= endAt ?? new Date().toISOString();
        const session = await serviceEndFast(await getDb(), getSupabase(), {
          sessionId: activeSession.id,
          userId,
          endAt: pendingEnd.current,
        });
        pendingEnd.current = null;
        setActiveSession(null);
        await refresh();
        return session;
      }),
    [run, activeSession, userId, refresh],
  );
  const editSession = useCallback(
    (params: {
      sessionId: string;
      startAt?: string;
      endAt?: string | null;
      plannedMinutes?: number;
      localDate?: string;
    }) =>
      run(async () => {
        if (!hasPaidAccess) throw new Error('PLUS_REQUIRED');
        const result = await editFastingSession(await getDb(), getSupabase(), {
          ...params,
          userId,
          reminders,
          timezone,
        });
        await refresh();
        return result;
      }),
    [run, hasPaidAccess, userId, refresh, reminders, timezone],
  );
  const updateSettings = useCallback(
    (updates: Partial<UpdateFastingSettingsInput>) =>
      run(async () => {
        if (!hasPaidAccess && updates.enabled !== false) throw new Error('PLUS_REQUIRED');
        if (updates.enabled !== false && (!gating.canAccess || !screeningReady))
          throw new Error(
            !screeningReady
              ? 'SCREENING_REQUIRED'
              : gating.isPaused
                ? 'LOW_INTAKE_PAUSED'
                : 'SCREENING_INELIGIBLE',
          );
        const result = await saveFastingSettings(
          await getDb(),
          getSupabase(),
          { ...settings, ...updates },
          reminders.quiet,
          timezone,
          reminders.enabled,
        );
        setSettings(result);
        return result;
      }),
    [run, hasPaidAccess, gating, screeningReady, settings, timezone, reminders],
  );
  const completeScreening = useCallback(
    (
      answers: Pick<
        HealthScreening,
        'pregnant_or_breastfeeding' | 'has_diabetes_or_medication' | 'has_eating_disorder_history'
      >,
    ) =>
      run(async () => {
        const now = new Date().toISOString();
        await saveHealthScreeningOnline(
          await getDb(),
          getSupabase(),
          { ...answers, user_id: userId, created_at: now, updated_at: now },
          true,
        );
        await refresh();
      }),
    [run, userId, refresh],
  );
  return {
    completeScreening,
    settings,
    activeSession,
    computedState,
    scheduledState,
    stats,
    streak,
    gating,
    screeningReady,
    history,
    loading,
    error,
    startFast,
    endFast,
    editSession,
    updateSettings,
    refresh,
    hasPaidAccess,
    planLoading,
  };
}
