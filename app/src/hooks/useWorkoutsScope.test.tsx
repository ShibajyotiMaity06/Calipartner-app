import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'owner' } }) }));
vi.mock('./useCurrentLocalDate', () => ({
  useCurrentLocalDate: () => ({ localDate: '2026-11-11' }),
}));
vi.mock('./useTargets', () => ({
  useTargets: () => ({ currentGoalProfile: { current_weight_kg: 70 } }),
}));
vi.mock('@/db', () => ({ getDb: async () => ({}) }));
vi.mock('@/services/accountDataService', () => ({ loadAccountTable: async () => {} }));
vi.mock('@/services/workoutService', () => ({ getWorkoutsForDate: state.read }));
import { useWorkouts } from './useWorkouts';
let tree: ReactTestRenderer, current: ReturnType<typeof useWorkouts>;
function Probe({ date }: { date: string }) {
  current = useWorkouts(date);
  return null;
}
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});
it('cannot replace a previous-day view with a delayed response for today', async () => {
  let resolve!: (value: unknown) => void;
  state.read
    .mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    )
    .mockResolvedValue([{ id: 'previous-day' }]);
  await act(async () => {
    tree = create(<Probe date="2026-11-11" />);
  });
  await act(async () => tree.update(<Probe date="2026-11-10" />));
  expect(current.workouts[0]!.id).toBe('previous-day');
  await act(async () => resolve([{ id: 'stale-today' }]));
  expect(current.workouts[0]!.id).toBe('previous-day');
  expect(current.loading).toBe(false);
});
