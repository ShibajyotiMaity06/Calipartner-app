import React, { useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({
  inbox: vi.fn(),
  respond: vi.fn(),
  profile: vi.fn(),
  user: { id: 'owner' },
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: api.user, profile: null }) }));
vi.mock('@/hooks/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isOnline: true }) }));
vi.mock('expo-router', () => ({
  useFocusEffect: (effect: () => (() => void) | undefined) => useEffect(effect, [effect]),
}));
vi.mock('@/lib/supabase', () => ({ getSupabase: () => ({}) }));
vi.mock('@/db', () => ({ getDb: async () => ({}) }));
vi.mock('@/services/friendsService', () => ({
  loadFriendInbox: api.inbox,
  respondFriendRequest: api.respond,
  loadSocialProfile: api.profile,
  searchSocialProfiles: vi.fn(),
  saveSocialProfile: vi.fn(),
  sendFriendRequest: vi.fn(),
  blockSocialProfile: vi.fn(),
  reportSocialProfile: vi.fn(),
}));
import { useFriends } from './useFriends';
const empty = { incoming: [], outgoing: [], friends: [], quota: {} };
const person = {
  id: 'friend',
  request_id: 'request',
  nickname: 'Friend',
  username: 'friend',
  relationship: 'incoming',
};
let hooks: ReturnType<typeof useFriends>[] = [],
  trees: ReactTestRenderer[] = [];
function Probe({ index = 0 }: { index?: number }) {
  hooks[index] = useFriends();
  return null;
}
beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  vi.useFakeTimers();
  hooks = [];
  trees = [];
  api.inbox.mockResolvedValue({ data: { ...empty, incoming: [person] }, cached: false });
  api.profile.mockResolvedValue({ data: null, cached: false });
});
afterEach(async () => {
  await act(async () => {
    for (const tree of trees) tree.unmount();
  });
  vi.useRealTimers();
});
async function mount(index = 0) {
  await act(async () => {
    trees.push(create(<Probe index={index} />));
  });
}
it('waits for friend acknowledgement, removes the resolved row even if refresh fails and invalidates other mounted inboxes', async () => {
  await mount();
  await mount(1);
  let acknowledge!: (value: unknown) => void;
  api.respond.mockImplementation(
    () =>
      new Promise((done) => {
        acknowledge = done;
      }),
  );
  let result!: Promise<boolean>;
  await act(async () => {
    result = hooks[0]!.respond('request', 'accept', 'friend');
  });
  expect(hooks[0]!.inbox?.incoming).toHaveLength(1);
  api.inbox.mockRejectedValue(new Error('offline'));
  await act(async () => {
    acknowledge({ data: { status: 'accepted' } });
    await result;
  });
  expect(hooks[0]!.inbox?.incoming).toEqual([]);
  expect(api.inbox.mock.calls.length).toBeGreaterThan(3);
});
it('retains a request when its write fails', async () => {
  await mount();
  api.respond.mockRejectedValue(new Error('offline'));
  await act(async () => {
    expect(await hooks[0]!.respond('request', 'accept', 'friend')).toBe(false);
  });
  expect(hooks[0]!.inbox?.incoming).toHaveLength(1);
});
it('refreshes outgoing friend requests resolved by the recipient', async () => {
  api.inbox.mockResolvedValue({ data: { ...empty, outgoing: [person] }, cached: false });
  await mount();
  api.inbox.mockResolvedValue({
    data: { ...empty, friends: [{ ...person, relationship: 'friend' }] },
    cached: false,
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5000);
  });
  expect(hooks[0]!.inbox?.outgoing).toEqual([]);
  expect(hooks[0]!.inbox?.friends).toHaveLength(1);
});
