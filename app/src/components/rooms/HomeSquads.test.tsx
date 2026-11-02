import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
import type { RoomSummary } from '@/types/rooms';
const state = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  View: 'View',
  StyleSheet: { create: (value: unknown) => value },
  useWindowDimensions: () => ({ width: 390, fontScale: 1 }),
}));
vi.mock('expo-router', () => ({ useRouter: () => ({ push: state.push }) }));
vi.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
vi.mock('@calipartner/ui', async () => ({
  ...(await import('../../../../packages/ui/src/tokens')),
  Text: 'Text',
}));
vi.mock('./SquadDayPanel', () => ({
  SquadDayPanel: 'SquadDayPanel',
  SquadCheckInFeed: 'SquadCheckInFeed',
}));
import { HomeSquads } from './HomeSquads';
let renderer: ReactTestRenderer;
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
  vi.clearAllMocks();
});
const rooms = [
  { id: 'pair', name: 'Our pair', member_count: 2, member_cap: 2, state: 'active' },
  { id: 'large', name: 'Our squad', member_count: 20, member_cap: 20, state: 'active' },
] as RoomSummary[];
it('uses actual pair and 20-person counts, opens the selected squad and scrolls to a create action', async () => {
  await act(async () => {
    renderer = create(
      <HomeSquads rooms={rooms} loading={false} error={null} onRetry={vi.fn()} visible />,
    );
  });
  const panels = () => renderer.root.findAllByType('SquadDayPanel' as React.ElementType);
  expect(panels().map((panel) => panel.props.memberCount)).toEqual([2, 20]);
  expect(panels().map((panel) => panel.props.visible)).toEqual([true, false]);
  await act(async () =>
    renderer.root
      .findByProps({ testID: 'home-squad-carousel' })
      .props.onScroll({ nativeEvent: { contentOffset: { x: 332 } } }),
  );
  expect(panels().map((panel) => panel.props.visible)).toEqual([false, true]);
  panels()[1]!.props.onOpen();
  expect(state.push).toHaveBeenLastCalledWith({
    pathname: '/(tabs)/room',
    params: { room: 'large' },
  });
  renderer.root.findByProps({ testID: 'home-create-squad-end' }).props.onPress();
  expect(state.push).toHaveBeenLastCalledWith({
    pathname: '/(tabs)/room',
    params: { action: 'create' },
  });
  renderer.root.findByProps({ testID: 'home-create-squad-top' }).props.onPress();
  expect(state.push).toHaveBeenCalledTimes(3);
});
it('shows empty, loading and retry states without inventing a squad', async () => {
  const retry = vi.fn();
  await act(async () => {
    renderer = create(<HomeSquads rooms={[]} loading error={null} onRetry={retry} visible />);
  });
  expect(renderer.root.findAllByType('SquadDayPanel' as React.ElementType)).toHaveLength(0);
  expect(renderer.root.findByProps({ testID: 'home-create-squad-end' })).toBeDefined();
  await act(async () =>
    renderer.update(
      <HomeSquads
        rooms={[]}
        loading={false}
        error={new Error('offline')}
        onRetry={retry}
        visible
      />,
    ),
  );
  renderer.root.findByProps({ testID: 'home-squad-retry' }).props.onPress();
  expect(retry).toHaveBeenCalledOnce();
});
