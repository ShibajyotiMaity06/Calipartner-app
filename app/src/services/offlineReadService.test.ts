import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ offline: false, owner: 'a', db: undefined as unknown }));
vi.mock('./networkService', () => ({ isDeviceOffline: async () => state.offline }));
vi.mock('@/lib/supabase', () => ({
  AUTH_STORAGE_KEY: 'session',
  sessionStorage: {},
  getSupabase: vi.fn(),
}));
vi.mock('./sessionPersistence', () => ({
  readOfflineSession: async () => ({ user: { id: state.owner } }),
}));
vi.mock('@/db', () => ({ getDb: async () => state.db }));
import { cachedRead } from './offlineReadService';
import { DatabaseSync } from 'node:sqlite';
import type { SupabaseClient } from '@supabase/supabase-js';
let sqlite: DatabaseSync;
const client = {
  auth: { getSession: async () => ({ data: { session: { user: { id: state.owner } } } }) },
} as unknown as SupabaseClient;
beforeEach(() => {
  state.offline = false;
  state.owner = 'a';
  sqlite = new DatabaseSync(':memory:');
  sqlite.exec(
    'CREATE TABLE local_social_cache (id TEXT PRIMARY KEY, owner_id TEXT, cache_key TEXT, payload TEXT, updated_at TEXT)',
  );
  state.db = {
    runAsync: async (sql: string, params: unknown[]) => sqlite.prepare(sql).run(...(params as [])),
    getAllAsync: async (sql: string, params: unknown[]) =>
      sqlite.prepare(sql).all(...(params as [])),
    getFirstAsync: async (sql: string, params: unknown[]) =>
      sqlite.prepare(sql).get(...(params as [])),
  };
});
afterEach(() => sqlite.close());
describe('previously authorized offline reads', () => {
  it('persists an acknowledged projection, reads it offline without a server request, and isolates accounts', async () => {
    const read = vi.fn().mockResolvedValue({ members: [{ name: 'Saved member' }] });
    expect(await cachedRead(client, 'squad:one', read)).toEqual({
      members: [{ name: 'Saved member' }],
    });
    state.offline = true;
    expect(await cachedRead(client, 'squad:one', read)).toEqual({
      members: [{ name: 'Saved member' }],
    });
    expect(read).toHaveBeenCalledOnce();
    state.owner = 'b';
    await expect(cachedRead(client, 'squad:one', read)).rejects.toThrow('NETWORK_UNAVAILABLE');
    state.owner = 'a';
    await expect(cachedRead(client, 'squad:two', read)).rejects.toThrow('NETWORK_UNAVAILABLE');
  });
  it('clears cached access after an online authorization failure instead of falling back', async () => {
    await cachedRead(client, 'squad:one', async () => ({ members: ['former member'] }));
    await expect(
      cachedRead(client, 'squad:one', async () => {
        throw new Error('NOT_A_ROOM_MEMBER');
      }),
    ).rejects.toThrow('NOT_A_ROOM_MEMBER');
    state.offline = true;
    await expect(cachedRead(client, 'squad:one', vi.fn())).rejects.toThrow('NETWORK_UNAVAILABLE');
  });
});

it('removes old room projections when refreshed membership no longer includes that room', async () => {
  await cachedRead(client, 'squad:former', async () => ({ members: ['former room'] }));
  await cachedRead(client, 'rooms', async () => [{ id: 'current' }]);
  state.offline = true;
  await expect(cachedRead(client, 'squad:former', vi.fn())).rejects.toThrow('NETWORK_UNAVAILABLE');
});
