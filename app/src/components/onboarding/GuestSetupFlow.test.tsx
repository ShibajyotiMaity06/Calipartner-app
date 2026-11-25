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
  createProfile: vi.fn(),
  updateProfile: vi.fn(),
  changeUsername: vi.fn(),
  os: 'web',
}));

vi.mock('react-native', () => ({
  View: 'View',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  Modal: 'Modal',
  Keyboard: { dismiss: vi.fn() },
  BackHandler: { addEventListener: () => ({ remove: vi.fn() }) },
  Animated: {
    View: 'AnimatedView',
    Value: class {
      setValue() {}
      interpolate() {
        return 1;
      }
    },
    spring: () => ({ start: (cb?: () => void) => cb?.() }),
    timing: () => ({ start: (cb?: () => void) => cb?.() }),
  },
  Platform: {
    get OS() {
      return state.os;
    },
  },
  StyleSheet: { create: (value: unknown) => value },
}));
vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
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
vi.mock('@calipartner/ui/v1', async () => {
  const tokens = await import('../../../../packages/ui/src/v1/theme');
  return {
    ...tokens,
    FlameIcon: 'FlameIcon',
    DumbbellIcon: 'DumbbellIcon',
    ChevronLeftIcon: 'ChevronLeftIcon',
    Radio: 'Radio',
    Text: 'Text',
    PageDots: 'PageDots',
    PrimaryButton: 'PrimaryButton',
    LinkButton: 'LinkButton',
    IconButton: 'IconButton',
    ProgressBar: 'ProgressBar',
    ScreenWrapper: ({ children, navRow, footer, testID }: Record<string, unknown>) =>
      React.createElement(
        'View',
        { testID },
        navRow as React.ReactNode,
        children as React.ReactNode,
        footer as React.ReactNode,
      ),
    triggerHaptic: vi.fn(),
    usePressScale: () => ({ scale: 1, onPressIn: vi.fn(), onPressOut: vi.fn() }),
  };
});
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: state.user,
    profile: state.profile,
    isLoading: false,
    needsProfileSetup: Boolean(state.user && !state.profile),
    createProfile: state.createProfile,
    updateProfile: state.updateProfile,
    changeUsername: state.changeUsername,
  }),
}));
vi.mock('@/hooks/useTargets', () => ({ useTargets: () => ({ saveGoalProfile: state.save }) }));
vi.mock('@/hooks/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isOnline: true }) }));
vi.mock('@/db', () => ({ getDb: async () => ({}) }));
vi.mock('@/services/foodService', () => ({ generateClientUuid: () => 'stable-draft-id' }));
vi.mock('@/services/pairOnboardingService', () => ({
  requirePairPrompt: vi.fn().mockResolvedValue(undefined),
  finishPairPrompt: vi.fn().mockResolvedValue(undefined),
  pendingPairInvite: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/services/onboardingReviewService', () => ({ requireOnboardingReview: state.review }));
vi.mock('@/services/nativeHealthService', () => ({
  requestNativeHealthPermission: vi.fn().mockResolvedValue('granted'),
}));
vi.mock('@/services/notificationPermissionService', () => ({
  requestNotificationPermissions: vi.fn().mockResolvedValue(true),
}));
vi.mock('@/services/notificationSettingsService', () => ({
  updateNotificationSettings: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/services/localNotificationService', () => ({
  syncAllLocalReminders: vi.fn().mockResolvedValue({ scheduled: 0, cancelled: false }),
}));
vi.mock('./RevealStepView', () => ({ RevealStepView: 'Reveal' }));
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
vi.mock('./OnboardingQuestion', async () => {
  const { ONBOARDING_STEPS_ORDER } = await import('@/services/onboardingStateMachine');
  return {
    OnboardingQuestion: 'Question',
    questionCopy: Object.fromEntries(
      [
        ...ONBOARDING_STEPS_ORDER,
        'reveal',
        'reminders',
        'auth',
        'pro_coach',
        'pro_partners',
        'pro_adaptive',
        'paywall',
        'profile',
        'all_set',
      ].map((step) => [step, { title: 'characterSetup.startTitle' }]),
    ),
  };
});
vi.mock('./PlanReviewStep', () => ({ PlanReviewStep: 'Review' }));
vi.mock('./GymCalculationStep', () => ({ GymCalculationStep: 'Calculation' }));
vi.mock('./RemindersStep', () => ({ RemindersStep: 'RemindersStep' }));
vi.mock('./ProTeaserStep', () => ({ ProTeaserStep: 'ProTeaserStep' }));
vi.mock('./PaywallV1Step', () => ({ PaywallV1Step: 'PaywallV1Step' }));
vi.mock('./ProfileSetupStep', () => ({ ProfileSetupStep: 'ProfileSetupStep' }));
vi.mock('./AllSetStep', () => ({ AllSetStep: 'AllSetStep' }));
vi.mock('@/components/auth/AuthFormView', () => ({ AuthFormView: 'AuthFormView' }));

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
  state.createProfile.mockResolvedValue({ error: null });
  state.updateProfile.mockResolvedValue({ error: null });
  state.changeUsername.mockResolvedValue({ error: null });
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});

it('allows unauthenticated visitors to start questionnaire as guest', async () => {
  await render();
  expect(state.replace).not.toHaveBeenCalled();
  expect(find('Question').props.step).toBe('goal');
  expect(state.drafts.has('guest-user')).toBe(true);
});

it('carries a finished guest questionnaire through Reminders (16), Auth (17), Pro Carousel (19-21), Paywall (22), Profile (24), and All Set (25)', async () => {
  await render();
  await edit((machine) => machine.setCharacterGender('female', true).setGoal('bulk'));
  await next();
  await edit((machine) => machine.setNickname('Alex'));
  await next();
  await edit((machine) => machine.setBodyStats({ dateOfBirth: '1999-06-12' }));
  await next();
  await edit((machine) => machine.setBodyStats({ heightCm: 172 }));
  await next();
  await edit((machine) => machine.setBodyStats({ weightKg: 72 }));
  for (let stage = 5; stage <= 12; stage++) await next();
  await act(async () => find('Review').props.onPlanned({}));

  // 15 Reveal -> 16 Reminders
  await act(async () =>
    tree.root.findByProps({ testID: 'onboarding-open-paywall' }).props.onPress(),
  );
  expect(find('RemindersStep')).toBeTruthy();

  // 16 Reminders -> 17 Auth
  await act(async () => tree.root.findByProps({ testID: 'btn-turn-on-reminders' }).props.onPress());
  expect(find('AuthFormView')).toBeTruthy();
  const guest = state.drafts.get('guest-user');
  expect(guest).toMatchObject({
    currentStep: 'auth',
    heightCm: 172,
    weightKg: 72,
    dateOfBirth: '1999-06-12',
  });

  // Guest authenticates -> draft migrates -> auto-advances past auth to 19 Pro Coach
  state.user = { id: 'owner' };
  await act(async () => tree.update(<OnboardingScreen />));
  expect(find('ProTeaserStep').props.slide).toBe('pro_coach');
  expect(state.drafts.has('guest-user')).toBe(false);
  expect(state.drafts.get('owner')?.goalProfileId).toBe(guest?.goalProfileId);

  // 19 -> 20 -> 21 -> 22 Paywall
  await act(async () => tree.root.findByProps({ testID: 'btn-pro-teaser-next' }).props.onPress());
  expect(find('ProTeaserStep').props.slide).toBe('pro_partners');
  await act(async () => tree.root.findByProps({ testID: 'btn-pro-teaser-next' }).props.onPress());
  expect(find('ProTeaserStep').props.slide).toBe('pro_adaptive');
  await act(async () => tree.root.findByProps({ testID: 'btn-pro-teaser-next' }).props.onPress());
  expect(find('PaywallV1Step')).toBeTruthy();

  // 22 Paywall Continue with Free -> 24 Profile setup
  await act(async () => find('PaywallV1Step').props.onContinueFree());
  expect(find('ProfileSetupStep')).toBeTruthy();
  await act(async () => {
    find('ProfileSetupStep').props.onChangeUsername('alex.fit');
    find('ProfileSetupStep').props.onChangeValid(true);
  });
  await act(async () => tree.root.findByProps({ testID: 'btn-submit-profile' }).props.onPress());

  expect(state.createProfile).toHaveBeenCalledWith(
    expect.objectContaining({ username: 'alex.fit', nickname: 'Alex' }),
  );
  expect(find('AllSetStep').props.nickname).toBe('Alex');

  // 25 All set -> Go to Today
  await act(async () => find('AllSetStep').props.onGoToToday());
  expect(state.replace).toHaveBeenCalledWith('/(tabs)/today');
});

it('offers only Cut and Bulk in Design System v1 order when a historical goal is maintenance', async () => {
  const onSelectGoal = vi.fn();
  await act(async () => {
    tree = create(<GoalStep selectedGoal="maintain" onSelectGoal={onSelectGoal} />);
  });
  const choices = all('Pressable').filter((node) =>
    String(node.props.testID ?? '').startsWith('goal-card-'),
  );
  expect(choices.map(({ props }) => props.testID)).toEqual(['goal-card-cut', 'goal-card-bulk']);
  expect(choices.some(({ props }) => props.accessibilityState?.selected)).toBe(false);
  tree.root.findByProps({ testID: 'goal-card-cut' }).props.onPress();
  expect(onSelectGoal).toHaveBeenCalledWith('cut');
});

it('commits default Cut goal on Continue from Screen 2 and disables Continue on Screen 3 until a name is entered', async () => {
  state.user = { id: 'owner' };
  await render();
  expect(find('Question').props.step).toBe('goal');
  tree.root.findByProps({ testID: 'btn-onboarding-back' }).props.onPress();
  expect(state.replace).toHaveBeenCalledWith('/welcome');
  await next();
  expect(find('Question').props.step).toBe('nickname');
  expect(find('Question').props.state.goal).toBe('cut');
  expect(find('Question').props.state.goalSelected).toBe(true);
  expect(tree.root.findByProps({ testID: 'btn-onboarding-next' }).props.disabled).toBe(true);
  await edit((machine) => machine.setNickname('Priya'));
  expect(tree.root.findByProps({ testID: 'btn-onboarding-next' }).props.disabled).toBe(false);
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

it('skips Auth for signed-in users, retries save idempotently on Screen 24, and allows inviting a partner from Screen 25', async () => {
  state.user = { id: 'owner' };
  state.profile = {
    id: 'owner',
    username: 'alex',
    nickname: 'Alex',
    sex: 'female',
    date_of_birth: '1999-06-12',
  } as Profile;
  await render();
  await edit((machine) => machine.setCharacterGender('female', true).setGoal('bulk'));
  await next();
  await edit((machine) => machine.setNickname('Alex'));
  await next();
  await edit((machine) => machine.setBodyStats({ dateOfBirth: '1999-06-12' }));
  await next();
  await edit((machine) => machine.setBodyStats({ heightCm: 172 }));
  await next();
  await edit((machine) => machine.setBodyStats({ weightKg: 72 }));
  for (let stage = 5; stage <= 12; stage++) await next();
  await act(async () => find('Review').props.onPlanned({}));

  // 15 Reveal -> 16 Reminders
  await act(async () =>
    tree.root.findByProps({ testID: 'onboarding-open-paywall' }).props.onPress(),
  );
  // 16 Reminders (Not now) -> skips Auth straight to 19 Pro Coach!
  await act(async () => tree.root.findByProps({ testID: 'btn-skip-reminders' }).props.onPress());
  expect(all('AuthFormView')).toHaveLength(0);
  expect(find('ProTeaserStep').props.slide).toBe('pro_coach');

  // Top-right Skip jumps directly from Pro carousel -> 22 Paywall
  await act(async () => tree.root.findByProps({ testID: 'btn-pro-teaser-skip' }).props.onPress());
  expect(find('PaywallV1Step')).toBeTruthy();

  // 22 Paywall -> 24 Profile setup
  await act(async () => find('PaywallV1Step').props.onContinueFree());
  expect(find('ProfileSetupStep')).toBeTruthy();

  let rejectSave!: (value: { success: false; error: string }) => void;
  state.save.mockReturnValueOnce(
    new Promise((resolve) => {
      rejectSave = resolve;
    }),
  );
  await act(async () => {
    find('ProfileSetupStep').props.onChangeValid(true);
  });
  await act(async () => tree.root.findByProps({ testID: 'btn-submit-profile' }).props.onPress());
  await act(async () => rejectSave({ success: false, error: 'network' }));
  expect(state.replace).not.toHaveBeenCalled();
  expect(state.drafts.get('owner')?.goalProfileId).toBe('stable-draft-id');

  // Retry succeeds with exact same goalProfileId -> moves to 25 All set
  await act(async () => tree.root.findByProps({ testID: 'btn-submit-profile' }).props.onPress());
  expect(state.save).toHaveBeenCalledTimes(2);
  expect(state.save.mock.calls.map(([record]) => record.id)).toEqual([
    'stable-draft-id',
    'stable-draft-id',
  ]);
  expect(state.review).toHaveBeenCalledWith('owner', 'web');
  expect(state.drafts.has('owner')).toBe(false);
  expect(find('AllSetStep')).toBeTruthy();

  await act(async () => find('AllSetStep').props.onInvitePartner());
  expect(state.replace).toHaveBeenCalledWith('/pair-start');
});
