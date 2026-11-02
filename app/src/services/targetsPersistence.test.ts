import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { GoalProfile } from '@calipartner/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('expo-sqlite', () => ({}));
import { createWebDb } from '@/db';
import { migrations } from '@/db/migrations';
import { registerAccountWriteCheck } from './accountDataGate';
import { clearOnboardingDraft, loadOnboardingDraft, saveOnboardingDraft } from './onboardingDraft';
import { OnboardingStateMachine } from './onboardingStateMachine';
import {
  getCurrentLocalGoalProfile,
  saveGoalProfileOnline,
  restoreGoalProfile,
  type TargetsDb,
} from './targetsService';

function nativeDb(): TargetsDb {
  const sql = new DatabaseSync(':memory:');
  sql.exec(migrations.find((migration) => migration.version === 3)!.sql);
  sql.exec(migrations.find((migration) => migration.version === 12)!.sql);
  sql.exec(migrations.find((migration) => migration.version === 16)!.sql);
  sql.exec(
    `CREATE TABLE outbox (id TEXT PRIMARY KEY, entity TEXT, operation TEXT, payload TEXT, created_at TEXT, attempts INTEGER, last_error TEXT)`,
  );
  const flatten = (args: unknown[]) => (Array.isArray(args[0]) ? args[0] : args) as SQLInputValue[];
  return {
    async runAsync(query, ...args) {
      return sql.prepare(query).run(...flatten(args));
    },
    async getFirstAsync<T>(query: string, ...args: unknown[]) {
      return (sql.prepare(query).get(...flatten(args)) ?? null) as T | null;
    },
    async getAllAsync<T>(query: string, ...args: unknown[]) {
      return sql.prepare(query).all(...flatten(args)) as T[];
    },
    async withTransactionAsync(action) {
      sql.exec('BEGIN');
      try {
        await action();
        sql.exec('COMMIT');
      } catch (error) {
        sql.exec('ROLLBACK');
        throw error;
      }
    },
  };
}

const goal: GoalProfile = {
  id: '34e43af4-4c3c-4e44-b558-c421857ee29f',
  user_id: 'account-a',
  goal: 'cut',
  activity_level: 'moderate',
  current_weight_kg: 83,
  body_fat_percentage: null,
  weekly_rate_kg: 0.5,
  target_weight_kg: 78,
  target_date: null,
  daily_calorie_target: 2317,
  protein_grams: 166,
  carb_grams: 248,
  fat_grams: 73,
  bmr: 1800,
  tdee: 2867,
  step_goal: 9250,
  water_ml_goal: 2750,
  effective_from: '2026-10-20T00:00:00Z',
  confirmed_at: '2026-10-20T00:00:00Z',
  created_at: '2026-10-20T00:00:00Z',
  recompute_reason: 'initial_onboarding',
};

function remote(row: GoalProfile | null) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn(async () => ({ data: row, error: null })),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  return { client: { from: () => query } as unknown as SupabaseClient, query };
}

beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe.each(['native SQLite', 'browser persistence'])('online targets: %s', (platform) => {
  const open = () => (platform === 'native SQLite' ? nativeDb() : createWebDb());
  const successfulClient = () =>
    ({ from: () => ({ upsert: async () => ({ error: null }) }) }) as unknown as SupabaseClient;
  it('retains exact custom macros in the local read cache after an acknowledged save', async () => {
    const db = open();
    const profile = { ...goal, custom_macros: true };
    await saveGoalProfileOnline(db, successfulClient(), profile, true);
    expect(await getCurrentLocalGoalProfile(db, goal.user_id)).toEqual(profile);
    expect(await getCurrentLocalGoalProfile(db, 'another-account')).toBeNull();
  });
  it('keeps the last acknowledged plan when a save cannot reach the server', async () => {
    const db = open();
    await saveGoalProfileOnline(db, successfulClient(), goal, true);
    await expect(
      saveGoalProfileOnline(db, null, { ...goal, protein_grams: 200 }, false),
    ).rejects.toThrow('NETWORK_UNAVAILABLE');
    expect(await getCurrentLocalGoalProfile(db, goal.user_id)).toEqual(goal);
  });
  it('restores exact server goals and rejects a projection for a different account', async () => {
    const db = open();
    expect(await restoreGoalProfile(db, remote(goal).client, goal.user_id)).toEqual(goal);
    await expect(restoreGoalProfile(db, remote(goal).client, 'other')).rejects.toThrow(
      'owner mismatch',
    );
  });
  it('does not resurrect a cached plan when the server has no plan', async () => {
    const db = open();
    await saveGoalProfileOnline(db, successfulClient(), goal, true);
    expect(await restoreGoalProfile(db, remote(null).client, goal.user_id)).toBeNull();
  });
  it('does not cache a save before the reset check completes', async () => {
    const db = open();
    const unregister = registerAccountWriteCheck(async () => {
      throw new Error('RESET_CHECK_UNAVAILABLE');
    });
    try {
      await expect(saveGoalProfileOnline(db, successfulClient(), goal, true)).rejects.toThrow(
        'RESET_CHECK_UNAVAILABLE',
      );
    } finally {
      unregister();
    }
    expect(await getCurrentLocalGoalProfile(db, goal.user_id)).toBeNull();
  });
  it('persists account-scoped onboarding drafts without sending them', async () => {
    const db = open();
    const machine = new OnboardingStateMachine();
    await saveOnboardingDraft(db, 'account-a', machine.getState());
    expect(await loadOnboardingDraft(db, 'account-b')).toBeNull();
    expect(await loadOnboardingDraft(db, 'account-a')).not.toBeNull();
    await clearOnboardingDraft(db, 'account-a');
    expect(await loadOnboardingDraft(db, 'account-a')).toBeNull();
  });
});
