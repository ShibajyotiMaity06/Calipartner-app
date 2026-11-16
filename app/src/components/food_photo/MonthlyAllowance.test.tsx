import React from 'react';
import { act, create } from 'react-test-renderer';
import { expect, it, vi } from 'vitest';
vi.mock('react-native', () => ({
  Modal: 'Modal',
  Pressable: 'Pressable',
  View: 'View',
  StyleSheet: { create: (value: unknown) => value },
}));
vi.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
vi.mock('@calipartner/ui', async () => ({
  ...(await import('../../../../packages/ui/src/tokens')),
  Text: 'Text',
}));
vi.mock('@/theme/useTheme', () => ({ useTheme: () => ({ colors: {} }) }));
import { FoodPhotoDailyLimitModal } from './FoodPhotoDailyLimitModal';
it('shows responsible-use copy and manual logging without counters or an upsell at the monthly cap', async () => {
  const manual = vi.fn();
  let tree!: ReturnType<typeof create>;
  await act(async () => {
    tree = create(
      <FoodPhotoDailyLimitModal
        visible
        userState="paid_pro"
        usedToday={300}
        dailyCap={300}
        onClose={vi.fn()}
        onLogManually={manual}
      />,
    );
  });
  const copy = tree.root
    .findAllByType('Text' as React.ElementType)
    .flatMap((node) => node.props.children)
    .filter((value) => typeof value === 'string')
    .join(' ');
  expect(copy).toContain('responsible use');
  expect(copy).toContain('next month');
  expect(copy).not.toMatch(/\b(?:300|900|5|10)\b/);
  expect(tree.root.findAllByProps({ testID: 'pill-scan-usage' })).toHaveLength(0);
  expect(tree.root.findAllByProps({ testID: 'card-gentle-upsell' })).toHaveLength(0);
  tree.root.findByProps({ testID: 'btn-limit-log-manually' }).props.onPress();
  expect(manual).toHaveBeenCalledOnce();
  await act(async () => tree.unmount());
});
