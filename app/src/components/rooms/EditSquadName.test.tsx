import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { RoomSummary } from '@/types/rooms';
const api = vi.hoisted(() => ({
  rpc: vi.fn(),
  list: vi.fn(),
  uuid: vi.fn(),
  router: { push: vi.fn() },
}));
vi.mock('react-native', () => ({
  View: 'View',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  Modal: 'Modal',
  ActivityIndicator: 'ActivityIndicator',
  Platform: { OS: 'web' },
  Alert: { alert: vi.fn() },
  StyleSheet: { create: (value: unknown) => value },
  useWindowDimensions: () => ({ width: 390, fontScale: 1 }),
}));
vi.mock('@calipartner/ui', async () => ({
  ...(await import('../../../../packages/ui/src/tokens')),
  Text: 'Text',
  SegmentedControl: 'SegmentedControl',
  Button: 'Button',
  Field: 'Field',
  Avatar: 'Avatar',
  Sheet: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
    visible ? <>{children}</> : null,
}));
vi.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
vi.mock('expo-router', () => ({ useRouter: () => api.router }));
vi.mock('expo-clipboard', () => ({ setStringAsync: vi.fn() }));
vi.mock('@/theme/useTheme', async () => {
  const { dark } = await import('../../../../packages/ui/src/tokens');
  return { useTheme: () => ({ colors: dark }) };
});
vi.mock('@/hooks/useBrowserModalBack', () => ({
  useBrowserModalBack: vi.fn(),
  closeBrowserModalsThen: (action: () => void) => action(),
}));
vi.mock('@/lib/supabase', () => ({ getSupabase: () => ({ rpc: api.rpc }) }));
vi.mock('@/services/foodService', () => ({ generateClientUuid: api.uuid }));
vi.mock('@/services/roomService', () => ({
  listUserRooms: api.list,
  createRoom: vi.fn(),
  joinRoomByCode: vi.fn(),
  leaveRoom: vi.fn(),
}));
vi.mock('./HomeSquadLeaderboard', () => ({ HomeSquadLeaderboard: 'HomeSquadLeaderboard' }));
vi.mock('./SquadViews', () => ({ squadStyles: {}, useSquadStyles: () => ({}) }));
import { HomeSquads } from './HomeSquads';
import { RoomHeader } from './RoomHeader';
import { RoomSettingsModal } from './RoomSettingsModal';
import { useRooms } from '@/hooks/useRooms';
const room = {
  id: 'hosted',
  name: 'Original squad',
  role: 'host',
  state: 'active',
  member_count: 2,
  code: 'ABCD',
  who_can_invite: 'host_only',
} as RoomSummary;
function Harness() {
  const home = useRooms(),
    squad = useRooms();
  const current = squad.rooms[0];
  return (
    <>
      <HomeSquads
        rooms={home.rooms}
        loading={home.loading}
        error={home.error}
        onRetry={home.refresh}
        visible
      />
      {current && (
        <>
          <RoomHeader
            currentRoom={current}
            allRooms={squad.rooms}
            pendingRequestsCount={0}
            activeSegment="today"
            onSelectSegment={vi.fn()}
            onOpenInbox={vi.fn()}
            onOpenSettings={vi.fn()}
            onOpenPrivacy={vi.fn()}
          />
          <RoomSettingsModal
            visible
            room={current}
            members={[]}
            currentUserId="host"
            onClose={vi.fn()}
            onSetWhoCanInvite={vi.fn()}
            onRemoveMember={vi.fn()}
            onTransferHost={vi.fn()}
            onLeaveRoom={vi.fn()}
            onReportUser={vi.fn()}
            onBlockUser={vi.fn()}
          />
        </>
      )}
    </>
  );
}
let tree: ReactTestRenderer;
beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  api.uuid.mockReturnValue('request-one');
  api.list.mockResolvedValue([room, { ...room, id: 'joined', role: 'member' }]);
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});
it('offers Overview and settings host entry points without a Home pencil, preserves failed drafts and retry IDs, and updates Home and Squad only after acknowledgement', async () => {
  await act(async () => {
    tree = create(<Harness />);
  });
  for (const location of ['squad', 'settings'])
    expect(tree.root.findByProps({ testID: `${location}-edit-squad-name-hosted` })).toBeDefined();
  expect(tree.root.findAllByProps({ testID: 'home-edit-squad-name-joined' })).toHaveLength(0);
  await act(async () =>
    tree.root.findByProps({ testID: 'squad-edit-squad-name-hosted' }).props.onPress(),
  );
  expect(tree.root.findByProps({ testID: 'input-squad-name' }).props.value).toBe('Original squad');
  await act(async () =>
    tree.root.findByProps({ testID: 'input-squad-name' }).props.onChangeText('  Morning squad  '),
  );
  api.rpc.mockResolvedValueOnce({ data: null, error: { message: 'offline' } });
  await act(async () => tree.root.findByProps({ testID: 'save-squad-name' }).props.onPress());
  expect(tree.root.findByProps({ testID: 'squad-name-error' })).toBeDefined();
  expect(tree.root.findByProps({ testID: 'input-squad-name' }).props.value).toBe(
    '  Morning squad  ',
  );
  let acknowledge!: (result: unknown) => void;
  api.rpc.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        acknowledge = resolve;
      }),
  );
  let saving!: Promise<void>;
  await act(async () => {
    saving = tree.root.findByProps({ testID: 'save-squad-name' }).props.onPress();
  });
  expect(
    tree.root
      .findByProps({ testID: 'home-open-title-hosted' })
      .findByType('Text' as React.ElementType).props.children,
  ).toBe('Original squad');
  expect(tree.root.findByProps({ testID: 'save-squad-name' }).props.disabled).toBe(true);
  await act(async () => {
    acknowledge({
      data: { request_id: 'request-one', room_id: 'hosted', name: 'Morning squad' },
      error: null,
    });
    await saving;
  });
  expect(api.rpc.mock.calls.map((call) => call[1])).toEqual(
    Array(2).fill({ p_client_id: 'request-one', p_room_id: 'hosted', p_name: 'Morning squad' }),
  );
  expect(
    tree.root
      .findByProps({ testID: 'home-open-title-hosted' })
      .findByType('Text' as React.ElementType).props.children,
  ).toBe('Morning squad');
  expect(
    tree.root.findByProps({ testID: 'btn-room-title-switcher' }).props.accessibilityLabel,
  ).toBe('Morning squad');
  for (const location of ['squad', 'settings']) {
    await act(async () =>
      tree.root.findByProps({ testID: `${location}-edit-squad-name-hosted` }).props.onPress(),
    );
    expect(tree.root.findByProps({ testID: 'input-squad-name' }).props.value).toBe('Morning squad');
    await act(async () => tree.root.findByProps({ testID: 'cancel-squad-name' }).props.onPress());
  }
  expect(api.rpc).toHaveBeenCalledTimes(2);
});
it('preserves the confirmed name when Home finishes an older initial room read', async () => {
  let finishHome!: (rooms: RoomSummary[]) => void;
  api.list
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishHome = resolve;
        }),
    )
    .mockResolvedValueOnce([room]);
  await act(async () => {
    tree = create(<Harness />);
  });
  await act(async () =>
    tree.root.findByProps({ testID: 'squad-edit-squad-name-hosted' }).props.onPress(),
  );
  await act(async () =>
    tree.root.findByProps({ testID: 'input-squad-name' }).props.onChangeText('Confirmed name'),
  );
  api.rpc.mockResolvedValueOnce({
    data: { request_id: 'request-one', room_id: 'hosted', name: 'Confirmed name' },
    error: null,
  });
  await act(async () => tree.root.findByProps({ testID: 'save-squad-name' }).props.onPress());
  await act(async () => finishHome([room]));
  expect(
    tree.root
      .findByProps({ testID: 'home-open-title-hosted' })
      .findByType('Text' as React.ElementType).props.children,
  ).toBe('Confirmed name');
});
it('blocks empty and oversized names and refuses an unacknowledged response', async () => {
  await act(async () => {
    tree = create(<Harness />);
  });
  await act(async () =>
    tree.root.findByProps({ testID: 'settings-edit-squad-name-hosted' }).props.onPress(),
  );
  for (const name of ['   ', 'x'.repeat(101)]) {
    await act(async () =>
      tree.root.findByProps({ testID: 'input-squad-name' }).props.onChangeText(name),
    );
    expect(tree.root.findByProps({ testID: 'save-squad-name' }).props.disabled).toBe(true);
  }
  await act(async () =>
    tree.root.findByProps({ testID: 'input-squad-name' }).props.onChangeText('New squad'),
  );
  api.rpc.mockResolvedValueOnce({
    data: { room_id: 'different-room', request_id: 'request-one', name: 'New squad' },
    error: null,
  });
  await act(async () => tree.root.findByProps({ testID: 'save-squad-name' }).props.onPress());
  expect(tree.root.findByProps({ testID: 'squad-name-error' })).toBeDefined();
  expect(
    tree.root.findByProps({ testID: 'btn-room-title-switcher' }).props.accessibilityLabel,
  ).toBe('Original squad');
});
