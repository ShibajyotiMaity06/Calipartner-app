import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
import type { DiarySectionSummary } from '@calipartner/core';
vi.mock('./RepeatPreviousMeal', () => ({ RepeatPreviousMeal: 'RepeatPreviousMeal' }));
vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  View: 'View',
  StyleSheet: { create: (value: unknown) => value, hairlineWidth: 1 },
}));
vi.mock('@calipartner/ui', async () => ({
  ...(await import('../../../../packages/ui/src/tokens')),
  Text: 'Text',
}));
vi.mock('@/hooks/useSectionSuggestions', () => ({
  useSectionSuggestions: () => ({ suggestions: [] }),
}));
import { MealSectionCard } from './MealSectionCard';
let renderer: ReactTestRenderer;
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
});
const summary = {
  section: 'breakfast',
  entries: [],
  count: 0,
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  fiber: 0,
  sugar: 0,
  sodium_mg: 0,
} as DiarySectionSummary;
const props = {
  compact: true,
  section: 'breakfast' as const,
  summary,
  onAddFood: vi.fn(),
  onOpenDetail: vi.fn(),
  onEditEntry: vi.fn(),
  onDeleteEntry: vi.fn(),
  onCopyMeal: vi.fn(),
};
it('shows only the meal name and accessible add action for an empty meal', async () => {
  await act(async () => {
    renderer = create(<MealSectionCard {...props} />);
  });
  expect(renderer.root.findAllByProps({ testID: 'meal-metrics-breakfast' })).toHaveLength(0);
  expect(JSON.stringify(renderer.toJSON())).toContain('Breakfast');
  const add = renderer.root.findByProps({ testID: 'btn-add-food-breakfast' });
  expect(add.props.accessibilityLabel).toContain('Breakfast');
  add.props.onPress({ stopPropagation: vi.fn() });
  expect(props.onAddFood).toHaveBeenCalledWith('breakfast');
});
it('keeps four nutrient values in one row and opens details without expanding previews', async () => {
  const logged = {
    ...summary,
    count: 1,
    entries: [{ id: 'entry', food_name: 'Oats' }],
    calories: 250,
    protein: 10,
    carbs: 35,
    fat: 8,
  } as DiarySectionSummary;
  await act(async () => {
    renderer = create(<MealSectionCard {...props} summary={logged} />);
  });
  const metrics = renderer.root.findByProps({ testID: 'meal-metrics-breakfast' });
  expect(metrics.props.style.flexDirection).toBe('row');
  expect(metrics.props.style.flexWrap).toBeUndefined();
  expect(metrics.children).toHaveLength(4);
  expect(renderer.root.findAllByProps({ testID: 'entry-row-entry' })).toHaveLength(0);
  renderer.root.findByProps({ testID: 'card-section-breakfast' }).props.onPress();
  expect(props.onOpenDetail).toHaveBeenCalledWith('breakfast');
});
