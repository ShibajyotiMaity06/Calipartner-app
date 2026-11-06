import { beforeEach, expect, it, vi } from 'vitest';
import type { PlanPreferences } from '@calipartner/core';
const state = vi.hoisted(() => ({
  actor: 'owner',
  invoke: vi.fn(),
  rpc: vi.fn(),
  store: new Map<string, string>(),
}));
vi.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    auth: { getUser: async () => ({ data: { user: { id: state.actor } }, error: null }) },
    rpc: state.rpc,
    functions: { invoke: state.invoke },
  }),
}));
vi.mock('@/lib/secureStore', () => ({
  secureStoreAdapter: {
    getItem: async (key: string) => state.store.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      state.store.set(key, value);
    },
    removeItem: async (key: string) => {
      state.store.delete(key);
    },
  },
}));
vi.mock('./foodService', () => ({ generateClientUuid: () => crypto.randomUUID() }));
import {
  buildPersonalWeeklyPlan,
  editPreferredRoutine,
  getPersonalWeeklyPlan,
  logPlannedMeal,
  swapPlannedMeal,
  repeatPreviousMeal,
} from './weeklyPlanService';
const preferences = { workout_days: [0], country: 'India' } as PlanPreferences;
const mealPlan = { id: 'plan', revision: 1, full_access: true } as Parameters<
  typeof logPlannedMeal
>[1];
beforeEach(() => {
  state.actor = 'owner';
  state.store.clear();
  vi.clearAllMocks();
  state.rpc.mockResolvedValue({ data: null, error: null });
});
it('rejects an account change before any provider or database call', async () => {
  state.actor = 'stranger';
  await expect(buildPersonalWeeklyPlan('owner', preferences)).rejects.toThrow('ACCOUNT_CHANGED');
  expect(state.invoke).not.toHaveBeenCalled();
  expect(state.rpc).not.toHaveBeenCalled();
});
it('keeps the generation request UUID across lost acknowledgements and verifies the gated read', async () => {
  state.invoke
    .mockResolvedValueOnce({ data: null, error: {} })
    .mockResolvedValueOnce({ data: { saved: true }, error: null });
  state.rpc.mockImplementation(async (name: string) => ({
    data:
      name === 'get_personal_weekly_plan'
        ? {
            id: state.invoke.mock.lastCall![1].body.request_id,
            days: [{ day: 0 }],
            full_access: false,
            workout_tips: [],
            diet_tips: [],
          }
        : null,
    error: null,
  }));
  await expect(buildPersonalWeeklyPlan('owner', preferences)).rejects.toThrow('PLAN_UNAVAILABLE');
  const id = state.invoke.mock.calls[0]![1].body.request_id;
  const saved = await buildPersonalWeeklyPlan('owner', preferences);
  expect(saved.id).toBe(id);
  expect(state.invoke.mock.calls[1]![1].body.request_id).toBe(id);
  expect(saved.days).toHaveLength(1);
  expect(state.store.size).toBe(0);
  expect(state.rpc.mock.calls[0]).toEqual([
    'accept_ai_processing_consent',
    { p_version: '1.1-weekly-plan' },
  ]);
});
it('refuses an invalid free projection that includes hidden days or tips', async () => {
  state.rpc.mockResolvedValue({
    data: {
      id: 'plan',
      days: [{ day: 0 }, { day: 1 }],
      full_access: false,
      workout_tips: [],
      diet_tips: [],
    },
    error: null,
  });
  await expect(getPersonalWeeklyPlan('owner')).rejects.toThrow('INVALID_PLAN');
});
it('retries an edit with the same UUID and cannot confirm a failed save', async () => {
  state.rpc
    .mockResolvedValueOnce({ data: null, error: new Error('network') })
    .mockResolvedValueOnce({ data: { full_access: true, revision: 2 }, error: null });
  const plan = { id: 'plan', revision: 1 } as Parameters<typeof editPreferredRoutine>[1];
  await expect(editPreferredRoutine('owner', plan, 0, [])).rejects.toThrow('network');
  await editPreferredRoutine('owner', plan, 0, []);
  expect(state.rpc.mock.calls[0]![1].p_id).toBe(state.rpc.mock.calls[1]![1].p_id);
});

it('requires a matching server acknowledgement and retains meal retry identity', async () => {
  state.rpc.mockResolvedValueOnce({ data: null, error: new Error('offline') });
  await expect(logPlannedMeal('owner', mealPlan, 0, 0, 'breakfast')).rejects.toThrow('offline');
  const id = state.rpc.mock.calls[0]![1].p_id;
  state.rpc.mockResolvedValueOnce({ data: 'wrong-id', error: null });
  await expect(logPlannedMeal('owner', mealPlan, 0, 0, 'breakfast')).rejects.toThrow(
    'MEAL_NOT_SAVED',
  );
  state.rpc.mockResolvedValueOnce({ data: id, error: null });
  await logPlannedMeal('owner', mealPlan, 0, 0, 'breakfast');
  expect(state.rpc.mock.calls.map(([, args]) => args.p_id)).toEqual([id, id, id]);
  expect(state.store.size).toBe(0);
});

it('retains independent retry IDs when separate meals fail', async () => {
  state.rpc.mockResolvedValue({ data: null, error: new Error('offline') });
  await expect(logPlannedMeal('owner', mealPlan, 0, 0, 'breakfast')).rejects.toThrow();
  await expect(logPlannedMeal('owner', mealPlan, 0, 1, 'lunch')).rejects.toThrow();
  await expect(logPlannedMeal('owner', mealPlan, 0, 0, 'breakfast')).rejects.toThrow();
  expect(state.rpc.mock.calls[0]![1].p_id).toBe(state.rpc.mock.calls[2]![1].p_id);
  expect(state.rpc.mock.calls[0]![1].p_id).not.toBe(state.rpc.mock.calls[1]![1].p_id);
});

it('never accepts a locked or unrelated response as a saved swap', async () => {
  state.rpc.mockResolvedValueOnce({ data: { id: 'plan', full_access: false }, error: null });
  await expect(swapPlannedMeal('owner', mealPlan, 0, 0, 0)).rejects.toThrow('PLAN_CHANGED');
  const id = state.rpc.mock.calls[0]![1].p_id;
  state.rpc.mockResolvedValueOnce({
    data: { id: 'plan', full_access: true, revision: 2 },
    error: null,
  });
  expect((await swapPlannedMeal('owner', mealPlan, 0, 0, 0)).revision).toBe(2);
  expect(state.rpc.mock.calls[1]![1].p_id).toBe(id);
});

it('repeats only after an acknowledged count and reuses the failed request ID', async () => {
  state.rpc.mockResolvedValueOnce({ data: null, error: new Error('offline') });
  await expect(repeatPreviousMeal('owner', '2026-11-06', 'lunch')).rejects.toThrow();
  const id = state.rpc.mock.calls[0]![1].p_id;
  state.rpc.mockResolvedValueOnce({ data: 2, error: null });
  expect(await repeatPreviousMeal('owner', '2026-11-06', 'lunch')).toBe(2);
  expect(state.rpc.mock.calls[1]![1].p_id).toBe(id);
  expect(state.rpc.mock.calls[1]![1].p_target_date).toBe('2026-11-06');
  state.rpc.mockResolvedValueOnce({ data: 2, error: null });
  await repeatPreviousMeal('owner', '2026-11-06', 'lunch');
  expect(state.rpc.mock.calls[2]![1].p_id).toBe(id);
});
