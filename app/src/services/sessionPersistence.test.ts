import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/secureStore', () => ({ secureStoreAdapter: {} }));
import {
  createSessionStorage,
  readOfflineSession,
  RETURNING_USER_KEY,
  SESSION_INACTIVITY_MS,
} from './sessionPersistence';

function setup() {
  const data = new Map<string, string>();
  const raw = {
    getItem: async (key: string) => data.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: async (key: string) => {
      data.delete(key);
    },
  };
  const storage = createSessionStorage('session', raw);
  return { data, storage, raw };
}
const session = JSON.stringify({
  user: { id: 'user-1' },
  refresh_token: 'refresh',
  access_token: 'access',
  expires_at: 1,
});
afterEach(() => vi.useRealTimers());

describe('30 consecutive offline days', () => {
  it('restores an expired access token for offline UI before day 30 without extending the window', async () => {
    vi.useFakeTimers();
    const { storage, data } = setup();
    const started = Date.now();
    await storage.setItem('session', session);
    data.set('saved-macros', 'custom targets');
    vi.setSystemTime(started + SESSION_INACTIVITY_MS - 1);
    expect((await readOfflineSession(storage, 'session'))?.user.id).toBe('user-1');
    expect(data.get('session.last-online')).toBe(String(started));
    vi.setSystemTime(started + SESSION_INACTIVITY_MS);
    expect(await readOfflineSession(storage, 'session')).toBeNull();
    expect(data.get(RETURNING_USER_KEY)).toBe('true');
    expect(data.get('saved-macros')).toBe('custom targets');
  });

  it('keeps daily active users signed in beyond 30 days', async () => {
    vi.useFakeTimers();
    const { storage } = setup();
    for (let day = 0; day < 60; day++) {
      await storage.setItem('session', session); // Successful online token refresh.
      vi.setSystemTime(Date.now() + 24 * 60 * 60 * 1000);
      expect(await storage.getItem('session')).toBe(session);
    }
  });

  it('logout clears credentials but keeps the returning-user marker', async () => {
    const { storage, data } = setup();
    await storage.setItem('session', session);
    await storage.removeItem('session');
    expect(await readOfflineSession(storage, 'session')).toBeNull();
    expect(data.has('session.last-online')).toBe(false);
    expect(data.get(RETURNING_USER_KEY)).toBe('true');
  });

  it('migrates existing sessions using token issue time, rather than signing everyone out', async () => {
    const { raw, storage } = setup();
    await raw.setItem(
      'session',
      JSON.stringify({
        user: { id: 'returning-user' },
        refresh_token: 'refresh',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        expires_in: 3600,
      }),
    );
    expect((await readOfflineSession(storage, 'session'))?.user.id).toBe('returning-user');
  });
});
