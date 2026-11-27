import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  goal: 'cut' as 'cut' | 'bulk' | 'maintain',
  dailyCalories: 2200,
  todayCalories: 1220,
}));

vi.mock('react-native', () => ({
  View: 'View',
  Modal: 'Modal',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  ActivityIndicator: 'ActivityIndicator',
  Platform: { OS: 'ios' },
  StyleSheet: {
    create: <T,>(styles: T) => styles,
  },
}));

vi.mock('@calipartner/ui', async () => ({
  ...(await import('../../../../packages/ui/src/tokens')),
  Text: 'Text',
  Button: 'Button',
}));

vi.mock('@calipartner/ui/v1', async () => {
  const theme = await import('../../../../packages/ui/src/v1/theme');
  return {
    ...theme,
    AlertCircleIcon: 'AlertCircleIcon',
    Badge: 'Badge',
    BrandRingMark: 'BrandRingMark',
    Card: ({ children, ...rest }: Record<string, unknown>) =>
      React.createElement('Card', rest, children as React.ReactNode),
    ChartBarIcon: 'ChartBarIcon',
    CheckCircleIcon: 'CheckCircleIcon',
    ChevronRightIcon: 'ChevronRightIcon',
    CloseIcon: 'CloseIcon',
    DumbbellIcon: 'DumbbellIcon',
    PrimaryButton: 'PrimaryButton',
    Ring: ({ children, ...rest }: Record<string, unknown>) =>
      React.createElement('Ring', rest, children as React.ReactNode),
    ScaleIcon: 'ScaleIcon',
    Text: ({ children, ...rest }: Record<string, unknown>) =>
      React.createElement('Text', rest, children as React.ReactNode),
    UtensilsIcon: 'UtensilsIcon',
  };
});

vi.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
vi.mock('@/components/brand/CaliPartnerLogo', () => ({ CaliPartnerLogo: 'CaliPartnerLogo' }));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'coach-user' },
    session: null,
    profile: { nickname: 'Priya' },
  }),
}));
vi.mock('@/hooks/useCurrentLocalDate', () => ({
  useCurrentLocalDate: () => ({ localDate: '2026-11-23' }),
}));
vi.mock('@/hooks/useTargets', () => ({
  useTargets: () => ({
    currentGoalProfile: {
      goal: state.goal,
      daily_calorie_target: state.dailyCalories,
      effective_from: '2026-11-10',
    },
  }),
}));
vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => ({
    offerings: {
      all: {
        pro: {
          availablePackages: [
            {
              product: {
                identifier: 'pro_annual',
                priceString: '₹2,499',
                price: 2499,
                currencyCode: 'INR',
                subscriptionPeriod: 'P1Y',
              },
            },
          ],
        },
      },
    },
    purchase: vi.fn(),
    refresh: vi.fn(),
    loading: false,
  }),
}));
vi.mock('@/db', () => ({
  getDb: async () => ({
    getAllAsync: vi.fn().mockResolvedValue([]),
    getFirstAsync: vi.fn().mockResolvedValue(null),
  }),
}));
vi.mock('@/services/workoutService', () => ({
  getWorkoutsForDate: async () => [],
}));
vi.mock('@/services/workoutRoutineService', () => ({
  getWorkoutPlan: async () => ({ revision: 2 }),
}));
vi.mock('@/services/foodService', () => ({
  generateClientUuid: () => 'req-uuid-1',
  getDiaryDaySummary: async () => ({
    totals: { calories: state.todayCalories, protein: 64, carbs: 118, fat: 24 },
    sections: {
      breakfast: { entries: [{ id: '1' }] },
      lunch: { entries: [] },
      dinner: { entries: [] },
      snacks: { entries: [] },
      extra: { entries: [] },
    },
  }),
}));
vi.mock('@/services/webBillingService', () => ({
  fetchWebCatalog: vi.fn(),
  getCachedWebCatalog: vi.fn(() => undefined),
  startWebCheckout: vi.fn(),
}));
vi.mock('@/components/rooms/PaywallCheckout', () => ({
  checkoutPrice: (
    _tier: string,
    _dur: string,
    web?: { amount: number },
    pkg?: { product: { priceString?: string; price?: number } },
  ) => ({
    total: pkg?.product?.priceString ?? `₹${web?.amount ?? 2499}`,
    equivalent: '₹208 / month',
  }),
}));
vi.mock('@/services/aiCoachClient', () => ({
  cleanCoachResponse: (val: string) => val,
}));
vi.mock('./CoachMealDraftCard', () => ({
  CoachMealDraftCard: ({
    draft,
    onAnotherIdea,
  }: {
    draft: { description: string };
    onAnotherIdea?: () => void;
  }) =>
    React.createElement('CoachMealDraftCard', {
      draft,
      onAnotherIdea,
      testID: 'mock-meal-draft-card',
    }),
}));
vi.mock('./CoachSuggestionCard', () => ({
  CoachSuggestionCard: 'CoachSuggestionCard',
}));

import { CoachLockedSheetV1 } from './CoachLockedSheetV1';
import { CoachMessageBubble } from './CoachMessageBubble';
import { CoachStartV1 } from './CoachStartV1';

let tree: ReactTestRenderer;

beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  state.goal = 'cut';
  state.dailyCalories = 2200;
  state.todayCalories = 1220;
});

afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});

it('renders Screen 86 locked upsell sheet with live pricing and no star icon', async () => {
  const onClose = vi.fn();
  const onSeeAllPlans = vi.fn();
  await act(async () => {
    tree = create(<CoachLockedSheetV1 visible onClose={onClose} onSeeAllPlans={onSeeAllPlans} />);
  });

  expect(tree.root.findByProps({ testID: 'coach-locked-price' }).props.children).toBe('₹2,499');
  expect(tree.root.findAllByProps({ testID: 'spark-icon' })).toHaveLength(0);

  await act(async () => {
    tree.root.findByProps({ testID: 'btn-coach-see-plans' }).props.onPress();
  });
  expect(onClose).toHaveBeenCalled();
  expect(onSeeAllPlans).toHaveBeenCalledTimes(1);
});

it('renders Screen 84 Coach start with live goal, plan week, logs count, and kcal left', async () => {
  const onSelectPrompt = vi.fn();
  await act(async () => {
    tree = create(<CoachStartV1 onSelectPrompt={onSelectPrompt} />);
  });

  const allText = tree.root
    .findAllByType('Text' as React.ElementType)
    .map((n) =>
      Array.isArray(n.props.children) ? n.props.children.join('') : String(n.props.children ?? ''),
    )
    .join(' ');
  expect(allText).toContain('Goal · Lose fat');
  expect(allText).toContain('Plan · Week 2');
  expect(allText).toContain('1 logged today');
  expect(allText).toContain('Fits your 980 kcal left');

  await act(async () => {
    tree.root.findByProps({ testID: 'coach-starter-dinner' }).props.onPress();
  });
  expect(onSelectPrompt).toHaveBeenCalledWith('Plan my dinner');
});

it('renders Screen 85 structured feedback card, attached meal, and dinner idea action', async () => {
  const onActionPrompt = vi.fn();
  const onAnotherIdea = vi.fn();
  await act(async () => {
    tree = create(
      <>
        <CoachMessageBubble
          message={{
            id: 'm1',
            role: 'user',
            content: "How's my lunch looking?",
            timestamp: '2026-11-23T12:00:00Z',
            attachedMeal: {
              title: 'Chicken rice bowl',
              calories: 610,
              protein: 42,
              carbs: 68,
              fat: 18,
            },
          }}
        />
        <CoachMessageBubble
          message={{
            id: 'm2',
            role: 'assistant',
            content: "Solid lunch, Priya. Here's the quick read.",
            timestamp: '2026-11-23T12:00:01Z',
            card: {
              points: [
                { kind: 'positive', lead: 'Protein 42 g', detail: 'on target for a meal' },
                { kind: 'note', lead: 'Fiber looks low', detail: 'add greens or beans' },
              ],
              actions: [
                { label: 'Plan my dinner', prompt: 'Plan my dinner', primary: true },
                { label: 'Swap ideas', prompt: 'Give swap ideas' },
              ],
            },
          }}
          onActionPrompt={onActionPrompt}
          onAnotherIdea={onAnotherIdea}
        />
      </>,
    );
  });

  expect(tree.root.findByProps({ testID: 'coach-attached-meal-m1' })).toBeDefined();
  expect(tree.root.findByProps({ testID: 'coach-structured-card-m2' })).toBeDefined();

  await act(async () => {
    tree.root.findByProps({ testID: 'coach-card-action-m2-0' }).props.onPress();
  });
  expect(onActionPrompt).toHaveBeenCalledWith('Plan my dinner');
});
