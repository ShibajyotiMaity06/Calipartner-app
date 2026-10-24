import type { Session } from '@supabase/supabase-js';
import { secureStoreAdapter } from '@/lib/secureStore';

export const SESSION_INACTIVITY_MS = 30 * 24 * 60 * 60 * 1000;
export const RETURNING_USER_KEY = 'calipartner_returning_user';

type Storage = typeof secureStoreAdapter;

/** Only successful sign-in/refresh extends the offline window; reading cached data does not. */
export function createSessionStorage(sessionKey: string, storage: Storage = secureStoreAdapter) {
  const lastOnlineKey = `${sessionKey}.last-online`;
  return {
    async getItem(key: string): Promise<string | null> {
      const value = await storage.getItem(key);
      if (key !== sessionKey || !value) return value;
      const session = JSON.parse(value) as Session;
      const saved = await storage.getItem(lastOnlineKey);
      const lastOnline = saved
        ? Number(saved)
        : ((session.expires_at ?? 0) - (session.expires_in ?? 3600)) * 1000;
      if (Date.now() - lastOnline >= SESSION_INACTIVITY_MS) {
        await storage.setItem(RETURNING_USER_KEY, 'true');
        await storage.removeItem(sessionKey);
        await storage.removeItem(lastOnlineKey);
        return null;
      }
      return value;
    },
    async setItem(key: string, value: string): Promise<void> {
      await storage.setItem(key, value);
      if (key === sessionKey) {
        await storage.setItem(lastOnlineKey, String(Date.now()));
        await storage.setItem(RETURNING_USER_KEY, 'true');
      }
    },
    async removeItem(key: string): Promise<void> {
      await storage.removeItem(key);
      if (key === sessionKey) await storage.removeItem(lastOnlineKey);
    },
  };
}

/** Cached identity is for offline UI only. Server APIs still require a valid JWT and RLS. */
export async function readOfflineSession(
  storage: Pick<Storage, 'getItem'>,
  sessionKey: string,
): Promise<Session | null> {
  const value = await storage.getItem(sessionKey);
  if (!value) return null;
  const session = JSON.parse(value) as Session;
  return session.user?.id && session.refresh_token ? session : null;
}
