import React, { useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChallengeHome } from '@calipartner/core';
const state = vi.hoisted(() => ({ load: vi.fn(), flush: vi.fn() }));
vi.mock('react-native', () => ({ AppState: { addEventListener: () => ({ remove: vi.fn() }) } }));
vi.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void) => useEffect(callback, [callback]),
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'a' } }) }));
vi.mock('./useNetworkStatus', () => ({ useNetworkStatus: () => ({ isOnline: true }) }));
vi.mock('@/db', () => ({ getDb: async () => ({}) }));
vi.mock('@/lib/supabase', () => ({ getSupabase: () => ({}) }));
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
describe('challenge reads and queued writes', () => {
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
