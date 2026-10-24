import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
vi.mock('expo-sqlite', () => ({}));
vi.mock('@/lib/secureStore', () => ({ secureStoreAdapter: {} }));
import { createWebDb, clearTrackingDataForReset } from '@/db';
import { ACCOUNT_RESET_RECEIPT, applyAccountDataReset } from './accountDataReset';

const marker = { epoch: 'fresh-start-v1', reset_at: '2026-10-23T00:00:00Z' };
function setup(value: unknown = marker, error: { message: string } | null = null) {
  const data = new Map<string, string>([['auth-token', 'persistent-session']]);
  const storage = {
    getItem: async (key: string) => data.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      data.set(key, value);
    },
  };
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: async () => ({ data: value ? { value } : null, error }),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return { storage, data, client: { from: () => query } as unknown as SupabaseClient };
}

describe('one-time fresh start', () => {
  it('clears stale tracking exactly once, preserves login, and retains new values afterward', async () => {
    const { storage, data, client } = setup();
    const clear = vi.fn(async () => {
      data.delete('old-targets');
    });
    data.set('old-targets', 'legacy values');
    expect(await applyAccountDataReset(client, clear, storage)).toBe(true);
    data.set('new-targets', 'saved custom macros');
    expect(await applyAccountDataReset(client, clear, storage)).toBe(false);
    expect(clear).toHaveBeenCalledTimes(1);
    expect(data.get('auth-token')).toBe('persistent-session');
    expect(data.get('new-targets')).toBe('saved custom macros');
  });

  it('does not acknowledge an incomplete reset, so restart retries safely', async () => {
    const { storage, data, client } = setup();
    await expect(
      applyAccountDataReset(
        client,
        async () => {
          throw new Error('Disk full');
        },
        storage,
      ),
    ).rejects.toThrow('Disk full');
    expect(data.has(ACCOUNT_RESET_RECEIPT)).toBe(false);
  });

  it('does not delete data on network failure or an invalid marker', async () => {
    const clear = vi.fn();
    const offline = setup(null, { message: 'Offline' });
    await expect(applyAccountDataReset(offline.client, clear, offline.storage)).rejects.toThrow(
      'Offline',
    );
    const invalid = setup({ epoch: 'v1' });
    await expect(applyAccountDataReset(invalid.client, clear, invalid.storage)).rejects.toThrow(
      'Invalid account reset marker',
    );
    expect(clear).not.toHaveBeenCalled();
  });

  it('does not reset accounts when no administrative operation is scheduled', async () => {
    const { storage, client } = setup(null);
    const clear = vi.fn();
    expect(await applyAccountDataReset(client, clear, storage)).toBe(false);
    expect(clear).not.toHaveBeenCalled();
  });
});

beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('discarding stale offline queues', () => {
  it('clears browser queues, aliases and tracking before they can resurrect after restart', async () => {
    localStorage.setItem(
      'calipartner_web_db',
      JSON.stringify({
        local_goal_profiles: [{ id: 'old-goal' }],
        goal_profiles: [{ id: 'old-alias' }],
        local_activity_days: [{ steps: 9999 }],
        outbox: [{ id: 'queued-old-data' }],
      }),
    );
    await clearTrackingDataForReset(createWebDb());
    const restarted = createWebDb();
    expect(await restarted.getAllAsync('SELECT * FROM outbox')).toEqual([]);
    expect(await restarted.getFirstAsync('SELECT * FROM local_goal_profiles')).toBeNull();
    expect(JSON.parse(localStorage.getItem('calipartner_web_db')!).local_activity_days).toEqual([]);
  });

  it('clears native tracking tables transactionally, retaining unrelated metadata', async () => {
    const sql = new DatabaseSync(':memory:');
    sql.exec(
      "CREATE TABLE local_goal_profiles(id TEXT); INSERT INTO local_goal_profiles VALUES ('old'); CREATE TABLE outbox(id TEXT); INSERT INTO outbox VALUES ('queued'); CREATE TABLE sync_cursors(id TEXT); INSERT INTO sync_cursors VALUES ('cursor'); CREATE TABLE schema_metadata(version INTEGER); INSERT INTO schema_metadata VALUES (17)",
    );
    const db = {
      async getAllAsync(query: string) {
        return sql.prepare(query).all();
      },
      async runAsync(query: string, ...params: SQLInputValue[]) {
        return sql.prepare(query).run(...params);
      },
      async withTransactionAsync(action: () => Promise<void>) {
        sql.exec('BEGIN');
        try {
          await action();
          sql.exec('COMMIT');
        } catch (error) {
          sql.exec('ROLLBACK');
          throw error;
        }
      },
    } as unknown as SQLiteDatabase;
    await clearTrackingDataForReset(db);
    expect(sql.prepare('SELECT * FROM local_goal_profiles').all()).toEqual([]);
    expect(sql.prepare('SELECT * FROM outbox').all()).toEqual([]);
    expect(sql.prepare('SELECT * FROM sync_cursors').all()).toEqual([]);
    expect(sql.prepare('SELECT version FROM schema_metadata').get()?.version).toBe(17);
    sql.close();
  });
});
