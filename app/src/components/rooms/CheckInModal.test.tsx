import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ save: vi.fn(), members: [] as unknown[] }));
vi.mock('react-native', () => ({
  Modal: 'Modal',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  Switch: 'Switch',
  TextInput: 'TextInput',
  View: 'View',
  StyleSheet: { create: (value: unknown) => value },
}));
vi.mock('react-native-svg', () => ({ default: 'Svg', Circle: 'Circle' }));
vi.mock('@calipartner/ui', async () => ({
  ...(await import('../../../../packages/ui/src/tokens')),
  Text: 'Text',
  Button: 'Button',
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'owner' } }) }));
vi.mock('@/hooks/useSquadDay', () => ({
  useSquadDay: () => ({ members: state.members, loading: false, error: false, refresh: vi.fn() }),
}));
vi.mock('@/hooks/useCurrentLocalDate', () => ({
  useCurrentLocalDate: () => ({ localDate: '2026-11-02', timeZone: 'America/New_York' }),
}));
vi.mock('@/hooks/useSubscription', () => ({ useSubscription: () => ({ hasActiveAccess: true }) }));
vi.mock('@/hooks/useBrowserModalBack', () => ({ useBrowserModalBack: () => {} }));
vi.mock('@/db', () => ({ getDb: async () => ({}) }));
vi.mock('@/services/checkInService', () => ({ saveCheckIn: state.save }));
import { CheckInModal, SquadDayPanel, SquadCheckInFeed } from './SquadDayPanel';
let renderer: ReactTestRenderer;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-02T02:00:00Z'));
  state.save.mockReset().mockResolvedValue(undefined);
  state.members = [];
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  vi.useRealTimers();
});
it('saves one offline check-in with explicit privacy and the actual user-local day across UTC midnight', async () => {
  const saved = vi.fn();
  await act(async () => {
    renderer = create(
      <CheckInModal
        roomId="room"
        name="Our squad"
        count={1}
        total={20}
        onClose={vi.fn()}
        onSaved={saved}
      />,
    );
  });
  await act(async () => {
    renderer.root.findByProps({ testID: 'check-in-rest' }).props.onPress();
    renderer.root.findByProps({ testID: 'check-in-share' }).props.onValueChange(false);
    renderer.root.findByProps({ testID: 'check-in-note' }).props.onChangeText('A rest day');
  });
  await act(async () => {
    const button = renderer.root.findByProps({ testID: 'save-check-in' });
    button.props.onPress();
    button.props.onPress();
  });
  expect(state.save).toHaveBeenCalledOnce();
  expect(state.save.mock.calls[0]![1]).toMatchObject({
    userId: 'owner',
    roomId: 'room',
    localDate: '2026-11-01',
    occurredAt: '2026-11-02T02:00:00.000Z',
    activities: ['rest'],
    note: 'A rest day',
    share: false,
  });
  expect(saved).toHaveBeenCalledOnce();
});
it('retains the form and offers retry if durable storage fails', async () => {
  const saved = vi.fn();
  state.save.mockRejectedValueOnce(new Error('storage full'));
  await act(async () => {
    renderer = create(
      <CheckInModal
        roomId="room"
        name="Our squad"
        count={0}
        total={2}
        onClose={vi.fn()}
        onSaved={saved}
      />,
    );
  });
  await act(async () => renderer.root.findByProps({ testID: 'save-check-in' }).props.onPress());
  expect(saved).not.toHaveBeenCalled();
  expect(renderer.root.findAllByProps({ accessibilityRole: 'alert' }).length).toBeGreaterThan(0);
  await act(async () => renderer.root.findByProps({ testID: 'save-check-in' }).props.onPress());
  expect(saved).toHaveBeenCalledOnce();
});
it('shows individual pair statuses and condenses a 20-person squad into waiting avatars and two recent feed rows', async () => {
  const member = (index: number) => ({
    user_id: `member-${index}`,
    nickname: `Member ${index}`,
    is_self: index === 0,
    checked_in: index < 13 ? true : index === 13 ? null : false,
    activities: ['rest'],
    note: `Note ${index}`,
    occurred_at: '2026-11-02T02:00:00Z',
  });
  state.members = [member(0), { ...member(1), checked_in: false }];
  await act(async () => {
    renderer = create(<SquadDayPanel roomId="room" name="Pair" memberCount={2} showFeed={false} />);
  });
  expect(
    renderer.root
      .findAllByType('Text' as React.ElementType)
      .some((node) => node.props.children === 'Member 1'),
  ).toBe(true);
  state.members = Array.from({ length: 20 }, (_, index) => member(index));
  await act(async () =>
    renderer.update(
      <>
        <SquadDayPanel
          roomId="room"
          name="Squad"
          memberCount={20}
          showFeed={false}
          onNudge={vi.fn()}
        />
        <SquadCheckInFeed roomId="room" name="Squad" visible onOpen={vi.fn()} />
      </>,
    ),
  );
  expect(renderer.root.findByProps({ testID: 'nudge-squad-room' }).props.variant).toBe('primary');
  expect(renderer.root.findAllByProps({ accessibilityLabel: 'Member 14' })).toHaveLength(1);
  expect(renderer.root.findAllByProps({ accessibilityLabel: 'Member 19' })).toHaveLength(0);
  expect(renderer.root.findByProps({ testID: 'home-open-all-check-ins' }).props.label).toContain(
    '11',
  );
  expect(
    renderer.root
      .findAllByType('Text' as React.ElementType)
      .some((node) => node.props.children === 'Note 2'),
  ).toBe(false);
});
