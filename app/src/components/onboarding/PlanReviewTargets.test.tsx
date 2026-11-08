import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
import { OnboardingStateMachine } from '@/services/onboardingStateMachine';
vi.mock('@/services/foodService', () => ({ generateClientUuid: () => crypto.randomUUID() }));
vi.mock('react-native', () => ({
  View: 'View',
  Pressable: 'Pressable',
  StyleSheet: { create: (value: unknown) => value },
}));
vi.mock('@calipartner/ui', async () => ({
  ...(await import('../../../../packages/ui/src/tokens')),
  Button: 'Button',
  Text: 'Text',
  useTheme: () => ({ colors: {} }),
}));
vi.mock('./PlanPrimitives', () => ({
  PlanCard: 'PlanCard',
  NumberField: 'NumberField',
  planStyles: {},
}));
import { PlanReviewStep } from './PlanReviewStep';
let tree: ReactTestRenderer;
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});
it('offers calculated or custom targets, preserves blanks and keeps calculation help as text', async () => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const onPlanned = vi.fn();
  const onCalculation = vi.fn();
  const state = new OnboardingStateMachine({
    dateOfBirth: '1995-01-01',
    heightCm: 175,
    weightKg: 80,
  }).getState();
  await act(async () => {
    tree = create(
      <PlanReviewStep
        state={state}
        onWeight={vi.fn()}
        onDays={vi.fn()}
        onAdjustment={vi.fn()}
        onRecommended={vi.fn()}
        onPlanned={onPlanned}
        onCalculation={onCalculation}
        onChangeGoal={vi.fn()}
        saving={false}
        error={null}
      />,
    );
  });
  expect(tree.root.findAllByProps({ testID: 'review-weight' })).toHaveLength(0);
  expect(tree.root.findAllByProps({ testID: 'review-adjustment' })).toHaveLength(0);
  expect(tree.root.findAllByProps({ testID: 'onboarding-custom-targets' })).toHaveLength(0);
  await act(async () =>
    tree.root.findByProps({ testID: 'continue-calculated-plan' }).props.onPress(),
  );
  expect(onPlanned).toHaveBeenLastCalledWith({});
  expect(tree.root.findByProps({ testID: 'btn-how-calculated' }).type).toBe('Pressable');
  await act(async () => tree.root.findByProps({ testID: 'btn-how-calculated' }).props.onPress());
  expect(onCalculation).toHaveBeenCalledOnce();
  await act(async () => tree.root.findByProps({ testID: 'btn-build-your-plan' }).props.onPress());
  expect(tree.root.findByProps({ testID: 'custom-target-protein' }).props.value).toBeNull();
  expect(tree.root.findAllByProps({ testID: 'custom-target-steps' })).toHaveLength(0);
  expect(tree.root.findAllByProps({ testID: 'custom-target-water' })).toHaveLength(0);
  expect(tree.root.findAllByProps({ testID: 'btn-private-health' })).toHaveLength(0);
  await act(async () =>
    tree.root.findByProps({ testID: 'custom-target-calories' }).props.onChange(2200),
  );
  await act(async () => tree.root.findByProps({ testID: 'btn-use-planned' }).props.onPress());
  expect(onPlanned).toHaveBeenLastCalledWith({ calories: 2200 });
  await act(async () => tree.root.findByProps({ testID: 'skip-custom-targets' }).props.onPress());
  expect(onPlanned).toHaveBeenLastCalledWith({});
});
