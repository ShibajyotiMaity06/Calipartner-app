import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ mark: vi.fn(), refresh: vi.fn(), page: vi.fn(), push: vi.fn() }));
vi.mock('react-native', () => ({
  View: 'View',
  Pressable: 'Pressable',
  Modal: 'Modal',
  ScrollView: 'ScrollView',
  StyleSheet: { create: (value: unknown) => value, absoluteFill: {} },
}));
vi.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
vi.mock('@calipartner/ui', async () => ({
  ...(await import('../../../../packages/ui/src/tokens')),
  Text: 'Text',
  Button: 'Button',
}));
vi.mock('expo-router', () => ({ useRouter: () => ({ push: state.push }) }));
vi.mock('./SquadViews', () => ({ squadStyles: {}, useSquadStyles: () => ({}) }));
vi.mock('@/services/squadService', () => ({
  getSquadMentions: state.page,
  markSquadMentionSeen: state.mark,
}));
const first = {
  message_id: 'first',
  nickname: 'Alex',
  text: '@you Hello',
  created_at: '2026-11-08T12:00:00Z',
};
const data = { count: 2, locked: false, mentions: [first], has_more: true };
vi.mock('@/hooks/useSquad', () => ({
  useSquadMentions: () => ({ data, error: false, refresh: state.refresh }),
}));
import { SquadMentions } from './SquadMentions';
let tree: ReactTestRenderer;
beforeEach(() => {
  vi.clearAllMocks();
  state.mark.mockResolvedValue(undefined);
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});
const render = async () => {
  await act(async () => {
    tree = create(<SquadMentions roomId="room" visible />);
  });
};
it('opens a bell/count disclosure without marking anything, then acknowledges only displayed mentions on outside dismissal', async () => {
  await render();
  expect(state.mark).not.toHaveBeenCalled();
  await act(async () => tree.root.findByProps({ testID: 'mentions-room' }).props.onPress());
  expect(state.mark).not.toHaveBeenCalled();
  expect(tree.root.findByType('Modal' as React.ElementType).props.visible).toBe(true);
  await act(async () => tree.root.findByProps({ testID: 'dismiss-home-mentions' }).props.onPress());
  expect(state.mark).toHaveBeenCalledExactlyOnceWith('room', 'first');
  expect(state.refresh).toHaveBeenCalled();
  expect(tree.root.findByType('Modal' as React.ElementType).props.visible).toBe(false);
});
it('keeps an actionable error when the acknowledgement fails and retries the same mention', async () => {
  state.mark.mockRejectedValueOnce(new Error('offline'));
  await render();
  await act(async () => tree.root.findByProps({ testID: 'mentions-room' }).props.onPress());
  await act(async () => tree.root.findByProps({ testID: 'dismiss-home-mentions' }).props.onPress());
  await act(async () => tree.root.findByProps({ testID: 'retry-mention-seen' }).props.onPress());
  expect(state.mark.mock.calls).toEqual([
    ['room', 'first'],
    ['room', 'first'],
  ]);
  expect(tree.root.findAllByProps({ testID: 'retry-mention-seen' })).toHaveLength(0);
});
