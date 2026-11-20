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
  Button: (await import('@/test/ButtonStub')).ButtonStub,
  ...(await import('../../../../packages/ui/src/tokens')),
  Text: 'Text',
  NavigationIcon: 'NavigationIcon',
}));
vi.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
import { CardioHub } from './CardioHub';

it('exposes exactly cycling, running and steps within Cardio as disabled launch preview', async () => {
  const select = vi.fn();
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<CardioHub onSelect={select} onBack={vi.fn()} />);
  });
  expect(tree.root.findByProps({ testID: 'cardio-launch-notice' })).toBeDefined();
  for (const flow of ['cycling', 'running', 'steps']) {
    const item = tree.root.findByProps({ testID: `cardio-${flow}` });
    expect(item).toBeDefined();
    expect(item.props.disabled).toBe(true);
  }
  await act(async () => tree.unmount());
});
