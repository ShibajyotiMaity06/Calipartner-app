import { afterEach, expect, it, vi } from 'vitest';
vi.mock('expo-sqlite', () => ({}));
import { createWebDb } from '@/db';
afterEach(() => vi.unstubAllGlobals());
it('reopens social caches by account and cache key after a browser restart', async () => {
  const memory = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => memory.set(key, value),
  });
  const db = createWebDb();
  await db.runAsync(
    'INSERT INTO local_social_cache (id,owner_id,cache_key,payload,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at',
    ['a:rooms', 'a', 'rooms', '[{"id":"room"}]', 'now'],
  );
  const reopened = createWebDb();
  const query = 'SELECT * FROM local_social_cache WHERE owner_id = ? AND cache_key = ?';
  expect(await reopened.getFirstAsync(query, ['a', 'rooms'])).toMatchObject({
    payload: '[{"id":"room"}]',
  });
  expect(await reopened.getFirstAsync(query, ['b', 'rooms'])).toBeNull();
  expect(await reopened.getFirstAsync(query, ['a', 'squad:other'])).toBeNull();
});
