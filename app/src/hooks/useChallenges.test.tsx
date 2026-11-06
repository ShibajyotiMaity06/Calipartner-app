import React, { useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChallengeHome } from '@calipartner/core';
const state = vi.hoisted(() => ({
  load: vi.fn(),
  flush: vi.fn(),
  online: true as boolean | null,
  user: 'a',
  appState: new Set<(value: string) => void>(),
  channels: [] as string[],
  removedChannels: [] as string[],
}));
vi.mock('react-native', () => ({
  AppState: {
    addEventListener: (_event: string, listener: (value: string) => void) => {
      state.appState.add(listener);
      return { remove: () => state.appState.delete(listener) };
    },
  },
}));
vi.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void) => useEffect(callback, [callback]),
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: state.user } }) }));
vi.mock('./useNetworkStatus', () => ({ useNetworkStatus: () => ({ isOnline: state.online }) }));
vi.mock('@/db', () => ({ getDb: async () => ({}) }));
vi.mock('@/lib/supabase', () => {
  const channels = new Map<
    string,
    { subscribed: boolean; name: string; on: () => unknown; subscribe: () => unknown }
  >();
  return {
    getSupabase: () => ({
      channel: (name: string) => {
        state.channels.push(name);
        if (channels.has(name)) return channels.get(name);
        const channel = {
          name,
          subscribed: false,
          on() {
            if (this.subscribed) throw new Error('Cannot add postgres_changes after subscribe');
            return this;
          },
          subscribe() {
            this.subscribed = true;
            return this;
          },
        };
        channels.set(name, channel);
        return channel;
      },
      removeChannel: async (channel: { name: string }) => {
        state.removedChannels.push(channel.name);
        channels.delete(channel.name);
      },
    }),
  };
});
vi.mock('@/services/challengeService', () => ({
  cachedChallenges: async () => null,
  loadChallenges: state.load,
  flushChallenges: state.flush,
  challengeOutbox: async () => [],
  queueChallenge: vi.fn(),
  dismissChallengeWrite: vi.fn(),
}));
import { useChallenges } from './useChallenges';
let renderer: ReactTestRenderer;
let result: ReturnType<typeof useChallenges>;
function Probe() {
  result = useChallenges();
  return null;
}
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  vi.resetAllMocks();
});
beforeEach(() => {
  state.online = true;
  state.user = 'a';
  state.appState.clear();
  state.channels.length = 0;
  state.removedChannels.length = 0;
});
describe('challenge reads and queued writes', () => {
  it('keeps Home and You mounted without reusing an already subscribed realtime channel', async () => {
    state.load.mockResolvedValue({ items: [], catalog: { config: { poll_seconds: 120 } } });
    await act(async () => {
      renderer = create(
        <>
          <Probe />
          <Probe />
        </>,
      );
    });
    expect(state.channels).toHaveLength(2);
    expect(new Set(state.channels).size).toBe(2);
    await act(async () => renderer.unmount());
    expect(state.removedChannels).toHaveLength(2);
    expect(new Set(state.removedChannels).size).toBe(2);
  });
  it('retries a failed initial load when the APK returns to the foreground', async () => {
    const fresh = { items: [], catalog: { config: {} } } as unknown as ChallengeHome;
    state.load.mockRejectedValueOnce(new Error('NETWORK_UNAVAILABLE')).mockResolvedValue(fresh);
    await act(async () => {
      renderer = create(<Probe />);
    });
    expect(result.error).toBe('NETWORK_UNAVAILABLE');
    await act(async () => {
      for (const listener of state.appState) listener('active');
    });
    expect(result.home).toEqual(fresh);
    expect(result.error).toBeNull();
    expect(state.load).toHaveBeenCalledTimes(2);
  });
  it('recovers after native reconnects while an older request is still pending', async () => {
    let rejectInitial!: (error: Error) => void;
    const fresh = { items: [], catalog: { config: {} } } as unknown as ChallengeHome;
    state.load
      .mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            rejectInitial = reject;
          }),
      )
      .mockResolvedValue(fresh);
    await act(async () => {
      renderer = create(<Probe />);
    });
    expect(state.load).toHaveBeenCalledTimes(1);
    state.online = false;
    await act(async () => renderer.update(<Probe />));
    state.online = true;
    await act(async () => renderer.update(<Probe />));
    await act(async () => rejectInitial(new Error('NETWORK_UNAVAILABLE')));
    expect(state.load).toHaveBeenCalledTimes(2);
    expect(result.home).toEqual(fresh);
    expect(result.error).toBeNull();
    expect(result.loading).toBe(false);
  });

  it('does not replace a new account with the previous account’s delayed result', async () => {
    let resolveInitial!: (home: ChallengeHome) => void;
    const fresh = { items: [], catalog: { config: {} }, owner: 'b' } as unknown as ChallengeHome;
    state.load
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveInitial = resolve;
          }),
      )
      .mockResolvedValue(fresh);
    await act(async () => {
      renderer = create(<Probe />);
    });
    state.user = 'b';
    await act(async () => renderer.update(<Probe />));
    await act(async () =>
      resolveInitial({ items: [], catalog: { config: {} } } as unknown as ChallengeHome),
    );
    expect(result.home).toBe(fresh);
    expect(result.userId).toBe('b');
  });
  it('loads the home when an upload reset check temporarily fails', async () => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    const home = { items: [], catalog: { config: {} } } as unknown as ChallengeHome;
    state.load.mockResolvedValue(home);
    state.flush.mockRejectedValue(new Error('RESET_CHECK_UNAVAILABLE'));
    await act(async () => {
      renderer = create(<Probe />);
    });
    expect(result.home).toEqual(home);
    expect(result.error).toBeNull();
    expect(result.loading).toBe(false);
  });
});
