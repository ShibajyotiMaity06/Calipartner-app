import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  load: vi.fn(),
  build: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  params: { setup: '1' },
}));
vi.mock('react-native', () => ({
  Platform: { OS: 'web' },
  BackHandler: {},
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  View: 'View',
  StyleSheet: { create: (value: unknown) => value },
}));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
vi.mock('expo-router', () => ({
  useRouter: () => ({ replace: state.replace, back: state.back, canGoBack: () => true }),
  useLocalSearchParams: () => state.params,
  useFocusEffect: (callback: () => void | (() => void)) => React.useEffect(callback, [callback]),
}));
vi.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
vi.mock('@calipartner/ui', async () => ({
  ...(await import('../../../../packages/ui/src/tokens')),
  Text: 'Text',
  Button: 'Button',
}));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'owner' }, profile: { sex: 'male' } }),
}));
vi.mock('@/hooks/useTargets', () => ({
  useTargets: () => ({ currentGoalProfile: { id: 'goal', current_weight_kg: 80 } }),
}));
vi.mock('@/hooks/useBrowserModalBack', () => ({ useBrowserModalBack: vi.fn() }));
vi.mock('@/services/weeklyPlanService', () => ({
  getPersonalWeeklyPlan: state.load,
  buildPersonalWeeklyPlan: state.build,
}));
vi.mock('@/services/pairOnboardingService', () => ({
  afterSetupDestination: async () => '/pair-start',
}));
vi.mock('@/components/rooms/SquadViews', () => ({ squadStyles: {} }));
vi.mock('@/components/rooms/PaywallModal', () => ({ PaywallModal: 'PaywallModal' }));
vi.mock('@/components/workouts/WeeklyRoutineEditor', () => ({
  WeeklyRoutineEditor: 'RoutineEditor',
}));
vi.mock('@/components/diary/NutrientSummary', () => ({ NutrientSummary: 'NutrientSummary' }));
vi.mock('./WeeklyPlanForm', () => ({ WeeklyPlanForm: 'WeeklyPlanForm' }));
vi.mock('./WeeklyPlanPreparing', () => ({ WeeklyPlanPreparing: 'WeeklyPlanPreparing' }));
vi.mock('./BlueprintStep', () => ({ BlueprintStep: 'BlueprintStep' }));
vi.mock('./OnboardingPaywall', () => ({ OnboardingPaywall: 'OnboardingPaywall' }));
import WeeklyPlanScreen from '@/app/weekly-plan';
import { WeeklyPlanForm } from './WeeklyPlanForm';
import { BlueprintStep } from './BlueprintStep';
import { WeeklyPlanPreparing } from './WeeklyPlanPreparing';
import { OnboardingPaywall } from './OnboardingPaywall';
import { PaywallModal } from '@/components/rooms/PaywallModal';
let tree: ReactTestRenderer;
beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  state.load.mockResolvedValue(null);
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});
const preferences = { country: 'India' };
const monday = {
  id: 'saved',
  revision: 1,
  preferences,
  full_access: false,
  days: [{ day: 0, workout: { title: 'Rest', minutes: 0, exercises: [] }, meals: [] }],
  workout_tips: [],
  diet_tips: [],
};
it('waits for all preferences, then shows the blueprint before any AI call; acknowledged plan precedes the paywall', async () => {
  let finish: ((value: unknown) => void) | undefined;
  state.build.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await act(async () => {
    tree = create(<WeeklyPlanScreen />);
  });
  await act(async () => tree.root.findByType(WeeklyPlanForm).props.onBuild(preferences));
  expect(state.build).not.toHaveBeenCalled();
  expect(tree.root.findByType(BlueprintStep)).toBeDefined();
  await act(async () => tree.root.findByType(BlueprintStep).props.onMake());
  expect(tree.root.findByType(WeeklyPlanPreparing)).toBeDefined();
  expect(tree.root.findAllByType(OnboardingPaywall)).toHaveLength(0);
  await act(async () => finish?.(monday));
  expect(tree.root.findByProps({ testID: 'weekly-plan-paid-lock' })).toBeDefined();
  await act(async () =>
    tree.root.findByProps({ testID: 'weekly-plan-choose-support' }).props.onPress(),
  );
  await act(async () => tree.root.findByType(OnboardingPaywall).props.onCheckout('pro', 'monthly'));
  expect(tree.root.findByType(PaywallModal).props).toMatchObject({
    preselectedTier: 'pro',
    preselectedDuration: 'monthly',
  });
});
it('a failed request retains the preferences and shows an error instead of a fabricated plan', async () => {
  state.build.mockRejectedValue(new Error('PLAN_UNAVAILABLE'));
  await act(async () => {
    tree = create(<WeeklyPlanScreen />);
  });
  await act(async () => tree.root.findByType(WeeklyPlanForm).props.onBuild(preferences));
  await act(async () => tree.root.findByType(BlueprintStep).props.onMake());
  expect(tree.root.findAllByProps({ accessibilityRole: 'alert' })).toHaveLength(1);
  expect(tree.root.findAllByProps({ testID: 'weekly-plan-paid-lock' })).toHaveLength(0);
  expect(tree.root.findByType(WeeklyPlanForm).props.initial).toEqual(preferences);
});
