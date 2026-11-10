import { cachedRead } from './offlineReadService';
import type { MealSection, PlanExercise, PlanPreferences, WeeklyPlanView } from '@calipartner/core';
import { getSupabase } from '@/lib/supabase';
import { secureStoreAdapter } from '@/lib/secureStore';
import { generateClientUuid } from './foodService';
import { acceptAiProcessingConsent } from './aiFoodPhotoService';
import { buildWorkoutPlan } from './workoutRoutineService';

async function actor(userId: string) {
  const client = getSupabase();
  const auth = await client.auth.getUser();
  if (auth.error || auth.data.user?.id !== userId) throw new Error('ACCOUNT_CHANGED');
  return client;
}
export async function getPersonalWeeklyPlan(userId: string): Promise<WeeklyPlanView | null> {
  const client = getSupabase();
  return cachedRead(client, 'weekly-plan:' + userId, async () => {
    await actor(userId);
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
  });
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
  singleDay = false,
): Promise<WeeklyPlanView> {
  const client = await actor(userId);
  // First builds require the consent checkbox; existing owners can explicitly rebuild their plan.
  await acceptAiProcessingConsent(
    { rpc: async (name, args) => await client.rpc(name, args) },
    '1.1-weekly-plan',
  );
  const request = await stableRequest(
    userId,
    singleDay ? 'build-day-sections' : 'build',
    preferences,
  );
  const { data, error } = await client.functions.invoke('weekly-plan', {
    body: { request_id: request.id, preferences, ...(singleDay ? { scope: 'day' } : {}) },
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
  if (singleDay) {
    await buildWorkoutPlan(userId, preferences, true);
    const refreshed = await getPersonalWeeklyPlan(userId);
    if (!refreshed || refreshed.id !== request.id) throw new Error('PLAN_UNAVAILABLE');
    await request.clear();
    return refreshed;
  }
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

export async function logPlannedMeal(
  userId: string,
  plan: WeeklyPlanView,
  day: number,
  meal: number,
  section: 'breakfast' | 'lunch' | 'dinner' | 'snacks',
): Promise<void> {
  const client = await actor(userId);
  const request = await stableRequest(userId, `log-meal.${plan.id}.${day}.${meal}`, [
    plan.id,
    plan.revision,
    day,
    meal,
    section,
  ]);
  const { data, error } = await client.rpc('log_weekly_plan_meal', {
    p_id: request.id,
    p_plan_id: plan.id,
    p_revision: plan.revision,
    p_day: day,
    p_meal: meal,
    p_section: section,
  });
  if (error) throw error;
  if (data !== request.id) throw new Error('MEAL_NOT_SAVED');
  await request.clear();
}

export async function swapPlannedMeal(
  userId: string,
  plan: WeeklyPlanView,
  day: number,
  meal: number,
  option: number,
): Promise<WeeklyPlanView> {
  const client = await actor(userId);
  const request = await stableRequest(userId, `swap-meal.${plan.id}.${day}.${meal}`, [
    plan.id,
    plan.revision,
    day,
    meal,
    option,
  ]);
  const { data, error } = await client.rpc('swap_weekly_plan_meal', {
    p_id: request.id,
    p_plan_id: plan.id,
    p_revision: plan.revision,
    p_day: day,
    p_meal: meal,
    p_option: option,
  });
  if (error) throw error;
  if (!data?.full_access || data.id !== plan.id) throw new Error('PLAN_CHANGED');
  await request.clear();
  return data as WeeklyPlanView;
}

export async function repeatPreviousMeal(
  userId: string,
  localDate: string,
  section: MealSection,
): Promise<number> {
  const client = await actor(userId);
  const request = await stableRequest(userId, `repeat-meal.${localDate}.${section}`, [
    localDate,
    section,
  ]);
  const { data, error } = await client.rpc('repeat_previous_day_meal', {
    p_id: request.id,
    p_target_date: localDate,
    p_section: section,
  });
  if (error) throw error;
  if (!Number.isInteger(data) || data < 0) throw new Error('MEAL_NOT_SAVED');
  // One repeat per section/date stays retry-safe across diary refreshes and navigation.
  return data as number;
}
