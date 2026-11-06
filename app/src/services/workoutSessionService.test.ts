import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ rpc: vi.fn(), owner: 'owner', reset: false, changed: vi.fn() }));
vi.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    auth: { getUser: async () => ({ data: { user: { id: state.owner } }, error: null }) },
    rpc: state.rpc,
  }),
}));
vi.mock('./accountDataGate', () => ({ beforeAccountWrite: async () => state.reset }));
vi.mock('./foodService', () => ({ generateClientUuid: () => crypto.randomUUID() }));
vi.mock('./workoutEvents', () => ({ workoutEvents: { emitChange: state.changed } }));
import { newWorkoutSessionRequest, saveNewWorkoutSession } from './workoutSessionService';
const input = {
  userId: 'owner',
  localDate: '2026-11-06',
  type: 'cardio' as const,
  name: 'Cycling',
  durationMinutes: 30,
  distanceKm: 12.5,
  notes: null,
  effortRating: null,
  exercises: [],
};
beforeEach(() => {
  vi.clearAllMocks();
  state.owner = 'owner';
  state.reset = false;
});
it('saves the workout, cardio duration and distance atomically and reuses every ID after failure', async () => {
  state.rpc
    .mockResolvedValueOnce({ error: new Error('offline') })
    .mockResolvedValue({ data: null, error: null });
  const request = newWorkoutSessionRequest();
  await expect(saveNewWorkoutSession(request, input)).rejects.toThrow('offline');
  expect(state.changed).not.toHaveBeenCalled();
  const first = state.rpc.mock.calls[0]![1].p_changes;
  const saved = await saveNewWorkoutSession(request, input);
  const second = state.rpc.mock.calls[1]![1].p_changes;
  expect(first.map((row: { id: string }) => row.id)).toEqual(
    second.map((row: { id: string }) => row.id),
  );
  expect(second.map((row: { entity: string }) => row.entity)).toEqual([
    'workouts',
    'workout_exercises',
    'workout_sets',
  ]);
  expect(saved.exercises[0]!.sets![0]).toMatchObject({
    duration_seconds: 1800,
    distance_meters: 12500,
  });
  expect(state.changed).toHaveBeenCalledOnce();
});
it('removes a set from an uncertain earlier draft within the same atomic retry', async () => {
  state.rpc.mockResolvedValue({ data: null, error: null });
  const request = newWorkoutSessionRequest();
  const set = { reps: 10, weightKg: 20, isWarmup: false, completed: true };
  const strength = {
    ...input,
    type: 'strength' as const,
    exercises: [{ exerciseName: 'Squat', sets: [set, set] }],
  };
  await saveNewWorkoutSession(request, strength);
  await saveNewWorkoutSession(request, {
    ...strength,
    exercises: [{ exerciseName: 'Squat', sets: [set] }],
  });
  const changes = state.rpc.mock.lastCall![1].p_changes;
  expect(
    changes.filter((row: { payload: { deleted_at: string | null } }) => row.payload.deleted_at),
  ).toHaveLength(1);
});
it('rejects an account change or account reset before any save', async () => {
  state.owner = 'stranger';
  await expect(saveNewWorkoutSession(newWorkoutSessionRequest(), input)).rejects.toThrow(
    'ACCOUNT_CHANGED',
  );
  state.owner = 'owner';
  state.reset = true;
  await expect(saveNewWorkoutSession(newWorkoutSessionRequest(), input)).rejects.toThrow(
    'ACCOUNT_DATA_RESET',
  );
  expect(state.rpc).not.toHaveBeenCalled();
});
