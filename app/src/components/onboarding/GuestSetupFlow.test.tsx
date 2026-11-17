import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
import type { OnboardingState } from '@/services/onboardingStateMachine';
const state = vi.hoisted(() => ({
  user: null as { id: string } | null,
  profile: null as { id: string; nickname: string; sex: 'female'; date_of_birth: string } | null,
  drafts: new Map<string, Partial<OnboardingState>>(),
  push: vi.fn(),
  replace: vi.fn(),
  save: vi.fn(),
}));
vi.mock('react-native', () => ({
  View: 'View',
  ScrollView: 'ScrollView',
  Modal: 'Modal',
  KeyboardAvoidingView: 'KeyboardAvoidingView',
  Platform: { OS: 'web' },
  StyleSheet: { create: (value: unknown) => value },
}));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
vi.mock('expo-router', () => {
  const router = { push: state.push, replace: state.replace };
  return { useRouter: () => router };
});
vi.mock('@calipartner/ui', async () => ({
  ...(await import('../../../../packages/ui/src/tokens')),
  Button: (await import('@/test/ButtonStub')).ButtonStub,
  Text: 'Text',
  NavigationIcon: 'Icon',
  useTheme: () => ({ colors: {}, reduceMotion: true }),
}));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: state.user, profile: state.profile, isLoading: false }),
}));
vi.mock('@/hooks/useTargets', () => ({
  useTargets: () => ({ saveGoalProfile: state.save, saveScreening: state.save }),
}));
vi.mock('@/hooks/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isOnline: true }) }));
vi.mock('@/db', () => ({ getDb: async () => ({}) }));
vi.mock('@/services/foodService', () => ({ generateClientUuid: () => 'stable-draft-id' }));
vi.mock('@/services/webBillingService', () => ({ fetchWebCatalog: async () => ({}) }));
vi.mock('@/services/pairOnboardingService', () => ({ requirePairPrompt: vi.fn() }));
vi.mock('@/services/onboardingDraft', () => ({
  loadOnboardingDraft: async (_db: unknown, owner: string) => state.drafts.get(owner) ?? null,
  saveOnboardingDraft: async (_db: unknown, owner: string, draft: OnboardingState) => {
    state.drafts.set(owner, { ...draft });
  },
  clearOnboardingDraft: async (_db: unknown, owner: string) => {
    state.drafts.delete(owner);
  },
}));
vi.mock('./GrowthProjectionStep', () => ({ GrowthProjectionStep: 'Growth' }));
vi.mock('./GoalStep', () => ({ GoalStep: 'Goal' }));
vi.mock('./ActivityStep', () => ({ ActivityStep: 'Activity' }));
vi.mock('./MotivationStep', () => ({ MotivationStep: 'Motivation' }));
vi.mock('./TrainingStep', () => ({ TrainingStep: 'Training' }));
vi.mock('./PremiumStep', () => ({ PremiumStep: 'Premium' }));
vi.mock('./PlanReviewStep', () => ({ PlanReviewStep: 'Review', PlanSafetyNotice: 'Safety' }));
vi.mock('./GymCalculationStep', () => ({ GymCalculationStep: 'Calculation' }));
vi.mock('./PlanPrimitives', () => ({
  PlanChoice: 'Choice',
  NumberField: 'NumberField',
  PlanCard: 'Card',
  planStyles: {},
}));
vi.mock('@/components/rooms/PaywallModal', () => ({ PaywallModal: 'Paywall' }));
import OnboardingScreen from '@/app/onboarding';
let tree: ReactTestRenderer;
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});
it('keeps guest setup local and hands off the same draft only after authentication and profile confirmation', async () => {
  await act(async () => {
    tree = create(<OnboardingScreen />);
  });
  expect(state.replace).not.toHaveBeenCalled();
  const next = async () => {
    await act(async () => tree.root.findByProps({ testID: 'btn-onboarding-next' }).props.onPress());
  };
  await next();
  await next();
  const training = tree.root.findByType('Training' as React.ElementType);
  await act(async () => {
    training.props.onWeight(72);
    training.props.onHeight(172);
    training.props.onBodyStats({ dateOfBirth: '2001-01-01' });
    training.props.onNickname('Guest name');
  });
  await next();
  expect(tree.root.findByType('Growth' as React.ElementType)).toBeDefined();
  await next();
  await next();
  await next();
  expect(state.save).not.toHaveBeenCalled();
  await act(async () => tree.root.findByProps({ testID: 'setup-create-account' }).props.onPress());
  expect(state.push).toHaveBeenCalledWith('/auth/sign-in?mode=signup');
  expect(state.drafts.get('guest-user')?.weightKg).toBe(72);
  state.user = { id: 'confirmed-owner' };
  state.profile = {
    id: 'confirmed-owner',
    nickname: 'Alex',
    sex: 'female',
    date_of_birth: '1999-06-12',
  };
  await act(async () => tree.update(<OnboardingScreen />));
  const review = tree.root.findByType('Review' as React.ElementType).props.state;
  expect(review).toMatchObject({
    weightKg: 72,
    heightCm: 172,
    dateOfBirth: '1999-06-12',
    nickname: 'Alex',
    sex: 'female',
    goalProfileId: 'stable-draft-id',
  });
  expect(state.drafts.has('guest-user')).toBe(false);
  expect(state.drafts.get('confirmed-owner')?.weightKg).toBe(72);
  expect(state.save).not.toHaveBeenCalled();
});
