import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  View: 'View',
  TextInput: 'TextInput',
  KeyboardAvoidingView: 'KeyboardAvoidingView',
  Platform: { OS: 'web' },
  Alert: { alert: vi.fn() },
  StyleSheet: { create: (value: unknown) => value },
}));
vi.mock('@calipartner/ui', async () => ({
  ...(await import('../../../../packages/ui/src/tokens')),
  Text: 'Text',
  Button: 'Button',
  Sheet: 'Sheet',
  Chip: 'Chip',
}));
vi.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
vi.mock('./AdvancedNutrition', () => ({ AdvancedNutrition: 'AdvancedNutrition' }));
import { LogSomethingView } from './LogSomethingView';
import { QuantityModal } from './QuantityModal';
let tree: ReactTestRenderer;
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});
it('opens exactly the five personal logging flows without requesting a squad', async () => {
  const onFlow = vi.fn();
  await act(async () => {
    tree = create(<LogSomethingView onFlow={onFlow} onClose={vi.fn()} />);
  });
  const actions = tree.root.findAll(
    (node) => String(node.type) === 'Pressable' && node.props.testID?.startsWith('log-tile-'),
  );
  expect(actions.map((node) => node.props.testID)).toEqual([
    'log-tile-food',
    'log-tile-workout',
    'log-tile-water',
    'log-tile-steps',
    'log-tile-weight',
  ]);
  for (const node of actions) await act(async () => node.props.onPress());
  expect(onFlow.mock.calls.map(([flow]) => flow)).toEqual([
    'food',
    'workout',
    'water',
    'steps',
    'weight',
  ]);
  expect(tree.root.findAllByProps({ testID: 'log-quick-check-in' })).toHaveLength(0);
});
const food = {
  id: 'rice',
  name: 'Rice',
  source: 'custom',
  calories: 100,
  protein: 3,
  carbs: 20,
  fat: 1,
  fiber: 0,
  sugar: 0,
  sodium_mg: 0,
  serving_units: [{ unit: 'serving', grams: 100 }],
} as never;
it('removes sharing switches, keeps a failed portion open and closes only after an acknowledged retry', async () => {
  let acknowledge!: () => void;
  const save = vi
    .fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockImplementationOnce(
      () =>
        new Promise<void>((done) => {
          acknowledge = done;
        }),
    );
  const close = vi.fn();
  await act(async () => {
    tree = create(<QuantityModal visible food={food} onClose={close} onSave={save} />);
  });
  expect(tree.root.findAllByProps({ testID: 'switch-share-room' })).toHaveLength(0);
  expect(tree.root.findAllByProps({ testID: 'switch-someone-else-ate' })).toHaveLength(0);
  await act(async () => tree.root.findByProps({ testID: 'btn-submit-quantity' }).props.onPress());
  expect(close).not.toHaveBeenCalled();
  expect(tree.root.findByProps({ testID: 'quantity-save-error' })).toBeDefined();
  await act(async () => tree.root.findByProps({ testID: 'btn-submit-quantity' }).props.onPress());
  expect(save).toHaveBeenLastCalledWith(
    expect.objectContaining({ sharedWithRoom: true, taggedPartner: false }),
  );
  expect(close).not.toHaveBeenCalled();
  await act(async () => {
    acknowledge();
  });
  expect(close).toHaveBeenCalledOnce();
});
