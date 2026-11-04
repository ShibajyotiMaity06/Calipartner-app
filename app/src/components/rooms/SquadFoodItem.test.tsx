import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ copy: vi.fn() }));
vi.mock('react-native', () => ({ View: 'View', Pressable: 'Pressable' }));
vi.mock('@calipartner/ui', async () => ({
  ...(await import('../../../../packages/ui/src/tokens')),
  Text: 'Text',
  Button: 'Button',
  Sheet: 'Sheet',
}));
vi.mock('@/hooks/useBrowserModalBack', () => ({ useBrowserModalBack: vi.fn() }));
vi.mock('@/services/roomMealService', () => ({ copyRoomMeal: state.copy }));
vi.mock('@/services/foodService', () => ({ generateClientUuid: () => 'stable-id' }));
import { SquadFoodItem } from './SquadFoodItem';
const item = { id: 'egg', name: 'Chicken egg', quantity: 1, unit: 'piece' };
let tree: ReactTestRenderer;
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
  vi.clearAllMocks();
});
it('only shows Log for a peer and never reports a failed acknowledgement as saved', async () => {
  await act(async () => {
    tree = create(<SquadFoodItem item={item} section="lunch" />);
  });
  expect(tree.root.findAllByProps({ testID: 'log-peer-food-egg' })).toHaveLength(0);
  await act(async () =>
    tree.update(<SquadFoodItem item={item} roomId="room" memberId="peer" section="lunch" />),
  );
  state.copy
    .mockRejectedValueOnce(new Error('lost ack'))
    .mockResolvedValueOnce({ id: 'stable-id' });
  await act(async () => tree.root.findByProps({ testID: 'log-peer-food-egg' }).props.onPress());
  await act(async () =>
    tree.root.findByProps({ testID: 'copy-food-section-dinner' }).props.onPress(),
  );
  await act(async () => tree.root.findByProps({ testID: 'confirm-peer-food-log' }).props.onPress());
  expect(tree.root.findAllByProps({ testID: 'peer-food-saved-egg' })).toHaveLength(0);
  await act(async () => tree.root.findByProps({ testID: 'confirm-peer-food-log' }).props.onPress());
  expect(state.copy.mock.calls).toEqual([
    ['stable-id', 'room', 'peer', 'egg', 'dinner', true],
    ['stable-id', 'room', 'peer', 'egg', 'dinner', true],
  ]);
  expect(tree.root.findByProps({ testID: 'peer-food-saved-egg' })).toBeDefined();
});
