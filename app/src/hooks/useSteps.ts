import { useCallback, useEffect, useState } from 'react';
import { calculateStrideLengthCm, type ActivityDay, type ActivitySource } from '@calipartner/core';
import { useAuth } from '@/contexts/AuthContext';
import { getDb } from '@/db';
import { getActivityDay, getActivityMetrics, upsertActivityDay } from '@/services/activityService';
import {
  getStepPermissionStatus,
  readDeviceSteps,
  requestStepPermissions,
  type StepPermissionStatus,
} from '@/services/stepIntegrationService';
import { useTargets } from './useTargets';

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
  requestPermission: () => Promise<boolean>;
  logManualSteps: (steps: number, distanceM?: number) => Promise<ActivityDay>;
  syncFromPlatform: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useSteps(date?: string): UseStepsResult {
  const localDate = date ?? new Date().toISOString().split('T')[0]!;
  const { currentGoalProfile } = useTargets();
  const { user } = useAuth();

  const [activity, setActivity] = useState<ActivityDay | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<StepPermissionStatus>('not_requested');
  const [loading, setLoading] = useState(true);

  const goalSteps = currentGoalProfile?.step_goal ?? 8000;
  const userWeightKg = currentGoalProfile?.current_weight_kg ?? 70;
  const userStrideCm = calculateStrideLengthCm(170, 'other');

  const effectiveUserId = user?.id ?? currentGoalProfile?.user_id ?? 'guest-user';

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const db = await getDb();

      let [act, perm] = await Promise.all([
        getActivityDay(db, effectiveUserId, localDate),
        getStepPermissionStatus(),
      ]);

      if (!act && effectiveUserId !== 'guest-user') {
        const guestAct = await getActivityDay(db, 'guest-user', localDate);
        if (guestAct) act = guestAct;
      }

      setActivity(act);
      setPermissionStatus(perm);
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false);
    }
  }, [effectiveUserId, localDate]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const syncFromPlatform = async (): Promise<void> => {
    const reading = await readDeviceSteps(localDate);
    if (reading) {
      const db = await getDb();
      await upsertActivityDay(db, effectiveUserId, {
        localDate,
        steps: reading.steps,
        distanceM: reading.distance_m,
        source: reading.source,
        strideLengthCm: userStrideCm,
      });
      await loadData();
    }
  };

  const requestPermission = async (): Promise<boolean> => {
    const res = await requestStepPermissions();
    setPermissionStatus(res.status);
    if (res.granted) {
      await syncFromPlatform();
    }
    return res.granted;
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

  const metrics = getActivityMetrics(activity, userWeightKg, userStrideCm);
  const progressPercent =
    goalSteps > 0 ? Math.min(100, Math.round((metrics.steps / goalSteps) * 100)) : 0;

  return {
    activity,
    steps: metrics.steps,
    distanceM: metrics.distanceM,
    distanceKm: metrics.distanceKm,
    walkingCalories: metrics.walkingCalories,
    source: activity?.source ?? null,
    goalSteps,
    progressPercent,
    permissionStatus,
    loading,
    requestPermission,
    logManualSteps,
    syncFromPlatform,
    refresh: loadData,
  };
}
