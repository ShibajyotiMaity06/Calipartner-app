import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  paid: false,
  count: 1,
  roomState: 'dormant',
  roomId: 'room',
  chat: vi.fn(),
  refresh: vi.fn(),
  copy: vi.fn().mockResolvedValue(true),
  share: vi.fn().mockResolvedValue({ action: 'sharedAction' }),
}));
vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Modal: 'Modal',
  Pressable: 'Pressable',
  RefreshControl: 'RefreshControl',
  SafeAreaView: 'SafeAreaView',
  ScrollView: 'ScrollView',
  Text: 'Text',
  View: 'View',
  Share: { share: state.share },
  StyleSheet: { create: (v: unknown) => v },
}));
vi.mock('expo-clipboard', () => ({ setStringAsync: state.copy }));
vi.mock('expo-router', () => ({
  useFocusEffect: () => {},
  useNavigation: () => ({ setOptions: vi.fn() }),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
vi.mock('@calipartner/ui', () => ({
  Text: 'Text',
  Button: 'Button',
  dark: {},
  onboardingLayout: { touch: 48 },
  radius: {},
  space: [],
  useTheme: () => ({ colors: {} }),
}));
vi.mock('@/theme/useTheme', () => ({ useTheme: () => ({ colors: {} }) }));
vi.mock('@/theme/tokens', () => ({ fontSize: {}, radius: {}, spacing: {} }));
vi.mock('@/hooks/useRooms', () => ({
  useRooms: () => ({
    rooms: [
      {
        id: state.roomId,
        code: 'CP1234',
        name: 'Our room',
        state: state.roomState,
        member_count: state.count,
      },
    ],
    loading: false,
    refresh: vi.fn(),
  }),
}));
vi.mock('@/hooks/useRoomSnapshot', () => ({
  useRoomSnapshot: () => ({
    refresh: state.refresh,
    snapshot: {
      room: { id: state.roomId, state: state.roomState },
      caller_id: 'self',
      members: Array.from({ length: state.count }, (_, i) => ({
        user_id: i ? `friend${i}` : 'self',
        status: 'active',
      })),
    },
    loading: false,
  }),
}));
vi.mock('@/hooks/useRoomRequests', () => ({
  useRoomRequests: () => ({ incoming: [], outgoing: [] }),
}));
vi.mock('@/hooks/useRoomActions', () => ({ useRoomActions: () => ({}) }));
vi.mock('@/hooks/useFriends', () => ({ useFriends: () => ({ inbox: { incoming: [] } }) }));
vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => ({
    hasActiveAccess: state.paid,
    currentTier: state.paid ? 'plus' : 'free',
    loading: false,
  }),
}));
vi.mock('@/hooks/useRoomChat', () => ({
  useRoomChat: (...args: unknown[]) => {
    state.chat(...args);
    return { unreadCount: 5 };
  },
}));
vi.mock('@/components/chat', () => ({ ChatView: 'ChatView' }));
vi.mock('@/components/rooms/BasicRoomCard', () => ({ BasicRoomCard: 'BasicRoomCard' }));
vi.mock('@/components/rooms/RoomExtras', () => ({ RoomExtras: 'RoomExtras' }));
vi.mock('@/components/rooms', () =>
  Object.fromEntries(
    [
      'BlockUserModal',
      'DormantWaitingState',
      'InviteUserModal',
      'JoinByCodeModal',
      'LockedRoomPausedState',
      'MembersTab',
      'NudgeModal',
      'OverCapacityBanner',
      'PaywallModal',
      'PrivacySettingsModal',
      'ReactionModal',
      'ReportModal',
      'RequestsInboxModal',
      'RoomFullNotice',
      'RoomHeader',
      'RoomOverviewRow',
      'RoomProgressView',
      'RoomSettingsModal',
      'SharedMealCard',
      'SideBySideCard',
      'SquadConnectFlow',
      'TrialBanner',
    ].map((name) => [name, name]),
  ),
);
import RoomScreen from '@/app/(tabs)/room';
import { DormantWaitingState } from './DormantWaitingState';
import { RoomHeader } from './RoomHeader';

beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  state.paid = false;
  state.count = 1;
  state.roomState = 'dormant';
  vi.clearAllMocks();
});
const node = (tree: ReactTestRenderer, type: string) =>
  tree.root.findByType(type as React.ElementType);
describe('room invitation and viewer access', () => {
  it('refreshes a pending room if realtime misses acceptance and stops once joined', async () => {
    vi.useFakeTimers();
    let tree!: ReactTestRenderer;
    try {
      await act(async () => {
        tree = create(<RoomScreen />);
      });
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });
      expect(state.refresh).toHaveBeenCalledTimes(1);
      state.count = 2;
      state.roomState = 'active';
      await act(async () => {
        tree.update(<RoomScreen />);
      });
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });
      expect(state.refresh).toHaveBeenCalledTimes(1);
      await act(async () => tree.unmount());
    } finally {
      vi.useRealTimers();
    }
  });
  it('shows only waiting content while pending; progress explains acceptance and Free chat never mounts or fetches', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(<RoomScreen />);
    });
    expect(node(tree, 'DormantWaitingState').props.roomCode).toBe('CP1234');
    for (const type of [
      'RoomExtras',
      'SideBySideCard',
      'BasicRoomCard',
      'RoomProgressView',
      'MembersTab',
      'ChatView',
    ])
      expect(tree.root.findAllByType(type as React.ElementType)).toHaveLength(0);
    expect(state.chat.mock.lastCall?.[0]).toBe(null);
    expect(node(tree, 'RoomHeader').props.chatUnreadCount).toBe(0);
    await act(async () => node(tree, 'RoomHeader').props.onSelectSegment('progress'));
    expect(
      tree.root
        .findAllByType('Text' as React.ElementType)
        .map((n) => n.children.join(''))
        .join(' '),
    ).toContain('Progress opens when your friend accepts');
    await act(async () => node(tree, 'RoomHeader').props.onSelectSegment('chat'));
    expect(
      tree.root
        .findAllByType('Text' as React.ElementType)
        .map((n) => n.children.join(''))
        .join(' '),
    ).toContain('Get Plus or Pro to open room chat.');
    expect(tree.root.findAllByType('ChatView' as React.ElementType)).toHaveLength(0);
    await act(async () => tree.unmount());
  });
  it.each([
    [false, 3, false],
    [true, 2, false],
    [true, 3, true],
  ])('Members visibility for paid=%s and count=%s is %s', async (paid, count, shown) => {
    state.paid = paid;
    state.count = count;
    state.roomState = 'active';
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(<RoomScreen />);
    });
    expect(node(tree, 'RoomHeader').props.showMembers).toBe(shown);
    await act(async () => node(tree, 'RoomHeader').props.onSelectSegment('members'));
    expect(tree.root.findAllByType('MembersTab' as React.ElementType)).toHaveLength(shown ? 1 : 0);
    await act(async () => node(tree, 'RoomHeader').props.onSelectSegment('chat'));
    expect(tree.root.findAllByType('ChatView' as React.ElementType)).toHaveLength(paid ? 1 : 0);
    expect(state.chat.mock.lastCall?.[0]).toBe(null);
    await act(async () => tree.unmount());
  });
  it('waiting code has only Copy/Share actions and uses the real clipboard', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(<DormantWaitingState roomCode="CP1234" />);
    });
    expect(tree.root.findAllByType('Pressable' as React.ElementType)).toHaveLength(2);
    await act(async () =>
      tree.root.findByProps({ testID: 'btn-dormant-copy-code' }).props.onPress(),
    );
    expect(state.copy).toHaveBeenCalledWith('CP1234');
    await act(async () =>
      tree.root.findByProps({ testID: 'btn-dormant-share-code' }).props.onPress(),
    );
    expect(state.share).toHaveBeenCalledWith({
      message: 'Join my room on CaliPartner. Room code: CP1234',
    });
    await act(async () => tree.unmount());
  });
  it('RoomHeader physically removes the Members tab for a pair', async () => {
    let tree!: ReactTestRenderer;
    const props = {
      currentRoom: { id: 'r', name: 'Pair', code: 'CP1234', member_count: 2 },
      allRooms: [],
      activeSegment: 'today',
      pendingRequestsCount: 0,
      streakDays: 0,
    } as unknown as React.ComponentProps<typeof RoomHeader>;
    await act(async () => {
      tree = create(<RoomHeader {...props} showMembers={false} isWaiting />);
    });
    expect(tree.root.findAllByProps({ testID: 'room-tab-members' })).toHaveLength(0);
    expect(tree.root.findAllByProps({ testID: 'btn-copy-room-code' })).toHaveLength(0);
    await act(async () => tree.update(<RoomHeader {...props} showMembers />));
    expect(tree.root.findAllByProps({ testID: 'room-tab-members' })).toHaveLength(1);
    await act(async () => tree.unmount());
  });
});
