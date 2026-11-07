import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ query: vi.fn(), save: vi.fn(), pro: true }));
vi.mock('react-native', () => ({
  View: 'View',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  TextInput: 'TextInput',
  ActivityIndicator: 'ActivityIndicator',
  KeyboardAvoidingView: 'KeyboardAvoidingView',
  Platform: { OS: 'web' },
  StyleSheet: { create: (value: unknown) => value },
}));
vi.mock('@calipartner/ui', async () => ({
  ...(await import('../../../../packages/ui/src/tokens')),
  Text: 'Text',
  Button: 'Button',
}));
vi.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
vi.mock('@/theme/useTheme', () => ({ useTheme: () => ({ colors: {} }) }));
vi.mock('@/hooks/useTargets', () => ({
  useTargets: () => ({
    currentGoalProfile: { daily_calorie_target: 2200, protein_grams: 140, goal: 'maintain' },
  }),
}));
vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => ({
    currentTier: state.pro ? 'pro' : 'basic',
    hasActiveAccess: state.pro,
    isTrial: false,
    loading: false,
  }),
}));
vi.mock('@/hooks/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isOnline: true }) }));
vi.mock('@/hooks/usePaywall', () => ({
  usePaywall: () => {
    const [isOpen, setIsOpen] = React.useState(false);
    return {
      checkAndTrigger: () => setIsOpen(true),
      paywallState: { isOpen },
      closePaywall: () => setIsOpen(false),
    };
  },
}));
vi.mock('@/services/aiCoachClient', () => ({
  queryAiCoach: state.query,
  cleanCoachResponse: (text: string) => text,
}));
vi.mock('@/services/coachMealService', () => ({
  prepareCoachMealSave: (draft: unknown) => ({ id: 'stable-id', draft }),
  saveCoachMeal: state.save,
}));
vi.mock('@/services/aiFoodPhotoService', () => ({ acceptAiProcessingConsent: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ getSupabase: vi.fn() }));
vi.mock('@/services/foodService', () => ({ generateClientUuid: () => crypto.randomUUID() }));
vi.mock('@/components/diary/FoodLogModal', () => ({ FoodLogModal: 'FoodLogModal' }));
vi.mock('@/components/rooms', () => ({ AiCoachLockedCard: 'LockedCard', PaywallModal: 'Paywall' }));
vi.mock('./CoachBanners', () => ({
  CoachDailyLimitBanner: 'DailyLimit',
  CoachOfflineBanner: 'Offline',
}));
vi.mock('./CoachConsentModal', () => ({ CoachConsentModal: 'Consent' }));
vi.mock('./CoachHistoryModal', () => ({ CoachHistoryModal: 'History' }));
vi.mock('./CoachReportModal', () => ({ CoachReportModal: 'Report' }));
vi.mock('./CoachSuggestedPrompts', () => ({ CoachSuggestedPrompts: 'Prompts' }));
import { CoachChatView } from './CoachChatView';
import { AiCoachLockedCard, PaywallModal } from '@/components/rooms';
let tree: ReactTestRenderer;
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
  vi.clearAllMocks();
  state.pro = true;
});
const mealDraft = {
  description: '2 boiled eggs',
  mealSection: 'lunch',
  localDate: '2026-11-03',
  items: [
    {
      name: 'Boiled eggs',
      quantity: 2,
      unit: 'eggs',
      calories: 156,
      protein: 13,
      carbs: 1,
      fat: 11,
      fiber: 0,
      sugar: 0,
      sodium_mg: 124,
    },
  ],
};
it('clarifies portions and meal section, then logs only on a tap and waits for acknowledgement', async () => {
  state.query
    .mockResolvedValueOnce({ content: 'Which foods and amounts?', mealDraft: null })
    .mockResolvedValueOnce({ content: 'Was this breakfast, lunch or dinner?', mealDraft: null })
    .mockResolvedValueOnce({ content: 'Estimated meal. Check the portions.', mealDraft });
  let acknowledge!: () => void;
  state.save.mockRejectedValueOnce(new Error('offline')).mockImplementationOnce(
    () =>
      new Promise<void>((done) => {
        acknowledge = done;
      }),
  );
  await act(async () => {
    tree = create(<CoachChatView />);
  });
  const send = async (text: string) => {
    await act(async () =>
      tree.root.findByProps({ testID: 'input-coach-message' }).props.onChangeText(text),
    );
    await act(async () => tree.root.findByProps({ testID: 'btn-coach-send' }).props.onPress());
  };
  await send('I ate eggs');
  expect(tree.root.findAllByProps({ testID: 'coach-meal-draft' })).toHaveLength(0);
  await send('2 boiled eggs');
  expect(tree.root.findAllByProps({ testID: 'coach-meal-draft' })).toHaveLength(0);
  await send('Lunch');
  expect(tree.root.findByProps({ testID: 'coach-meal-macros' })).toBeDefined();
  expect(state.query.mock.lastCall?.[3]).toEqual({ mealLogging: true });
  expect(state.save).not.toHaveBeenCalled();
  await act(async () => tree.root.findByProps({ testID: 'coach-meal-log' }).props.onPress());
  expect(tree.root.findByProps({ testID: 'coach-meal-log' }).props.label).toBe('Log meal');
  await act(async () => {
    const log = tree.root.findByProps({ testID: 'coach-meal-log' }).props.onPress;
    log();
    log();
  });
  expect(state.save).toHaveBeenCalledTimes(2);
  expect(state.save.mock.calls[0]).toEqual(state.save.mock.calls[1]);
  await act(async () => {
    acknowledge();
  });
  expect(tree.root.findByProps({ testID: 'coach-meal-log' }).props.label).toBe('Meal logged');
});

it('closes both the local and triggered paywall states for a Free coach user', async () => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  state.pro = false;
  await act(async () => {
    tree = create(<CoachChatView />);
  });
  await act(async () => tree.root.findByType(AiCoachLockedCard).props.onUnlock());
  expect(tree.root.findByType(PaywallModal).props.visible).toBe(true);
  await act(async () => tree.root.findByType(PaywallModal).props.onClose());
  expect(tree.root.findByType(PaywallModal).props.visible).toBe(false);
});
