import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Food } from '@calipartner/core';
vi.mock('react-native', () => ({
  Platform: { OS: 'web' },
  Alert: { alert: vi.fn() },
  KeyboardAvoidingView: 'KeyboardAvoidingView',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  TextInput: 'TextInput',
  View: 'View',
  StyleSheet: { create: (value: unknown) => value },
}));
vi.mock('@calipartner/ui', async () => ({
  ...(await import('../../../../packages/ui/src/tokens')),
  Text: 'Text',
  Button: 'Button',
  Sheet: 'Sheet',
  Chip: 'Chip',
}));
vi.mock('./AdvancedNutrition', () => ({ AdvancedNutrition: 'AdvancedNutrition' }));
vi.mock('@/hooks/useBrowserModalBack', () => ({ useBrowserModalBack: vi.fn() }));
import { QuantityModal } from './QuantityModal';
it('requires a deliberate meal selection before a food can be saved', async () => {
  const save = vi.fn();
  await act(async () => {
    tree = create(
      <QuantityModal visible food={food} requireMealChoice onClose={vi.fn()} onSave={save} />,
    );
  });
  expect(tree.root.findByProps({ testID: 'btn-submit-quantity' }).props.disabled).toBe(true);
  await act(async () => tree.root.findByProps({ testID: 'section-picker-dinner' }).props.onPress());
  await act(async () => tree.root.findByProps({ testID: 'btn-submit-quantity' }).props.onPress());
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ mealSection: 'dinner' }));
});
let tree: ReactTestRenderer;
const food = {
  id: 'food',
  source: 'usda',
  name: 'Food',
  brand: null,
  barcode: null,
  serving_units: [{ unit: 'serving', grams: 100 }],
  calories_per_100g: 450,
  protein_per_100g: 55,
  carbs_per_100g: 30,
  fat_per_100g: 10,
  fiber_per_100g: 4,
  sugar_per_100g: 2,
  sodium_mg_per_100g: 30,
  owner_id: null,
  attribution: null,
} as Food;
beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
  vi.unstubAllGlobals();
});
it('saves a 50g protein correction for the chosen portion without editing the catalog', async () => {
  const save = vi.fn().mockResolvedValue(undefined);
  await act(async () => {
    tree = create(<QuantityModal visible food={food} onClose={vi.fn()} onSave={save} />);
  });
  await act(async () => tree.root.findByProps({ testID: 'edit-nutrition' }).props.onPress());
  await act(async () =>
    tree.root.findByProps({ testID: 'edit-nutrient-protein' }).props.onChangeText('50'),
  );
  const button = tree.root
    .findAllByType('Button' as React.ElementType)
    .find((node) => node.props.testID === 'btn-submit-quantity');
  expect(button).toBeTruthy();
  await act(async () => button!.props.onPress());
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({
      nutrientOverrides: { calories: 450, protein: 50, carbs: 30, fat: 10 },
    }),
  );
  expect(food.protein_per_100g).toBe(55);
});
it('shows invalid correction errors and never saves them', async () => {
  const save = vi.fn();
  await act(async () => {
    tree = create(<QuantityModal visible food={food} onClose={vi.fn()} onSave={save} />);
  });
  await act(async () => tree.root.findByProps({ testID: 'edit-nutrition' }).props.onPress());
  await act(async () =>
    tree.root.findByProps({ testID: 'edit-nutrient-protein' }).props.onChangeText('-1'),
  );
  expect(tree.root.findByProps({ testID: 'btn-submit-quantity' }).props.disabled).toBe(true);
  expect(save).not.toHaveBeenCalled();
});
it('keeps the large-portion confirmation on web and saves only after confirmation', async () => {
  const save = vi.fn().mockResolvedValue(undefined),
    confirm = vi.fn().mockReturnValue(false);
  vi.stubGlobal('confirm', confirm);
  await act(async () => {
    tree = create(<QuantityModal visible food={food} onClose={vi.fn()} onSave={save} />);
  });
  await act(async () => tree.root.findByProps({ testID: 'edit-nutrition' }).props.onPress());
  await act(async () =>
    tree.root.findByProps({ testID: 'edit-nutrient-calories' }).props.onChangeText('4500'),
  );
  await act(async () => tree.root.findByProps({ testID: 'btn-submit-quantity' }).props.onPress());
  expect(confirm).toHaveBeenCalledOnce();
  expect(save).not.toHaveBeenCalled();
  confirm.mockReturnValue(true);
  await act(async () => tree.root.findByProps({ testID: 'btn-submit-quantity' }).props.onPress());
  expect(save).toHaveBeenCalledOnce();
});
