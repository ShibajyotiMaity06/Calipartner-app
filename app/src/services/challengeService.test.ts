import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChallengeMutation } from '@calipartner/core';
vi.mock('expo-sqlite', () => ({}));
import { createWebDb } from '@/db';
import { migrations } from '@/db/migrations';
import {
  cachedChallenges,
  challengeOutbox,
  challengeRequest,
  dismissChallengeWrite,
  flushChallenges,
  loadChallenges,
  queueChallenge,
  type ChallengeClient,
} from './challengeService';
import type { SyncDb } from './syncService';
const connections: DatabaseSync[] = [];
function nativeDb(): SyncDb {
  const sql = new DatabaseSync(':memory:');
  connections.push(sql);
  sql.exec(migrations.find((m) => m.version === 15)!.sql);
  const params = (args: unknown[]) => (Array.isArray(args[0]) ? args[0] : args) as SQLInputValue[];
  return {
    async runAsync(q, ...args) {
      return sql.prepare(q).run(...params(args));
    },
    async getAllAsync<T>(q: string, ...args: unknown[]) {
      return sql.prepare(q).all(...params(args)) as T[];
    },
    async getFirstAsync<T>(q: string, ...args: unknown[]) {
      return (sql.prepare(q).get(...params(args)) ?? null) as T | null;
    },
  };
}
const mutation: ChallengeMutation = {
  action: 'create',
  id: 'aabb0000-0000-4000-8000-000000000001',
  template_id: 'template',
  scope: 'pair',
  duration: 7,
  partners: ['friend'],
};
beforeEach(() => {
  const memory = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => memory.set(key, value),
    removeItem: (key: string) => memory.delete(key),
  });
});
afterEach(() => {
  connections.splice(0).forEach((db) => db.close());
  vi.unstubAllGlobals();
});
for (const [name, makeDb] of [
  ['native SQLite', nativeDb],
  ['web storage', createWebDb],
] as const)
  describe(name, () => {
    it('keeps cache and outbox isolated between accounts', async () => {
      const db = makeDb();
      const client: ChallengeClient = {
        auth: { getUser: async () => ({ data: { user: { id: 'owner' } } }) },
        functions: {
          invoke: async () => ({ data: { catalog: {}, items: [], reminders: [] }, error: null }),
        },
      };
      await loadChallenges(db, client, 'owner');
      expect(await cachedChallenges(db, 'other')).toBeNull();
      await queueChallenge(db, 'owner', mutation);
      expect(await challengeOutbox(db, 'other')).toEqual([]);
      expect(await challengeOutbox(db, 'owner')).toHaveLength(1);
    });
    it('preserves the same UUID through lost-response retries and serializes concurrent flushes', async () => {
      const db = makeDb();
      const calls: unknown[] = [];
      let lost = true;
      const client: ChallengeClient = {
        auth: { getUser: async () => ({ data: { user: { id: 'owner' } } }) },
        functions: {
          invoke: async (_, { body }) => {
            calls.push(body);
            if (lost) {
              lost = false;
              throw new Error('NETWORK_UNAVAILABLE');
            }
            return { data: { id: mutation.id }, error: null };
          },
        },
      };
      await queueChallenge(db, 'owner', mutation);
      await flushChallenges(db, client, 'owner');
      expect((await challengeOutbox(db, 'owner'))[0]?.status).toBe('pending');
      await Promise.all([
        flushChallenges(db, client, 'owner'),
        flushChallenges(db, client, 'owner'),
      ]);
      expect(calls).toEqual([mutation, mutation]);
      expect(await challengeOutbox(db, 'owner')).toEqual([]);
    });
    it('never sends a queued action with another signed-in account', async () => {
      const db = makeDb();
      const invoke = vi.fn();
      const client: ChallengeClient = {
        auth: { getUser: async () => ({ data: { user: { id: 'other' } } }) },
        functions: { invoke },
      };
      await queueChallenge(db, 'owner', mutation);
      await flushChallenges(db, client, 'owner');
      expect(invoke).not.toHaveBeenCalled();
      expect(await challengeOutbox(db, 'owner')).toHaveLength(1);
    });
    it('records an actionable terminal error without retry loops', async () => {
      const db = makeDb();
      const invoke = vi.fn(async () => ({ data: { error: 'CHALLENGE_LIMIT' }, error: null }));
      const client: ChallengeClient = {
        auth: { getUser: async () => ({ data: { user: { id: 'owner' } } }) },
        functions: { invoke },
      };
      await queueChallenge(db, 'owner', mutation);
      await flushChallenges(db, client, 'owner');
      await flushChallenges(db, client, 'owner');
      expect(invoke).toHaveBeenCalledTimes(1);
      expect((await challengeOutbox(db, 'owner'))[0]?.last_error).toBe('CHALLENGE_LIMIT');
      await dismissChallengeWrite(db, 'owner', mutation.id);
      expect(await challengeOutbox(db, 'owner')).toEqual([]);
    });
    it('rejects changed payloads sharing a creation UUID', async () => {
      const db = makeDb();
      await queueChallenge(db, 'owner', mutation);
      await expect(queueChallenge(db, 'owner', { ...mutation, duration: 14 })).rejects.toThrow(
        'IDEMPOTENCY_CONFLICT',
      );
    });
    it('clears stale peer cache immediately when leaving or hiding comparison', async () => {
      const db = makeDb();
      const client: ChallengeClient = {
        auth: { getUser: async () => ({ data: { user: { id: 'owner' } } }) },
        functions: {
          invoke: async () => ({ data: { items: [{ private: 'peer data' }] }, error: null }),
        },
      };
      await loadChallenges(db, client, 'owner');
      await queueChallenge(db, 'owner', {
        action: 'social',
        id: mutation.id,
        request_id: 'leave',
        kind: 'leave',
      });
      expect(await cachedChallenges(db, 'owner')).toBeNull();
    });
  });
it('surfaces structured Edge errors and denies changed account reads', async () => {
  const client: ChallengeClient = {
    auth: { getUser: async () => ({ data: { user: { id: 'a' } } }) },
    functions: {
      invoke: async () => ({
        data: null,
        error: { context: new Response(JSON.stringify({ error: 'PLUS_REQUIRED' })) },
      }),
    },
  };
  await expect(challengeRequest(client, 'a', {})).rejects.toThrow('PLUS_REQUIRED');
  await expect(challengeRequest(client, 'b', {})).rejects.toThrow('ACCOUNT_CHANGED');
});
