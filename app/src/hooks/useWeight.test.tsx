import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ save: vi.fn(), read: vi.fn() }));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'signed-in' }, profile: { timezone: 'America/New_York' } }),
}));
vi.mock('./useTargets', () => ({ useTargets: () => ({ currentGoalProfile: null }) }));
vi.mock('@/db', () => ({ getDb: async () => ({}) }));
vi.mock('@/services/weightService', () => ({
  logWeight: state.save,
  getWeightLogs: state.read,
  getWeightSummary: async () => ({
    latestLog: null,
    latestTrendKg: null,
    weeklyPace: { weeklyPaceKg: null },
    projection: { projectedDate: null, reason: 'not_enough_trend' },
    goalProgressPercent: 0,
    trendHistory: [],
  }),
  editWeightLog: vi.fn(),
  deleteWeightLog: vi.fn(),
}));
import { useWeight } from './useWeight';
let renderer: ReactTestRenderer;
let weight: ReturnType<typeof useWeight>;
function Probe() {
  weight = useWeight();
  return null;
}
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  vi.useRealTimers();
  vi.resetAllMocks();
});
describe('weight logging before goals have hydrated', () => {
  it('uses the signed-in owner and their local day even when no goal profile is cached', async () => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-30T01:00:00Z'));
    state.read.mockResolvedValue([]);
    state.save.mockResolvedValue({ id: 'weight-1' });
    await act(async () => {
      renderer = create(<Probe />);
    });
    expect(state.read).toHaveBeenCalledWith({}, 'signed-in', 100);
    await act(async () => {
      await weight.logWeight(79.5, undefined, 'Morning');
    });
    expect(state.save).toHaveBeenCalledWith(
      {},
      'signed-in',
      79.5,
      '2026-10-29',
      undefined,
      'Morning',
    );
  });
});
