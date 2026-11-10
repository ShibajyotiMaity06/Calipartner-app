import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { expect, it, vi } from 'vitest';
vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  View: 'View',
  StyleSheet: { create: (value: unknown) => value },
}));
vi.mock('@calipartner/ui', async () => ({
  ...(await import('../../../../packages/ui/src/tokens')),
  Text: 'Text',
  NavigationIcon: 'NavigationIcon',
}));
vi.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
import { CardioHub } from './CardioHub';

it('exposes exactly cycling, running and steps within Cardio', async () => {
  const select = vi.fn();
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<CardioHub onSelect={select} onBack={vi.fn()} />);
  });
  for (const flow of ['cycling', 'running', 'steps']) {
    await act(async () => tree.root.findByProps({ testID: `cardio-${flow}` }).props.onPress());
  }
  expect(select.mock.calls.map(([flow]) => flow)).toEqual(['cycling', 'running', 'steps']);
  await act(async () => tree.unmount());
});
