import { beforeEach, expect, it, vi } from 'vitest';
import type { WorkoutWithDetails } from '@calipartner/core';
const state = vi.hoisted(() => ({ rpc: vi.fn(), owner: 'owner', changed: vi.fn() }));
vi.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    auth: { getUser: async () => ({ data: { user: { id: state.owner } }, error: null }) },
    rpc: state.rpc,
  }),
}));
vi.mock('./accountDataGate', () => ({ beforeAccountWrite: async () => false }));
vi.mock('./foodService', () => ({ generateClientUuid: () => crypto.randomUUID() }));
vi.mock('./workoutEvents', () => ({ workoutEvents: { emitChange: state.changed } }));
vi.mock('./diaryEvents', () => ({ diaryEvents: { emitChange: vi.fn() } }));
import { newWorkoutSessionRequest } from './workoutSessionService';
import { saveLoggedWorkoutSets } from './loggedWorkoutEditService';
const workout = {
  id: 'workout',
  user_id: 'owner',
  type: 'strength',
  exercises: [
    {
      id: 'exercise',
      workout_id: 'workout',
      user_id: 'owner',
      exercise_name: 'Squat',
      sets: [
        {
          id: 'old-set',
          workout_id: 'workout',
          workout_exercise_id: 'exercise',
          user_id: 'owner',
          set_number: 1,
          reps: 10,
          weight_kg: 0,
          completed: true,
          is_warmup: false,
        },
      ],
    },
  ],
} as WorkoutWithDetails;
beforeEach(() => {
  vi.clearAllMocks();
  state.owner = 'owner';
  state.rpc.mockResolvedValue({ error: null });
});
it('writes edits and added/removed sets in one batch, reuses IDs on retry, and emits only after acknowledgement', async () => {
  state.rpc
    .mockResolvedValueOnce({ error: new Error('offline') })
    .mockResolvedValue({ error: null });
  const request = newWorkoutSessionRequest();
  await expect(
    saveLoggedWorkoutSets(request, workout, [
      [
        { reps: 12, weightKg: 0 },
        { reps: 8, weightKg: 15 },
      ],
    ]),
  ).rejects.toThrow('offline');
  expect(state.changed).not.toHaveBeenCalled();
  const first = state.rpc.mock.calls[0]![1].p_changes;
  await saveLoggedWorkoutSets(request, workout, [
    [
      { reps: 12, weightKg: 0 },
      { reps: 8, weightKg: 15 },
    ],
  ]);
  const second = state.rpc.mock.calls[1]![1].p_changes;
  expect(second.map((row: { id: string }) => row.id)).toEqual(
    first.map((row: { id: string }) => row.id),
  );
  expect(second[0].payload).toMatchObject({ id: 'old-set', reps: 12, weight_kg: null });
  expect(state.changed).toHaveBeenCalledOnce();
  await saveLoggedWorkoutSets(request, workout, [[{ reps: 12, weightKg: 0 }]]);
  expect(
    state.rpc.mock.lastCall![1].p_changes.find((row: { id: string }) => row.id === second[1].id)
      .payload.deleted_at,
  ).toBeTruthy();
  expect(state.rpc.mock.lastCall![0]).toBe('save_tracking_changes');
});
it('rejects invalid numbers and a different account before making a write', async () => {
  await expect(
    saveLoggedWorkoutSets(newWorkoutSessionRequest(), workout, [[{ reps: NaN, weightKg: 0 }]]),
  ).rejects.toThrow('INVALID_WORKOUT');
  state.owner = 'other';
  await expect(
    saveLoggedWorkoutSets(newWorkoutSessionRequest(), workout, [[{ reps: 10, weightKg: 0 }]]),
  ).rejects.toThrow('ACCOUNT_CHANGED');
  expect(state.rpc).not.toHaveBeenCalled();
});
it('renames only private workout snapshots and omits cache-only columns from edits', async () => {
  const cached = structuredClone(workout);
  cached.name = 'Squat';
  const exercise = cached.exercises[0]!;
  exercise.exercise_id = 'shared-catalog-squat';
  Object.assign(exercise, { sync_state: 'synced' });
  Object.assign(exercise.sets![0]!, { sync_state: 'synced' });
  await saveLoggedWorkoutSets(
    newWorkoutSessionRequest(),
    cached,
    [[{ reps: 15, weightKg: 0 }]],
    ['Paused squat'],
  );
  const writes = state.rpc.mock.lastCall![1].p_changes;
  expect(writes.map((row: { entity: string }) => row.entity)).toEqual([
    'workouts',
    'workout_exercises',
    'workout_sets',
  ]);
  expect(writes[0].payload.name).toBe('Paused squat');
  expect(writes[1].payload).toMatchObject({
    exercise_name: 'Paused squat',
    exercise_id: 'shared-catalog-squat',
  });
  expect(writes[2].payload.reps).toBe(15);
  expect(
    writes.every((row: { payload: object }) => !Object.hasOwn(row.payload, 'sync_state')),
  ).toBe(true);
});
it('does not report success if the account changes during acknowledgement', async () => {
  state.rpc.mockImplementation(async () => {
    state.owner = 'other';
    return { error: null };
  });
  await expect(
    saveLoggedWorkoutSets(newWorkoutSessionRequest(), workout, [[{ reps: 10, weightKg: 0 }]]),
  ).rejects.toThrow('ACCOUNT_CHANGED');
  expect(state.changed).not.toHaveBeenCalled();
});
