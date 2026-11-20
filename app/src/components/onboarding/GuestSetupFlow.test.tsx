import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Profile } from '@calipartner/core';
import type * as onboardingDraft from '@/services/onboardingDraft';
import type { OnboardingState, OnboardingStateMachine } from '@/services/onboardingStateMachine';
const state = vi.hoisted(() => ({
  user: null as { id: string } | null,
  profile: null as Profile | null,
  drafts: new Map<string, Partial<OnboardingState>>(),
  replace: vi.fn(),
  save: vi.fn(),
  review: vi.fn(),
  next: vi.fn(),
  os: 'web',
}));
vi.mock('react-native', () => ({
  View: 'View',
  ScrollView: 'ScrollView',
  Modal: 'Modal',
  Keyboard: { dismiss: vi.fn() },
  Platform: {
    get OS() {
      return state.os;
    },
  },
  StyleSheet: { create: (value: unknown) => value },
}));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
vi.mock('expo-router', () => {
  const router = { replace: state.replace };
  return { useRouter: () => router, useLocalSearchParams: () => ({}) };
});
vi.mock('@calipartner/ui', async () => ({
  ...(await import('../../../../packages/ui/src/tokens')),
  Button: (await import('@/test/ButtonStub')).ButtonStub,
  Text: 'Text',
  NavigationIcon: 'Icon',
  useTheme: () => ({ colors: {}, reduceMotion: true }),
}));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: state.user,
    profile: state.profile,
    isLoading: false,
    needsProfileSetup: Boolean(state.user && !state.profile),
    updateProfile: vi.fn(async () => ({ error: null })),
  }),
}));
vi.mock('@/hooks/useTargets', () => ({ useTargets: () => ({ saveGoalProfile: state.save }) }));
vi.mock('@/hooks/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isOnline: true }) }));
vi.mock('@/db', () => ({ getDb: async () => ({}) }));
vi.mock('@/services/foodService', () => ({ generateClientUuid: () => 'stable-draft-id' }));
vi.mock('@/services/pairOnboardingService', () => ({
  requirePairPrompt: vi.fn(),
  afterSetupDestination: state.next,
}));
vi.mock('@/services/onboardingReviewService', () => ({ requireOnboardingReview: state.review }));
vi.mock('@/services/onboardingDraft', async (importOriginal) => ({
  ...(await importOriginal<typeof onboardingDraft>()),
  loadOnboardingDraft: async (_db: unknown, owner: string) => state.drafts.get(owner) ?? null,
  saveOnboardingDraft: async (_db: unknown, owner: string, draft: OnboardingState) => {
    state.drafts.set(owner, { ...draft });
  },
  clearOnboardingDraft: async (_db: unknown, owner: string) => {
    state.drafts.delete(owner);
  },
}));
vi.mock('./EvolutionCharacter', () => ({ EvolutionCharacter: 'Character' }));
vi.mock('./OnboardingQuestion', async () => {
  const { ONBOARDING_STEPS_ORDER } = await import('@/services/onboardingStateMachine');
  return {
    OnboardingQuestion: 'Question',
    questionCopy: Object.fromEntries(
      [...ONBOARDING_STEPS_ORDER, 'reveal', 'paywall'].map((step) => [
        step,
        { title: 'characterSetup.startTitle' },
      ]),
    ),
  };
});
vi.mock('./FinishOnboardingProfile', () => ({ FinishOnboardingProfile: 'ProfileForm' }));
vi.mock('./PlanReviewStep', () => ({ PlanReviewStep: 'Review' }));
vi.mock('./GymCalculationStep', () => ({ GymCalculationStep: 'Calculation' }));
vi.mock('./PlanPrimitives', () => ({
  PlanChoice: 'GoalChoice',
  PlanCard: 'PlanCard',
  planStyles: {},
}));
vi.mock('@/components/rooms/PaywallModal', () => ({ PaywallModal: 'Paywall' }));

import OnboardingScreen from '@/app/onboarding';
import { GoalStep } from './GoalStep';
let tree: ReactTestRenderer;
const find = (type: string) => tree.root.findByType(type as React.ElementType);
const all = (type: string) => tree.root.findAllByType(type as React.ElementType);
const next = async () =>
  act(async () => tree.root.findByProps({ testID: 'btn-onboarding-next' }).props.onPress());
const edit = async (change: (machine: OnboardingStateMachine) => void) => {
  const question = find('Question').props;
  await act(async () => {
    change(question.machine);
    question.update();
  });
};
const render = async () => {
  await act(async () => {
    tree = create(<OnboardingScreen />);
  });
};

beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  state.user = null;
  state.profile = null;
  state.drafts.clear();
  state.save.mockResolvedValue({ success: true });
  state.next.mockResolvedValue('/founders?next=pair');
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});

it('routes unauthenticated visitors to signup or login before asking questions', async () => {
  await render();
  expect(state.replace).toHaveBeenCalledWith('/auth/sign-in?mode=signup');
  expect(all('Question')).toHaveLength(0);
  expect(state.drafts.size).toBe(0);
});

it('offers only Bulk and Cut when a historical goal is maintenance', async () => {
  const onSelectGoal = vi.fn();
  await act(async () => {
    tree = create(<GoalStep selectedGoal="maintain" onSelectGoal={onSelectGoal} />);
  });
  const choices = all('GoalChoice');
  expect(choices.map(({ props }) => props.testID)).toEqual(['goal-card-bulk', 'goal-card-cut']);
  expect(choices.some(({ props }) => props.selected)).toBe(false);
  tree.root.findByProps({ testID: 'goal-card-cut' }).props.onPress();
  expect(onSelectGoal).toHaveBeenCalledWith('cut');
});

it('keeps measurements and the save ID when resuming an old guest draft', async () => {
  state.drafts.set('guest-user', {
    currentStep: 'completed' as OnboardingState['currentStep'],
    goalProfileId: 'original-id',
    goal: 'maintain',
    heightCm: 172,
    weightKg: 72,
    dateOfBirth: '1999-06-12',
  });
  state.user = { id: 'owner' };
  await render();
  expect(find('Question').props.state).toMatchObject({
    currentStep: 'goal',
    goalSelected: false,
    dateOfBirth: '',
    heightCm: 172,
    weightKg: 72,
    goalProfileId: 'original-id',
  });
  expect(state.drafts.has('guest-user')).toBe(false);
  expect(state.drafts.has('owner')).toBe(true);
});

it('maps 11 asset stages and only finishes after an acknowledged, retry-safe save from the paywall', async () => {
  state.user = { id: 'owner' };
  await render();
  expect(find('Question').props.step).toBe('goal');
  expect(all('Character')).toHaveLength(0);
  expect(find('Paywall').props).toMatchObject({ visible: false, preloadPrices: true });
  await edit((machine) => machine.setCharacterGender('female', true).setGoal('bulk'));
  await next();
  expect(find('Character').props).toMatchObject({ gender: 'female', goal: 'bulk', stage: 1 });
  await edit((machine) => machine.setNickname('Alex'));
  await next();
  await edit((machine) => machine.setBodyStats({ dateOfBirth: '1999-06-12' }));
  await next();
  expect(find('ProfileForm').props.state.currentStep).toBe('profile');
  expect(state.save).not.toHaveBeenCalled();
  state.profile = {
    id: 'owner',
    nickname: 'Alex',
    sex: 'female',
    date_of_birth: '1999-06-12',
  } as Profile;
  await act(async () => tree.update(<OnboardingScreen />));
  await next();
  await edit((machine) => machine.setBodyStats({ heightCm: 172 }));
  await next();
  await edit((machine) => machine.setBodyStats({ weightKg: 72 }));
  for (let stage = 5; stage <= 11; stage++) {
    expect(find('Character').props.stage).toBe(stage);
    await next();
  }
  expect(find('Review').props.state.calculatedTargets.targetKcal).toBeGreaterThan(0);
  expect(all('Character')).toHaveLength(0);
  await act(async () => find('Review').props.onPlanned({}));
  expect(find('Character').props).toMatchObject({ stage: 11, reveal: true });
  expect(find('Paywall').props.visible).toBe(false);
  await act(async () =>
    tree.root.findByProps({ testID: 'onboarding-open-paywall' }).props.onPress(),
  );
  expect(state.drafts.get('owner')?.currentStep).toBe('paywall');
  let rejectSave!: (value: { success: false; error: string }) => void;
  state.save.mockReturnValueOnce(
    new Promise((resolve) => {
      rejectSave = resolve;
    }),
  );
  await act(async () => find('Paywall').props.onContinueFree());
  expect(find('Paywall').props).toMatchObject({ visible: true, completionPending: true });
  await act(async () => rejectSave({ success: false, error: 'network' }));
  expect(state.replace).not.toHaveBeenCalled();
  expect(state.drafts.get('owner')?.goalProfileId).toBe('stable-draft-id');
  await act(async () =>
    tree.root.findByProps({ testID: 'finish-onboarding-retry' }).props.onPress(),
  );
  expect(state.save).toHaveBeenCalledTimes(2);
  expect(state.save.mock.calls.map(([record]) => record.id)).toEqual([
    'stable-draft-id',
    'stable-draft-id',
  ]);
  expect(state.review).toHaveBeenCalledWith('owner', 'web');
  expect(state.replace).toHaveBeenCalledWith('/founders?next=pair');
  expect(state.drafts.has('owner')).toBe(false);
});
