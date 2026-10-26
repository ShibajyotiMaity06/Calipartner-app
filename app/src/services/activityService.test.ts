import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { getActivityDay, upsertActivityDay } from './activityService';
import { getPendingOutboxItems, type SyncDb } from './syncService';
function database(): SyncDb {
  const sql = new DatabaseSync(':memory:');
  sql.exec(`CREATE TABLE local_activity_days(id TEXT PRIMARY KEY, user_id TEXT, local_date TEXT, steps INTEGER, distance_m REAL, source TEXT, active_calories REAL, created_at TEXT, updated_at TEXT, deleted_at TEXT, sync_state TEXT, UNIQUE(user_id,local_date));
    CREATE TABLE outbox(id TEXT PRIMARY KEY, entity TEXT, operation TEXT, payload TEXT, created_at TEXT, attempts INTEGER DEFAULT 0, last_error TEXT, status TEXT DEFAULT 'pending', next_retry_at TEXT, updated_at TEXT);`);
  return {
    runAsync: async (query, ...values) =>
      sql.prepare(query).run(...(values.flat() as (string | number | null)[])),
    getFirstAsync: async <T>(query: string, ...values: unknown[]) =>
      (sql.prepare(query).get(...(values.flat() as (string | number | null)[])) as T | undefined) ??
      null,
    getAllAsync: async <T>(query: string, ...values: unknown[]) =>
      sql.prepare(query).all(...(values.flat() as (string | number | null)[])) as T[],
  };
}
describe('daily steps remain idempotent offline', () => {
  it('concurrent screen refreshes preserve one activity UUID and one outbox entry', async () => {
    const db = database();
    const input = {
      localDate: '2026-10-26',
      steps: 6099,
      distanceM: 4567,
      source: 'health_platform' as const,
    };
    const [first, second] = await Promise.all([
      upsertActivityDay(db, 'owner', input),
      upsertActivityDay(db, 'owner', input),
    ]);
    expect(first.id).toBe(second.id);
    expect((await getActivityDay(db, 'owner', input.localDate))?.steps).toBe(6099);
    const pending = await getPendingOutboxItems(db);
    expect(pending).toHaveLength(1);
    expect(pending[0]!.payload.id).toBe(first.id);
  });
  it('replaces a corrected health snapshot and never adds a manual or walking total on top', async () => {
    const db = database();
    const base = { localDate: '2026-10-26', source: 'health_platform' as const, distanceM: 5000 };
    await upsertActivityDay(db, 'owner', { ...base, steps: 8500 });
    await upsertActivityDay(db, 'owner', { ...base, steps: 6099, distanceM: 4567 });
    await upsertActivityDay(db, 'owner', { ...base, source: 'pedometer', steps: 2000 });
    expect((await getActivityDay(db, 'owner', base.localDate))?.steps).toBe(6099);
  });
});
