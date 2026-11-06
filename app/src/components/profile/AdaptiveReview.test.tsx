import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ invoke: vi.fn(), rpc: vi.fn(), refresh: vi.fn(), next: 0 }));
vi.mock('react-native', () => ({ View: 'View' }));
vi.mock('@calipartner/ui', () => ({ Button: 'Button', Text: 'Text' }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'owner' } }) }));
vi.mock('@/hooks/useTargets', () => ({
  useTargets: () => ({
    currentGoalProfile: { tdee: 2500, daily_calorie_target: 1950 },
    refresh: api.refresh,
  }),
}));
vi.mock('@/lib/supabase', () => ({
  getSupabase: () => ({ functions: { invoke: api.invoke }, rpc: api.rpc }),
}));
vi.mock('@/services/foodService', () => ({ generateClientUuid: () => `request-${++api.next}` }));
vi.mock('@/components/rooms/SquadViews', () => ({ squadStyles: {} }));
vi.mock('@/components/diary/NutrientSummary', () => ({ NutrientSummary: 'Nutrients' }));
import { AdaptiveReview } from './AdaptiveReview';
let tree: ReactTestRenderer;
const proposal = {
  reason: 'ready',
  id: 'proposal-id',
  proposal: {
    tdee: 2480,
    daily_calorie_target: 1930,
    protein_grams: 176,
    carb_grams: 90,
    fat_grams: 96,
    logged_days: 14,
    weigh_in_days: 4,
    weight_change: -0.5,
  },
};
beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  api.invoke.mockResolvedValue({ data: proposal, error: null });
  api.refresh.mockResolvedValue(undefined);
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});
it('does not change targets while previewing; failed acceptance retries the same proposal and confirms only an acknowledgement', async () => {
  api.rpc
    .mockResolvedValueOnce({ data: null, error: { message: 'Network request failed' } })
    .mockResolvedValueOnce({ data: { id: 'proposal-id', user_id: 'owner' }, error: null });
  await act(async () => {
    tree = create(<AdaptiveReview />);
  });
  await act(async () =>
    tree.root.findByProps({ testID: 'prepare-adaptive-review' }).props.onPress(),
  );
  expect(api.rpc).not.toHaveBeenCalled();
  await act(async () =>
    tree.root.findByProps({ testID: 'accept-adaptive-review' }).props.onPress(),
  );
  expect(api.refresh).not.toHaveBeenCalled();
  expect(tree.root.findAllByProps({ accessibilityRole: 'alert' })).toHaveLength(1);
  await act(async () =>
    tree.root.findByProps({ testID: 'accept-adaptive-review' }).props.onPress(),
  );
  expect(api.rpc.mock.calls.map((call) => call[1])).toEqual([
    { p_id: 'proposal-id' },
    { p_id: 'proposal-id' },
  ]);
  expect(api.refresh).toHaveBeenCalledOnce();
});
it('clears a stale proposal and creates a fresh request for changed logs', async () => {
  api.rpc.mockResolvedValue({ data: null, error: { message: 'REVIEW_STALE' } });
  await act(async () => {
    tree = create(<AdaptiveReview />);
  });
  await act(async () =>
    tree.root.findByProps({ testID: 'prepare-adaptive-review' }).props.onPress(),
  );
  const first = api.invoke.mock.calls[0]![1].body.request_id;
  await act(async () =>
    tree.root.findByProps({ testID: 'accept-adaptive-review' }).props.onPress(),
  );
  expect(tree.root.findAllByProps({ testID: 'accept-adaptive-review' })).toHaveLength(0);
  await act(async () =>
    tree.root.findByProps({ testID: 'prepare-adaptive-review' }).props.onPress(),
  );
  expect(api.invoke.mock.calls[1]![1].body.request_id).not.toBe(first);
});
