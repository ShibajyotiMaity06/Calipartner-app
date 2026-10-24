import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { Session } from '@supabase/supabase-js';
import { AuthRetryableFetchError } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  online: true,
  session: null as Session | null,
  error: null as Error | null,
  callback: null as ((event: string, session: Session | null) => unknown) | null,
  appState: null as ((status: string) => void) | null,
  storage: new Map<string, string>(),
  profileError: false,
  startRefresh: vi.fn(),
  stopRefresh: vi.fn(),
  otp: vi.fn(async () => ({ error: null })),
}));
vi.mock('react-native', () => ({
  Platform: { OS: 'android' },
  AppState: {
    currentState: 'active',
    addEventListener: (_event: string, handler: (status: string) => void) => {
      state.appState = handler;
      return { remove: vi.fn() };
    },
  },
}));
vi.mock('@/hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isOnline: state.online }),
}));
vi.mock('@/lib/secureStore', () => ({
  secureStoreAdapter: {
    getItem: async (key: string) => state.storage.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      state.storage.set(key, value);
    },
    removeItem: async (key: string) => {
      state.storage.delete(key);
    },
  },
}));
vi.mock('@/lib/supabase', () => ({
  AUTH_STORAGE_KEY: 'auth-token',
  sessionStorage: { getItem: async (key: string) => state.storage.get(key) ?? null },
  getSupabase: () => ({
    auth: {
      getSession: async () => ({ data: { session: state.session }, error: state.error }),
      onAuthStateChange: (callback: typeof state.callback) => {
        state.callback = callback;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
      startAutoRefresh: state.startRefresh,
      stopAutoRefresh: state.stopRefresh,
      signInWithOtp: state.otp,
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: state.profileError
              ? null
              : { id: state.session?.user.id, nickname: 'Saved user', username: 'saved' },
            error: state.profileError ? { message: 'Network unavailable' } : null,
          }),
        }),
      }),
    }),
  }),
}));
vi.mock('@/db', () => ({ getDb: vi.fn() }));
vi.mock('@/services/guestMigration', () => ({ migrateGuestData: vi.fn() }));
import { AuthProvider, useAuth } from './AuthContext';

let renderer: ReactTestRenderer;
let auth: ReturnType<typeof useAuth>;
const session = {
  user: { id: 'returning-user' },
  access_token: 'expired',
  refresh_token: 'saved-refresh',
  expires_at: 1,
} as Session;
function Probe() {
  auth = useAuth();
  return null;
}
async function mount() {
  await act(async () => {
    renderer = create(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  state.storage.clear();
  state.online = true;
  state.session = session;
  state.error = null;
  state.profileError = false;
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
});

describe('returning user sessions', () => {
  it('restores a session without sending another email code', async () => {
    await mount();
    expect(auth.user?.id).toBe('returning-user');
    expect(auth.isLoading).toBe(false);
    expect(state.otp).not.toHaveBeenCalled();
    let callbackResult: unknown;
    await act(async () => {
      callbackResult = state.callback?.('TOKEN_REFRESHED', session);
    });
    expect(callbackResult).toBeUndefined(); // The listener must not await database/profile calls.
  });

  it('retains offline identity and cached profile when an expired token cannot be refreshed', async () => {
    state.session = null;
    state.error = new AuthRetryableFetchError('Offline', 0);
    state.profileError = true;
    state.storage.set('auth-token', JSON.stringify(session));
    state.storage.set(
      'calipartner.profile.returning-user',
      JSON.stringify({ id: 'returning-user', nickname: 'Remembered' }),
    );
    await mount();
    expect(auth.user?.id).toBe('returning-user');
    expect(auth.profile?.nickname).toBe('Remembered');
    expect(auth.needsProfileSetup).toBe(false);
  });

  it('does not restore a cached session rejected by the server', async () => {
    state.session = null;
    state.error = new Error('Refresh token revoked');
    state.storage.set('auth-token', JSON.stringify(session));
    await mount();
    expect(auth.user).toBeNull();
  });

  it('starts refresh on foreground and stops it in the background', async () => {
    await mount();
    expect(state.startRefresh).toHaveBeenCalled();
    await act(async () => {
      state.appState?.('background');
    });
    expect(state.stopRefresh).toHaveBeenCalled();
    const starts = state.startRefresh.mock.calls.length;
    await act(async () => {
      state.appState?.('active');
    });
    expect(state.startRefresh.mock.calls.length).toBeGreaterThan(starts);
  });

  it('creates accounts only for an explicit signup request', async () => {
    await mount();
    await act(async () => {
      await auth.signInWithOtp('person@example.com');
    });
    expect(state.otp).toHaveBeenLastCalledWith({
      email: 'person@example.com',
      options: { shouldCreateUser: false },
    });
    await act(async () => {
      await auth.signInWithOtp('new@example.com', true);
    });
    expect(state.otp).toHaveBeenLastCalledWith({
      email: 'new@example.com',
      options: { shouldCreateUser: true },
    });
  });
});
