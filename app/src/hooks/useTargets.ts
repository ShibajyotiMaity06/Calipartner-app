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

  const userId = user?.id;

  const loadLocalData = useCallback(async () => {
    if (!userId) {
      setState((prev) => ({
        ...prev,
        currentGoalProfile: null,
        healthScreening: null,
        loading: false,
      }));
      return;
    }

    try {
      const db = await getDb();
      const [profile, screening] = await Promise.all([
        getCurrentLocalGoalProfile(db, userId),
        getLocalHealthScreening(db, userId),
      ]);

      setState({
        currentGoalProfile: profile,
        healthScreening: screening,
        loading: false,
        error: null,
      });

      // If online and supabase configured, flush outbox queue in background
      if (online) {
        const supabase = getSupabase();
        flushTargetsOutbox(db, supabase).catch(() => {
          // Background sync retry silently
        });
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setState((prev) => ({ ...prev, loading: false, error: message }));
    }
  }, [userId, online]);

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
    async (profile: GoalProfile): Promise<{ success: boolean; synced: boolean; error?: string }> => {
      if (!userId) {
        return { success: false, synced: false, error: 'User not logged in' };
      }

      try {
        const db = await getDb();
        const supabase = online ? getSupabase() : null;
        const res = await saveGoalProfileWithSync(db, supabase, profile, online);

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
    [userId, online],
  );

  /**
   * Saves health screening data.
   */
  const saveScreening = useCallback(
    async (
      screening: HealthScreening,
    ): Promise<{ success: boolean; synced: boolean; error?: string }> => {
      if (!userId) {
        return { success: false, synced: false, error: 'User not logged in' };
      }

      try {
        const db = await getDb();
        const supabase = online ? getSupabase() : null;
        const res = await saveHealthScreeningWithSync(db, supabase, screening, online);

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
    [userId, online],
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
