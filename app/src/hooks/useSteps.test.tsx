import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({
  read: vi.fn().mockResolvedValue({ steps: 400, user_id: 'owner', local_date: '2026-11-17' }),
  owner: 'owner',
}));
vi.mock('react-native', () => ({ AppState: { addEventListener: () => ({ remove: vi.fn() }) } }));
vi.mock('@/services/accountDataService', () => ({ loadAccountTable: async () => {} }));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: mock.owner }, profile: {} }),
}));
vi.mock('@/db', () => ({ getDb: async () => ({}) }));
vi.mock('./useTargets', () => ({
  useTargets: () => ({ currentGoalProfile: { step_goal: 8000 }, updateDailyGoals: vi.fn() }),
}));
vi.mock('./useCurrentLocalDate', () => ({
  useCurrentLocalDate: () => ({ localDate: '2026-11-17', timeZone: 'UTC' }),
}));
vi.mock('@/services/activityService', () => ({
  getActivityDay: mock.read,
  getActivityWeek: async () => [],
  upsertActivityDay: vi.fn(),
  getActivityMetrics: (value: { steps: number } | null) => ({
    steps: value?.steps ?? 0,
    distanceM: 0,
    distanceKm: 0,
    walkingCalories: 0,
  }),
}));
vi.mock('@/services/stepIntegrationService', () => ({
  getStepPermissionStatus: async () => 'granted',
  readDeviceSteps: async () => null,
  requestStepPermissions: vi.fn(),
}));
import { useSteps } from './useSteps';
let current: ReturnType<typeof useSteps>, tree: ReactTestRenderer;
function Probe({ date }: { date?: string }) {
  current = useSteps(date);
  return null;
}
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});
it('keeps acknowledged step percentages visible during a refresh and hides old days during a date change', async () => {
  await act(async () => {
    tree = create(<Probe />);
  });
  expect(current.steps).toBe(400);
  expect(current.loading).toBe(false);
  let resolve!: (value: { steps: number; user_id: string; local_date: string }) => void;
  mock.read.mockReturnValueOnce(
    new Promise((r) => {
      resolve = r;
    }),
  );
  let pending!: Promise<void>;
  await act(async () => {
    pending = current.refresh();
  });
  expect(current.loading).toBe(false);
  expect(current.progressPercent).toBe(5);
  await act(async () => {
    resolve({ steps: 800, user_id: 'owner', local_date: '2026-11-17' });
    await pending;
  });
  expect(current.progressPercent).toBe(10);
  mock.read.mockReturnValue(
    new Promise((r) => {
      resolve = r;
    }),
  );
  await act(async () => tree.update(<Probe date="2026-11-16" />));
  expect(current.loading).toBe(true);
  expect(current.steps).toBe(0);
  await act(async () => resolve({ steps: 1000, user_id: 'owner', local_date: '2026-11-16' }));
  expect(current.loading).toBe(false);
  expect(current.steps).toBe(1000);
});
