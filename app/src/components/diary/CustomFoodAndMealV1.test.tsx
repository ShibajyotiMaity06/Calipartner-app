import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Food, MealSelection } from '@calipartner/core';

const mocks = vi.hoisted(() => ({
  createFood: vi.fn(),
  saveMyMeal: vi.fn(),
  setQuery: vi.fn(),
  historyFoods: [] as Food[],
}));

vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Modal: ({
    visible = true,
    children,
    ...rest
  }: Record<string, unknown> & { visible?: boolean; children?: React.ReactNode }) =>
    visible ? React.createElement('Modal', rest, children) : null,
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: { create: <T,>(styles: T) => styles },
  TextInput: 'TextInput',
  View: 'View',
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

vi.mock('@calipartner/ui/v1', async () => {
  const theme = await import('../../../../packages/ui/src/v1/theme');
  return {
    ...theme,
    BarcodeIcon: 'BarcodeIcon',
    CheckIcon: 'CheckIcon',
    ChevronRightIcon: 'ChevronRightIcon',
    Chip: 'Chip',
    CloseIcon: 'CloseIcon',
    PlusIcon: 'PlusIcon',
    PrimaryButton: 'PrimaryButton',
    SearchIcon: 'SearchIcon',
    Text: 'Text',
  };
});

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('@/hooks/useBrowserModalBack', () => ({
  useBrowserModalBack: vi.fn(),
}));

vi.mock('@/hooks/useFoodEntries', () => ({
  useCustomFood: () => ({ createFood: mocks.createFood, loading: false }),
}));

vi.mock('@/hooks/useFoodSearch', () => ({
  useFoodSearch: () => ({ query: '', setQuery: mocks.setQuery, results: [], loading: false }),
}));

vi.mock('@/hooks/usePreviouslyLogged', () => ({
  usePreviouslyLogged: () => ({
    items: mocks.historyFoods.map((food) => ({ food })),
  }),
}));

vi.mock('@/services/foodService', () => ({
  generateClientUuid: () => 'client-uuid-123',
}));

vi.mock('@/services/myMealsService', () => ({
  saveMyMeal: (...args: unknown[]) => mocks.saveMyMeal(...args),
}));

vi.mock('@/components/diary/QuantityModal', () => ({
  QuantityModal: 'QuantityModal',
}));

import { CreateMealModal } from '@/components/diary/CreateMealModal';
import { CustomFoodModal } from '@/components/diary/CustomFoodModal';

let tree: ReactTestRenderer | undefined;

const byId = (id: string) => tree!.root.findByProps({ testID: id });

const SAMPLE_FOOD_A: Food = {
  id: 'food-a',
  name: 'Oatmeal with banana',
  brand: null,
  barcode: null,
  owner_id: null,
  attribution: null,
  source: 'ifct',
  calories_per_100g: 110.7143,
  protein_per_100g: 3.5,
  carbs_per_100g: 21,
  fat_per_100g: 1.5,
  fiber_per_100g: 3,
  sugar_per_100g: 5,
  sodium_mg_per_100g: 40,
  serving_units: [{ unit: 'g', grams: 1 }],
};

const SAMPLE_FOOD_B: Food = {
  id: 'food-b',
  name: 'Scrambled eggs',
  brand: null,
  barcode: null,
  owner_id: null,
  attribution: null,
  source: 'ifct',
  calories_per_100g: 151.6667,
  protein_per_100g: 11,
  carbs_per_100g: 1,
  fat_per_100g: 11,
  fiber_per_100g: 0,
  sugar_per_100g: 1,
  sodium_mg_per_100g: 140,
  serving_units: [{ unit: 'large', grams: 60 }],
};

describe('CreateFood & CreateMeal Design System v1 modals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.historyFoods = [SAMPLE_FOOD_A, SAMPLE_FOOD_B];
    mocks.createFood.mockResolvedValue({
      ...SAMPLE_FOOD_A,
      id: 'custom-food-1',
      name: 'Protein oatmeal',
    });
    mocks.saveMyMeal.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    if (tree) {
      await act(async () => {
        tree?.unmount();
      });
      tree = undefined;
    }
  });

  it('CreateFood: validates macro check banner, toggles expandable fields, and saves custom food', async () => {
    const onCreated = vi.fn();
    const onClose = vi.fn();

    await act(async () => {
      tree = create(
        <CustomFoodModal visible defaultSection="dinner" onClose={onClose} onCreated={onCreated} />,
      );
    });

    await act(async () => {
      byId('input-custom-food-name').props.onChangeText('Protein oatmeal');
      byId('input-custom-food-serving-size').props.onChangeText('60');
      byId('input-custom-food-calories').props.onChangeText('300');
      byId('input-custom-food-protein').props.onChangeText('24');
      byId('input-custom-food-carbs').props.onChangeText('30');
      byId('input-custom-food-fat').props.onChangeText('10');
    });

    const macroBanner = byId('custom-food-macro-check');
    const bannerTexts = macroBanner.findAllByType('Text' as React.ElementType);
    const renderedCopy = bannerTexts.map((n) => String(n.props.children)).join(' ');
    expect(renderedCopy).toContain('306 kcal');

    await act(async () => {
      byId('btn-toggle-more-nutrients').props.onPress();
      byId('btn-toggle-barcode-input').props.onPress();
    });
    expect(byId('input-custom-food-fiber')).toBeDefined();
    expect(byId('input-custom-food-barcode')).toBeDefined();

    await act(async () => {
      byId('btn-submit-custom-food').props.onPress();
    });

    expect(mocks.createFood).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Protein oatmeal',
        source: 'user',
      }),
    );
    expect(onCreated).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('CreateMeal: calculates total nutrition, updates default meal chip, and saves meal', async () => {
    const onSaved = vi.fn();
    const onClose = vi.fn();
    const initialSelection: MealSelection[] = [
      { food: SAMPLE_FOOD_A, quantity: 280, unit: 'g' },
      { food: SAMPLE_FOOD_B, quantity: 2, unit: 'large' },
    ];

    await act(async () => {
      tree = create(
        <CreateMealModal
          visible
          initialSelection={initialSelection}
          defaultSection="breakfast"
          onClose={onClose}
          onSaved={onSaved}
        />,
      );
    });

    const initialTotal = Number(byId('create-meal-total-kcal').props.children);
    expect(initialTotal).toBe(492);

    await act(async () => {
      byId('btn-remove-ingredient-1').props.onPress();
    });
    expect(Number(byId('create-meal-total-kcal').props.children)).toBe(310);

    await act(async () => {
      byId('input-create-meal-name').props.onChangeText('Post-workout breakfast');
      byId('create-meal-default-dinner').props.onPress();
    });

    await act(async () => {
      byId('btn-save-create-meal').props.onPress();
    });

    expect(mocks.saveMyMeal).toHaveBeenCalledWith(
      'user-1',
      'client-uuid-123',
      'Post-workout breakfast',
      [{ food: SAMPLE_FOOD_A, quantity: 280, unit: 'g' }],
      'dinner',
    );
    expect(onSaved).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
