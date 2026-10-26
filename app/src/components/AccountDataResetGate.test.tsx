import React, { useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  online: true,
  reset: false,
  mounts: 0,
  foreground: null as ((state: string) => void) | null,
  clear: vi.fn(),
  checks: vi.fn(),
  unavailable: false,
  authLoading: false,
}));
vi.mock('react-native', () => ({
  AppState: {
    addEventListener: (_event: string, callback: typeof state.foreground) => {
      state.foreground = callback;
      return { remove: vi.fn() };
    },
  },
}));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: state.authLoading ? null : { id: 'existing-user' },
    isLoading: state.authLoading,
  }),
}));
vi.mock('@/hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isOnline: state.online }),
}));
vi.mock('@/lib/supabase', () => ({ getSupabase: () => ({}) }));
vi.mock('@/db', () => ({ clearTrackingDataForReset: state.clear }));
vi.mock('@/services/accountDataReset', () => ({
  applyAccountDataReset: async (_client: unknown, clear: () => Promise<void>) => {
    state.checks();
    if (state.unavailable)
      throw Object.assign(new Error('Offline'), { code: 'RESET_CHECK_UNAVAILABLE' });
    if (!state.reset) return false;
    await clear();
    state.reset = false;
    return true;
  },
}));
vi.mock('./ErrorState', () => ({ ErrorState: () => <div>Error</div> }));
vi.mock('./LoadingState', () => ({ LoadingState: () => <div>Loading</div> }));
import { AccountDataResetGate } from './AccountDataResetGate';
import { beforeTrackingSync } from '@/services/accountSyncGate';
let renderer: ReactTestRenderer;
function Child() {
  useEffect(() => {
    state.mounts++;
  }, []);
  return <div>Tracking</div>;
}
const tree = () => (
  <AccountDataResetGate>
    <Child />
  </AccountDataResetGate>
);
beforeEach(() => {
  state.online = true;
  state.reset = false;
  state.mounts = 0;
  state.unavailable = false;
  state.authLoading = false;
  vi.clearAllMocks();
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(async () => {
  await act(async () => renderer.unmount());
});
describe('safe reset before sync', () => {
  it('preserves checkout return navigation by mounting only after session and reset checks', async () => {
    state.authLoading = true;
    await act(async () => {
      renderer = create(tree());
    });
    expect(state.mounts).toBe(0);
    state.authLoading = false;
    await act(async () => {
      renderer.update(tree());
    });
    expect(state.mounts).toBe(1);
    await act(async () => {
      state.foreground?.('active');
    });
    expect(state.mounts).toBe(1);
  });
  it('retains cached access during a server outage while blocking uploads until verification', async () => {
    state.unavailable = true;
    await act(async () => {
      renderer = create(tree());
    });
    expect(state.mounts).toBe(1);
    await expect(beforeTrackingSync()).rejects.toThrow('Offline');
    expect(state.clear).not.toHaveBeenCalled();
  });
  it('does not unmount an active walking screen during normal foreground checks', async () => {
    await act(async () => {
      renderer = create(tree());
    });
    expect(state.mounts).toBe(1);
    await act(async () => {
      state.foreground?.('active');
    });
    expect(state.mounts).toBe(1);
    expect(state.clear).not.toHaveBeenCalled();
  });

  it('clears old data before a queue flush, without ending the login session', async () => {
    await act(async () => {
      renderer = create(tree());
    });
    state.reset = true;
    let changed = false;
    await act(async () => {
      changed = await beforeTrackingSync();
    });
    expect(changed).toBe(true);
    expect(state.clear).toHaveBeenCalledOnce();
    expect(renderer.toJSON()).toMatchObject({ type: 'div', children: ['Tracking'] });
  });

  it('continues cached offline use and verifies again when the connection returns', async () => {
    state.online = false;
    await act(async () => {
      renderer = create(tree());
    });
    expect(state.mounts).toBe(1);
    state.online = true;
    await act(async () => {
      renderer.update(tree());
    });
    expect(state.checks).toHaveBeenCalled();
  });
});
