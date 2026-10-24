import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { GoalProfile } from '@calipartner/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('expo-sqlite', () => ({}));
import { createWebDb } from '@/db';
import { migrations } from '@/db/migrations';
import { registerAccountSyncCheck } from './accountSyncGate';
import {
  getCurrentLocalGoalProfile,
  saveGoalProfileWithSync,
  restoreGoalProfile,
  repairLegacyGoalProfile,
  flushTargetsOutbox,
  type TargetsDb,
} from './targetsService';

function nativeDb(): TargetsDb {
  const sql = new DatabaseSync(':memory:');
  sql.exec(migrations.find((migration) => migration.version === 3)!.sql);
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

describe.each(['native SQLite', 'browser persistence'])('saved targets: %s', (platform) => {
  const open = () => (platform === 'native SQLite' ? nativeDb() : createWebDb());

  it('retains custom macros and goals across restart with an idempotent offline outbox', async () => {
    let db = open();
    await saveGoalProfileWithSync(db, null, goal, false);
    await saveGoalProfileWithSync(db, null, goal, false);
    if (platform === 'browser persistence') db = createWebDb();
    expect(await getCurrentLocalGoalProfile(db, goal.user_id)).toEqual(goal);
    const queued = await db.getAllAsync<{ payload: string; operation: string }>(
      'SELECT * FROM outbox',
    );
    expect(queued).toHaveLength(1);
    expect(queued[0]?.operation).toBe('upsert');
    expect(JSON.parse(queued[0]!.payload)).toEqual(goal);
  });

  it('never returns another account or guest targets', async () => {
    const db = open();
    await saveGoalProfileWithSync(db, null, goal, false);
    expect(await getCurrentLocalGoalProfile(db, 'account-b')).toBeNull();
    expect(await getCurrentLocalGoalProfile(db, 'guest-user')).toBeNull();
  });

  it('still saves macros locally if a reset check cannot reach the server', async () => {
    const db = open();
    const unregister = registerAccountSyncCheck(async () => {
      throw new Error('Network unavailable');
    });
    try {
      const client = { from: () => ({ upsert: vi.fn() }) } as unknown as SupabaseClient;
      const result = await saveGoalProfileWithSync(db, client, goal, true);
      expect(result.synced).toBe(false);
      expect(await getCurrentLocalGoalProfile(db, goal.user_id)).toEqual(goal);
      expect(await db.getAllAsync('SELECT * FROM outbox')).toHaveLength(1);
    } finally {
      unregister();
    }
  });

  it('rolls back targets when the durable outbox write fails', async () => {
    const db: TargetsDb = open();
    const run = db.runAsync.bind(db);
    const spy = vi.spyOn(db, 'runAsync').mockImplementation(async (query, ...args) => {
      if (query.startsWith('INSERT INTO outbox')) throw new Error('Storage unavailable');
      return run(query, ...args);
    });
    await expect(saveGoalProfileWithSync(db, null, goal, false)).rejects.toThrow(
      'Storage unavailable',
    );
    spy.mockRestore();
    expect(await getCurrentLocalGoalProfile(db, goal.user_id)).toBeNull();
    expect(await db.getAllAsync('SELECT * FROM outbox')).toHaveLength(0);
  });

  it('restores exact server targets when the local cache is empty, then works offline', async () => {
    const db = open();
    const { client, query } = remote(goal);
    expect(await restoreGoalProfile(db, client, goal.user_id)).toEqual(goal);
    expect(query.eq).toHaveBeenCalledWith('user_id', goal.user_id);
    expect(await getCurrentLocalGoalProfile(db, goal.user_id)).toEqual(goal);
  });

  it('does not overwrite unsynced custom macros with an older server copy', async () => {
    const db = open();
    await saveGoalProfileWithSync(db, null, goal, false);
    const { client } = remote({ ...goal, protein_grams: 140, carb_grams: 240 });
    expect(await restoreGoalProfile(db, client, goal.user_id)).toEqual(goal);
  });

  it('repairs legacy non-UUID IDs once without changing macro values', async () => {
    const db = open();
    await saveGoalProfileWithSync(db, null, { ...goal, id: 'gp-account-a-123' }, false);
    await Promise.all([
      repairLegacyGoalProfile(db, goal.user_id),
      repairLegacyGoalProfile(db, goal.user_id),
    ]);
    const repaired = await getCurrentLocalGoalProfile(db, goal.user_id);
    expect(repaired?.id).toMatch(/^[0-9a-f-]{36}$/);
    expect({ ...repaired, id: goal.id }).toEqual(goal);
    await repairLegacyGoalProfile(db, goal.user_id);
    expect((await getCurrentLocalGoalProfile(db, goal.user_id))?.id).toBe(repaired?.id);
    expect(await db.getAllAsync('SELECT * FROM outbox')).toHaveLength(1);
  });

  it('flushes only the current account and keeps other accounts queued', async () => {
    const db = open();
    await saveGoalProfileWithSync(db, null, goal, false);
    await saveGoalProfileWithSync(db, null, { ...goal, id: 'b-id', user_id: 'account-b' }, false);
    const upsert = vi.fn(async () => ({ error: null }));
    const client = { from: () => ({ upsert }) } as unknown as SupabaseClient;
    expect(await flushTargetsOutbox(db, client, goal.user_id)).toEqual({ flushedCount: 1 });
    expect(upsert).toHaveBeenCalledExactlyOnceWith(goal);
    expect(await db.getAllAsync('SELECT * FROM outbox')).toHaveLength(1);
  });

  it('retains pending values after a failed sync and succeeds on retry', async () => {
    const db = open();
    await saveGoalProfileWithSync(db, null, goal, false);
    const upsert = vi
      .fn()
      .mockResolvedValueOnce({ error: { message: 'Connection lost' } })
      .mockResolvedValueOnce({ error: null });
    const client = { from: () => ({ upsert }) } as unknown as SupabaseClient;
    expect(await flushTargetsOutbox(db, client, goal.user_id)).toEqual({ flushedCount: 0 });
    expect(await getCurrentLocalGoalProfile(db, goal.user_id)).toEqual(goal);
    const queued = await db.getAllAsync<{ attempts: number; last_error: string }>(
      'SELECT * FROM outbox',
    );
    expect(queued[0]).toMatchObject({ attempts: 1, last_error: 'Connection lost' });
    expect(await flushTargetsOutbox(db, client, goal.user_id)).toEqual({ flushedCount: 1 });
    expect(await db.getAllAsync('SELECT * FROM outbox')).toHaveLength(0);
  });
});
