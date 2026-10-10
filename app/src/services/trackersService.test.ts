import { describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import {
  deleteWaterLog,
  editWaterLog,
  getWaterLogsForDate,
  getWaterTotalForDate,
  logWater,
  undoLastWaterLog,
} from './waterService';
import {
  deleteWeightLog,
  editWeightLog,
  getWeightLogs,
  getWeightSummary,
  logWeight,
} from './weightService';
import {
  getActivityDay,
  getActivityMetrics,
  upsertActivityDay,
} from './activityService';
import {
  flushOutbox,
  getPendingOutboxItems,
  pullEntityDelta,
  type SupabaseSyncClient,
  type SyncDb,
} from './syncService';

function createTestDb(): SyncDb {
  const sqlite = new DatabaseSync(':memory:');

  sqlite.exec(`
    CREATE TABLE outbox (
      id TEXT PRIMARY KEY NOT NULL,
      entity TEXT NOT NULL,
      operation TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      next_retry_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE local_water_logs (
      id              TEXT PRIMARY KEY NOT NULL,
      user_id         TEXT NOT NULL,
      amount_ml       INTEGER NOT NULL,
      logged_at       TEXT NOT NULL,
      local_date      TEXT NOT NULL,
      created_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL,
      deleted_at      TEXT,
      sync_state      TEXT NOT NULL DEFAULT 'pending'
    );

    CREATE TABLE local_weight_logs (
      id              TEXT PRIMARY KEY NOT NULL,
      user_id         TEXT NOT NULL,
      weight_kg       REAL NOT NULL,
      logged_at       TEXT NOT NULL,
      local_date      TEXT NOT NULL,
      notes           TEXT,
      created_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL,
      deleted_at      TEXT,
      sync_state      TEXT NOT NULL DEFAULT 'pending'
    );

    CREATE TABLE local_activity_days (
      id              TEXT PRIMARY KEY NOT NULL,
      user_id         TEXT NOT NULL,
      local_date      TEXT NOT NULL,
      steps           INTEGER NOT NULL DEFAULT 0,
      distance_m      REAL NOT NULL DEFAULT 0,
      source          TEXT NOT NULL,
      active_calories INTEGER DEFAULT 0,
      created_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL,
      deleted_at      TEXT,
      sync_state      TEXT NOT NULL DEFAULT 'pending',
      UNIQUE (user_id, local_date)
    );

    CREATE TABLE sync_cursors (
      entity          TEXT PRIMARY KEY NOT NULL,
      last_pulled_at  TEXT NOT NULL
    );
  `);

  return {
    async runAsync(sql: string, ...params: unknown[]) {
      const flat = Array.isArray(params[0]) ? params[0] : params;
      const stmt = sqlite.prepare(sql);
      const res = stmt.run(...flat);
      return { changes: res.changes, lastInsertRowId: res.lastInsertRowid };
    },
    async getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]> {
      const flat = Array.isArray(params[0]) ? params[0] : params;
      const stmt = sqlite.prepare(sql);
      return stmt.all(...flat) as T[];
    },
    async getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null> {
      const flat = Array.isArray(params[0]) ? params[0] : params;
      const stmt = sqlite.prepare(sql);
      const rows = stmt.all(...flat);
      return (rows[0] as T) || null;
    },
  };
}

interface MockRemoteStores {
  water_logs: Array<Record<string, unknown>>;
  weight_logs: Array<Record<string, unknown>>;
  activity_days: Array<Record<string, unknown>>;
  [key: string]: Array<Record<string, unknown>>;
}

function createMockSupabase(): {
  client: SupabaseSyncClient;
  remoteStores: MockRemoteStores;
} {
  const remoteStores: MockRemoteStores = {
    water_logs: [],
    weight_logs: [],
    activity_days: [],
  };

  const client: SupabaseSyncClient = {
    from(table: string) {
      if (!remoteStores[table]) {
        remoteStores[table] = [];
      }
      const store = remoteStores[table]!;

      return {
        async upsert(values: Record<string, unknown> | Array<Record<string, unknown>>) {
          const list = Array.isArray(values) ? values : [values];
          for (const item of list) {
            let idx = -1;
            if (table === 'activity_days') {
              idx = store.findIndex(
                (r) => r.user_id === item.user_id && r.local_date === item.local_date,
              );
            } else {
              idx = store.findIndex((r) => r.id === item.id);
            }
            if (idx >= 0) {
              store[idx] = { ...store[idx], ...item };
            } else {
              store.push({ ...item });
            }
          }
          return { error: null, data: values };
        },
        update(values: Record<string, unknown>) {
          return {
            async eq(col: string, val: unknown) {
              const item = store.find((r) => r[col] === val);
              if (item) {
                Object.assign(item, values);
              }
              return { error: null };
            },
          };
        },
        select() {
          return {
            gt() {
              return {
                async order() {
                  return { error: null, data: [...store] };
                },
              };
            },
            async order() {
              return { error: null, data: [...store] };
            },
          };
        },
      };
    },
  };

  return { client, remoteStores };
}

describe('Phase 4 Trackers - Water Service & Offline Sync', () => {
  it('logs water, calculates daily totals, and queues outbox', async () => {
    const db = createTestDb();

    // Log 250ml glass and 500ml bottle
    await logWater(db, 'user-1', 250, '2026-10-10');
    await logWater(db, 'user-1', 500, '2026-10-10');

    const total = await getWaterTotalForDate(db, 'user-1', '2026-10-10');
    expect(total).toBe(750);

    const logs = await getWaterLogsForDate(db, 'user-1', '2026-10-10');
    expect(logs).toHaveLength(2);

    const outbox = await getPendingOutboxItems(db);
    expect(outbox).toHaveLength(2);
    expect(outbox[0]!.entity).toBe('water_logs');
  });

  it('undoes the last water log correctly', async () => {
    const db = createTestDb();

    await logWater(db, 'user-1', 250, '2026-10-10');
    await logWater(db, 'user-1', 500, '2026-10-10');

    // Undo last (500ml)
    const undone = await undoLastWaterLog(db, 'user-1', '2026-10-10');
    expect(undone).not.toBeNull();
    expect(undone?.amount_ml).toBe(500);

    const total = await getWaterTotalForDate(db, 'user-1', '2026-10-10');
    expect(total).toBe(250);
  });

  it('edits and soft deletes water entries', async () => {
    const db = createTestDb();

    const entry = await logWater(db, 'user-1', 250, '2026-10-10');
    const edited = await editWaterLog(db, 'user-1', entry.id, 300);
    expect(edited?.amount_ml).toBe(300);

    const totalAfterEdit = await getWaterTotalForDate(db, 'user-1', '2026-10-10');
    expect(totalAfterEdit).toBe(300);

    await deleteWaterLog(db, 'user-1', entry.id);
    const totalAfterDelete = await getWaterTotalForDate(db, 'user-1', '2026-10-10');
    expect(totalAfterDelete).toBe(0);
  });
});

describe('Phase 4 Trackers - Weight Service & Derived Trends', () => {
  it('logs weights and computes 7-day moving average and weekly pace', async () => {
    const db = createTestDb();

    // 3 logs in 7 days to trigger moving average
    await logWeight(db, 'user-1', 82.0, '2026-10-01');
    await logWeight(db, 'user-1', 81.5, '2026-10-08');
    await logWeight(db, 'user-1', 81.0, '2026-10-15');

    const summary = await getWeightSummary(db, 'user-1', {
      startingWeightKg: 85.0,
      targetWeightKg: 75.0,
    });

    expect(summary.latestLog?.weight_kg).toBe(81.0);
    expect(summary.latestTrendKg).toBe(81.0);
    expect(summary.weeklyPace.weeklyPaceKg).toBe(-0.5); // (81.0 - 82.0) / 2
    expect(summary.projection.reason).toBe('on_track');
    expect(summary.projection.weeksRemaining).toBe(12); // (75 - 81) / -0.5 = 12 weeks
    // Goal progress: (85 - 81) / (85 - 75) = 4/10 = 40%
    expect(summary.goalProgressPercent).toBe(40);
  });

  it('allows back-dating, editing, and deleting weight entries', async () => {
    const db = createTestDb();

    const logged = await logWeight(db, 'user-1', 80.0, '2026-10-05', undefined, 'Morning weigh-in');
    expect(logged.local_date).toBe('2026-10-05');

    const edited = await editWeightLog(db, 'user-1', logged.id, 79.8, 'Corrected');
    expect(edited?.weight_kg).toBe(79.8);
    expect(edited?.notes).toBe('Corrected');

    await deleteWeightLog(db, 'user-1', logged.id);
    const logs = await getWeightLogs(db, 'user-1');
    expect(logs).toHaveLength(0);
  });
});

describe('Phase 4 Trackers - Activity Days & Source Priority Deduplication', () => {
  it('enforces source priority: health_platform > pedometer > manual', async () => {
    const db = createTestDb();

    // 1. Manual entry first (3000 steps)
    await upsertActivityDay(db, 'user-1', {
      localDate: '2026-10-10',
      steps: 3000,
      distanceM: 2100,
      source: 'manual',
    });

    let act = await getActivityDay(db, 'user-1', '2026-10-10');
    expect(act?.steps).toBe(3000);
    expect(act?.source).toBe('manual');

    // 2. Phone pedometer reading comes in (5500 steps) -> beats manual!
    await upsertActivityDay(db, 'user-1', {
      localDate: '2026-10-10',
      steps: 5500,
      distanceM: 3850,
      source: 'pedometer',
    });

    act = await getActivityDay(db, 'user-1', '2026-10-10');
    expect(act?.steps).toBe(5500);
    expect(act?.source).toBe('pedometer');

    // 3. Health Connect / HealthKit platform syncs (8500 steps) -> beats pedometer!
    await upsertActivityDay(db, 'user-1', {
      localDate: '2026-10-10',
      steps: 8500,
      distanceM: 6200,
      source: 'health_platform',
    });

    act = await getActivityDay(db, 'user-1', '2026-10-10');
    expect(act?.steps).toBe(8500);
    expect(act?.distance_m).toBe(6200);
    expect(act?.source).toBe('health_platform');

    // 4. Lower priority pedometer reading arrives later (e.g. 6000 steps) -> MUST NOT OVERWRITE health_platform!
    await upsertActivityDay(db, 'user-1', {
      localDate: '2026-10-10',
      steps: 6000,
      source: 'pedometer',
    });

    act = await getActivityDay(db, 'user-1', '2026-10-10');
    expect(act?.steps).toBe(8500);
    expect(act?.source).toBe('health_platform');
  });

  it('ensures platform-measured distance beats calculated distance', async () => {
    const db = createTestDb();

    // 10,000 steps with platform measured 8.2km (8200m) vs calculated (~7.5km)
    await upsertActivityDay(db, 'user-1', {
      localDate: '2026-10-10',
      steps: 10000,
      distanceM: 8200,
      source: 'health_platform',
      strideLengthCm: 75,
    });

    const act = await getActivityDay(db, 'user-1', '2026-10-10');
    expect(act?.distance_m).toBe(8200);

    const metrics = getActivityMetrics(act, 70, 75);
    expect(metrics.distanceKm).toBe(8.2);
    // 0.5 * 70kg * 8.2km = 287 kcal
    expect(metrics.walkingCalories).toBe(287);
  });

  it('handles date boundary / midnight transitions cleanly', async () => {
    const db = createTestDb();

    // Oct 10 and Oct 11 records are completely isolated
    await upsertActivityDay(db, 'user-1', {
      localDate: '2026-10-10',
      steps: 9000,
      source: 'health_platform',
    });

    await upsertActivityDay(db, 'user-1', {
      localDate: '2026-10-11',
      steps: 2500,
      source: 'pedometer',
    });

    const oct10 = await getActivityDay(db, 'user-1', '2026-10-10');
    const oct11 = await getActivityDay(db, 'user-1', '2026-10-11');

    expect(oct10?.steps).toBe(9000);
    expect(oct11?.steps).toBe(2500);
  });
});

describe('Phase 4 Trackers - Offline Sync Across All Three Trackers', () => {
  it('flushes water, weight, and activity logs from outbox to remote Supabase', async () => {
    const db = createTestDb();
    const { client, remoteStores } = createMockSupabase();

    // 1. Create offline entries across all 3 trackers
    await logWater(db, 'user-1', 500, '2026-10-10');
    await logWeight(db, 'user-1', 78.5, '2026-10-10');
    await upsertActivityDay(db, 'user-1', {
      localDate: '2026-10-10',
      steps: 10500,
      distanceM: 7800,
      source: 'health_platform',
    });

    const pending = await getPendingOutboxItems(db);
    expect(pending).toHaveLength(3);

    // 2. Flush outbox
    const flushRes = await flushOutbox(db, client);
    expect(flushRes.processed).toBe(3);
    expect(flushRes.succeeded).toBe(3);
    expect(flushRes.failed).toBe(0);

    // 3. Verify remote stores received the rows
    expect(remoteStores.water_logs).toHaveLength(1);
    expect(remoteStores.water_logs[0]!.amount_ml).toBe(500);

    expect(remoteStores.weight_logs).toHaveLength(1);
    expect(remoteStores.weight_logs[0]!.weight_kg).toBe(78.5);

    expect(remoteStores.activity_days).toHaveLength(1);
    expect(remoteStores.activity_days[0]!.steps).toBe(10500);

    // 4. Outbox is now empty
    const remainingOutbox = await getPendingOutboxItems(db);
    expect(remainingOutbox).toHaveLength(0);
  });

  it('pulls remote deltas into local SQLite mirror tables', async () => {
    const db = createTestDb();
    const { client, remoteStores } = createMockSupabase();

    // Seed remote Supabase with entries created on another device
    const now = new Date().toISOString();
    remoteStores.water_logs.push({
      id: 'remote-w-1',
      user_id: 'user-1',
      amount_ml: 750,
      logged_at: now,
      local_date: '2026-10-10',
      created_at: now,
      updated_at: now,
      deleted_at: null,
    });

    remoteStores.weight_logs.push({
      id: 'remote-wt-1',
      user_id: 'user-1',
      weight_kg: 77.9,
      logged_at: now,
      local_date: '2026-10-10',
      notes: 'Pulled from remote',
      created_at: now,
      updated_at: now,
      deleted_at: null,
    });

    remoteStores.activity_days.push({
      id: 'remote-act-1',
      user_id: 'user-1',
      local_date: '2026-10-10',
      steps: 12000,
      distance_m: 9000,
      source: 'health_platform',
      active_calories: 320,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    });

    // Pull deltas
    const pullWater = await pullEntityDelta(db, client, 'water_logs');
    expect(pullWater.pulledCount).toBe(1);

    const pullWeight = await pullEntityDelta(db, client, 'weight_logs');
    expect(pullWeight.pulledCount).toBe(1);

    const pullActivity = await pullEntityDelta(db, client, 'activity_days');
    expect(pullActivity.pulledCount).toBe(1);

    // Verify local SQLite mirror tables received the pulled rows
    const localWater = await getWaterLogsForDate(db, 'user-1', '2026-10-10');
    expect(localWater).toHaveLength(1);
    expect(localWater[0]!.amount_ml).toBe(750);

    const localWeight = await getWeightLogs(db, 'user-1');
    expect(localWeight).toHaveLength(1);
    expect(localWeight[0]!.weight_kg).toBe(77.9);

    const localAct = await getActivityDay(db, 'user-1', '2026-10-10');
    expect(localAct?.steps).toBe(12000);
    expect(localAct?.source).toBe('health_platform');
  });
});
