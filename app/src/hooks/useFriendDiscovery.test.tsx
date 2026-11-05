import React from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  browse: vi.fn().mockResolvedValue({ data: [{ id: 'peer', username: 'friend' }], cached: false }),
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'owner' } }) }));
vi.mock('@/db', () => ({ getDb: async () => ({}) }));
vi.mock('@/lib/supabase', () => ({ getSupabase: () => ({}) }));
vi.mock('@/services/friendsService', () => ({ browseSocialProfiles: state.browse }));
vi.mock('./useNetworkStatus', () => ({ useNetworkStatus: () => ({ isOnline: true }) }));
import { useFriendDiscovery } from './useFriendDiscovery';
let result: ReturnType<typeof useFriendDiscovery>;
function Harness({ query, random = false }: { query: string; random?: boolean }) {
  result = useFriendDiscovery(null, query, random);
  return null;
}
afterEach(() => vi.useRealTimers());
it('loads at most five same-goal suggestions without a query, keeps username search and retains onboarding random lookup', async () => {
  vi.useFakeTimers();
  let tree!: ReturnType<typeof create>;
  await act(async () => {
    tree = create(<Harness query="" />);
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(250);
  });
  expect(state.browse).toHaveBeenCalledOnce();
  expect(state.browse).toHaveBeenLastCalledWith(
    expect.anything(),
    expect.anything(),
    'owner',
    true,
    null,
    '',
    '',
    false,
  );
  expect(result.people).toHaveLength(1);
  await act(async () => tree.update(<Harness query="@friend" />));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(250);
  });
  expect(state.browse).toHaveBeenCalledTimes(2);
  expect(result.people).toHaveLength(1);
  await act(async () => tree.update(<Harness query="" />));
  expect(result.people).toEqual([]);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(250);
  });
  expect(state.browse).toHaveBeenCalledTimes(3);
  await act(async () => tree.update(<Harness query="" random />));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(250);
  });
  expect(state.browse).toHaveBeenCalledTimes(4);
  await act(async () => tree.unmount());
});
