import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  paid: false,
  count: 2,
  roomState: 'active',
  params: {} as Record<string, string>,
  push: vi.fn(),
  navigate: vi.fn(),
  setParams: vi.fn(),
  refresh: vi.fn().mockResolvedValue(undefined),
  chat: vi.fn(),
  back: undefined as (() => boolean) | undefined,
}));
vi.mock('react-native', () => ({
  View: 'View',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  SafeAreaView: 'SafeAreaView',
  RefreshControl: 'RefreshControl',
  useWindowDimensions: () => ({ fontScale: 1 }),
  StyleSheet: { create: (s: unknown) => s, hairlineWidth: 1 },
  BackHandler: {
    addEventListener: (_event: string, fn: () => boolean) => {
      state.back = fn;
      return { remove: vi.fn() };
    },
  },
}));
vi.mock('expo-router', async () => {
  const React = await import('react');
  const router = { push: state.push, navigate: state.navigate, setParams: state.setParams };
  return {
    useRouter: () => router,
    useLocalSearchParams: () => state.params,
    useFocusEffect: (callback: () => void) => React.useEffect(callback, [callback]),
  };
});
vi.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
vi.mock('expo-clipboard', () => ({ setStringAsync: vi.fn().mockResolvedValue(true) }));
vi.mock('@calipartner/ui', async () => ({
  ...(await import('../../../../packages/ui/src/tokens')),
  Text: 'Text',
  Button: 'Button',
  Avatar: 'Avatar',
  Sheet: 'Sheet',
  getTabBarHeight: () => 64,
}));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'self' }, profile: { nickname: 'You', username: 'self' } }),
}));
vi.mock('@/hooks/useBrowserModalBack', () => ({
  useBrowserModalBack: vi.fn(),
  closeBrowserModalsThen: (callback: () => void) => callback(),
}));
vi.mock('@/hooks/useRooms', () => ({
  useRooms: () => ({
    rooms: state.count
      ? [
          {
            id: 'room',
            code: 'TEST01',
            name: 'Our squad',
            member_count: state.count,
            member_cap: 20,
            role: 'host',
            state: state.roomState,
          },
        ]
      : [],
    loading: false,
    error: null,
    refresh: state.refresh,
    createRoom: vi.fn(),
    joinByCode: vi.fn(),
    leaveRoom: vi.fn(),
  }),
}));
vi.mock('@/hooks/useRoomSnapshot', () => ({
  useRoomSnapshot: () => ({ snapshot: { members: [] }, refresh: state.refresh }),
}));
vi.mock('@/hooks/useRoomActions', () => ({ useRoomActions: () => ({}) }));
vi.mock('@/hooks/useRoomRequests', () => ({
  useRoomRequests: () => ({ incoming: [], outgoing: [], refresh: state.refresh }),
}));
vi.mock('@/hooks/useFriends', () => ({
  useFriends: () => ({ inbox: { incoming: [], friends: [] }, refresh: state.refresh }),
}));
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
    return { messages: [], unreadCount: 4 };
  },
}));
vi.mock('@/hooks/useSquad', () => ({
  useSquadToday: () => ({
    data: {
      room_id: 'room',
      members: Array.from({ length: state.count }, (_, index) => ({
        user_id: index ? 'peer' + index : 'self',
        username: 'user' + index,
        nickname: index ? 'Person ' + index : 'You',
        is_self: !index,
        calories: 1200,
        protein: 75,
        carbs: 150,
        fat: 35,
        steps: 4000,
        targets: { calories: 2400, protein: 150, carbs: 300, fat: 70, steps: 8000 },
        score: 50,
        rank: 1,
      })),
    },
    loading: false,
    error: false,
    refresh: state.refresh,
  }),
}));
vi.mock('@/components/chat', () => ({ ChatView: 'ChatView' }));
vi.mock('@/components/rooms/SquadConnectModal', () => ({ SquadConnectModal: 'SquadConnectModal' }));
vi.mock('@/components/rooms/SquadMemberPicker', () => ({ SquadMemberPicker: 'SquadMemberPicker' }));
vi.mock('@/components/rooms/SquadVisibilityModal', () => ({
  SquadVisibilityModal: 'SquadVisibilityModal',
}));
vi.mock('@/components/rooms', () =>
  Object.fromEntries(
    [
      'DormantWaitingState',
      'InviteUserModal',
      'JoinByCodeModal',
      'LockedRoomPausedState',
      'PaywallModal',
      'RequestsInboxModal',
      'RoomHeader',
      'RoomSettingsModal',
      'BlockUserModal',
      'ReportModal',
    ].map((name) => [name, name]),
  ),
);
import RoomScreen from '@/app/(tabs)/room';
import { RoomHeader } from './RoomHeader';
let tree: ReactTestRenderer;
beforeEach(() => {
  state.paid = false;
  state.count = 2;
  state.roomState = 'active';
  state.params = {};
  vi.clearAllMocks();
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
  vi.useRealTimers();
});
const rows = () =>
  tree.root.findAll(
    (node) =>
      typeof node.props.testID === 'string' && node.props.testID.startsWith('squad-member-'),
  );
it('shows both people for a Free pair, removes check-ins and nudges, and keeps Free chat behind Plus', async () => {
  await act(async () => {
    tree = create(<RoomScreen />);
  });
  expect(rows()).toHaveLength(2);
  expect(
    tree.root.findAll((node) => /check-in|nudge|select-all/.test(node.props.testID ?? '')),
  ).toHaveLength(0);
  await act(async () =>
    tree.root.findByType('RoomHeader' as React.ElementType).props.onSelectSegment('chat'),
  );
  expect(tree.root.findAllByType('ChatView' as React.ElementType)).toHaveLength(0);
  expect(state.chat.mock.lastCall?.[0]).toBeNull();
});
it('shows only the top three on Overview and all 20 on Leaderboard without a paid gate', async () => {
  state.count = 20;
  await act(async () => {
    tree = create(<RoomScreen />);
  });
  expect(rows()).toHaveLength(3);
  await act(async () => tree.root.findByProps({ testID: 'open-full-leaderboard' }).props.onPress());
  expect(rows()).toHaveLength(20);
  await act(async () => rows()[19]!.props.onPress());
  expect(state.push).toHaveBeenLastCalledWith('/squad/person?room=room&member=peer19');
});
it('allows either of exactly two comparison slots to select another member', async () => {
  state.count = 3;
  await act(async () => {
    tree = create(<RoomScreen />);
  });
  await act(async () => tree.root.findByProps({ testID: 'compare-choose-left' }).props.onPress());
  const picker = tree.root.findByType('SquadMemberPicker' as React.ElementType);
  expect(picker.props.excludedId).toBe('peer1');
  await act(async () => {
    picker.props.onSelect('peer2');
    picker.props.onClose();
  });
  await act(async () =>
    tree.root.findByProps({ testID: 'open-two-person-compare' }).props.onPress(),
  );
  expect(state.push).toHaveBeenLastCalledWith('/squad/compare?room=room&left=peer2&right=peer1');
});
it('opens the tagged room directly in paid chat and passes its exact message ID', async () => {
  state.paid = true;
  state.params = { room: 'room', tab: 'chat', mention: 'old-message' };
  await act(async () => {
    tree = create(<RoomScreen />);
  });
  const chat = tree.root.findByType('ChatView' as React.ElementType);
  expect(chat.props.roomId).toBe('room');
  expect(chat.props.focusedMentionId).toBe('old-message');
});
it('keeps pending rooms in the acceptance state and polls until another person joins', async () => {
  vi.useFakeTimers();
  state.count = 1;
  state.roomState = 'dormant';
  await act(async () => {
    tree = create(<RoomScreen />);
  });
  expect(tree.root.findByType('DormantWaitingState' as React.ElementType).props.roomCode).toBe(
    'TEST01',
  );
  expect(rows()).toHaveLength(0);
  state.refresh.mockClear();
  await act(async () => {
    vi.advanceTimersByTime(5000);
  });
  expect(state.refresh).toHaveBeenCalled();
  state.count = 2;
  state.roomState = 'active';
  await act(async () => tree.update(<RoomScreen />));
  state.refresh.mockClear();
  await act(async () => {
    vi.advanceTimersByTime(5000);
  });
  expect(state.refresh).not.toHaveBeenCalled();
});
it('keeps just Overview, Leaderboard and Chat in the squad header for every room size', async () => {
  await act(async () => {
    tree = create(
      <RoomHeader
        currentRoom={{ id: 'room', name: 'Our squad', code: 'TEST01', member_count: 20 } as never}
        allRooms={[]}
        pendingRequestsCount={0}
        activeSegment="today"
        onSelectSegment={vi.fn()}
        onOpenInbox={vi.fn()}
        onOpenSettings={vi.fn()}
        onOpenPrivacy={vi.fn()}
      />,
    );
  });
  expect(
    tree.root
      .findAll((node) => node.props.accessibilityRole === 'tab')
      .map((node) => node.props.testID),
  ).toEqual(['room-tab-today', 'room-tab-progress', 'room-tab-chat']);
});

it('cancels a Home create/join sheet back to Home instead of leaving you on the Squad screen', async () => {
  state.params = { action: 'create', returnTo: 'home' };
  await act(async () => {
    tree = create(<RoomScreen />);
  });
  await act(async () =>
    tree.root.findByType('SquadConnectModal' as React.ElementType).props.onClose(),
  );
  expect(state.navigate).toHaveBeenLastCalledWith('/(tabs)/today');
});
