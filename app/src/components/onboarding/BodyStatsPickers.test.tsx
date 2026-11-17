import React, { useState } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
import { lbToKg } from '@calipartner/core';
import { OnboardingStateMachine } from '@/services/onboardingStateMachine';
const feedback = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('@/services/foodService', () => ({ generateClientUuid: () => 'draft-id' }));
vi.mock('expo-haptics', () => ({ selectionAsync: feedback }));
vi.mock('react-native', () => ({
  View: 'View',
  ScrollView: 'ScrollView',
  FlatList: 'FlatList',
  useWindowDimensions: () => ({ width: 320, height: 844, fontScale: 2 }),
  StyleSheet: { create: (value: unknown) => value, absoluteFill: {} },
}));
vi.mock('react-native-svg', () => ({
  default: 'Svg',
  Defs: 'Defs',
  LinearGradient: 'LinearGradient',
  Rect: 'Rect',
  Stop: 'Stop',
}));
vi.mock('@calipartner/ui', async () => {
  const tokens = await import('../../../../packages/ui/src/tokens');
  return {
    ...tokens,
    Text: 'Text',
    Button: (await import('@/test/ButtonStub')).ButtonStub,
    SegmentedControl: 'SegmentedControl',
    useTheme: () => ({ colors: tokens.dark, reduceMotion: true }),
  };
});
vi.mock('@/components/CompactSelect', () => ({ CompactSelect: 'Select' }));
vi.mock('./PlanPrimitives', () => ({ PlanCard: 'Card', PlanTextField: 'Field', planStyles: {} }));
import { BodyStatsStep } from './BodyStatsStep';
import { StatsPicker } from './StatsPicker';
let tree: ReactTestRenderer;
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});
it('preserves canonical weight and height on unit toggles, converting only explicit edits', async () => {
  const weight = vi.fn(),
    height = vi.fn();
  function Controlled() {
    const [units, setUnits] = useState<'metric' | 'imperial'>('metric');
    return (
      <BodyStatsStep
        units={units}
        sex="male"
        dateOfBirth="2001-01-01"
        heightCm={175}
        weightKg={70.5}
        bodyFatPercentage={null}
        goal="maintain"
        onChangeUnits={setUnits}
        onChangeSex={vi.fn()}
        onChangeDateOfBirth={vi.fn()}
        onChangeHeightCm={height}
        onChangeWeightKg={weight}
        onChangeBodyFat={vi.fn()}
      />
    );
  }
  await act(async () => {
    tree = create(<Controlled />);
  });
  await act(async () =>
    tree.root.findByProps({ testID: 'weight-units' }).props.onChange('imperial'),
  );
  expect(weight).not.toHaveBeenCalled();
  expect(height).not.toHaveBeenCalled();
  await act(async () =>
    tree.root.findByProps({ testID: 'height-in-wheel-increase' }).props.onPress(),
  );
  expect(height).toHaveBeenLastCalledWith(177.8);
  await act(async () => tree.root.findByProps({ testID: 'weight-ruler-increase' }).props.onPress());
  expect(weight).toHaveBeenLastCalledWith(lbToKg(156));
  await act(async () => tree.root.findByProps({ testID: 'weight-units' }).props.onChange('metric'));
  expect(tree.root.findByProps({ testID: 'weight-value' }).props.children).toContain('70.5');
});
it('allows the requested age range without bypassing the existing adult gate', async () => {
  const machine = new OnboardingStateMachine({ heightCm: 175, weightKg: 70 });
  await act(async () => {
    tree = create(
      <BodyStatsStep
        {...machine.getState()}
        onChangeUnits={vi.fn()}
        onChangeSex={vi.fn()}
        onChangeDateOfBirth={(dateOfBirth) => machine.setBodyStats({ dateOfBirth })}
        onChangeHeightCm={vi.fn()}
        onChangeWeightKg={vi.fn()}
        onChangeBodyFat={vi.fn()}
      />,
    );
  });
  await act(async () => tree.root.findByProps({ testID: 'age-wheel' }).props.onChange(16));
  expect(machine.validateStep('body_stats').isValid).toBe(false);
  await act(async () => tree.root.findByProps({ testID: 'age-wheel' }).props.onChange(25));
  expect(machine.validateStep('body_stats').isValid).toBe(true);
});
it('offers bounded accessible adjustments and expands wheel rows at 200% text size', async () => {
  const change = vi.fn();
  await act(async () => {
    tree = create(
      <StatsPicker
        value={90}
        min={16}
        max={90}
        label="Age"
        format={String}
        testID="picker"
        onChange={change}
      />,
    );
  });
  expect(tree.root.findByProps({ testID: 'picker-increase' }).props.disabled).toBe(true);
  const adjustable = tree.root.findByProps({ accessibilityRole: 'adjustable' });
  expect(adjustable.props.style[1].height).toBe(288);
  await act(async () =>
    adjustable.props.onAccessibilityAction({ nativeEvent: { actionName: 'decrement' } }),
  );
  expect(change).toHaveBeenCalledWith(89);
  expect(feedback).toHaveBeenCalled();
});
