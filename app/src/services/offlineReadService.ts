import { isDeviceOffline } from './networkService';
import { AUTH_STORAGE_KEY, sessionStorage } from '@/lib/supabase';
import { readOfflineSession } from './sessionPersistence';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Only previously authorized projections are cached, partitioned by the restored account. */
export async function cachedRead<T>(
  client: SupabaseClient,
  key: string,
  read: () => Promise<T>,
): Promise<T> {
  const offline = await isDeviceOffline();
  const owner =
    offline && sessionStorage
      ? (await readOfflineSession(sessionStorage, AUTH_STORAGE_KEY))?.user.id
      : (await client.auth?.getSession?.())?.data.session?.user.id;
  if (!owner) return read();
  const { getDb } = await import('@/db');
  const db = await getDb();
  if (offline) {
    const row = await db.getFirstAsync<{ payload: string }>(
      'SELECT * FROM local_social_cache WHERE owner_id = ? AND cache_key = ?',
      [owner, key],
    );
    if (row) return JSON.parse(row.payload) as T;
    throw new Error('NETWORK_UNAVAILABLE');
  }
  try {
    const data = await read();
    const current = (await client.auth.getSession()).data.session?.user.id;
    if (current !== owner) throw new Error('ACCOUNT_CHANGED');
    if (key === 'rooms' && Array.isArray(data)) {
      const allowed = new Set(
        data.filter((room) => !['locked', 'archived'].includes(room.state)).map((room) => room.id),
      );
      const entries = await db.getAllAsync<{ cache_key: string }>(
        'SELECT * FROM local_social_cache WHERE owner_id = ?',
        [owner],
      );
      for (const entry of entries) {
        const [kind, roomId] = entry.cache_key.split(':');
        if (
          ['squad', 'squad-details', 'room-snapshot', 'chat'].includes(kind ?? '') &&
          !allowed.has(roomId)
        )
          await db.runAsync('DELETE FROM local_social_cache WHERE owner_id = ? AND cache_key = ?', [
            owner,
            entry.cache_key,
          ]);
      }
    }
    await db
      .runAsync(
        'INSERT INTO local_social_cache (id,owner_id,cache_key,payload,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at',
        [owner + ':' + key, owner, key, JSON.stringify(data), new Date().toISOString()],
      )
      .catch(() => undefined);
    return data;
  } catch (error) {
    // A permission/entitlement response is authoritative. Never serve an older projection for it.
    if (!(await isDeviceOffline())) {
      await db.runAsync('DELETE FROM local_social_cache WHERE owner_id = ?', [owner]);
    }
    throw error;
  }
}
