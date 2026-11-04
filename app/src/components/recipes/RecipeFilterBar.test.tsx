import React, { useState } from 'react';
import { act, create } from 'react-test-renderer';
import { expect, it, vi } from 'vitest';
import type { RecipeFilterCriteria } from '@calipartner/core';
vi.mock('react-native', () => ({
  View: 'View',
  ScrollView: 'ScrollView',
  Pressable: 'Pressable',
  TextInput: 'TextInput',
  StyleSheet: { create: (s: unknown) => s },
}));
vi.mock('@calipartner/ui', async () => ({
  ...(await import('../../../../packages/ui/src/tokens')),
  Text: 'Text',
}));
vi.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
vi.mock('@/theme/useTheme', () => ({ useTheme: () => ({ colors: {} }) }));
import { RecipeFilterBar } from './RecipeFilterBar';
it('offers exactly three filters, combines Indian with a focus, and deselects by tapping again', async () => {
  let criteria: RecipeFilterCriteria = {};
  function Harness() {
    const [value, setValue] = useState<RecipeFilterCriteria>({});
    criteria = value;
    return (
      <RecipeFilterBar
        query=""
        onQueryChange={vi.fn()}
        criteria={value}
        onCriteriaChange={setValue}
      />
    );
  }
  let tree!: ReturnType<typeof create>;
  await act(async () => {
    tree = create(<Harness />);
  });
  expect(
    tree.root.findAll(
      (node) =>
        String(node.type) === 'Pressable' && node.props.testID?.startsWith('recipe-filter-'),
    ),
  ).toHaveLength(3);
  await act(async () => tree.root.findByProps({ testID: 'recipe-filter-indian' }).props.onPress());
  await act(async () =>
    tree.root.findByProps({ testID: 'recipe-filter-high-protein' }).props.onPress(),
  );
  expect(criteria).toEqual({ cuisine_group: 'indian', nutrition_focus: 'high-protein' });
  await act(async () =>
    tree.root.findByProps({ testID: 'recipe-filter-high-carb' }).props.onPress(),
  );
  expect(criteria.nutrition_focus).toBe('high-carb');
  await act(async () => tree.root.findByProps({ testID: 'recipe-filter-indian' }).props.onPress());
  expect(criteria.cuisine_group).toBeUndefined();
  await act(async () => tree.unmount());
});
