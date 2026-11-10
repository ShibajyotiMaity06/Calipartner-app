import type { ChallengeHome, ChallengeMutation } from '@calipartner/core';
import { buildChallengeHome } from '@calipartner/core';
import type { LocalDb } from './accountDataService';
import { beforeAccountWrite } from './accountDataGate';

export interface ChallengeClient {
  rpc?(name: string): PromiseLike<{ data: unknown; error: unknown }>;
  auth: { getUser(): Promise<{ data: { user: { id: string } | null }; error?: unknown }> };
  functions: {
    invoke(
      name: string,
      options: { body: Record<string, unknown> },
    ): Promise<{ data: unknown; error: unknown }>;
  };
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
export async function loadChallenges(
  db: LocalDb,
  client: ChallengeClient,
  owner: string,
  rescore = true,
) {
  let response: ChallengeHome;
  try {
    response = await challengeRequest<ChallengeHome>(client, owner, {
      action: rescore ? 'home' : 'read',
    });
  } catch (error) {
    // A failed scoring job or unavailable Edge deployment must not hide the authorized catalogue.
    // This RPC applies the same participant/privacy checks and never computes scores on device.
    if (
      !client.rpc ||
      !['NETWORK_UNAVAILABLE', 'CHALLENGE_UNAVAILABLE'].includes((error as Error).message)
    )
      throw error;
    const auth = await client.auth.getUser();
    if (auth.error || auth.data.user?.id !== owner) throw new Error('ACCOUNT_CHANGED');
    const read = await client.rpc('challenge_home');
    if (read.error) throw error;
    response = { ...(read.data as ChallengeHome), scores_pending: true };
  }
  const data = buildChallengeHome(response);
  await db
    .runAsync(
      'INSERT INTO local_challenge_cache (id,owner_id,payload,updated_at) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at',
      [owner, owner, JSON.stringify(data), new Date().toISOString()],
    )
    .catch(() => undefined); // A replaceable cache cannot prevent displaying a successful server read.
  return data;
}
export async function saveChallenge(
  client: ChallengeClient,
  owner: string,
  mutation: ChallengeMutation,
) {
  if (await beforeAccountWrite()) throw new Error('ACCOUNT_DATA_RESET');
  await challengeRequest(client, owner, mutation);
  return 'saved';
}

/** Last authorized challenge projection, for read-only offline browsing. */
export async function cachedChallenges(db: LocalDb, owner: string): Promise<ChallengeHome | null> {
  const row = await db.getFirstAsync<{ payload: string }>(
    'SELECT * FROM local_challenge_cache WHERE owner_id = ?',
    [owner],
  );
  return row ? (JSON.parse(row.payload) as ChallengeHome) : null;
}
