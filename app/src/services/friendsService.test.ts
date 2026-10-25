import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FriendInbox, SocialProfile } from '@calipartner/core';
vi.mock('expo-sqlite', () => ({}));
import { createWebDb } from '@/db';
import { migrations } from '@/db/migrations';
import {
  dismissSocialFailure,
  flushSocialOutbox,
  loadFriendInbox,
  loadSocialProfile,
  queueFriendAction,
  queueFriendRequest,
  queueSocialBlock,
  queueSocialReport,
  readSocialCache,
  saveSocialProfile,
  searchSocialProfiles,
  socialOutbox,
  type SocialClient,
  type SocialDb,
} from './friendsService';

const connections: DatabaseSync[] = [];
function nativeDb(): SocialDb {
  const sql = new DatabaseSync(':memory:');
  connections.push(sql);
  sql.exec(migrations.find((migration) => migration.version === 13)!.sql);
  const params = (args: unknown[]) => (Array.isArray(args[0]) ? args[0] : args) as SQLInputValue[];
  return {
    async runAsync(query, ...args) {
      return sql.prepare(query).run(...params(args));
    },
    async getAllAsync<T>(query: string, ...args: unknown[]) {
      return sql.prepare(query).all(...params(args)) as T[];
    },
    async getFirstAsync<T>(query: string, ...args: unknown[]) {
      return (sql.prepare(query).get(...params(args)) ?? null) as T | null;
    },
    async withTransactionAsync(work) {
      sql.exec('BEGIN');
      try {
        await work();
        sql.exec('COMMIT');
      } catch (error) {
        sql.exec('ROLLBACK');
        throw error;
      }
    },
  };
}
const self: SocialProfile = {
  id: 'account-a',
  username: 'ari',
  nickname: 'Ari',
  avatar_url: null,
  bio: '',
  training_style: '',
  instagram_handle: '',
  website_url: '',
  is_public: false,
  relationship: 'self',
  request_id: null,
};
const friend: SocialProfile = {
  ...self,
  id: 'account-b',
  username: 'bea',
  nickname: 'Bea',
  bio: 'Shared bio',
  is_public: true,
  relationship: 'none',
};
const inbox: FriendInbox = {
  incoming: [friend],
  outgoing: [],
  friends: [],
  quota: { premium: false, sent: 0, remaining: 3, resets_at: null },
};
function remote(owner = 'account-a', data: unknown = null) {
  const rpc = vi.fn<SocialClient['rpc']>(async () => ({ data, error: null }));
  const getUser = vi.fn(async () => ({ data: { user: { id: owner } } }));
  return { client: { auth: { getUser }, rpc } satisfies SocialClient, rpc, getUser };
}
beforeEach(() => {
  const storage = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
});
afterEach(() => {
  connections.splice(0).forEach((sql) => sql.close());
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe.each(['native SQLite', 'browser persistence'])('friends offline: %s', (platform) => {
  const open = (): SocialDb => (platform === 'native SQLite' ? nativeDb() : createWebDb());
  it('persists the profile and only the latest edit before network access, scoped to its owner', async () => {
    let db = open();
    await saveSocialProfile(db, self.id, self, {
      ...self,
      bio: 'First edit',
      website_url: 'https://example.com',
    });
    const first = (await readSocialCache<SocialProfile>(db, self.id, `profile:${self.id}`))!;
    await saveSocialProfile(db, self.id, first, { ...first, bio: 'Latest edit', is_public: true });
    if (platform === 'browser persistence') db = open();
    const queued = await socialOutbox(db, self.id);
    expect(queued).toHaveLength(1);
    expect(JSON.parse(queued[0]!.payload)).toMatchObject({
      p_actor_id: self.id,
      p_bio: 'Latest edit',
      p_is_public: true,
      p_website_url: 'https://example.com/',
    });
    const stored = (await readSocialCache<SocialProfile>(db, self.id, `profile:${self.id}`))!;
    expect(stored.bio).toBe('Latest edit');
    expect(Date.parse(stored.edited_at!)).toBeGreaterThan(Date.parse(first.edited_at!));
    expect(await socialOutbox(db, friend.id)).toHaveLength(0);
    expect(await readSocialCache(db, friend.id, `profile:${self.id}`)).toBeNull();
    const { client, rpc } = remote(self.id, { ...self, bio: 'Older server value' });
    expect((await loadSocialProfile(db, client, self.id, self.id, true)).data.bio).toBe(
      'Latest edit',
    );
    expect(rpc).not.toHaveBeenCalled();
  });
  it('rolls back the local profile when the durable queue cannot be saved', async () => {
    const db = open();
    const run = db.runAsync.bind(db);
    vi.spyOn(db, 'runAsync').mockImplementation(async (query, ...args) => {
      if (query.startsWith('INSERT INTO local_social_cache'))
        throw new Error('Storage unavailable');
      return run(query, ...args);
    });
    await expect(
      saveSocialProfile(db, self.id, self, { ...self, bio: 'Not saved' }),
    ).rejects.toThrow('Storage unavailable');
    expect(await socialOutbox(db, self.id)).toHaveLength(0);
    expect(await readSocialCache(db, self.id, `profile:${self.id}`)).toBeNull();
  });
  it('keeps an identical request UUID after a lost acknowledgement and never flushes another account', async () => {
    let db = open();
    const request = await queueFriendRequest(db, self.id, friend.id);
    await queueFriendRequest(db, 'account-c', 'account-d');
    if (platform === 'browser persistence') db = open();
    const { client, rpc } = remote();
    rpc.mockRejectedValueOnce(new Error('Connection lost after server commit'));
    await flushSocialOutbox(db, client, self.id);
    expect((await socialOutbox(db, self.id))[0]).toMatchObject({ id: request, status: 'pending' });
    await flushSocialOutbox(db, client, self.id);
    expect(rpc.mock.calls).toHaveLength(2);
    expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1]);
    expect(rpc.mock.calls[0]).toEqual([
      'send_friend_request',
      { p_request_id: request, p_recipient_id: friend.id, p_actor_id: self.id },
    ]);
    expect(await socialOutbox(db, self.id)).toHaveLength(0);
    expect(await socialOutbox(db, 'account-c')).toHaveLength(1);
  });
  it('does not upload queued actions when authentication belongs to another account', async () => {
    const db = open();
    await queueFriendRequest(db, self.id, friend.id);
    const { client, rpc, getUser } = remote(friend.id);
    await flushSocialOutbox(db, client, self.id);
    expect(rpc).not.toHaveBeenCalled();
    expect((await socialOutbox(db, self.id))[0]?.status).toBe('pending');
    getUser.mockRejectedValueOnce(new Error('Offline authentication lookup'));
    await expect(flushSocialOutbox(db, client, self.id)).resolves.toBeUndefined();
    expect(rpc).not.toHaveBeenCalled();
    expect((await socialOutbox(db, self.id))[0]?.status).toBe('pending');
  });
  it('keeps server quota failures visible without retrying or letting another owner dismiss them', async () => {
    const db = open();
    const id = await queueFriendRequest(db, self.id, friend.id);
    const { client, rpc } = remote();
    rpc.mockResolvedValue({ data: null, error: { message: 'FRIEND_WEEKLY_LIMIT' } });
    await flushSocialOutbox(db, client, self.id);
    expect((await socialOutbox(db, self.id))[0]).toMatchObject({
      id,
      status: 'failed',
      last_error: 'FRIEND_WEEKLY_LIMIT',
    });
    await flushSocialOutbox(db, client, self.id);
    expect(rpc).toHaveBeenCalledTimes(1);
    await dismissSocialFailure(db, friend.id, id);
    expect(await socialOutbox(db, self.id)).toHaveLength(1);
    await dismissSocialFailure(db, self.id, id);
    expect(await socialOutbox(db, self.id)).toHaveLength(0);
  });
  it('reuses action and report IDs and serializes simultaneous flushes', async () => {
    const db = open();
    await queueFriendAction(db, self.id, 'request-1', 'accept');
    const report = await queueSocialReport(db, self.id, friend.id, 'Spam', 'Details');
    const { client, rpc } = remote();
    await Promise.all([
      flushSocialOutbox(db, client, self.id),
      flushSocialOutbox(db, client, self.id),
    ]);
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      'respond_friend_request',
      'report_social_profile',
    ]);
    expect(rpc.mock.calls[1]?.[1]).toEqual({
      p_actor_id: self.id,
      p_report_id: report,
      p_target_id: friend.id,
      p_reason: 'Spam',
      p_details: 'Details',
    });
    expect(await socialOutbox(db, self.id)).toHaveLength(0);
  });
  it('uses safe cached reads offline but erases revoked profiles and never falls back on authorization failures', async () => {
    const db = open();
    const { client, rpc } = remote(self.id, friend);
    expect((await loadSocialProfile(db, client, self.id, friend.id, true)).cached).toBe(false);
    expect((await loadSocialProfile(db, client, self.id, friend.id, false)).data).toEqual(friend);
    rpc.mockResolvedValue({ data: null, error: { message: 'PROFILE_UNAVAILABLE' } });
    await expect(loadSocialProfile(db, client, self.id, friend.id, true)).rejects.toThrow(
      'PROFILE_UNAVAILABLE',
    );
    await expect(loadSocialProfile(db, client, self.id, friend.id, false)).rejects.toThrow(
      'OFFLINE_NO_CACHE',
    );
    const other = remote(friend.id, friend);
    await expect(loadSocialProfile(db, other.client, self.id, friend.id, true)).rejects.toThrow(
      'NOT_AUTHORIZED',
    );
    expect(other.rpc).not.toHaveBeenCalled();
  });
  it('redacts blocked profiles from cached inbox, search and profile while the block awaits network sync', async () => {
    const db = open();
    const { client, rpc } = remote(self.id, friend);
    await loadSocialProfile(db, client, self.id, friend.id, true);
    rpc.mockResolvedValue({ data: [friend], error: null });
    await searchSocialProfiles(db, client, self.id, '@BEA', true);
    rpc.mockResolvedValue({ data: inbox, error: null });
    await loadFriendInbox(db, client, self.id, true);
    await queueSocialBlock(db, self.id, friend.id);
    expect(await readSocialCache(db, self.id, `profile:${friend.id}`)).toBeNull();
    expect((await loadFriendInbox(db, client, self.id, false)).data.incoming).toHaveLength(0);
    expect((await searchSocialProfiles(db, client, self.id, 'bea', false)).data).toEqual([]);
    // A read that succeeds before the pending block reaches the server stays filtered locally.
    expect((await loadFriendInbox(db, client, self.id, true)).data.incoming).toHaveLength(0);
    rpc.mockResolvedValue({ data: [friend], error: null });
    expect((await searchSocialProfiles(db, client, self.id, 'bea', true)).data).toEqual([]);
    rpc.mockResolvedValue({ data: friend, error: null });
    await expect(loadSocialProfile(db, client, self.id, friend.id, true)).rejects.toThrow(
      'PROFILE_UNAVAILABLE',
    );
  });
});
