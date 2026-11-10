import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('react-native', () => ({
  Modal: 'Modal',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  TextInput: 'TextInput',
  View: 'View',
  StyleSheet: { create: (value: unknown) => value },
}));
vi.mock('@calipartner/ui', async () => ({
  ...(await import('../../../../packages/ui/src/tokens')),
  Text: 'Text',
  useReducedMotion: () => true,
}));
vi.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
vi.mock('@/hooks/useCurrentLocalDate', () => ({
  useCurrentLocalDate: () => ({ localDate: '2026-11-09' }),
}));
import { WeightEntryModal, type WeightEntryModalProps } from './WeightEntryModal';
let tree: ReactTestRenderer;
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});
it('preserves a typed future date during late cache hydration and rejects it before saving', async () => {
  const save = vi.fn(),
    close = vi.fn();
  const props: WeightEntryModalProps = {
    visible: true,
    startWeight: 80,
    currentWeight: null,
    totalChangeKg: null,
    weeklyPace: null,
    projectedDate: null,
    hasEnoughTrend: false,
    onClose: close,
    onSave: save,
  };
  await act(async () => {
    tree = create(<WeightEntryModal {...props} />);
  });
  await act(async () => {
    tree.root.findByProps({ testID: 'input-weight-value' }).props.onChangeText('79');
    tree.root.findByProps({ testID: 'input-weight-date' }).props.onChangeText('2026-11-10');
  });
  await act(async () => tree.update(<WeightEntryModal {...props} currentWeight={80} />));
  expect(tree.root.findByProps({ testID: 'input-weight-date' }).props.value).toBe('2026-11-10');
  await act(async () => tree.root.findByProps({ testID: 'btn-weight-save' }).props.onPress());
  expect(tree.root.findByProps({ testID: 'weight-entry-error' })).toBeDefined();
  expect(save).not.toHaveBeenCalled();
  expect(close).not.toHaveBeenCalled();
});
it('keeps a failed save open and closes only after an acknowledged retry', async () => {
  const save = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({}),
    close = vi.fn();
  await act(async () => {
    tree = create(
      <WeightEntryModal
        visible
        startWeight={80}
        currentWeight={79}
        totalChangeKg={-1}
        weeklyPace={null}
        projectedDate={null}
        hasEnoughTrend={false}
        onClose={close}
        onSave={save}
      />,
    );
  });
  await act(async () => tree.root.findByProps({ testID: 'btn-weight-save' }).props.onPress());
  expect(close).not.toHaveBeenCalled();
  expect(tree.root.findByProps({ testID: 'weight-entry-error' })).toBeDefined();
  await act(async () => tree.root.findByProps({ testID: 'btn-weight-save' }).props.onPress());
  expect(close).toHaveBeenCalledOnce();
  expect(save).toHaveBeenLastCalledWith(79, undefined, '2026-11-09');
});
