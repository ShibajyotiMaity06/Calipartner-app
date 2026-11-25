import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { OnboardingStateMachine } from '@/services/onboardingStateMachine';

const mockState = vi.hoisted(() => ({
  os: 'web' as 'ios' | 'android' | 'web',
}));

vi.mock('react-native', () => ({
  View: 'View',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  NativeModules: {},
  Platform: {
    get OS() {
      return mockState.os;
    },
  },
  Animated: {
    View: 'AnimatedView',
    Value: class {
      setValue() {}
    },
    spring: () => ({ start: (cb?: () => void) => cb?.() }),
  },
  StyleSheet: { create: (value: unknown) => value },
}));
vi.mock('react-native-svg', () => ({
  default: 'Svg',
  Svg: 'Svg',
  Circle: 'Circle',
  Defs: 'Defs',
  LinearGradient: 'LinearGradient',
  Path: 'Path',
  Stop: 'Stop',
}));
vi.mock('expo-constants', () => ({ default: { expoConfig: { extra: {} } } }));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
vi.mock('@calipartner/ui', async () => ({
  ...(await import('../../../../packages/ui/src/tokens')),
  Button: 'Button',
  SegmentedControl: (await import('@/test/SegmentedControlStub')).SegmentedControlStub,
  Text: 'Text',
  useTheme: () => ({ colors: {}, reduceMotion: true }),
}));
vi.mock('@calipartner/ui/v1', async () => {
  const tokens = await import('../../../../packages/ui/src/v1/theme');
  return {
    ...tokens,
    Badge: 'Badge',
    BigNameField: 'BigNameField',
    BrandRingMark: 'BrandRingMark',
    Card: ({ children, ...rest }: Record<string, unknown>) =>
      React.createElement('Card', rest, children as React.ReactNode),
    DropletIcon: 'DropletIcon',
    DumbbellIcon: 'DumbbellIcon',
    FlameIcon: 'FlameIcon',
    HeartIcon: 'HeartIcon',
    LinkButton: 'LinkButton',
    LockIcon: 'LockIcon',
    OptionTile: ({ title, meta, selected, onPress, testID }: Record<string, unknown>) =>
      React.createElement('OptionTile', { title, meta, selected, onPress, testID }),
    PulseIcon: 'PulseIcon',
    QuantityButton: 'QuantityButton',
    Radio: 'Radio',
    Ring: ({ children, ...rest }: Record<string, unknown>) =>
      React.createElement('Ring', rest, children as React.ReactNode),
    RulerPicker: 'RulerPicker',
    ScaleIcon: 'ScaleIcon',
    ScreenTitle: 'ScreenTitle',
    Segmented: 'Segmented',
    SwitchRow: 'SwitchRow',
    Text: 'V1Text',
    TimerIcon: 'TimerIcon',
    TrendIcon: 'TrendIcon',
    triggerHaptic: vi.fn(),
    usePressScale: () => ({ scale: 1, onPressIn: vi.fn(), onPressOut: vi.fn() }),
  };
});
vi.mock('./PlanPrimitives', () => ({
  NumberField: 'NumberField',
  PlanCard: 'PlanCard',
  PlanChoice: 'PlanChoice',
  planStyles: { gap: {}, row: {}, section: {} },
}));

import { OnboardingQuestion } from './OnboardingQuestion';
import { PlanReviewStep } from './PlanReviewStep';
import { RevealStepView } from './RevealStepView';

let tree: ReactTestRenderer;
beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  mockState.os = 'web';
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});

const baseConfiguredMachine = () =>
  new OnboardingStateMachine({
    nickname: 'Priya',
    sex: 'female',
    characterGender: 'female',
    dateOfBirth: '1999-05-01',
    heightCm: 178,
    weightKg: 74.5,
    gymDays: 4,
  })
    .setGoal('cut')
    .setTargetWeightAndDate(68, null)
    .setWeeklyRate(0.5);

it('renders Screen 2 (Goal) with Cut first, Bulk second, and no biological sex toggle', async () => {
  const machine = new OnboardingStateMachine();
  await act(async () => {
    tree = create(
      <OnboardingQuestion
        step="goal"
        state={machine.getState()}
        machine={machine}
        update={vi.fn()}
        identityConfirmed={false}
      />,
    );
  });
  expect(tree.root.findByProps({ testID: 'onboarding-title' }).props).toMatchObject({
    eyebrow: 'YOUR GOAL',
    title: 'What are you training for?',
    accentWord: 'training',
  });
  const cards = tree.root
    .findAllByType('Pressable' as React.ElementType)
    .filter((node) => String(node.props.testID ?? '').startsWith('goal-card-'));
  expect(cards.map((node) => node.props.testID)).toEqual(['goal-card-cut', 'goal-card-bulk']);
  expect(tree.root.findAllByProps({ testID: 'onboarding-gender' })).toHaveLength(0);
});

it('renders Screen 3 (Name) with BigNameField and live partner room preview card', async () => {
  const machine = new OnboardingStateMachine().setGoal('cut').setNickname('Priya');
  await act(async () => {
    tree = create(
      <OnboardingQuestion
        step="nickname"
        state={machine.getState()}
        machine={machine}
        update={vi.fn()}
        identityConfirmed={false}
      />,
    );
  });
  expect(tree.root.findByProps({ testID: 'onboarding-nickname' }).props.value).toBe('Priya');
  expect(tree.root.findByProps({ testID: 'nickname-preview-name' }).props.children).toBe('Priya');
});

it('renders Screen 4 (About you) with Female left, Male right, and 5-row AgeWheelPicker', async () => {
  const machine = new OnboardingStateMachine().setGoal('cut').setNickname('Priya');
  await act(async () => {
    tree = create(
      <OnboardingQuestion
        step="age"
        state={machine.getState()}
        machine={machine}
        update={vi.fn()}
        identityConfirmed={false}
      />,
    );
  });
  const genderButtons = tree.root
    .findByProps({ testID: 'onboarding-gender' })
    .findAllByType('Pressable' as React.ElementType);
  expect(genderButtons.map((node) => node.props.testID)).toEqual([
    'onboarding-gender-female',
    'onboarding-gender-male',
  ]);
  const wheel = tree.root
    .findAllByProps({ testID: 'age-wheel' })
    .find((node) => String(node.type) === 'View')!;
  expect(wheel.props.accessibilityValue).toMatchObject({ min: 18, max: 90, now: 27 });
});

it('renders Screen 5 (Height) and Screen 6 (Weight) with Design System v1 rulers', async () => {
  const machine = baseConfiguredMachine();
  await act(async () => {
    tree = create(
      <OnboardingQuestion
        step="height"
        state={machine.getState()}
        machine={machine}
        update={vi.fn()}
        identityConfirmed={false}
      />,
    );
  });
  expect(tree.root.findByProps({ testID: 'height-cm-wheel' }).props).toMatchObject({
    vertical: true,
    inverted: true,
    align: 'right',
    value: 178,
  });
  await act(async () => {
    tree.update(
      <OnboardingQuestion
        step="weight"
        state={machine.getState()}
        machine={machine}
        update={vi.fn()}
        identityConfirmed={false}
      />,
    );
  });
  expect(tree.root.findByProps({ testID: 'weight-ruler' }).props.value).toBe(74.5);
  expect(tree.root.findByProps({ testID: 'weight-privacy-card' })).toBeTruthy();
});

it('renders Screens 07-12 (Activity, Training days, Target weight, Weekly pace, Trackers, Daily targets)', async () => {
  const machine = baseConfiguredMachine();
  await act(async () => {
    tree = create(
      <OnboardingQuestion
        step="activity_level"
        state={machine.getState()}
        machine={machine}
        update={vi.fn()}
        identityConfirmed={false}
      />,
    );
  });
  expect(tree.root.findByProps({ testID: 'activity-card-sedentary' })).toBeTruthy();
  expect(tree.root.findByProps({ testID: 'activity-card-very_active' })).toBeTruthy();

  await act(async () => {
    tree.update(
      <OnboardingQuestion
        step="gym_days"
        state={machine.getState()}
        machine={machine}
        update={vi.fn()}
        identityConfirmed={false}
      />,
    );
  });
  expect(tree.root.findByProps({ testID: 'gym-days-count' }).props.children).toBe('4');
  expect(tree.root.findByProps({ testID: 'training-weekday-0' })).toBeTruthy();

  await act(async () => {
    tree.update(
      <OnboardingQuestion
        step="target_weight"
        state={machine.getState()}
        machine={machine}
        update={vi.fn()}
        identityConfirmed={false}
      />,
    );
  });
  expect(tree.root.findByProps({ testID: 'target-weight-ruler' }).props.value).toBe(68);
  expect(tree.root.findByProps({ testID: 'target-weight-summary-card' })).toBeTruthy();

  await act(async () => {
    tree.update(
      <OnboardingQuestion
        step="rate_selection"
        state={machine.getState()}
        machine={machine}
        update={vi.fn()}
        identityConfirmed={false}
      />,
    );
  });
  expect(tree.root.findByProps({ testID: 'rate-card-0.5' })).toBeTruthy();
  expect(tree.root.findByProps({ testID: 'pace-projection-banner' })).toBeTruthy();

  await act(async () => {
    tree.update(
      <OnboardingQuestion
        step="trackers"
        state={machine.getState()}
        machine={machine}
        update={vi.fn()}
        identityConfirmed={false}
      />,
    );
  });
  expect(tree.root.findByProps({ testID: 'tracker-tile-calories' }).props.selected).toBe(true);
  expect(tree.root.findByProps({ testID: 'tracker-tile-fasting' }).props.selected).toBe(false);

  await act(async () => {
    tree.update(
      <OnboardingQuestion
        step="daily_targets"
        state={machine.getState()}
        machine={machine}
        update={vi.fn()}
        identityConfirmed={false}
      />,
    );
  });
  expect(tree.root.findByProps({ testID: 'input-step-goal-card' })).toBeTruthy();
  expect(tree.root.findByProps({ testID: 'input-water-goal-card' })).toBeTruthy();
});

it('renders Screen 13 (Health sync) platform-accurately for web, iOS Apple Health, and Android Health Connect', async () => {
  const machine = baseConfiguredMachine();
  mockState.os = 'web';
  await act(async () => {
    tree = create(
      <OnboardingQuestion
        step="health_sync"
        state={machine.getState()}
        machine={machine}
        update={vi.fn()}
        identityConfirmed={false}
      />,
    );
  });
  expect(tree.root.findByProps({ testID: 'health-sync-web-card' })).toBeTruthy();

  mockState.os = 'ios';
  await act(async () => {
    tree.update(
      <OnboardingQuestion
        step="health_sync"
        state={machine.getState()}
        machine={machine}
        update={vi.fn()}
        identityConfirmed={false}
      />,
    );
  });
  expect(tree.root.findByProps({ testID: 'onboarding-title' }).props.subtitle).toContain(
    'Apple Health',
  );
  expect(tree.root.findByProps({ testID: 'health-sync-options-card' })).toBeTruthy();

  mockState.os = 'android';
  await act(async () => {
    tree.update(
      <OnboardingQuestion
        step="health_sync"
        state={machine.getState()}
        machine={machine}
        update={vi.fn()}
        identityConfirmed={false}
      />,
    );
  });
  expect(tree.root.findByProps({ testID: 'onboarding-title' }).props.subtitle).toContain(
    'Health Connect',
  );
});

it('renders Screen 14 (Your plan) and Screen 15 (Reveal) in Design System v1', async () => {
  const state = baseConfiguredMachine().getState();
  await act(async () => {
    tree = create(
      <PlanReviewStep
        variant="v1"
        state={state}
        onPlanned={vi.fn()}
        onCalculation={vi.fn()}
        saving={false}
        error={null}
      />,
    );
  });
  expect(tree.root.findByProps({ testID: 'onboarding-title' }).props).toMatchObject({
    eyebrow: 'YOUR PLAN',
    title: "Priya, here's your starting point.",
    accentWord: 'starting point.',
  });
  expect(tree.root.findByProps({ testID: 'plan-calorie-ring' })).toBeTruthy();
  expect(tree.root.findByProps({ testID: 'plan-macro-split' })).toBeTruthy();

  await act(async () => {
    tree.update(<RevealStepView state={state} />);
  });
  expect(tree.root.findByProps({ testID: 'onboarding-title' }).props).toMatchObject({
    eyebrow: 'YOUR JOURNEY',
    accentWord: '68 kg',
  });
  expect(tree.root.findByProps({ testID: 'onboarding-peak-reveal' })).toBeTruthy();
  expect(tree.root.findByProps({ testID: 'reveal-metrics-row' })).toBeTruthy();
});
