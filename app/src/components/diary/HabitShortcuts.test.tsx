import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { WeeklyPlanView } from '@calipartner/core';
const state = vi.hoisted(() => ({
  log: vi.fn(),
  swap: vi.fn(),
  repeat: vi.fn(),
  changed: vi.fn(),
}));
vi.mock('react-native', () => ({
  View: 'View',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: { create: (value: unknown) => value },
}));
vi.mock('@calipartner/ui', async () => ({
  ...(await import('../../../../packages/ui/src/tokens')),
  Text: 'Text',
  Button: 'Button',
  Sheet: 'Sheet',
}));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'owner' }, profile: { timezone: 'America/New_York' } }),
}));
vi.mock('@/services/weeklyPlanService', () => ({
  logPlannedMeal: state.log,
  swapPlannedMeal: state.swap,
  repeatPreviousMeal: state.repeat,
}));
vi.mock('@/services/diaryEvents', () => ({ diaryEvents: { emitChange: state.changed } }));
import { WeeklyMealActions } from './WeeklyMealActions';
import { WeeklyGroceryList } from './WeeklyGroceryList';
import { RepeatPreviousMeal } from './RepeatPreviousMeal';
import { t } from '@/i18n';
const meal = {
  name: 'Breakfast oats',
  portion: 'One bowl',
  ingredients: ['Oats 60 g'],
  calories: 450,
  protein: 30,
  carbs: 60,
  fat: 10,
};
const plan = {
  id: 'plan',
  revision: 1,
  full_access: false,
  days: [{ day: 0, meals: [meal] }],
} as WeeklyPlanView;
let tree: ReactTestRenderer;
beforeEach(() => vi.clearAllMocks());
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});

it('keeps failed meal saves actionable and shows success only after acknowledgement', async () => {
  let acknowledge!: () => void;
  state.log.mockRejectedValueOnce(new Error('offline')).mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        acknowledge = resolve;
      }),
  );
  await act(async () => {
    tree = create(
      <WeeklyMealActions plan={plan} day={0} index={0} onChanged={vi.fn()} onUpgrade={vi.fn()} />,
    );
  });
  await act(async () => tree.root.findByProps({ testID: 'weekly-log-meal-0' }).props.onPress());
  expect(state.changed).not.toHaveBeenCalled();
  expect(tree.root.findByProps({ accessibilityRole: 'alert' })).toBeDefined();
  await act(async () => {
    tree.root.findByProps({ testID: 'weekly-log-meal-0' }).props.onPress();
  });
  expect(tree.root.findByProps({ testID: 'weekly-log-meal-0' }).props.label).toBe(
    t('homeRefresh.logToDiary'),
  );
  await act(async () => {
    acknowledge();
  });
  expect(tree.root.findByProps({ testID: 'weekly-log-meal-0' }).props.label).toBe(
    t('homeRefresh.logged'),
  );
  expect(state.changed).toHaveBeenCalledOnce();
});

it('opens the upgrade for a free meal swap without calling the write API', async () => {
  const upgrade = vi.fn();
  await act(async () => {
    tree = create(
      <WeeklyMealActions plan={plan} day={0} index={0} onChanged={vi.fn()} onUpgrade={upgrade} />,
    );
  });
  await act(async () => tree.root.findByProps({ testID: 'weekly-swap-meal-0' }).props.onPress());
  expect(upgrade).toHaveBeenCalledOnce();
  expect(state.swap).not.toHaveBeenCalled();
});

it('shows only disclosed groceries with accessible session checkboxes', async () => {
  await act(async () => {
    tree = create(<WeeklyGroceryList plan={plan} onUpgrade={vi.fn()} />);
  });
  await act(async () => tree.root.findByProps({ testID: 'weekly-grocery-open' }).props.onPress());
  const checkbox = tree.root.findByProps({ testID: 'weekly-grocery-item-0' });
  expect(checkbox.props.accessibilityLabel).toBe('Oats 60 g');
  expect(checkbox.props.accessibilityState.checked).toBe(false);
  await act(async () => checkbox.props.onPress());
  expect(
    tree.root.findByProps({ testID: 'weekly-grocery-item-0' }).props.accessibilityState.checked,
  ).toBe(true);
  expect(tree.root.findAllByProps({ testID: 'weekly-grocery-item-1' })).toHaveLength(0);
  expect(tree.root.findByProps({ testID: 'weekly-grocery-upgrade' })).toBeDefined();
});

it('keeps a failed repeat open and shows an empty source without claiming a save', async () => {
  state.repeat.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(0);
  await act(async () => {
    tree = create(<RepeatPreviousMeal localDate="2026-11-06" section="lunch" />);
  });
  const press = () =>
    tree.root
      .findByProps({ testID: 'repeat-previous-lunch' })
      .props.onPress({ stopPropagation: vi.fn() });
  await act(press);
  expect(tree.root.findByProps({ accessibilityRole: 'alert' })).toBeDefined();
  expect(state.changed).not.toHaveBeenCalled();
  await act(press);
  expect(tree.root.findByProps({ testID: 'repeat-previous-lunch' }).props.disabled).toBe(true);
  expect(state.changed).not.toHaveBeenCalled();
});
