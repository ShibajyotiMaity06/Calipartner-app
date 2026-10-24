import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';
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
import { generateClientUuid } from '@/services/foodService';
import {
  flushTargetsOutbox,
  getCurrentLocalGoalProfile,
  getLocalHealthScreening,
  saveGoalProfileWithSync,
  saveHealthScreeningWithSync,
  restoreGoalProfile,
  repairLegacyGoalProfile,
} from '@/services/targetsService';

export interface UseTargetsState {
  currentGoalProfile: GoalProfile | null;
  healthScreening: HealthScreening | null;
  loading: boolean;
  error: string | null;
}

function useTargetsState() {
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
  const ownerRef = useRef(effectiveUserId);
  ownerRef.current = effectiveUserId;

  const loadLocalData = useCallback(async () => {
    try {
      const db = await getDb();
      await repairLegacyGoalProfile(db, effectiveUserId);
      const [profile, screening] = await Promise.all([
        getCurrentLocalGoalProfile(db, effectiveUserId),
        getLocalHealthScreening(db, effectiveUserId),
      ]);

      if (ownerRef.current !== effectiveUserId) return;
      setState({
        currentGoalProfile: profile,
        healthScreening: screening,
        loading: !profile && online && Boolean(user?.id),
        error: null,
      });

      // If online, logged in and supabase configured, flush outbox queue in background
      if (online && user?.id) {
        const supabase = getSupabase();
        await flushTargetsOutbox(db, supabase, user.id);
        const restored = await restoreGoalProfile(db, supabase, user.id);
        if (ownerRef.current === effectiveUserId) {
          setState((prev) => ({
            ...prev,
            currentGoalProfile: restored,
            loading: false,
            error: null,
          }));
        }
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      if (ownerRef.current === effectiveUserId) {
        setState((prev) => ({ ...prev, loading: false, error: message }));
      }
    }
  }, [effectiveUserId, online, user?.id]);

  useEffect(() => {
    void loadLocalData();
    const listener = AppState.addEventListener('change', (status) => {
      if (status === 'active') void loadLocalData();
    });
    return () => listener.remove();
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
        if (profile.user_id !== effectiveUserId) throw new Error('Goal profile owner mismatch');
        const db = await getDb();
        const supabase = online && user?.id ? getSupabase() : null;
        const saving = saveGoalProfileWithSync(db, supabase, profile, Boolean(online && user?.id));

        const res = await saving;
        if (ownerRef.current === effectiveUserId)
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
    [effectiveUserId, online, user?.id],
  );

  /**
   * Saves health screening data.
   */
  const saveScreening = useCallback(
    async (
      screening: HealthScreening,
    ): Promise<{ success: boolean; synced: boolean; error?: string }> => {
      try {
        if (screening.user_id !== effectiveUserId)
          throw new Error('Health screening owner mismatch');
        const db = await getDb();
        const supabase = online && user?.id ? getSupabase() : null;
        const res = await saveHealthScreeningWithSync(
          db,
          supabase,
          screening,
          Boolean(online && user?.id),
        );

        if (ownerRef.current === effectiveUserId)
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
    [effectiveUserId, online, user?.id],
  );

  const updateDailyGoals = useCallback(
    async (stepGoal: number, waterMlGoal: number) => {
      const current = state.currentGoalProfile;
      if (!current || current.user_id !== effectiveUserId)
        throw new Error('Saved targets unavailable');
      if (
        !Number.isInteger(stepGoal) ||
        stepGoal < 0 ||
        stepGoal > 100000 ||
        !Number.isInteger(waterMlGoal) ||
        waterMlGoal < 0 ||
        waterMlGoal > 20000
      ) {
        throw new Error('Invalid daily goals');
      }
      const now = new Date().toISOString();
      const result = await saveGoalProfile({
        ...current,
        id: generateClientUuid(),
        step_goal: stepGoal,
        water_ml_goal: waterMlGoal,
        effective_from: now,
        confirmed_at: now,
        created_at: now,
        recompute_reason: 'manual_edit',
      });
      if (!result.success) throw new Error(result.error);
    },
    [effectiveUserId, saveGoalProfile, state.currentGoalProfile],
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
    currentGoalProfile:
      state.currentGoalProfile?.user_id === effectiveUserId ? state.currentGoalProfile : null,
    healthScreening:
      state.healthScreening?.user_id === effectiveUserId ? state.healthScreening : null,
    loading: state.loading,
    error: state.error,
    calculate,
    saveGoalProfile,
    updateDailyGoals,
    saveScreening,
    checkRecompute,
    refresh: loadLocalData,
  };
}

const TargetsContext = createContext<ReturnType<typeof useTargetsState> | null>(null);

export function TargetsProvider({ children }: { children: ReactNode }) {
  return createElement(TargetsContext.Provider, { value: useTargetsState() }, children);
}

export function useTargets() {
  const context = useContext(TargetsContext);
  if (!context) throw new Error('useTargets must be used within TargetsProvider');
  return context;
}
