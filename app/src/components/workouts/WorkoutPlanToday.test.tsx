import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ load: vi.fn(), push: vi.fn() }));
vi.mock('react-native', () => ({ View: 'View' }));
vi.mock('expo-router', () => ({ useRouter: () => ({ push: api.push }) }));
vi.mock('@calipartner/ui', async () => ({
  ...(await import('../../../../packages/ui/src/tokens')),
  Text: 'Text',
  Button: 'Button',
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'owner' } }) }));
vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => ({ hasActiveAccess: true, currentTier: 'plus', isTrial: false }),
}));
vi.mock('@/services/weeklyPlanService', () => ({ getPersonalWeeklyPlan: api.load }));
import { WorkoutPlanToday } from './WorkoutPlanToday';
let tree: ReactTestRenderer;
const day = {
  day: 0,
  workout: {
    title: 'Private workout',
    exercises: [{ name: 'Squat', sets: 3, reps: 8, rest_seconds: 60 }],
    minutes: 30,
  },
  meals: [],
};
beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});
it('conceals a Basic preview without rendering its exercise names or a start action', async () => {
  api.load.mockResolvedValue({ scope: 'day', full_access: false, days: [day] });
  await act(async () => {
    tree = create(<WorkoutPlanToday localDate="2026-11-07" onUse={vi.fn()} />);
  });
  expect(JSON.stringify(tree.toJSON())).not.toContain('Private workout');
  expect(JSON.stringify(tree.toJSON())).not.toContain('Squat');
  expect(tree.root.findAllByProps({ testID: 'workout-use-today-plan' })).toHaveLength(0);
  expect(
    tree.root.findByProps({ testID: 'workout-plan-concealed' }).props.accessibilityElementsHidden,
  ).toBe(true);
  await act(async () => tree.root.findByProps({ testID: 'workout-plan-upgrade' }).props.onPress());
  expect(api.push).toHaveBeenCalledWith('/paywall');
});
it('uses a purchased single-day plan on today without imposing a weekday or saving invented logs', async () => {
  const use = vi.fn();
  api.load.mockResolvedValue({ scope: 'day', full_access: true, days: [day] });
  await act(async () => {
    tree = create(<WorkoutPlanToday localDate="2026-11-07" onUse={use} />);
  });
  expect(JSON.stringify(tree.toJSON())).toContain('Private workout');
  await act(async () =>
    tree.root.findByProps({ testID: 'workout-use-today-plan' }).props.onPress(),
  );
  expect(use).toHaveBeenCalledWith(day);
  expect(api.load).toHaveBeenCalledWith('owner');
});
it('shows a retry for an unavailable plan and recovers to an honest empty state', async () => {
  api.load.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(null);
  await act(async () => {
    tree = create(<WorkoutPlanToday localDate="2026-11-07" onUse={vi.fn()} />);
  });
  expect(tree.root.findByProps({ accessibilityRole: 'alert' })).toBeDefined();
  await act(async () => tree.root.findByProps({ testID: 'workout-plan-retry' }).props.onPress());
  expect(JSON.stringify(tree.toJSON())).toContain('No workout planned');
  expect(tree.root.findAllByProps({ accessibilityRole: 'alert' })).toHaveLength(0);
});
