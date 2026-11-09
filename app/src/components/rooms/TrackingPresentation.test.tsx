import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
import type { RankedSquadMember } from '@calipartner/core';
vi.mock('react-native', () => ({
  View: 'View',
  Pressable: 'Pressable',
  StyleSheet: { create: (value: unknown) => value, hairlineWidth: 1 },
}));
vi.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
vi.mock('@calipartner/ui', async () => ({
  ...(await import('../../../../packages/ui/src/tokens')),
  Text: 'Text',
  Button: 'Button',
  Avatar: 'Avatar',
}));
vi.mock('./SquadFoodItem', () => ({ SquadFoodItem: 'SquadFoodItem' }));
vi.mock('../diary/NutrientSummary', () => ({ NutrientSummary: 'NutrientSummary' }));
import { PersonalDayCard } from './PersonalDayCard';
import { MetricValue } from './SquadViews';
let tree: ReactTestRenderer;
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});
it('retains disabled Home metrics with a blur and announces Not tracked', async () => {
  await act(async () => {
    tree = create(
      <PersonalDayCard
        loading={false}
        error={false}
        onRetry={vi.fn()}
        onPress={vi.fn()}
        metrics={[
          { id: 'steps', label: 'Steps', value: 4500, target: 8000, unit: 'steps', enabled: false },
          {
            nutrient: 'protein',
            label: 'Protein',
            value: 100,
            target: 100,
            unit: 'g',
            enabled: true,
          },
        ]}
      />,
    );
  });
  const disabled = tree.root.findByProps({ testID: 'personal-day-metric-steps' });
  expect(disabled.props.accessibilityLabel).toBe('Steps: Not tracked');
  expect(
    disabled.props.style.some(
      (style: { opacity?: number } | false) => style && style.opacity != null && style.opacity < 1,
    ),
  ).toBe(true);
  expect(
    disabled
      .findAllByType('Text' as React.ElementType)
      .some((node) => node.props.style?.textShadowRadius > 0),
  ).toBe(true);
  expect(tree.root.findByProps({ testID: 'personal-day-track-steps' })).toBeDefined();
  expect(
    tree.root.findByProps({ testID: 'personal-day-metric-protein' }).props.accessibilityLabel,
  ).toContain('100 / 100');
});
it('Compare distinguishes a disabled metric from a tracked zero without showing saved disabled totals', async () => {
  const member = {
    user_id: 'peer',
    nickname: 'Your partner',
    protein: 120,
    targets: { protein: 150 },
    tracking: { protein: false },
  } as RankedSquadMember;
  await act(async () => {
    tree = create(<MetricValue member={member} metric="protein" />);
  });
  expect(
    tree.root.findByProps({ testID: 'member-metric-peer-protein' }).props.accessibilityLabel,
  ).toContain('Not tracked');
  expect(JSON.stringify(tree.toJSON())).not.toContain('120');
  await act(async () =>
    tree.update(
      <MetricValue
        member={{ ...member, protein: 0, tracking: { ...member.tracking!, protein: true } }}
        metric="protein"
      />,
    ),
  );
  expect(
    tree.root.findByProps({ testID: 'member-metric-peer-protein' }).props.accessibilityLabel,
  ).toContain('0 / 150');
});
