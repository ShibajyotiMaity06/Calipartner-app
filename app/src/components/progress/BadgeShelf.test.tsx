import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
import type { ChallengeCatalog } from '@calipartner/core';
const state = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock('react-native', () => ({ View: 'View', Pressable: 'Pressable' }));
vi.mock('@calipartner/ui', async () => ({
  ...(await import('../../../../packages/ui/src/tokens')),
  Text: 'Text',
}));
vi.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
vi.mock('./ChallengeUI', () => ({ CButton: 'Button', CSheet: 'Sheet', cs: {} }));
vi.mock('@/db', () => ({ getDb: async () => ({}) }));
vi.mock('@/lib/supabase', () => ({ getSupabase: () => ({}) }));
vi.mock('@/services/chatService', () => ({ sendChatMessage: state.send }));
vi.mock('@/services/foodService', () => ({ generateClientUuid: () => 'stable-share-id' }));
import { BadgeShelf } from './BadgeShelf';
import { t } from '@/i18n';
const catalog = {
  badges: [
    {
      id: 'first',
      text_key: 'badge.first',
      earned: 1,
      plan_required: 'free',
      rule: { completed: 1 },
    },
    {
      id: 'month',
      text_key: 'badge.month',
      earned: 0,
      plan_required: 'plus',
      rule: { duration_min: 30 },
    },
  ],
  texts: { 'badge.first': { en: 'First challenge' }, 'badge.month': { en: 'A month together' } },
  rooms: [{ id: 'room', name: 'Our squad' }],
} as unknown as ChallengeCatalog;
let tree: ReactTestRenderer;
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});
it('shows locked requirements and sends only after choosing an earned badge and a squad', async () => {
  let acknowledge!: () => void;
  state.send.mockRejectedValueOnce(new Error('offline')).mockImplementationOnce(
    () =>
      new Promise<void>((done) => {
        acknowledge = done;
      }),
  );
  await act(async () => {
    tree = create(<BadgeShelf catalog={catalog} userId="owner" onClose={vi.fn()} />);
  });
  expect(tree.root.findByProps({ testID: 'badge-month' }).props.disabled).toBe(true);
  expect(JSON.stringify(tree.toJSON())).toContain('at least 30 days');
  await act(async () => tree.root.findByProps({ testID: 'badge-first' }).props.onPress());
  expect(state.send).not.toHaveBeenCalled();
  await act(async () => tree.root.findByProps({ testID: 'badge-share-room-room' }).props.onPress());
  expect(tree.root.findByProps({ accessibilityRole: 'alert' })).toBeDefined();
  await act(async () => {
    tree.root.findByProps({ testID: 'badge-share-room-room' }).props.onPress();
  });
  expect(JSON.stringify(tree.toJSON())).not.toContain(t('homeRefresh.badgeShared'));
  await act(async () => acknowledge());
  expect(JSON.stringify(tree.toJSON())).toContain(t('homeRefresh.badgeShared'));
  expect(state.send.mock.calls.map((args) => args[4].clientId)).toEqual([
    'stable-share-id',
    'stable-share-id',
  ]);
});
