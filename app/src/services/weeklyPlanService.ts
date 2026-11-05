import type { PlanExercise, PlanPreferences, WeeklyPlanView } from '@calipartner/core';
import { getSupabase } from '@/lib/supabase';
import { secureStoreAdapter } from '@/lib/secureStore';
import { generateClientUuid } from './foodService';
import { acceptAiProcessingConsent } from './aiFoodPhotoService';

async function actor(userId: string) {
  const client = getSupabase();
  const auth = await client.auth.getUser();
  if (auth.error || auth.data.user?.id !== userId) throw new Error('ACCOUNT_CHANGED');
  return client;
}
export async function getPersonalWeeklyPlan(userId: string): Promise<WeeklyPlanView | null> {
  const client = await actor(userId);
  const { data, error } = await client.rpc('get_personal_weekly_plan');
  if (error) throw error;
  if (!data) return null;
  if (
    !Array.isArray(data.days) ||
    typeof data.full_access !== 'boolean' ||
    (!data.full_access &&
      (data.days.length !== 1 ||
        data.days[0]?.day !== 0 ||
        data.workout_tips?.length ||
        data.diet_tips?.length))
  )
    throw new Error('INVALID_PLAN');
  return data as WeeklyPlanView;
}
async function stableRequest(userId: string, operation: string, payload: unknown) {
  const key = `calipartner.weekly.${operation}.${userId}`;
  const fingerprint = JSON.stringify(payload);
  let pending: { id: string; payload: string } | null = null;
  try {
    pending = JSON.parse((await secureStoreAdapter.getItem(key)) ?? 'null');
  } catch {
    /* Invalid local draft. */
  }
  if (pending?.payload !== fingerprint)
    pending = { id: generateClientUuid(), payload: fingerprint };
  await secureStoreAdapter.setItem(key, JSON.stringify(pending));
  return { id: pending!.id, clear: () => secureStoreAdapter.removeItem(key) };
}
export async function buildPersonalWeeklyPlan(
  userId: string,
  preferences: PlanPreferences,
): Promise<WeeklyPlanView> {
  const client = await actor(userId);
  // First builds require the consent checkbox; existing owners can explicitly rebuild their plan.
  await acceptAiProcessingConsent(
    { rpc: async (name, args) => await client.rpc(name, args) },
    '1.1-weekly-plan',
  );
  const request = await stableRequest(userId, 'build', preferences);
  const { data, error } = await client.functions.invoke('weekly-plan', {
    body: { request_id: request.id, preferences },
  });
  if (error) {
    let body: { code?: string } = {};
    try {
      body = (await error.context?.json?.()) ?? {};
    } catch {
      /* No structured response. */
    }
    throw new Error(body.code ?? 'PLAN_UNAVAILABLE');
  }
  if (data?.saved !== true) throw new Error('PLAN_UNAVAILABLE');
  const plan = await getPersonalWeeklyPlan(userId);
  if (!plan || plan.id !== request.id) throw new Error('PLAN_UNAVAILABLE');
  await request.clear();
  return plan;
}
export async function editPreferredRoutine(
  userId: string,
  plan: WeeklyPlanView,
  day: number,
  exercises: PlanExercise[],
): Promise<WeeklyPlanView> {
  const client = await actor(userId);
  const request = await stableRequest(userId, 'edit', [plan.id, plan.revision, day, exercises]);
  const { data, error } = await client.rpc('edit_weekly_routine', {
    p_id: request.id,
    p_plan_id: plan.id,
    p_revision: plan.revision,
    p_day: day,
    p_exercises: exercises,
  });
  if (error) throw error;
  if (!data?.full_access) throw new Error('PURCHASED_PLUS_REQUIRED');
  await request.clear();
  return data as WeeklyPlanView;
}
