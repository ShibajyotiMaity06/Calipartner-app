import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlanPreferences, WorkoutPlanView, WorkoutRoutineContent } from '@calipartner/core';
import { useAuth } from '@/contexts/AuthContext';
import {
  getWorkoutPlan,
  buildWorkoutPlan,
  editWorkoutPlan,
} from '@/services/workoutRoutineService';
import { workoutEvents } from '@/services/workoutEvents';

export function useWorkoutPlan(visible: boolean) {
  const { user } = useAuth(),
    userId = user?.id;
  const key = JSON.stringify([userId, visible]),
    active = useRef(key),
    version = useRef(0);
  active.current = key;
  const [state, setState] = useState<{
    key: string;
    plan: WorkoutPlanView | null;
    loading: boolean;
    error: boolean;
  }>();
  const refresh = useCallback(async () => {
    if (!userId || !visible) return;
    const request = ++version.current;
    setState((previous) => ({
      key,
      plan: previous?.key === key ? previous.plan : null,
      loading: true,
      error: false,
    }));
    try {
      let plan = await getWorkoutPlan(userId);
      if (plan.needs_initial && plan.preferences)
        plan = await buildWorkoutPlan(userId, plan.preferences, true);
      if (active.current === key && request === version.current)
        setState({ key, plan, loading: false, error: false });
    } catch {
      if (active.current === key && request === version.current)
        setState({ key, plan: null, loading: false, error: true });
    }
  }, [userId, visible, key]);
  useEffect(() => {
    void refresh();
    const unsubscribe = workoutEvents.subscribe(() => void refresh());
    const invalidate = () => {
      version.current++;
    };
    return () => {
      invalidate();
      unsubscribe();
    };
  }, [refresh]);
  const current = state?.key === key ? state : null;
  const publish = (plan: WorkoutPlanView) => {
    if (active.current !== key) throw new Error('ACCOUNT_CHANGED');
    setState({ key, plan, loading: false, error: false });
  };
  return {
    plan: visible ? (current?.plan ?? null) : null,
    loading: visible && !!userId && (current?.loading ?? true),
    error: current?.error ?? false,
    refresh,
    rebuild: async (preferences: PlanPreferences) => {
      if (!userId) throw new Error('UNAUTHENTICATED');
      publish(await buildWorkoutPlan(userId, preferences, !current?.plan?.id, true));
    },
    edit: async (content: WorkoutRoutineContent) => {
      if (!userId || !current?.plan) throw new Error('PLAN_STALE');
      publish(await editWorkoutPlan(userId, current.plan, content));
    },
  };
}
