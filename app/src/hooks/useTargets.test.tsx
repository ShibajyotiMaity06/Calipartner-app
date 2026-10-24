import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { GoalProfile } from '@calipartner/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const stored = vi.hoisted(() => ({
  userId: 'user-a',
  profiles: new Map<string, GoalProfile>(),
  remote: null as GoalProfile | null,
  failRestore: false,
  restore: vi.fn(),
}));
vi.mock('react-native', () => ({ AppState: { addEventListener: () => ({ remove: vi.fn() }) } }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: stored.userId } }) }));
vi.mock('@/hooks/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isOnline: true }) }));
vi.mock('@/db', () => ({ getDb: async () => ({}) }));
vi.mock('@/lib/supabase', () => ({ getSupabase: () => ({}) }));
vi.mock('@/services/targetsService', () => ({
  repairLegacyGoalProfile: vi.fn(),
  flushTargetsOutbox: vi.fn(),
  getLocalHealthScreening: async () => null,
  getCurrentLocalGoalProfile: async (_db: unknown, userId: string) =>
    stored.profiles.get(userId) ?? null,
  restoreGoalProfile: async (_db: unknown, _client: unknown, userId: string) => {
    stored.restore(userId);
    if (stored.failRestore) throw new Error('Offline');
    return stored.profiles.get(userId) ?? stored.remote;
  },
  saveGoalProfileWithSync: async (_db: unknown, _client: unknown, profile: GoalProfile) => {
    stored.profiles.set(profile.user_id, profile);
    return { synced: false };
  },
  saveHealthScreeningWithSync: vi.fn(),
}));
import { TargetsProvider, useTargets } from './useTargets';

let renderer: ReactTestRenderer;
let today: ReturnType<typeof useTargets>;
let tracker: ReturnType<typeof useTargets>;
function Today() {
  today = useTargets();
  return null;
}
function Tracker() {
  tracker = useTargets();
  return null;
}
const saved = {
  id: 'saved-goal',
  user_id: 'user-a',
  daily_calorie_target: 2317,
  protein_grams: 166,
  carb_grams: 248,
  fat_grams: 73,
} as GoalProfile;
const tree = () => (
  <TargetsProvider>
    <Today />
    <Tracker />
  </TargetsProvider>
);
beforeEach(() => {
  stored.profiles.clear();
  stored.remote = null;
  stored.userId = 'user-a';
  stored.failRestore = false;
  vi.clearAllMocks();
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
});

describe('shared persisted targets', () => {
  it('updates every consumer immediately after saving onboarding/custom macros', async () => {
    await act(async () => {
      renderer = create(tree());
    });
    await act(async () => {
      await today.saveGoalProfile(saved);
    });
    expect(today.currentGoalProfile).toEqual(saved);
    expect(tracker.currentGoalProfile).toEqual(saved);
    expect(stored.restore).toHaveBeenCalledTimes(1);
  });

  it('hydrates server targets for returning users with no local cache', async () => {
    stored.remote = saved;
    await act(async () => {
      renderer = create(tree());
    });
    expect(today.currentGoalProfile).toEqual(saved);
    expect(tracker.currentGoalProfile?.protein_grams).toBe(166);
  });

  it('retains saved macros during a failed network restore', async () => {
    stored.profiles.set('user-a', saved);
    stored.failRestore = true;
    await act(async () => {
      renderer = create(tree());
    });
    expect(today.currentGoalProfile).toEqual(saved);
    expect(today.error).toBe('Offline');
  });

  it('changing daily step/water goals preserves custom macro targets', async () => {
    stored.profiles.set('user-a', saved);
    await act(async () => {
      renderer = create(tree());
    });
    await act(async () => {
      await today.updateDailyGoals(9500, 2750);
    });
    expect(today.currentGoalProfile).toMatchObject({
      daily_calorie_target: 2317,
      protein_grams: 166,
      carb_grams: 248,
      fat_grams: 73,
      step_goal: 9500,
      water_ml_goal: 2750,
    });
  });

  it('clears the previous account from every consumer when accounts switch', async () => {
    stored.profiles.set('user-a', saved);
    await act(async () => {
      renderer = create(tree());
    });
    stored.userId = 'user-b';
    await act(async () => {
      renderer.update(tree());
    });
    expect(today.currentGoalProfile).toBeNull();
    expect(tracker.currentGoalProfile).toBeNull();
  });
});
