import { beforeEach, expect, it, vi } from 'vitest';
import type { PlanPreferences, WorkoutPlanView } from '@calipartner/core';
const state = vi.hoisted(() => ({
  actor: 'owner',
  rpc: vi.fn(),
  invoke: vi.fn(),
  store: new Map<string, string>(),
}));
vi.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: state.actor } }, error: null }),
      getSession: async () => ({
        data: { session: { user: { id: state.actor }, access_token: 'fixture-session' } },
        error: null,
      }),
    },
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
import { buildWorkoutPlan, editWorkoutPlan, getWorkoutPlan } from './workoutRoutineService';
const preferences = { workout_days: [0], country: 'India' } as PlanPreferences;
const days = Array.from({ length: 7 }, (_, day) => ({
  day,
  title: 'Arms',
  minutes: 30,
  exercises: [
    {
      id: 'curl',
      name: 'Seated dumbbell curls',
      equipment: 'dumbbell' as const,
      targetSets: [{ reps: 10, weightKg: 5 }],
    },
  ],
}));
const view = {
  id: 'plan',
  revision: 1,
  full_access: true,
  days,
  can_rebuild: true,
  rebuilds_used: 0,
} as WorkoutPlanView;
beforeEach(() => {
  vi.clearAllMocks();
  state.store.clear();
  state.actor = 'owner';
  state.rpc.mockResolvedValue({ data: null, error: null });
});
it('rejects an account change and a Free projection containing private routine days', async () => {
  state.actor = 'other';
  await expect(getWorkoutPlan('owner')).rejects.toThrow('ACCOUNT_CHANGED');
  expect(state.rpc).not.toHaveBeenCalled();
  state.actor = 'owner';
  state.rpc.mockResolvedValue({ data: { ...view, full_access: false }, error: null });
  await expect(getWorkoutPlan('owner')).rejects.toThrow('PLAN_UNAVAILABLE');
});
it('keeps one rebuild request across a lost acknowledgement and trusts server eligibility errors', async () => {
  state.invoke
    .mockResolvedValueOnce({
      data: null,
      error: { context: { json: async () => ({ code: 'PLAN_UNAVAILABLE' }) } },
    })
    .mockResolvedValueOnce({ data: { saved: true }, error: null });
  state.rpc.mockImplementation(async (name: string) => ({
    data:
      name === 'get_workout_plan'
        ? { ...view, id: state.invoke.mock.lastCall![1].body.request_id }
        : null,
    error: null,
  }));
  await expect(buildWorkoutPlan('owner', preferences)).rejects.toThrow('PLAN_UNAVAILABLE');
  const id = state.invoke.mock.lastCall![1].body.request_id;
  expect((await buildWorkoutPlan('owner', preferences)).id).toBe(id);
  expect(state.invoke.mock.calls.map((call) => call[1].body.request_id)).toEqual([id, id]);
  expect(state.store.size).toBe(0);
  state.invoke.mockResolvedValueOnce({
    data: null,
    error: { context: { json: async () => ({ code: 'WORKOUT_LIFETIME_LIMIT' }) } },
  });
  await expect(buildWorkoutPlan('owner', preferences)).rejects.toThrow('WORKOUT_LIFETIME_LIMIT');
});
it('preserves per-set target edits and reuses the edit UUID after an online failure', async () => {
  const content = { days: structuredClone(days) };
  content.days[0]!.exercises[0]!.targetSets = [
    { reps: 12, weightKg: 7.5 },
    { reps: 8, weightKg: 10 },
  ];
  state.rpc
    .mockResolvedValueOnce({ data: null, error: new Error('offline') })
    .mockResolvedValueOnce({ data: { ...view, revision: 2, days: content.days }, error: null });
  await expect(editWorkoutPlan('owner', view, content)).rejects.toThrow('offline');
  const saved = await editWorkoutPlan('owner', view, content);
  expect(state.rpc.mock.calls[0]![1]).toEqual(state.rpc.mock.calls[1]![1]);
  expect(saved.days[0]!.exercises[0]!.targetSets).toEqual(
    content.days[0]!.exercises[0]!.targetSets,
  );
});
it('does not regenerate an existing onboarding routine', async () => {
  state.rpc.mockResolvedValue({ data: view, error: null });
  expect(await buildWorkoutPlan('owner', preferences, true)).toEqual(view);
  expect(state.invoke).not.toHaveBeenCalled();
});
it('never re-enables revoked AI consent when opening an older onboarding routine', async () => {
  state.rpc.mockResolvedValue({
    data: { ...view, id: null, days: [], full_access: false },
    error: null,
  });
  state.invoke.mockResolvedValue({
    data: null,
    error: { context: { json: async () => ({ code: 'CONSENT_REQUIRED' }) } },
  });
  await expect(buildWorkoutPlan('owner', preferences, true)).rejects.toThrow('CONSENT_REQUIRED');
  expect(state.rpc.mock.calls.some((call) => call[0] === 'accept_ai_processing_consent')).toBe(
    false,
  );
});
