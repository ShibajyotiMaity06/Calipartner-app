import { registerAccountWriteCheck } from './accountDataGate';
import { DEV_100_FOOD_SEED, type Food } from '@calipartner/core';
import { savePhotoCandidatesToDiary } from './aiFoodPhotoService';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { migrations } from '@/db/migrations';
import type { LocalDb, RemoteWrite } from './accountDataService';
const server = vi.hoisted(() => ({
  actor: 'owner',
  error: null as Error | null,
  rpc: vi.fn(),
  tables: {} as Record<string, Record<string, unknown>[]>,
}));
vi.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    auth: { getUser: async () => ({ data: { user: { id: server.actor } } }) },
    rpc: server.rpc,
    from: (table: string) => {
      const filters: Record<string, unknown> = {};
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => {
          filters[key] = value;
          return query;
        },
        order: () => query,
        range: async (start: number, end: number) => ({
          error: server.error,
          data: (server.tables[table] ?? [])
            .filter((row) => Object.entries(filters).every(([key, value]) => row[key] === value))
            .slice(start, end + 1),
        }),
      };
      return query;
    },
  }),
}));
import { loadAccountTable, saveRemote } from './accountDataService';
import { logWater } from './waterService';
import { logWorkoutExercise } from './workoutLogService';
const connections: DatabaseSync[] = [];
function database() {
  const sql = new DatabaseSync(':memory:');
  connections.push(sql);
  for (const migration of migrations) sql.exec(migration.sql);
  const params = (args: unknown[]) => (Array.isArray(args[0]) ? args[0] : args) as never[];
  const db: LocalDb = {
    runAsync: async (query, ...args) => sql.prepare(query).run(...params(args)),
    getAllAsync: async <T>(query: string, ...args: unknown[]) =>
      sql.prepare(query).all(...params(args)) as T[],
    getFirstAsync: async <T>(query: string, ...args: unknown[]) =>
      (sql.prepare(query).get(...params(args)) ?? null) as T | null,
    withTransactionAsync: async (action) => {
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
  return { sql, db };
}
beforeEach(() => {
  server.actor = 'owner';
  server.error = null;
  server.tables = {};
  server.rpc.mockReset().mockImplementation(async () => ({ error: server.error }));
});
afterEach(() => connections.splice(0).forEach((connection) => connection.close()));
describe('online saves without a delivery queue', () => {
  it('acknowledges a complete workout and its sets with exactly one server request', async () => {
    const { db, sql } = database();
    const workout = await logWorkoutExercise(db, {
      userId: 'owner',
      localDate: '2026-11-02',
      exerciseName: 'Squat',
      durationMinutes: 20,
      sets: [
        { reps: 8, weightKg: 40 },
        { reps: 8, weightKg: 40 },
      ],
    });
    expect(workout.exercises[0]?.sets).toHaveLength(2);
    expect(server.rpc).toHaveBeenCalledOnce();
    const changes = server.rpc.mock.calls[0]![1].p_changes as RemoteWrite[];
    expect(changes.map((change) => change.entity)).toEqual([
      'workouts',
      'workout_exercises',
      'workout_sets',
      'workout_sets',
    ]);
    expect(
      sql
        .prepare(
          "SELECT name FROM sqlite_master WHERE name IN ('outbox','sync_cursors','local_social_outbox','local_challenge_outbox')",
        )
        .all(),
    ).toEqual([]);
  });
  it('saves all accepted photo items in one acknowledged request without nested SQLite transactions', async () => {
    const { db } = database();
    const candidate = {
      id: 'estimate',
      detected_name: 'Food estimate',
      matched_food: {
        ...DEV_100_FOOD_SEED[0]!,
        id: 'fixture-food',
        source: 'ifct',
        brand: null,
        barcode: null,
        owner_id: null,
        attribution: null,
      } as Food,
      quantity: 100,
      unit: 'g',
      estimated_grams: 100,
      confidence: 0.9,
      is_estimate: true,
      nutrients: { calories: 100, protein: 5, carbs: 15, fat: 3, fiber: 0, sugar: 0, sodium_mg: 0 },
    };
    const entries = await savePhotoCandidatesToDiary(db, {
      userId: 'owner',
      candidates: [candidate, candidate],
      mealSection: 'lunch',
      localDate: '2026-11-02',
    });
    expect(entries).toHaveLength(2);
    expect(server.rpc).toHaveBeenCalledOnce();
    expect(
      (server.rpc.mock.calls[0]![1].p_changes as RemoteWrite[]).filter(
        (change) => change.entity === 'food_entries',
      ),
    ).toHaveLength(2);
  });
  it('rolls back the entire local workout and reports a failed online request', async () => {
    const { db, sql } = database();
    server.error = new Error('Network request failed');
    await expect(
      logWorkoutExercise(db, {
        userId: 'owner',
        localDate: '2026-11-02',
        exerciseName: 'Squat',
        durationMinutes: 20,
        sets: [{ reps: 8, weightKg: 40 }],
      }),
    ).rejects.toThrow('Network request failed');
    for (const table of ['local_workouts', 'local_workout_exercises', 'local_workout_sets'])
      expect(sql.prepare(`SELECT * FROM ${table}`).all()).toEqual([]);
    expect(server.rpc).toHaveBeenCalledOnce();
  });
  it('keeps a failed water save unsaved and never retries it automatically', async () => {
    const { db, sql } = database();
    server.error = new Error('offline');
    await expect(logWater(db, 'owner', 250, '2026-11-02')).rejects.toThrow('offline');
    expect(sql.prepare('SELECT * FROM local_water_logs').all()).toEqual([]);
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(server.rpc).toHaveBeenCalledOnce();
  });
  it('rejects a changed account before any request is sent', async () => {
    const { db } = database();
    server.actor = 'other';
    await expect(logWater(db, 'owner', 250, '2026-11-02')).rejects.toThrow('ACCOUNT_CHANGED');
    expect(server.rpc).not.toHaveBeenCalled();
  });
  it('does not retain unauthenticated logs as local-only successes', async () => {
    const { db, sql } = database();
    await expect(logWater(db, 'guest-user', 250, '2026-11-02')).rejects.toThrow('UNAUTHENTICATED');
    expect(sql.prepare('SELECT * FROM local_water_logs').all()).toEqual([]);
    expect(server.rpc).not.toHaveBeenCalled();
  });
  it('finishes a reset verification before opening the local save transaction', async () => {
    const { db } = database();
    let verified = 0;
    const unregister = registerAccountWriteCheck(async () => {
      await db.withTransactionAsync!(async () => {
        verified++;
      });
      return false;
    });
    try {
      await logWater(db, 'owner', 250, '2026-11-02');
    } finally {
      unregister();
    }
    expect(verified).toBe(1);
    expect(server.rpc).toHaveBeenCalledOnce();
  });
  it('retains a supplied client UUID for an explicit request retry', async () => {
    const { db } = database();
    const change: RemoteWrite = {
      id: 'client-uuid',
      entity: 'water_logs',
      operation: 'upsert',
      payload: { id: 'client-uuid', user_id: 'owner', amount_ml: 250 },
    };
    server.error = new Error('lost acknowledgement');
    await expect(saveRemote(db, change)).rejects.toThrow('lost acknowledgement');
    server.error = null;
    await saveRemote(db, change);
    expect(server.rpc.mock.calls.map((call) => call[1].p_changes[0].id)).toEqual([
      'client-uuid',
      'client-uuid',
    ]);
  });
  it('replaces stale own cache rows with all pages of current server data and preserves another account', async () => {
    const { db, sql } = database();
    const row = (id: string, owner: string) => ({
      id,
      user_id: owner,
      amount_ml: 250,
      local_date: '2026-11-02',
      logged_at: '2026-11-02T12:00:00Z',
      created_at: '2026-11-02T12:00:00Z',
      updated_at: '2026-11-02T12:00:00Z',
      deleted_at: null,
    });
    server.tables.water_logs = [
      row('other-row', 'other'),
      ...Array.from({ length: 501 }, (_, index) => row(`water-${index}`, 'owner')),
    ];
    await db.runAsync(
      "INSERT INTO local_water_logs (id,user_id,amount_ml,logged_at,local_date,created_at,updated_at,sync_state) VALUES ('stale','owner',1,'now','2026-11-02','now','now','synced')",
      [],
    );
    await loadAccountTable(db, 'water_logs', 'owner');
    expect(sql.prepare('SELECT * FROM local_water_logs').all()).toHaveLength(501);
    server.error = new Error('read failed');
    await expect(loadAccountTable(db, 'water_logs', 'owner')).rejects.toThrow('read failed');
    expect(sql.prepare('SELECT * FROM local_water_logs').all()).toHaveLength(501);
    server.error = null;
    server.tables.water_logs = [];
    await loadAccountTable(db, 'water_logs', 'owner');
    expect(sql.prepare('SELECT * FROM local_water_logs').all()).toEqual([]);
  });
});
