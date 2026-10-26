import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  calculateStrideLengthCm,
  addDaysToDateString,
  type ActivityDay,
  type ActivitySource,
} from '@calipartner/core';
import { useAuth } from '@/contexts/AuthContext';
import { getDb } from '@/db';
import {
  getActivityDay,
  getActivityWeek,
  getActivityMetrics,
  upsertActivityDay,
} from '@/services/activityService';
import {
  getStepPermissionStatus,
  readDeviceSteps,
  requestStepPermissions,
  type StepPermissionStatus,
} from '@/services/stepIntegrationService';
import { useTargets } from './useTargets';
import { useCurrentLocalDate } from './useCurrentLocalDate';

export interface UseStepsResult {
  activity: ActivityDay | null;
  steps: number;
  distanceM: number;
  distanceKm: number;
  walkingCalories: number;
  source: ActivitySource | null;
  goalSteps: number;
  progressPercent: number;
  permissionStatus: StepPermissionStatus;
  loading: boolean;
  error: string | null;
  week: { localDate: string; steps: number | null }[];
  logPedometerSession: (baseline: number, measuredSteps: number) => Promise<void>;
  updateStepGoal: (goal: number) => Promise<void>;
  requestPermission: () => Promise<boolean>;
  logManualSteps: (steps: number, distanceM?: number) => Promise<ActivityDay>;
  syncFromPlatform: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useSteps(date?: string): UseStepsResult {
  const { currentGoalProfile, updateDailyGoals } = useTargets();
  const { user, profile } = useAuth();
  const { localDate: today, timeZone } = useCurrentLocalDate();
  const localDate = date ?? today;

  const [activity, setActivity] = useState<ActivityDay | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<StepPermissionStatus>('not_requested');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [week, setWeek] = useState<{ localDate: string; steps: number | null }[]>([]);

  const goalSteps = currentGoalProfile?.step_goal ?? 8000;
  const userWeightKg = currentGoalProfile?.current_weight_kg ?? 0;
  const userStrideCm = profile?.height_cm
    ? calculateStrideLengthCm(profile.height_cm, profile.sex)
    : 0;

  const effectiveUserId = user?.id ?? currentGoalProfile?.user_id ?? 'guest-user';
  const ownerKey = `${effectiveUserId}/${localDate}`;
  const activeKey = useRef(ownerKey);
  activeKey.current = ownerKey;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const db = await getDb();

      const [act, perm, history] = await Promise.all([
        getActivityDay(db, effectiveUserId, localDate),
        getStepPermissionStatus(),
        getActivityWeek(db, effectiveUserId, localDate),
      ]);

      if (activeKey.current !== ownerKey) return;
      setLoadedKey(ownerKey);
      setActivity(act);
      setPermissionStatus(perm);
      setWeek(history);
      setError(null);
    } catch (error) {
      if (activeKey.current === ownerKey)
        setError(error instanceof Error ? error.message : String(error));
    } finally {
      if (activeKey.current === ownerKey) setLoading(false);
    }
  }, [effectiveUserId, localDate, ownerKey]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const syncFromPlatform = useCallback(async (): Promise<void> => {
    const dates =
      localDate === today
        ? Array.from({ length: 7 }, (_, index) => addDaysToDateString(today, -index))
        : [localDate];
    for (const day of dates) {
      const reading = await readDeviceSteps(day, timeZone);
      if (!reading || activeKey.current !== ownerKey) continue;
      const db = await getDb();
      if (activeKey.current !== ownerKey) return;
      await upsertActivityDay(db, effectiveUserId, {
        localDate: day,
        steps: reading.steps,
        distanceM: reading.distance_m,
        source: reading.source,
        strideLengthCm: userStrideCm,
      });
    }
    await loadData();
  }, [localDate, today, timeZone, ownerKey, effectiveUserId, userStrideCm, loadData]);

  useEffect(() => {
    let disposed = false;
    let running = false;
    const sync = async () => {
      if (disposed || running) return;
      running = true;
      try {
        await syncFromPlatform();
      } catch (failure) {
        if (!disposed) setError(failure instanceof Error ? failure.message : String(failure));
      } finally {
        running = false;
      }
    };
    void sync();
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') void sync();
    });
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void sync();
    }, 60000);
    return () => {
      disposed = true;
      clearInterval(timer);
      listener.remove();
    };
  }, [syncFromPlatform]);

  const requestPermission = async (): Promise<boolean> => {
    const res = await requestStepPermissions();
    setPermissionStatus(res.status);
    if (res.granted) {
      await syncFromPlatform();
    }
    return res.granted;
  };

  const logPedometerSession = async (baseline: number, measuredSteps: number): Promise<void> => {
    if (!Number.isInteger(measuredSteps) || measuredSteps <= 0) return;
    const reading = await readDeviceSteps(localDate, timeZone);
    const db = await getDb();
    await upsertActivityDay(db, effectiveUserId, {
      localDate,
      steps: reading?.steps ?? baseline + measuredSteps,
      distanceM: reading?.distance_m,
      source: reading?.source ?? 'pedometer',
      strideLengthCm: userStrideCm,
    });
    await loadData();
  };

  const logManualSteps = async (steps: number, distanceM?: number): Promise<ActivityDay> => {
    const db = await getDb();
    const updated = await upsertActivityDay(db, effectiveUserId, {
      localDate,
      steps,
      distanceM: distanceM ?? null,
      source: 'manual',
      strideLengthCm: userStrideCm,
    });
    await loadData();
    return updated;
  };

  const currentActivity =
    activity?.user_id === effectiveUserId && activity.local_date === localDate ? activity : null;
  const metrics = getActivityMetrics(currentActivity, userWeightKg, userStrideCm);
  const progressPercent =
    goalSteps > 0 ? Math.min(100, Math.round((metrics.steps / goalSteps) * 100)) : 0;

  return {
    activity: currentActivity,
    steps: metrics.steps,
    distanceM: metrics.distanceM,
    distanceKm: metrics.distanceKm,
    walkingCalories: metrics.walkingCalories,
    source: currentActivity?.source ?? null,
    goalSteps,
    progressPercent,
    permissionStatus,
    loading,
    error,
    week: loadedKey === ownerKey ? week : [],
    logPedometerSession,
    updateStepGoal: (goal) => updateDailyGoals(goal, currentGoalProfile?.water_ml_goal ?? 0),
    requestPermission,
    logManualSteps,
    syncFromPlatform,
    refresh: loadData,
  };
}
