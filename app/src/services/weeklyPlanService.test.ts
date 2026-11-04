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
} from './weeklyPlanService';
const preferences = { workout_days: [0], country: 'India' } as PlanPreferences;
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
