import { describe, expect, it, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import {
  calculateBackoffMs,
  enqueueOutbox,
  flushOutbox,
  getPendingOutboxItems,
  getSyncCursor,
  pullEntityDelta,
  recoverInFlightOutbox,
  setSyncCursor,
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

    CREATE TABLE local_food_entries (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      food_id TEXT,
      meal_section TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      calories REAL NOT NULL,
      protein REAL NOT NULL,
      carbs REAL NOT NULL,
      fat REAL NOT NULL,
      fiber REAL NOT NULL DEFAULT 0,
      sugar REAL NOT NULL DEFAULT 0,
      sodium_mg REAL NOT NULL DEFAULT 0,
      food_name TEXT NOT NULL,
      brand_name TEXT,
      logged_at TEXT NOT NULL,
      local_date TEXT NOT NULL,
      source TEXT NOT NULL,
      shared_meal_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      sync_state TEXT NOT NULL DEFAULT 'pending'
    );

    CREATE TABLE local_user_food_stats (
      user_id TEXT NOT NULL,
      food_id TEXT NOT NULL,
      use_count INTEGER NOT NULL DEFAULT 1,
      last_used_at TEXT NOT NULL,
      last_quantity REAL NOT NULL,
      last_unit TEXT NOT NULL,
      last_meal_section TEXT NOT NULL,
      hidden INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      sync_state TEXT NOT NULL DEFAULT 'pending',
      PRIMARY KEY (user_id, food_id)
    );

    CREATE TABLE local_foods (
      id TEXT PRIMARY KEY NOT NULL,
      source TEXT NOT NULL,
      name TEXT NOT NULL,
      brand TEXT,
      barcode TEXT,
      serving_units TEXT NOT NULL,
      calories_per_100g REAL NOT NULL,
      protein_per_100g REAL NOT NULL,
      carbs_per_100g REAL NOT NULL,
      fat_per_100g REAL NOT NULL,
      fiber_per_100g REAL NOT NULL DEFAULT 0,
      sugar_per_100g REAL NOT NULL DEFAULT 0,
      sodium_mg_per_100g REAL NOT NULL DEFAULT 0,
      owner_id TEXT,
      attribution TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      sync_state TEXT NOT NULL DEFAULT 'synced'
    );

    CREATE TABLE sync_cursors (
      entity TEXT PRIMARY KEY NOT NULL,
      last_pulled_at TEXT NOT NULL
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

describe('Offline-First Sync Layer', () => {
  it('calculates exponential backoff delay correctly', () => {
    expect(calculateBackoffMs(0)).toBe(1000);
    expect(calculateBackoffMs(1)).toBe(2000);
    expect(calculateBackoffMs(2)).toBe(4000);
    expect(calculateBackoffMs(3)).toBe(8000);
    expect(calculateBackoffMs(10)).toBe(60000); // capped at max 60s
  });

  it('enqueues item into outbox and retrieves pending items', async () => {
    const db = createTestDb();

    await enqueueOutbox(db, {
      id: 'entry-1',
      entity: 'food_entries',
      operation: 'upsert',
      payload: { id: 'entry-1', calories: 250 },
    });

    const pending = await getPendingOutboxItems(db);
    expect(pending).toHaveLength(1);
    expect(pending[0]!.id).toBe('entry-1');
    expect(pending[0]!.status).toBe('pending');
    expect(pending[0]!.payload).toEqual({ id: 'entry-1', calories: 250 });
  });

  it('handles offline -> online: enqueues offline, flushes when online', async () => {
    const db = createTestDb();

    // 1. User logs offline
    await db.runAsync(
      `INSERT INTO local_food_entries (
        id, user_id, food_id, meal_section, quantity, unit,
        calories, protein, carbs, fat, food_name, logged_at,
        local_date, source, created_at, updated_at, sync_state
      ) VALUES (?, 'u1', 'f1', 'breakfast', 1, 'bowl', 200, 10, 30, 5, 'Oats', '2026-10-08T08:00:00Z', '2026-10-08', 'search', '2026-10-08T08:00:00Z', '2026-10-08T08:00:00Z', 'pending')`,
      ['entry-offline-1'],
    );

    await enqueueOutbox(db, {
      id: 'entry-offline-1',
      entity: 'food_entries',
      operation: 'upsert',
      payload: { id: 'entry-offline-1', user_id: 'u1', calories: 200 },
    });

    // Verify outbox has 1 pending item and local entry is pending
    const beforeSync = await getPendingOutboxItems(db);
    expect(beforeSync).toHaveLength(1);

    // 2. Network reconnects; flush to Supabase
    const upserted: unknown[] = [];
    const mockSupabase: SupabaseSyncClient = {
      from: vi.fn().mockImplementation((_table: string) => ({
        upsert: vi.fn().mockImplementation(async (val: unknown) => {
          upserted.push(val);
          return { error: null };
        }),
        update: vi.fn().mockResolvedValue({ error: null }),
        select: vi.fn(),
      })),
    };

    const res = await flushOutbox(db, mockSupabase);
    expect(res.processed).toBe(1);
    expect(res.succeeded).toBe(1);
    expect(res.failed).toBe(0);
    expect(upserted).toHaveLength(1);

    // Verify outbox is empty and local entry is marked synced
    const afterSync = await getPendingOutboxItems(db);
    expect(afterSync).toHaveLength(0);

    const localEntry = await db.getFirstAsync<{ sync_state: string }>(
      `SELECT sync_state FROM local_food_entries WHERE id = 'entry-offline-1'`,
    );
    expect(localEntry?.sync_state).toBe('synced');
  });

  it('survives app kill mid-sync: recovers stuck in_flight items to pending', async () => {
    const db = createTestDb();

    // Insert an item that was marked in_flight before the app was killed
    await db.runAsync(
      `INSERT INTO outbox (id, entity, operation, payload, created_at, attempts, last_error, status)
       VALUES ('entry-killed', 'food_entries', 'upsert', '{"id":"entry-killed"}', '2026-10-08T08:00:00Z', 1, NULL, 'in_flight')`,
    );

    const recovered = await recoverInFlightOutbox(db);
    expect(recovered).toBe(1);

    const pending = await getPendingOutboxItems(db);
    expect(pending).toHaveLength(1);
    expect(pending[0]!.id).toBe('entry-killed');
    expect(pending[0]!.status).toBe('pending');
  });

  it('guarantees idempotency on duplicate requests with same client UUID', async () => {
    const db = createTestDb();

    // Enqueue twice with same ID
    await enqueueOutbox(db, {
      id: 'uuid-duplicate',
      entity: 'food_entries',
      operation: 'upsert',
      payload: { id: 'uuid-duplicate', count: 1 },
    });

    await enqueueOutbox(db, {
      id: 'uuid-duplicate',
      entity: 'food_entries',
      operation: 'upsert',
      payload: { id: 'uuid-duplicate', count: 2 },
    });

    const pending = await getPendingOutboxItems(db);
    expect(pending).toHaveLength(1);
    expect(pending[0]!.payload).toEqual({ id: 'uuid-duplicate', count: 2 });
  });

  it('applies last-write-wins using updated_at when pulling remote deltas', async () => {
    const db = createTestDb();

    // Local entry with older timestamp
    await db.runAsync(
      `INSERT INTO local_food_entries (
        id, user_id, meal_section, quantity, unit, calories, protein, carbs, fat,
        food_name, logged_at, local_date, source, created_at, updated_at, sync_state
      ) VALUES ('entry-lww', 'u1', 'lunch', 1, 'plate', 300, 10, 40, 8, 'Rice', '2026-10-08T12:00:00Z', '2026-10-08', 'search', '2026-10-08T12:00:00Z', '2026-10-08T12:00:00Z', 'synced')`,
    );

    // Remote has newer update (edited on another device)
    const remoteData = [
      {
        id: 'entry-lww',
        user_id: 'u1',
        meal_section: 'lunch',
        quantity: 2, // edited to 2 plates
        unit: 'plate',
        calories: 600,
        protein: 20,
        carbs: 80,
        fat: 16,
        fiber: 2,
        sugar: 1,
        sodium_mg: 50,
        food_name: 'Rice',
        logged_at: '2026-10-08T12:00:00Z',
        local_date: '2026-10-08',
        source: 'search',
        updated_at: '2026-10-08T12:30:00Z', // newer!
      },
    ];

    const mockSupabase: SupabaseSyncClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ error: null, data: remoteData }),
          gt: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ error: null, data: remoteData }),
          }),
        }),
      }),
    };

    const pullRes = await pullEntityDelta(db, mockSupabase, 'food_entries');
    expect(pullRes.pulledCount).toBe(1);

    const updatedLocal = await db.getFirstAsync<{ quantity: number; calories: number; updated_at: string }>(
      `SELECT quantity, calories, updated_at FROM local_food_entries WHERE id = 'entry-lww'`,
    );
    expect(updatedLocal?.quantity).toBe(2);
    expect(updatedLocal?.calories).toBe(600);
    expect(updatedLocal?.updated_at).toBe('2026-10-08T12:30:00Z');
  });

  it('manages sync cursor correctly', async () => {
    const db = createTestDb();

    expect(await getSyncCursor(db, 'food_entries')).toBeNull();

    await setSyncCursor(db, 'food_entries', '2026-10-08T15:00:00Z');
    expect(await getSyncCursor(db, 'food_entries')).toBe('2026-10-08T15:00:00Z');

    await setSyncCursor(db, 'food_entries', '2026-10-08T16:00:00Z');
    expect(await getSyncCursor(db, 'food_entries')).toBe('2026-10-08T16:00:00Z');
  });
});
