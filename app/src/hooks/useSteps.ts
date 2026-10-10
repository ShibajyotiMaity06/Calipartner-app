import { useCallback, useEffect, useState } from 'react';
import {
  calculateStrideLengthCm,
  type ActivityDay,
  type ActivitySource,
} from '@calipartner/core';
import { getDb } from '@/db';
import {
  getActivityDay,
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

  const [activity, setActivity] = useState<ActivityDay | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<StepPermissionStatus>('not_requested');
  const [loading, setLoading] = useState(true);

  const goalSteps = currentGoalProfile?.step_goal ?? 8000;
  const userWeightKg = currentGoalProfile?.current_weight_kg ?? 70;
  // Fallback 170cm height / other sex -> ~70.38cm stride length
  const userStrideCm = calculateStrideLengthCm(170, 'other');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const db = await getDb();
      const userId = currentGoalProfile?.user_id ?? 'guest-user';

      const [act, perm] = await Promise.all([
        getActivityDay(db, userId, localDate),
        getStepPermissionStatus(),
      ]);

      setActivity(act);
      setPermissionStatus(perm);
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false);
    }
  }, [currentGoalProfile?.user_id, localDate]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const syncFromPlatform = async (): Promise<void> => {
    const reading = await readDeviceSteps(localDate);
    if (reading) {
      const db = await getDb();
      const userId = currentGoalProfile?.user_id ?? 'guest-user';
      await upsertActivityDay(db, userId, {
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

  const logManualSteps = async (
    steps: number,
    distanceM?: number,
  ): Promise<ActivityDay> => {
    const db = await getDb();
    const userId = currentGoalProfile?.user_id ?? 'guest-user';
    const updated = await upsertActivityDay(db, userId, {
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
  const progressPercent = goalSteps > 0
    ? Math.min(100, Math.round((metrics.steps / goalSteps) * 100))
    : 0;

  return {
    activity,
    steps: metrics.steps,
    distanceM: metrics.distanceM,
    distanceKm: metrics.distanceKm,
    walkingCalories: metrics.walkingCalories,
    source: metrics.source,
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
