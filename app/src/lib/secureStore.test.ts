import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const device = vi.hoisted(() => ({ os: 'ios', data: new Map<string, string>() }));
vi.mock('react-native', () => ({
  Platform: {
    get OS() {
      return device.os;
    },
  },
}));
vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(async (key: string) => device.data.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => {
    if (Buffer.byteLength(value) > 2048) throw new Error('SecureStore value too large');
    device.data.set(key, value);
  }),
  deleteItemAsync: vi.fn(async (key: string) => {
    device.data.delete(key);
  }),
}));
import * as SecureStore from 'expo-secure-store';
import { secureStoreAdapter } from './secureStore';

beforeEach(() => {
  device.data.clear();
  device.os = 'ios';
});
afterEach(() => vi.restoreAllMocks());

describe('durable auth storage', () => {
  it('persists a large OAuth session across a module/app restart', async () => {
    const session = JSON.stringify({ refresh_token: 'token', metadata: 'नाम'.repeat(3000) });
    await secureStoreAdapter.setItem('auth-token', session);
    vi.resetModules();
    const restarted = (await import('./secureStore')).secureStoreAdapter;
    expect(await restarted.getItem('auth-token')).toBe(session);
    expect([...device.data.values()].every((value) => Buffer.byteLength(value) <= 2048)).toBe(true);
  });

  it('reads legacy unchunked sessions and removes every chunk on logout', async () => {
    device.data.set('auth-token', 'legacy-session');
    expect(await secureStoreAdapter.getItem('auth-token')).toBe('legacy-session');
    await secureStoreAdapter.setItem('auth-token', 'new-session'.repeat(600));
    await secureStoreAdapter.removeItem('auth-token');
    expect(device.data.size).toBe(0);
  });

  it('reports failed writes and preserves the last durable session', async () => {
    await secureStoreAdapter.setItem('auth-token', 'previous-session');
    vi.spyOn(SecureStore, 'setItemAsync').mockRejectedValueOnce(new Error('Storage unavailable'));
    await expect(secureStoreAdapter.setItem('auth-token', 'replacement')).rejects.toThrow(
      'Storage unavailable',
    );
    expect(await secureStoreAdapter.getItem('auth-token')).toBe('previous-session');
  });

  it('serializes concurrent token rotation and reads without losing chunks', async () => {
    await secureStoreAdapter.setItem('auth-token', 'old-token'.repeat(800));
    const [before, , after] = await Promise.all([
      secureStoreAdapter.getItem('auth-token'),
      secureStoreAdapter.setItem('auth-token', 'new-token'.repeat(800)),
      secureStoreAdapter.getItem('auth-token'),
    ]);
    expect(before).toBe('old-token'.repeat(800));
    expect(after).toBe('new-token'.repeat(800));
  });

  it('uses persistent browser storage across module restarts', async () => {
    device.os = 'web';
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => device.data.get(key) ?? null,
      setItem: (key: string, value: string) => device.data.set(key, value),
      removeItem: (key: string) => device.data.delete(key),
    });
    await secureStoreAdapter.setItem('auth-token', 'browser-session');
    expect(await secureStoreAdapter.getItem('auth-token')).toBe('browser-session');
    await secureStoreAdapter.removeItem('auth-token');
    expect(await secureStoreAdapter.getItem('auth-token')).toBeNull();
    vi.unstubAllGlobals();
  });
});
