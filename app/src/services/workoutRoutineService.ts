import {
  validateWorkoutRoutine,
  type PlanPreferences,
  type WorkoutPlanView,
  type WorkoutRoutineContent,
} from '@calipartner/core';
import { getSupabase } from '@/lib/supabase';
import { secureStoreAdapter } from '@/lib/secureStore';
import { generateClientUuid } from './foodService';
import { acceptAiProcessingConsent } from './aiFoodPhotoService';
import { workoutEvents } from './workoutEvents';

async function actor(userId: string) {
  const client = getSupabase();
  const auth = await client.auth.getUser();
  if (auth.error || auth.data.user?.id !== userId) throw new Error('ACCOUNT_CHANGED');
  return client;
}
async function request(userId: string, operation: string, payload: unknown) {
  const key = `calipartner.workout-plan.${operation}.${userId}`,
    fingerprint = JSON.stringify(payload);
  let pending: { id: string; fingerprint: string } | null = null;
  try {
    pending = JSON.parse((await secureStoreAdapter.getItem(key)) ?? 'null');
  } catch {
    /* Discard malformed local request metadata. */
  }
  if (pending?.fingerprint !== fingerprint) pending = { id: generateClientUuid(), fingerprint };
  await secureStoreAdapter.setItem(key, JSON.stringify(pending));
  return { id: pending!.id, clear: () => secureStoreAdapter.removeItem(key) };
}
export async function getWorkoutPlan(userId: string): Promise<WorkoutPlanView> {
  const client = await actor(userId);
  const { data, error } = await client.rpc('get_workout_plan');
  if (error) throw error;
  if (
    !data ||
    typeof data.full_access !== 'boolean' ||
    !Array.isArray(data.days) ||
    (!data.full_access && data.days.length)
  )
    throw new Error('PLAN_UNAVAILABLE');
  if (data.full_access && data.id) validateWorkoutRoutine({ days: data.days });
  return data as WorkoutPlanView;
}
export async function buildWorkoutPlan(
  userId: string,
  preferences: PlanPreferences,
  initial = false,
  explicitConsent = false,
): Promise<WorkoutPlanView> {
  const client = await actor(userId);
  if (initial) {
    const existing = await getWorkoutPlan(userId);
    if (existing.id) return existing;
  }
  const session = await client.auth.getSession();
  if (
    session.error ||
    session.data.session?.user.id !== userId ||
    !session.data.session.access_token
  )
    throw new Error('ACCOUNT_CHANGED');
  const accessToken = session.data.session.access_token;
  // Opening Log must never re-enable revoked AI consent. Onboarding already
  // acknowledged consent; the explicit rebuild form asks for it again.
  if (!initial || explicitConsent)
    await acceptAiProcessingConsent(
      { rpc: async (name, args) => await client.rpc(name, args) },
      '1.1-weekly-plan',
    );
  const pending = await request(userId, initial ? 'initial' : 'rebuild', preferences);
  const { data, error } = await client.functions.invoke('workout-plan', {
    headers: { Authorization: `Bearer ${accessToken}` },
    body: { request_id: pending.id, initial, preferences },
  });
  if (error) {
    let code = 'PLAN_UNAVAILABLE';
    try {
      const result = await error.context?.json?.();
      if (typeof result?.code === 'string') code = result.code;
    } catch {
      /* Keep the actionable generic request error. */
    }
    throw new Error(code);
  }
  if (data?.saved !== true) throw new Error('PLAN_UNAVAILABLE');
  const plan = await getWorkoutPlan(userId);
  if (plan.id !== pending.id) {
    await pending.clear();
    throw new Error('PLAN_STALE');
  }
  await pending.clear();
  workoutEvents.emitChange();
  return plan;
}
export async function editWorkoutPlan(
  userId: string,
  plan: WorkoutPlanView,
  content: WorkoutRoutineContent,
): Promise<WorkoutPlanView> {
  const client = await actor(userId),
    valid = validateWorkoutRoutine(content);
  const pending = await request(userId, 'edit', [plan.id, plan.revision, valid]);
  const { data, error } = await client.rpc('edit_workout_plan', {
    p_id: pending.id,
    p_plan_id: plan.id,
    p_revision: plan.revision,
    p_content: valid,
  });
  if (error) throw error;
  if (!data?.full_access || data.id !== plan.id || data.revision <= plan.revision)
    throw new Error('PLAN_STALE');
  validateWorkoutRoutine({ days: data.days });
  await pending.clear();
  workoutEvents.emitChange();
  return data as WorkoutPlanView;
}
