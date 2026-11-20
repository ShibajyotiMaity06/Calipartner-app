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
  StyleSheet: { create: (value: unknown) => value, hairlineWidth: 1 },
}));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
vi.mock('expo-router', () => ({
  Redirect: 'Redirect',
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
vi.mock('@/hooks/useBrowserModalBack', () => ({
  useBrowserModalBack: vi.fn(),
  closeBrowserModalsThen: (navigate: () => void) => navigate(),
}));
vi.mock('@/services/recipeService', async () => {
  const { default: recipes } = await import('../../../../datasets/owner_recipes.json');
  const { ownerRecipeToRecipe } = await import('@calipartner/core');
  return { OWNER_RECIPES: recipes.map((recipe) => ownerRecipeToRecipe(recipe, recipe.id)) };
});
vi.mock('@/services/weeklyPlanService', () => ({
  getPersonalWeeklyPlan: state.load,
  buildPersonalWeeklyPlan: state.build,
}));
vi.mock('@/services/pairOnboardingService', () => ({
  afterSetupDestination: async () => '/pair-start',
  finishPairPrompt: vi.fn(),
}));
vi.mock('@/components/rooms/SquadViews', () => ({ squadStyles: {}, useSquadStyles: () => ({}) }));
vi.mock('@/components/rooms/PaywallModal', () => ({ PaywallModal: 'PaywallModal' }));
vi.mock('@/components/workouts/WeeklyRoutineEditor', () => ({
  WeeklyRoutineEditor: 'RoutineEditor',
}));
vi.mock('@/components/diary/NutrientSummary', () => ({ NutrientSummary: 'NutrientSummary' }));
vi.mock('./WeeklyPlanForm', () => ({ WeeklyPlanForm: 'WeeklyPlanForm' }));
vi.mock('./WeeklyPlanPreparing', () => ({ WeeklyPlanPreparing: 'WeeklyPlanPreparing' }));
vi.mock('./PersonalisedDayPreview', () => ({ PersonalisedDayPreview: 'PersonalisedDayPreview' }));
vi.mock('./OnboardingPaywall', () => ({ OnboardingPaywall: 'OnboardingPaywall' }));
import WeeklyPlanScreen from '@/app/weekly-plan';
import { WeeklyPlanForm } from './WeeklyPlanForm';
import { PersonalisedDayPreview } from './PersonalisedDayPreview';
let tree: ReactTestRenderer;
beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  state.params.setup = '';
  state.load.mockResolvedValue(null);
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});
const preferences = { country: 'India' };
const monday = {
  id: 'saved',
  revision: 1,
  scope: 'day',
  preferences,
  full_access: false,
  days: [{ day: 0, workout: { title: 'Rest', minutes: 0, exercises: [] }, meals: [] }],
  workout_tips: [],
  diet_tips: [],
};
it('redirects old setup links through normal launch without loading or generating a plan', async () => {
  state.params.setup = '1';
  await act(async () => {
    tree = create(<WeeklyPlanScreen />);
  });
  expect(tree.root.findByType('Redirect' as React.ElementType).props.href).toBe('/');
  expect(state.load).not.toHaveBeenCalled();
  expect(state.build).not.toHaveBeenCalled();
});
it('a failed request retains the preferences and shows an error instead of a fabricated plan', async () => {
  state.build.mockRejectedValue(new Error('PLAN_UNAVAILABLE'));
  await act(async () => {
    tree = create(<WeeklyPlanScreen />);
  });
  await act(async () => tree.root.findByType(WeeklyPlanForm).props.onBuild(preferences));
  expect(tree.root.findAllByProps({ accessibilityRole: 'alert' })).toHaveLength(1);
  expect(tree.root.findAllByProps({ testID: 'weekly-plan-paid-lock' })).toHaveLength(0);
  expect(tree.root.findByType(WeeklyPlanForm).props.initial).toEqual(preferences);
});
it('preserves an existing day and reports a failed meal-section update', async () => {
  state.load.mockResolvedValue(monday);
  state.build.mockRejectedValue(new Error('PLAN_UNAVAILABLE'));
  await act(async () => {
    tree = create(<WeeklyPlanScreen />);
  });
  await act(async () => tree.root.findByType(PersonalisedDayPreview).props.onRebuild());
  expect(tree.root.findByType(PersonalisedDayPreview).props.plan).toEqual(monday);
  expect(tree.root.findAllByProps({ accessibilityRole: 'alert' })).toHaveLength(1);
});
