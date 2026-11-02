import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChallengeMutation } from '@calipartner/core';
vi.mock('expo-sqlite', () => ({}));
import { createWebDb } from '@/db';
import { migrations } from '@/db/migrations';
import {
  challengeRequest,
  saveChallenge,
  loadChallenges,
  type ChallengeClient,
} from './challengeService';
import type { LocalDb } from './accountDataService';
const connections: DatabaseSync[] = [];
function nativeDb(): LocalDb {
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

it('keeps the authorized catalogue visible when Edge scoring is unavailable and cache writes fail', async () => {
  const home = { catalog: { templates: [], seasons: [] }, items: [] };
  const client: ChallengeClient = {
    auth: { getUser: async () => ({ data: { user: { id: 'owner' } } }) },
    functions: {
      invoke: async () => ({
        data: null,
        error: { context: new Response(JSON.stringify({ error: 'CHALLENGE_UNAVAILABLE' })) },
      }),
    },
    rpc: vi.fn().mockResolvedValue({ data: home, error: null }),
  };
  const data = await loadChallenges(
    {
      runAsync: async () => {
        throw new Error('quota');
      },
    } as unknown as LocalDb,
    client,
    'owner',
  );
  expect(data.catalog.templates).toEqual([]);
  expect(data.scores_pending).toBe(true);
  expect(client.rpc).toHaveBeenCalledWith('challenge_home');
});

it('does not fall back after an access denial', async () => {
  const client: ChallengeClient = {
    auth: { getUser: async () => ({ data: { user: { id: 'owner' } } }) },
    functions: {
      invoke: async () => ({
        data: null,
        error: { context: new Response(JSON.stringify({ error: 'PLUS_REQUIRED' })) },
      }),
    },
    rpc: vi.fn(),
  };
  await expect(loadChallenges({} as LocalDb, client, 'owner')).rejects.toThrow('PLUS_REQUIRED');
  expect(client.rpc).not.toHaveBeenCalled();
});

it('sends a challenge mutation once and surfaces network failures without a retry queue', async () => {
  const invoke = vi.fn().mockResolvedValue({ data: {}, error: null });
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: 'owner' } } }) },
    functions: { invoke },
  };
  expect(await saveChallenge(client, 'owner', mutation)).toBe('saved');
  invoke.mockResolvedValueOnce({ data: null, error: new Error('offline') });
  await expect(saveChallenge(client, 'owner', mutation)).rejects.toThrow('NETWORK_UNAVAILABLE');
  expect(invoke).toHaveBeenCalledTimes(2);
  await expect(saveChallenge(client, 'other', mutation)).rejects.toThrow('ACCOUNT_CHANGED');
  expect(invoke).toHaveBeenCalledTimes(2);
});
