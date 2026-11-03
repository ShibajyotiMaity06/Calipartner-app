import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn() }));
vi.mock('react-native', () => ({
  View: 'View',
  ScrollView: 'ScrollView',
  StyleSheet: { create: (value: unknown) => value, hairlineWidth: 1 },
}));
vi.mock('@calipartner/ui', async () => ({
  ...(await import('../../../../packages/ui/src/tokens')),
  Button: 'Button',
  Text: 'Text',
  SwitchRow: 'SwitchRow',
  Sheet: 'Sheet',
}));
vi.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
vi.mock('@/hooks/useBrowserModalBack', () => ({ useBrowserModalBack: vi.fn() }));
vi.mock('@/services/squadService', () => ({
  getSquadVisibility: state.get,
  setSquadVisibility: state.set,
}));
import { SquadVisibilityModal } from './SquadVisibilityModal';
let tree: ReactTestRenderer;
beforeEach(() => {
  vi.clearAllMocks();
  state.get.mockResolvedValue({ share_weight: false, share_height: true });
  state.set.mockResolvedValue({ share_weight: true, share_height: true });
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});
it('offers only weight and height controls; macros, steps, meals and workouts cannot be hidden', async () => {
  await act(async () => {
    tree = create(<SquadVisibilityModal visible roomId="one" onClose={vi.fn()} />);
  });
  expect(
    tree.root.findAllByType('SwitchRow' as React.ElementType).map((row) => row.props.testID),
  ).toEqual(['squad-share-weight', 'squad-share-height']);
  await act(async () =>
    tree.root.findByProps({ testID: 'squad-share-weight' }).props.onValueChange(true),
  );
  expect(state.set).toHaveBeenCalledWith('one', { share_weight: true, share_height: true });
});
it('keeps the saved value until acknowledgement, prevents duplicate submissions and retains it on failure', async () => {
  let reject!: (error: Error) => void;
  state.set.mockImplementation(
    () =>
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
  );
  await act(async () => {
    tree = create(<SquadVisibilityModal visible roomId="one" onClose={vi.fn()} />);
  });
  await act(async () => {
    const row = tree.root.findByProps({ testID: 'squad-share-weight' });
    row.props.onValueChange(true);
    row.props.onValueChange(true);
  });
  expect(state.set).toHaveBeenCalledTimes(1);
  expect(tree.root.findByProps({ testID: 'squad-share-weight' }).props.value).toBe(false);
  await act(async () => reject(new Error('offline')));
  expect(tree.root.findByProps({ testID: 'squad-share-weight' }).props.value).toBe(false);
  expect(tree.root.findByProps({ testID: 'retry-squad-visibility' })).toBeDefined();
});
it('ignores an earlier room read when the room changes', async () => {
  let resolve!: (value: unknown) => void;
  state.get.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  await act(async () => {
    tree = create(<SquadVisibilityModal visible roomId="one" onClose={vi.fn()} />);
  });
  await act(async () =>
    tree.update(<SquadVisibilityModal visible roomId="two" onClose={vi.fn()} />),
  );
  await act(async () => resolve({ share_weight: true, share_height: false }));
  expect(tree.root.findByProps({ testID: 'squad-share-weight' }).props.value).toBe(false);
  expect(tree.root.findByProps({ testID: 'squad-share-height' }).props.value).toBe(true);
});
