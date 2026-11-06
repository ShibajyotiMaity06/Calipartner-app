import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { RankedSquadMember } from '@calipartner/core';

const state = vi.hoisted(() => ({
  members: [] as RankedSquadMember[],
  loading: false,
  error: false,
  refresh: vi.fn(),
  push: vi.fn(),
}));
vi.mock('react-native', () => ({
  Platform: { OS: 'android' },
  View: 'View',
  Pressable: 'Pressable',
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
}));
vi.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
vi.mock('@calipartner/ui', async () => ({
  ...(await import('../../../../packages/ui/src/tokens')),
  Text: 'Text',
  Button: 'Button',
  Avatar: 'Avatar',
}));
vi.mock('expo-router', () => ({ useRouter: () => ({ push: state.push }) }));
vi.mock('@/hooks/useSquad', () => ({
  useSquadToday: () => ({
    data: state.loading ? null : { room_id: 'room', members: state.members },
    loading: state.loading,
    error: state.error,
    refresh: state.refresh,
  }),
}));
vi.mock('./SquadMentions', () => ({ SquadMentions: 'SquadMentions' }));
vi.mock('./SquadFoodItem', () => ({ SquadFoodItem: 'SquadFoodItem' }));
vi.mock('../diary/NutrientSummary', () => ({ NutrientSummary: 'NutrientSummary' }));
import { HomeSquadLeaderboard } from './HomeSquadLeaderboard';
import { SquadLeaderboard } from './SquadViews';
import { t } from '@/i18n';

let tree: ReactTestRenderer;
beforeEach(() => {
  state.loading = false;
  state.error = false;
  state.members = [5678, 0, 12345, 333].map((steps, index) => ({
    user_id: 'member-' + index,
    username: 'user' + index,
    nickname: index ? 'Member ' + index : 'Owner',
    avatar_url: null,
    is_self: !index,
    role: 'member',
    status: 'joined',
    goal: 'maintain',
    local_date: '2026-11-06',
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    steps,
    targets: null,
    height_cm: null,
    weight_kg: null,
    score: index === 2 ? null : 100 - index * 10,
    rank: index === 2 ? null : index + 1,
  }));
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
  vi.clearAllMocks();
});
const renderHome = async (memberCount = 4, visible = true) => {
  await act(async () => {
    tree = create(
      <HomeSquadLeaderboard roomId="room" memberCount={memberCount} visible={visible} />,
    );
  });
};
const rows = () => tree.root.findAll((node) => node.props.testID?.startsWith('squad-member-'));

it('shows actual formatted steps under the top three names, including zero, and announces them', async () => {
  await renderHome();
  expect(rows()).toHaveLength(3);
  for (const [index, expected] of ['5,678 steps', '0 steps', '12,345 steps'].entries()) {
    const steps = tree.root.findByProps({ testID: 'home-squad-steps-member-' + index });
    expect(steps.children).toEqual([expected]);
    expect(steps.props.tabular).toBe(true);
    expect(rows()[index]!.props.accessibilityLabel).toContain(expected);
  }
  expect(tree.root.findAllByProps({ testID: 'home-squad-steps-member-3' })).toHaveLength(0);
  expect(rows()[0]!.props.accessibilityLabel).toContain('You');
  expect(rows()[2]!.props.accessibilityLabel).toContain(t('squadDesign.noGoals'));
  await act(async () => rows()[1]!.props.onPress());
  expect(state.push).toHaveBeenCalledWith('/squad/person?room=room&member=member-1');
});

it('reveals the small score explanation only on tap and dismisses it on toggle, blur or leaving the card', async () => {
  await renderHome();
  const help = () => tree.root.findByProps({ testID: 'home-squad-score-help-room' });
  const hints = () => tree.root.findAllByProps({ testID: 'home-squad-score-hint-room' });
  expect(help().props.accessibilityLabel).toBe('Daily target %');
  expect(help().props.accessibilityState.expanded).toBe(false);
  expect(hints()).toHaveLength(0);
  await act(async () => help().props.onPress());
  expect(help().props.accessibilityState.expanded).toBe(true);
  expect(hints()[0]!.findByType('Text' as React.ElementType).children).toEqual([
    t('squadDesign.scoreRule'),
  ]);
  await act(async () => help().props.onPress());
  expect(hints()).toHaveLength(0);
  await act(async () => help().props.onPress());
  await act(async () => help().props.onBlur());
  expect(hints()).toHaveLength(0);
  await act(async () => help().props.onPress());
  await act(async () =>
    tree.update(<HomeSquadLeaderboard roomId="room" memberCount={4} visible={false} />),
  );
  expect(hints()).toHaveLength(0);
});

it('keeps pair limits and the full leaderboard presentation', async () => {
  await renderHome(2);
  expect(rows()).toHaveLength(2);
  await act(async () =>
    tree.update(<SquadLeaderboard members={state.members} onMember={vi.fn()} />),
  );
  expect(rows()).toHaveLength(4);
  expect(
    tree.root.findAll((node) => node.props.testID?.startsWith('home-squad-steps-')),
  ).toHaveLength(0);
});

it('preserves loading, empty and actionable error states', async () => {
  state.loading = true;
  await renderHome();
  expect(rows()).toHaveLength(0);
  expect(
    tree.root
      .findAllByType('Text' as React.ElementType)
      .some((node) => node.children.includes(t('common.loading'))),
  ).toBe(true);
  state.loading = false;
  state.error = true;
  await act(async () =>
    tree.update(<HomeSquadLeaderboard roomId="room" memberCount={4} visible />),
  );
  await act(async () => tree.root.findByProps({ testID: 'retry-squad-room' }).props.onPress());
  expect(state.refresh).toHaveBeenCalledOnce();
  state.error = false;
  state.members = [];
  await act(async () =>
    tree.update(<HomeSquadLeaderboard roomId="room" memberCount={4} visible />),
  );
  expect(rows()).toHaveLength(0);
  expect(
    tree.root
      .findAllByType('Text' as React.ElementType)
      .some((node) => node.children.includes(t('squadDesign.empty'))),
  ).toBe(true);
});
