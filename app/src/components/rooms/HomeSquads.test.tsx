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
vi.mock('./HomeSquadLeaderboard', () => ({ HomeSquadLeaderboard: 'HomeSquadLeaderboard' }));
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
  const panels = () => renderer.root.findAllByType('HomeSquadLeaderboard' as React.ElementType);
  expect(panels().map((panel) => panel.props.memberCount)).toEqual([2, 20]);
  expect(panels().map((panel) => panel.props.visible)).toEqual([true, false]);
  await act(async () =>
    renderer.root
      .findByProps({ testID: 'home-squad-carousel' })
      .props.onScroll({ nativeEvent: { contentOffset: { x: 332 } } }),
  );
  expect(panels().map((panel) => panel.props.visible)).toEqual([false, true]);
  renderer.root.findByProps({ testID: 'home-open-title-large' }).props.onPress();
  expect(state.push).toHaveBeenLastCalledWith({
    pathname: '/(tabs)/room',
    params: { room: 'large' },
  });
  renderer.root.findByProps({ testID: 'home-create-squad-end' }).props.onPress();
  expect(state.push).toHaveBeenLastCalledWith({
    pathname: '/(tabs)/room',
    params: { action: 'create', returnTo: 'home' },
  });
  renderer.root.findByProps({ testID: 'home-open-friends' }).props.onPress();
  expect(state.push).toHaveBeenLastCalledWith('/friends');
  expect(state.push).toHaveBeenCalledTimes(3);
});
it('shows empty, loading and retry states without inventing a squad', async () => {
  const retry = vi.fn();
  await act(async () => {
    renderer = create(<HomeSquads rooms={[]} loading error={null} onRetry={retry} visible />);
  });
  expect(renderer.root.findAllByType('HomeSquadLeaderboard' as React.ElementType)).toHaveLength(0);
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

it('aligns squad and create cards at the same height and width without a separate Home feed', async () => {
  await act(async () => {
    renderer = create(
      <HomeSquads rooms={rooms} loading={false} error={null} onRetry={vi.fn()} visible />,
    );
  });
  const carousel = renderer.root.findByProps({ testID: 'home-squad-carousel' });
  expect(carousel.props.contentContainerStyle.alignItems).toBe('stretch');
  const first = renderer.root.findByProps({ testID: 'home-squad-card-pair' }).props.style;
  const second = renderer.root.findByProps({ testID: 'home-squad-card-large' }).props.style;
  const createCard = renderer.root.findByProps({ testID: 'home-create-squad-end' }).props.style;
  await act(async () =>
    renderer.root
      .findByProps({ testID: 'home-squad-card-large' })
      .props.onLayout({ nativeEvent: { layout: { height: 440 } } }),
  );
  for (const id of ['home-squad-card-pair', 'home-squad-card-large', 'home-create-squad-end']) {
    expect(renderer.root.findByProps({ testID: id }).props.style[1].minHeight).toBe(440);
  }
  expect(first[1].width).toBe(second[1].width);
  expect(first[1].width).toBe(createCard[1].width);
  expect(
    renderer.root
      .findAllByType('HomeSquadLeaderboard' as React.ElementType)
      .map((panel) => panel.props.visible),
  ).toEqual([true, false]);
  expect(renderer.root.findAllByType('SquadCheckInFeed' as React.ElementType)).toHaveLength(0);
});
