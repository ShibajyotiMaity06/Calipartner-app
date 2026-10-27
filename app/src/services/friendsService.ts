import type {
  FriendInbox,
  SocialProfile,
  SocialProfileDraft,
  FriendAction,
} from '@calipartner/core';
import { validateSocialProfile, normalizeSocialQuery, isSocialQueryValid } from '@calipartner/core';
import { generateClientUuid } from './foodService';
import type { SyncDb } from './syncService';

export interface SocialDb extends SyncDb {
  withTransactionAsync?(work: () => Promise<void>): Promise<void>;
}
export interface SocialClient {
  auth: { getUser(): Promise<{ data: { user: { id: string } | null }; error?: unknown }> };
  rpc(
    name: string,
    payload?: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>;
}
export type SocialRpc =
  | 'set_social_profile'
  | 'send_friend_request'
  | 'respond_friend_request'
  | 'block_social_profile'
  | 'report_social_profile';
export interface SocialOutboxItem {
  id: string;
  owner_id: string;
  rpc_name: SocialRpc;
  payload: string;
  status: 'pending' | 'failed';
  last_error: string | null;
  created_at: string;
}

async function cache(db: SocialDb, owner: string, key: string, value: unknown) {
  await db.runAsync(
    `INSERT INTO local_social_cache (id,owner_id,cache_key,payload,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at`,
    [`${owner}:${key}`, owner, key, JSON.stringify(value), new Date().toISOString()],
  );
}
export async function readSocialCache<T>(
  db: SocialDb,
  owner: string,
  key: string,
): Promise<T | null> {
  const rows = await db.getAllAsync<{ payload: string }>(
    'SELECT payload FROM local_social_cache WHERE owner_id = ? AND cache_key = ?',
    [owner, key],
  );
  return rows[0] ? (JSON.parse(rows[0].payload) as T) : null;
}
export function socialOutbox(db: SocialDb, owner: string): Promise<SocialOutboxItem[]> {
  return db.getAllAsync<SocialOutboxItem>(
    'SELECT * FROM local_social_outbox WHERE owner_id = ? ORDER BY created_at ASC',
    [owner],
  );
}
async function enqueue(
  db: SocialDb,
  owner: string,
  rpc: SocialRpc,
  payload: Record<string, unknown>,
  id = generateClientUuid(),
) {
  await db.runAsync(
    `INSERT INTO local_social_outbox (id,owner_id,rpc_name,payload,status,last_error,created_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,status=excluded.status,last_error=excluded.last_error`,
    [
      id,
      owner,
      rpc,
      JSON.stringify({ ...payload, p_actor_id: owner }),
      'pending',
      null,
      new Date().toISOString(),
    ],
  );
  return id;
}
export async function saveSocialProfile(
  db: SocialDb,
  owner: string,
  profile: SocialProfile,
  draft: SocialProfileDraft,
) {
  if (!validateSocialProfile(draft).valid) throw new Error('INVALID_PROFILE');
  const mutation = generateClientUuid();
  const lastEdit = Date.parse(profile.edited_at ?? '');
  const editedAt = new Date(
    Math.max(Date.now(), Number.isFinite(lastEdit) ? lastEdit + 1 : 0),
  ).toISOString();
  const write = async () => {
    const existing = await socialOutbox(db, owner);
    for (const item of existing.filter((item) => item.rpc_name === 'set_social_profile'))
      await db.runAsync('DELETE FROM local_social_outbox WHERE id = ? AND owner_id = ?', [
        item.id,
        owner,
      ]);
    await enqueue(
      db,
      owner,
      'set_social_profile',
      {
        p_mutation_id: mutation,
        p_edited_at: editedAt,
        p_bio: draft.bio,
        p_training_style: draft.training_style,
        p_instagram_handle: draft.instagram_handle,
        p_website_url: draft.website_url.trim() ? new URL(draft.website_url.trim()).href : '',
        p_is_public: draft.is_public,
      },
      mutation,
    );
    await cache(db, owner, `profile:${owner}`, { ...profile, ...draft, edited_at: editedAt });
  };
  if (db.withTransactionAsync) await db.withTransactionAsync(write);
  else await write();
}
export function queueFriendRequest(db: SocialDb, owner: string, target: string) {
  const id = generateClientUuid();
  return enqueue(
    db,
    owner,
    'send_friend_request',
    { p_request_id: id, p_recipient_id: target },
    id,
  );
}
export function queueFriendAction(
  db: SocialDb,
  owner: string,
  request: string,
  action: FriendAction,
) {
  return enqueue(db, owner, 'respond_friend_request', { p_request_id: request, p_action: action });
}
export async function queueSocialBlock(db: SocialDb, owner: string, target: string) {
  const write = async () => {
    await enqueue(db, owner, 'block_social_profile', { p_target_id: target });
    const entries = await db.getAllAsync<{ cache_key: string; payload: string }>(
      'SELECT * FROM local_social_cache WHERE owner_id = ?',
      [owner],
    );
    for (const entry of entries) {
      if (entry.cache_key === `profile:${target}`)
        await db.runAsync('DELETE FROM local_social_cache WHERE owner_id = ? AND cache_key = ?', [
          owner,
          entry.cache_key,
        ]);
      else if (entry.cache_key.startsWith('search:'))
        await cache(
          db,
          owner,
          entry.cache_key,
          (JSON.parse(entry.payload) as SocialProfile[]).filter((person) => person.id !== target),
        );
      else if (entry.cache_key === 'inbox') {
        const inbox = JSON.parse(entry.payload) as FriendInbox;
        await cache(db, owner, 'inbox', {
          ...inbox,
          incoming: inbox.incoming.filter((person) => person.id !== target),
          outgoing: inbox.outgoing.filter((person) => person.id !== target),
          friends: inbox.friends.filter((person) => person.id !== target),
        });
      }
    }
  };
  if (db.withTransactionAsync) await db.withTransactionAsync(write);
  else await write();
}
export function queueSocialReport(
  db: SocialDb,
  owner: string,
  target: string,
  reason: string,
  details?: string,
) {
  const id = generateClientUuid();
  return enqueue(
    db,
    owner,
    'report_social_profile',
    { p_report_id: id, p_target_id: target, p_reason: reason, p_details: details ?? null },
    id,
  );
}
export async function dismissSocialFailure(db: SocialDb, owner: string, id: string) {
  const item = (await socialOutbox(db, owner)).find((item) => item.id === id);
  if (item?.status === 'failed')
    await db.runAsync('DELETE FROM local_social_outbox WHERE id = ? AND owner_id = ?', [id, owner]);
}

const flushing = new Map<string, Promise<void>>();
export async function flushSocialOutbox(
  db: SocialDb,
  client: SocialClient,
  owner: string,
): Promise<void> {
  const previous = flushing.get(owner) ?? Promise.resolve();
  const task = previous
    .catch(() => {})
    .then(async () => {
      for (const item of await socialOutbox(db, owner)) {
        if (item.status === 'failed') continue;
        const session = await client.auth.getUser().catch(() => null);
        if (session?.data.user?.id !== owner) return;
        try {
          const payload = JSON.parse(item.payload) as Record<string, unknown>;
          if (payload.p_actor_id !== owner) throw new Error('NOT_AUTHORIZED');
          const { error } = await client.rpc(item.rpc_name, payload);
          if (error) throw new Error(`${error.code ?? ''} ${error.message}`.trim());
          await db.runAsync('DELETE FROM local_social_outbox WHERE id = ? AND owner_id = ?', [
            item.id,
            owner,
          ]);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const terminal =
            /FRIEND_WEEKLY_LIMIT|PROFILE_UNAVAILABLE|NOT_AUTHORIZED|INVALID_|REQUEST_NOT_PENDING|23514/.test(
              message,
            );
          await db.runAsync(
            'UPDATE local_social_outbox SET status = ?, last_error = ? WHERE id = ? AND owner_id = ?',
            [terminal ? 'failed' : 'pending', message, item.id, owner],
          );
          if (!terminal) break;
        }
      }
    });
  flushing.set(owner, task);
  try {
    await task;
  } finally {
    if (flushing.get(owner) === task) flushing.delete(owner);
  }
}

async function remoteOrCache<T>(
  db: SocialDb,
  client: SocialClient,
  owner: string,
  key: string,
  rpc: string,
  args: Record<string, unknown>,
  online: boolean,
) {
  const filterBlocked = async (value: unknown): Promise<T> => {
    const blocked = new Set(
      (await socialOutbox(db, owner))
        .filter((item) => item.rpc_name === 'block_social_profile')
        .map((item) => (JSON.parse(item.payload) as { p_target_id: string }).p_target_id),
    );
    if (key.startsWith('profile:') && blocked.has(key.slice('profile:'.length)))
      throw new Error('PROFILE_UNAVAILABLE');
    if (key.startsWith('search:'))
      return (value as SocialProfile[]).filter((person) => !blocked.has(person.id)) as T;
    if (key === 'inbox') {
      const inbox = value as FriendInbox;
      return {
        ...inbox,
        incoming: inbox.incoming.filter((person) => !blocked.has(person.id)),
        outgoing: inbox.outgoing.filter((person) => !blocked.has(person.id)),
        friends: inbox.friends.filter((person) => !blocked.has(person.id)),
      } as T;
    }
    return value as T;
  };
  if (online) {
    try {
      const {
        data: { user },
      } = await client.auth.getUser();
      if (user?.id !== owner) throw new Error('NOT_AUTHORIZED');
      const { data, error } = await client.rpc(rpc, { ...args, p_actor_id: owner });
      if (error)
        throw new Error(
          /PGRST202|PGRST205|42883|42P01/.test(error.code ?? '')
            ? 'SOCIAL_BACKEND_UNAVAILABLE'
            : error.message,
        );
      const visible = await filterBlocked(data);
      await cache(db, owner, key, visible);
      return { data: visible, cached: false };
    } catch (error) {
      if (error instanceof Error && /PROFILE_UNAVAILABLE|NOT_AUTHORIZED/.test(error.message)) {
        await db.runAsync('DELETE FROM local_social_cache WHERE owner_id = ? AND cache_key = ?', [
          owner,
          key,
        ]);
        throw error;
      }
      const stored = await readSocialCache<T>(db, owner, key);
      if (stored) return { data: await filterBlocked(stored), cached: true };
      throw error;
    }
  }
  const stored = await readSocialCache<T>(db, owner, key);
  if (!stored) throw new Error('OFFLINE_NO_CACHE');
  return { data: await filterBlocked(stored), cached: true };
}
export async function loadSocialProfile(
  db: SocialDb,
  client: SocialClient,
  owner: string,
  target: string,
  online: boolean,
) {
  if (
    owner === target &&
    (await socialOutbox(db, owner)).some((item) => item.rpc_name === 'set_social_profile')
  ) {
    const local = await readSocialCache<SocialProfile>(db, owner, `profile:${owner}`);
    if (local) return { data: local, cached: true };
  }
  return remoteOrCache<SocialProfile>(
    db,
    client,
    owner,
    `profile:${target}`,
    'get_social_profile',
    { p_user_id: target },
    online,
  );
}
export function loadFriendInbox(
  db: SocialDb,
  client: SocialClient,
  owner: string,
  online: boolean,
) {
  return remoteOrCache<FriendInbox>(db, client, owner, 'inbox', 'get_friend_inbox', {}, online);
}
export async function searchSocialProfiles(
  db: SocialDb,
  client: SocialClient,
  owner: string,
  query: string,
  online: boolean,
) {
  if (!isSocialQueryValid(query)) throw new Error('INVALID_QUERY');
  const normalized = normalizeSocialQuery(query);
  return remoteOrCache<SocialProfile[]>(
    db,
    client,
    owner,
    `search:${normalized}`,
    'search_social_profiles',
    { p_query: normalized },
    online,
  );
}

export function browseSocialProfiles(
  db: SocialDb,
  client: SocialClient,
  owner: string,
  online: boolean,
  goal: 'bulk' | 'cut' | 'maintain' | null,
  query = '',
  after = '',
  random = false,
) {
  const normalized = normalizeSocialQuery(query);
  return remoteOrCache<SocialProfile[]>(
    db,
    client,
    owner,
    `search:browse:${goal ?? 'all'}:${normalized}:${after}:${random}`,
    'browse_social_profiles',
    { p_goal: goal, p_query: normalized, p_after: after, p_random: random },
    online,
  );
}
