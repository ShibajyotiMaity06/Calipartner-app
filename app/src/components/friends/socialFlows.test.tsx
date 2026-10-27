import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ discovery: vi.fn(), friends: vi.fn() }));
vi.mock('react-native', () => ({
  View: 'View',
  Pressable: 'Pressable',
  TextInput: 'TextInput',
  ScrollView: 'ScrollView',
  StyleSheet: { create: (value: unknown) => value },
}));
vi.mock('@calipartner/ui', () => ({
  Avatar: 'Avatar',
  Button: 'Button',
  Card: 'Card',
  Text: 'Text',
  CheckIcon: 'CheckIcon',
  useTheme: () => ({ colors: {} }),
  space: [],
  radius: {},
  onboardingType: {},
  onboardingLayout: {},
}));
vi.mock('@/hooks/useFriendDiscovery', () => ({ useFriendDiscovery: mocks.discovery }));
vi.mock('@/hooks/useFriends', () => ({ useFriends: mocks.friends }));
import { FriendDiscovery } from './FriendDiscovery';
import { FriendRequests } from './FriendRequests';
import { SquadConnectFlow } from '@/components/rooms/SquadConnectFlow';
const people = [1, 2].map((id) => ({
  id: String(id),
  nickname: `Friend ${id}`,
  username: `friend_${id}`,
  avatar_url: null,
  relationship: 'none' as const,
  request_id: `request_${id}`,
  bio: '',
  training_style: '',
  instagram_handle: '',
  website_url: '',
  is_public: false,
}));
beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  mocks.discovery.mockReturnValue({
    people,
    loading: false,
    error: false,
    cached: false,
    hasMore: false,
    load: vi.fn(),
  });
});
describe('real friend interface flows', () => {
  it('selects only one goal and keeps search available across categories', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(<FriendDiscovery busy={false} onOpen={vi.fn()} onSend={vi.fn()} />);
    });
    await act(async () => tree.root.findByProps({ testID: 'friend-filter-bulk' }).props.onPress());
    expect(mocks.discovery).toHaveBeenLastCalledWith('bulk', '', false);
    await act(async () => tree.root.findByProps({ testID: 'friend-filter-cut' }).props.onPress());
    expect(
      tree.root.findByProps({ testID: 'friend-filter-bulk' }).props.accessibilityState.checked,
    ).toBe(false);
    expect(
      tree.root.findByProps({ testID: 'friend-filter-cut' }).props.accessibilityState.checked,
    ).toBe(true);
    await act(async () =>
      tree.root.findByProps({ testID: 'friend-username-search' }).props.onChangeText('@friend_2'),
    );
    expect(mocks.discovery).toHaveBeenLastCalledWith('cut', '@friend_2', false);
    await act(async () => tree.unmount());
  });
  it('uses real request actions and disables sends for queued requests and exhausted quota', async () => {
    const send = vi.fn().mockResolvedValue(true);
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(
        <FriendDiscovery
          busy={false}
          onOpen={vi.fn()}
          onSend={send}
          queuedIds={['1']}
          remaining={2}
        />,
      );
    });
    expect(tree.root.findByProps({ testID: 'send-friend-1' }).props.disabled).toBe(true);
    await act(async () => tree.root.findByProps({ testID: 'send-friend-2' }).props.onPress());
    expect(send).toHaveBeenCalledWith('2');
    await act(async () =>
      tree.update(<FriendDiscovery busy={false} onOpen={vi.fn()} onSend={send} remaining={0} />),
    );
    expect(tree.root.findByProps({ testID: 'send-friend-2' }).props.disabled).toBe(true);
    await act(async () => tree.unmount());
  });
  it('free squad selects one real friend, offers upgrade for a second and submits selected IDs', async () => {
    const createSquad = vi.fn().mockResolvedValue({ room_id: 'squad-id' });
    const upgrade = vi.fn();
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(
        <SquadConnectFlow
          isPlusOrPro={false}
          friends={people}
          onOpenPaywall={upgrade}
          onCreateSquad={createSquad}
          onJoinSquad={vi.fn()}
        />,
      );
    });
    expect(tree.root.findAllByProps({ testID: 'option-1-on-1-partner' })).toHaveLength(0);
    await act(async () => tree.root.findByProps({ testID: 'option-create-squad' }).props.onPress());
    await act(async () =>
      tree.root.findByProps({ testID: 'squad-name' }).props.onChangeText('Our squad'),
    );
    await act(async () => tree.root.findByProps({ testID: 'squad-friend-1' }).props.onPress());
    await act(async () => tree.root.findByProps({ testID: 'squad-friend-2' }).props.onPress());
    expect(upgrade).toHaveBeenCalledOnce();
    expect(
      tree.root.findByProps({ testID: 'squad-friend-2' }).props.accessibilityState.checked,
    ).toBe(false);
    await act(async () => tree.root.findByProps({ testID: 'create-squad-submit' }).props.onPress());
    expect(createSquad).toHaveBeenCalledWith('Our squad', ['1']);
    await act(async () => tree.unmount());
  });
  it('accepts incoming requests directly in the inbox and cancels outgoing requests there', async () => {
    const respond = vi.fn();
    const state = {
      inbox: { incoming: [people[0]], outgoing: [people[1]] },
      outbox: [],
      loading: false,
      error: null,
      busy: false,
      cached: false,
      respond,
    };
    mocks.friends.mockReturnValue(state);
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(<FriendRequests tab="incoming" />);
    });
    await act(async () => tree.root.findByProps({ testID: 'accept-friend-1' }).props.onPress());
    expect(respond).toHaveBeenCalledWith('request_1', 'accept', '1');
    await act(async () => tree.update(<FriendRequests tab="outgoing" />));
    await act(async () => tree.root.findByProps({ testID: 'cancel-friend-2' }).props.onPress());
    expect(respond).toHaveBeenCalledWith('request_2', 'cancel', '2');
    await act(async () => tree.unmount());
  });
});
