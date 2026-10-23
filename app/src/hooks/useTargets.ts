import { useCallback, useEffect, useState } from 'react';
import {
  calculateTargets,
  shouldRecomputeTargets,
  type ActivityLevel,
  type CalculateTargetsInput,
  type CalculateTargetsResult,
  type Goal,
  type GoalProfile,
  type HealthScreening,
  type RecomputeReason,
} from '@calipartner/core';
import { useAuth } from '@/contexts/AuthContext';
import { getDb } from '@/db';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { getSupabase } from '@/lib/supabase';
import {
  flushTargetsOutbox,
  getCurrentLocalGoalProfile,
  getLocalHealthScreening,
  saveGoalProfileWithSync,
  saveHealthScreeningWithSync,
} from '@/services/targetsService';

export interface UseTargetsState {
  currentGoalProfile: GoalProfile | null;
  healthScreening: HealthScreening | null;
  loading: boolean;
  error: string | null;
}

export function useTargets() {
  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();
  const online = Boolean(isOnline);
  const [state, setState] = useState<UseTargetsState>({
    currentGoalProfile: null,
    healthScreening: null,
    loading: true,
    error: null,
  });

  const effectiveUserId = user?.id ?? 'guest-user';

  const loadLocalData = useCallback(async () => {
    try {
      const db = await getDb();
      let [profile, screening] = await Promise.all([
        getCurrentLocalGoalProfile(db, effectiveUserId),
        getLocalHealthScreening(db, effectiveUserId),
      ]);

      if (!profile && effectiveUserId !== 'guest-user') {
        profile = await getCurrentLocalGoalProfile(db, 'guest-user');
      }
      if (!screening && effectiveUserId !== 'guest-user') {
        screening = await getLocalHealthScreening(db, 'guest-user');
      }

      setState({
        currentGoalProfile: profile,
        healthScreening: screening,
        loading: false,
        error: null,
      });

      // If online, logged in and supabase configured, flush outbox queue in background
      if (online && user?.id) {
        const supabase = getSupabase();
        flushTargetsOutbox(db, supabase).catch(() => {
          // Background sync retry silently
        });
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setState((prev) => ({ ...prev, loading: false, error: message }));
    }
  }, [effectiveUserId, online, user?.id]);

  useEffect(() => {
    loadLocalData();
  }, [loadLocalData]);

  /**
   * Pure deterministic calculation using @calipartner/core directly.
   * Completely offline and instantaneous.
   */
  const calculate = useCallback((input: CalculateTargetsInput): CalculateTargetsResult => {
    return calculateTargets(input);
  }, []);

  /**
   * Saves a new or updated GoalProfile.
   * Persists to local SQLite and syncs to Supabase when online.
   */
  const saveGoalProfile = useCallback(
    async (
      profile: GoalProfile,
    ): Promise<{ success: boolean; synced: boolean; error?: string }> => {
      try {
        const db = await getDb();
        const supabase = online && user?.id ? getSupabase() : null;
        const res = await saveGoalProfileWithSync(
          db,
          supabase,
          profile,
          Boolean(online && user?.id),
        );

        setState((prev) => ({
          ...prev,
          currentGoalProfile: profile,
          error: null,
        }));

        return { success: true, synced: res.synced, error: res.error };
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        return { success: false, synced: false, error: message };
      }
    },
    [online, user?.id],
  );

  /**
   * Saves health screening data.
   */
  const saveScreening = useCallback(
    async (
      screening: HealthScreening,
    ): Promise<{ success: boolean; synced: boolean; error?: string }> => {
      try {
        const db = await getDb();
        const supabase = online && user?.id ? getSupabase() : null;
        const res = await saveHealthScreeningWithSync(
          db,
          supabase,
          screening,
          Boolean(online && user?.id),
        );

        setState((prev) => ({
          ...prev,
          healthScreening: screening,
          error: null,
        }));

        return { success: true, synced: res.synced, error: res.error };
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        return { success: false, synced: false, error: message };
      }
    },
    [online, user?.id],
  );

  /**
   * Checks if recalculation triggers are met based on PRD 7.2:
   * Weight change >= 2 kg or manual edit to goal, rate, or activity level.
   */
  const checkRecompute = useCallback(
    (
      newWeightKg?: number,
      newGoal?: Goal,
      newWeeklyRateKg?: number,
      newActivityLevel?: ActivityLevel,
    ): { shouldRecompute: boolean; reasons: RecomputeReason[] } => {
      if (!state.currentGoalProfile) {
        return { shouldRecompute: false, reasons: [] };
      }

      return shouldRecomputeTargets(state.currentGoalProfile, {
        current_weight_kg: newWeightKg,
        goal: newGoal,
        weekly_rate_kg: newWeeklyRateKg,
        activity_level: newActivityLevel,
      });
    },
    [state.currentGoalProfile],
  );

  return {
    currentGoalProfile: state.currentGoalProfile,
    healthScreening: state.healthScreening,
    loading: state.loading,
    error: state.error,
    calculate,
    saveGoalProfile,
    saveScreening,
    checkRecompute,
    refresh: loadLocalData,
  };
}
