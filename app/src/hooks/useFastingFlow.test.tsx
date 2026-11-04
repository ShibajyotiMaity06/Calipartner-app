import React from 'react';
import { act, create } from 'react-test-renderer';
import { expect, it, vi, afterEach, beforeEach } from 'vitest';
const state = vi.hoisted(() => ({
  paid: true,
  start: vi.fn(),
  end: vi.fn(),
  active: null as unknown,
}));
vi.mock('react-native', () => ({ AppState: { addEventListener: () => ({ remove: vi.fn() }) } }));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ profile: { date_of_birth: '1995-01-01', timezone: 'Asia/Kolkata' } }),
}));
vi.mock('./useSubscription', () => ({
  useSubscription: () => ({
    hasActiveAccess: state.paid,
    currentTier: state.paid ? 'plus' : 'free',
    loading: false,
  }),
}));
vi.mock('@/db', () => ({ getDb: async () => ({}) }));
vi.mock('@/services/accountDataService', () => ({ loadAccountTable: async () => {} }));
vi.mock('@/services/foodService', () => ({ generateClientUuid: () => crypto.randomUUID() }));
vi.mock('@/services/targetsService', () => ({ saveHealthScreeningOnline: vi.fn() }));
vi.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    from: (table: string) => ({
      select() {
        return this;
      },
      eq() {
        return this;
      },
      order() {
        return this;
      },
      limit() {
        return this;
      },
      maybeSingle: async () => ({
        data:
          table === 'health_screening'
            ? {
                pregnant_or_breastfeeding: false,
                has_diabetes_or_medication: false,
                has_eating_disorder_history: false,
              }
            : table === 'daily_summaries'
              ? { low_intake_flag: false }
              : null,
        error: null,
      }),
    }),
  }),
}));
vi.mock('@/services/fastingService', async () => ({
  getLocalFastingSettings: async () => ({
    user_id: 'owner',
    enabled: true,
    protocol: '18:6',
    custom_fasting_hours: null,
    eating_window_start: '14:00',
    eating_window_end: '20:00',
  }),
  getActiveFastingSession: async () => state.active,
  getFastingHistory: async () => [],
  startFast: state.start,
  endFast: state.end,
  saveFastingSettings: vi.fn(),
  editFastingSession: vi.fn(),
  parseFastingError: (reason: Error) => ({ code: reason.message, message: reason.message }),
}));
import { useFasting } from './useFasting';
let hook: ReturnType<typeof useFasting>;
let tree: ReturnType<typeof create>;
function Harness() {
  hook = useFasting({ userId: 'owner' });
  return null;
}
beforeEach(() => {
  vi.clearAllMocks();
  state.paid = true;
  state.active = null;
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});
it('uses the selected 18-hour protocol and keeps retry identity after a failed acknowledgement', async () => {
  state.start.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({
    id: 'saved',
    status: 'active',
    start_at: new Date().toISOString(),
    planned_minutes: 1080,
  });
  await act(async () => {
    tree = create(<Harness />);
  });
  await act(async () => {
    await expect(hook.startFast()).rejects.toBeDefined();
  });
  const first = state.start.mock.calls[0]![2];
  expect(first.plannedMinutes).toBe(1080);
  await act(async () => {
    await hook.refresh();
  });
  await act(async () => {
    await hook.startFast();
  });
  expect(state.start.mock.calls[1]![2].id).toBe(first.id);
});
it('denies new Free fasts while allowing a lapsed user to end an existing fast', async () => {
  state.paid = false;
  state.active = {
    id: 'existing',
    user_id: 'owner',
    start_at: new Date().toISOString(),
    planned_minutes: 960,
    status: 'active',
    end_at: null,
  };
  state.end.mockResolvedValue({ id: 'existing', status: 'ended_early' });
  await act(async () => {
    tree = create(<Harness />);
  });
  await act(async () => {
    await expect(hook.startFast()).rejects.toBeDefined();
  });
  expect(state.start).not.toHaveBeenCalled();
  await act(async () => {
    await hook.endFast();
  });
  expect(state.end).toHaveBeenCalledOnce();
});
