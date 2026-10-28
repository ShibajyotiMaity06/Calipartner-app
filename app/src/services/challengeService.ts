import type { ChallengeHome, ChallengeMutation } from '@calipartner/core';
import type { SyncDb } from './syncService';
import { generateClientUuid } from './foodService';
import { beforeTrackingSync } from './accountSyncGate';

export interface ChallengeClient {
  auth: { getUser(): Promise<{ data: { user: { id: string } | null }; error?: unknown }> };
  functions: {
    invoke(
      name: string,
      options: { body: Record<string, unknown> },
    ): Promise<{ data: unknown; error: unknown }>;
  };
}
export interface ChallengePending {
  id: string;
  owner_id: string;
  payload: string;
  status: 'pending' | 'failed';
  last_error: string | null;
  created_at: string;
}
export async function challengeRequest<T>(
  client: ChallengeClient,
  owner: string,
  body: unknown,
): Promise<T> {
  const auth = await client.auth.getUser();
  if (auth.error || auth.data.user?.id !== owner) throw new Error('ACCOUNT_CHANGED');
  const { data, error } = await client.functions.invoke('challenges-api', {
    body: body as Record<string, unknown>,
  });
  if (error) {
    const context = (error as { context?: Response }).context;
    if (context?.json) {
      const json = (await context.json().catch(() => null)) as { error?: string } | null;
      if (json?.error) throw new Error(json.error);
    }
    throw new Error('NETWORK_UNAVAILABLE');
  }
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  return data as T;
}
export async function cachedChallenges(db: SyncDb, owner: string): Promise<ChallengeHome | null> {
  const rows = await db.getAllAsync<{ payload: string }>(
    'SELECT payload FROM local_challenge_cache WHERE owner_id = ?',
    [owner],
  );
  return rows[0] ? (JSON.parse(rows[0].payload) as ChallengeHome) : null;
}
export async function loadChallenges(
  db: SyncDb,
  client: ChallengeClient,
  owner: string,
  rescore = true,
) {
  const data = await challengeRequest<ChallengeHome>(client, owner, {
    action: rescore ? 'home' : 'read',
  });
  await db.runAsync(
    'INSERT INTO local_challenge_cache (id,owner_id,payload,updated_at) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at',
    [owner, owner, JSON.stringify(data), new Date().toISOString()],
  );
  return data;
}
export function challengeOutbox(db: SyncDb, owner: string) {
  return db.getAllAsync<ChallengePending>(
    'SELECT * FROM local_challenge_outbox WHERE owner_id = ? ORDER BY created_at ASC',
    [owner],
  );
}
export async function queueChallenge(db: SyncDb, owner: string, mutation: ChallengeMutation) {
  const id =
    mutation.action === 'create' || mutation.action === 'occasion'
      ? mutation.id
      : mutation.action === 'social' || mutation.action === 'track'
        ? mutation.request_id
        : generateClientUuid();
  const existing = (await challengeOutbox(db, owner)).find((item) => item.id === id);
  if (existing && existing.payload !== JSON.stringify(mutation))
    throw new Error('IDEMPOTENCY_CONFLICT');
  await db.runAsync(
    'INSERT INTO local_challenge_outbox (id,owner_id,payload,status,last_error,created_at) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,last_error=excluded.last_error',
    [id, owner, JSON.stringify(mutation), 'pending', null, new Date().toISOString()],
  );
  // Destructive/visibility changes must also remove stale cached peer data immediately.
  if (
    mutation.action === 'social' &&
    ['leave', 'comparison', 'report', 'block'].includes(mutation.kind)
  )
    await db.runAsync('DELETE FROM local_challenge_cache WHERE owner_id = ?', [owner]);
  return id;
}
const flushing = new Map<string, Promise<void>>();
export function flushChallenges(db: SyncDb, client: ChallengeClient, owner: string): Promise<void> {
  const active = flushing.get(owner);
  if (active) return active;
  const work = (async () => {
    await beforeTrackingSync();
    for (const item of await challengeOutbox(db, owner)) {
      if (item.status === 'failed') continue;
      try {
        await challengeRequest(client, owner, JSON.parse(item.payload));
        await db.runAsync('DELETE FROM local_challenge_outbox WHERE id = ? AND owner_id = ?', [
          item.id,
          owner,
        ]);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'NETWORK_UNAVAILABLE';
        if (message === 'ACCOUNT_CHANGED' || message === 'NETWORK_UNAVAILABLE') break;
        await db.runAsync(
          'UPDATE local_challenge_outbox SET status = ?, last_error = ? WHERE id = ? AND owner_id = ?',
          ['failed', message, item.id, owner],
        );
        break;
      }
    }
  })().finally(() => flushing.delete(owner));
  flushing.set(owner, work);
  return work;
}
export async function dismissChallengeWrite(db: SyncDb, owner: string, id: string) {
  await db.runAsync('DELETE FROM local_challenge_outbox WHERE id = ? AND owner_id = ?', [
    id,
    owner,
  ]);
}
