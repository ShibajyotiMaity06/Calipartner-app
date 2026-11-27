import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiarySectionSummary } from '@calipartner/core';

const mocks = vi.hoisted(() => ({
  routerPush: vi.fn(),
  routerBack: vi.fn(),
  routerReplace: vi.fn(),
  emitDiaryChange: vi.fn(),
  addWater: vi.fn().mockResolvedValue(undefined),
  squadMembers: [
    {
      user_id: 'u1',
      nickname: 'Priya',
      avatar_url: null,
      goal: 'cut',
      calories: 1680,
      protein: 0,
      carbs: 0,
      fat: 0,
      steps: 0,
      water: 0,
      targets: { calories: 2000 },
      tracking: {
        calories: true,
        protein: false,
        carbs: false,
        fat: false,
        steps: false,
        water: false,
      },
      is_self: true,
    },
    {
      user_id: 'u2',
      nickname: 'Jack',
      avatar_url: null,
      goal: 'cut',
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      steps: 0,
      water: 0,
      targets: null,
      is_self: false,
    },
  ],
  latestMention: {
    id: 'm1',
    nickname: 'Jack',
    text: 'finished a workout',
    created_at: new Date().toISOString(),
  },
}));

vi.mock('react-native', () => ({
  View: 'View',
  Modal: 'Modal',
  ScrollView: 'ScrollView',
  Pressable: 'Pressable',
  StyleSheet: {
    create: <T,>(styles: T) => styles,
    flatten: (val: unknown) =>
      Array.isArray(val) ? Object.assign({}, ...val.flat(Infinity).filter(Boolean)) : val,
  },
}));

vi.mock('expo-router', () => ({
  useRouter: () => ({
    push: mocks.routerPush,
    back: mocks.routerBack,
    replace: mocks.routerReplace,
    canGoBack: () => false,
  }),
  useFocusEffect: (cb: () => void) => cb(),
}));

vi.mock('@calipartner/ui/v1', async () => {
  const theme = await import('../../../../packages/ui/src/v1/theme');
  return {
    ...theme,
    AddButton: 'AddButton',
    AvatarRing: 'AvatarRing',
    Badge: 'Badge',
    BarcodeIcon: 'BarcodeIcon',
    BookmarkIcon: 'BookmarkIcon',
    BowlIcon: 'BowlIcon',
    CameraIcon: 'CameraIcon',
    Card: ({ children, ...rest }: Record<string, unknown>) =>
      React.createElement('Card', rest, children as React.ReactNode),
    ChatBubbleIcon: 'ChatBubbleIcon',
    CheckIcon: 'CheckIcon',
    ChevronLeftIcon: 'ChevronLeftIcon',
    ChevronRightIcon: 'ChevronRightIcon',
    CloseIcon: 'CloseIcon',
    DropletIcon: 'DropletIcon',
    DumbbellIcon: 'DumbbellIcon',
    EditIcon: 'EditIcon',
    FeedImageIcon: 'FeedImageIcon',
    HistoryClockIcon: 'HistoryClockIcon',
    IconButton: 'IconButton',
    LinkButton: 'LinkButton',
    LockIcon: 'LockIcon',
    MoonIcon: 'MoonIcon',
    PlusIcon: 'PlusIcon',
    PrimaryButton: 'PrimaryButton',
    PulseIcon: 'PulseIcon',
    Ring: ({ children, ...rest }: Record<string, unknown>) =>
      React.createElement('Ring', rest, children as React.ReactNode),
    ScaleIcon: 'ScaleIcon',
    SearchIcon: 'SearchIcon',
    SettingsIcon: 'SettingsIcon',
    Sheet: ({ children, ...rest }: Record<string, unknown>) =>
      React.createElement('Sheet', rest, children as React.ReactNode),
    SunIcon: 'SunIcon',
    Text: ({ children, ...rest }: Record<string, unknown>) =>
      React.createElement('Text', rest, children as React.ReactNode),
    TimerIcon: 'TimerIcon',
  };
});

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1' },
    profile: { timezone: 'UTC', nickname: 'Priya' },
  }),
}));

vi.mock('@/hooks/useSquad', () => ({
  useSquadToday: () => ({
    data: { members: mocks.squadMembers },
    loading: false,
    error: null,
  }),
  useSquadMentions: () => ({
    data: { mentions: [mocks.latestMention] },
    loading: false,
    error: null,
  }),
}));

vi.mock('@/hooks/useFasting', () => ({
  useFasting: () => ({
    settings: { enabled: true, protocol: '16:8', eating_window_end: '20:00' },
    activeSession: null,
    computedState: {
      isActive: false,
      elapsedMinutes: 0,
      remainingMinutes: 0,
      progressPercentage: 0,
      isCompleted: false,
    },
    gating: { canAccess: true },
    hasPaidAccess: true,
    loading: false,
    startFast: vi.fn(),
    endFast: vi.fn(),
  }),
}));

vi.mock('@/services/workoutRoutineService', () => ({
  getWorkoutPlan: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/hooks/useCurrentLocalDate', () => ({
  useCurrentLocalDate: () => ({ localDate: '2026-11-23' }),
}));

vi.mock('@/hooks/useTrackingPreferences', () => ({
  useTrackingPreferences: () => ({
    enabled: { calories: true, protein: true, carbs: true, fat: true, steps: true, water: true },
    loading: false,
    error: false,
    save: vi.fn(),
  }),
}));

vi.mock('@/hooks/useWater', () => ({
  useWater: () => ({
    totalMl: 1500,
    goalMl: 3000,
    loading: false,
    error: false,
    addWater: mocks.addWater,
    refresh: vi.fn(),
  }),
}));

vi.mock('@/hooks/useWeight', () => ({
  useWeight: () => ({
    logs: [],
    logWeight: vi.fn(),
    editWeight: vi.fn(),
    deleteWeight: vi.fn(),
    latestLog: null,
    startingWeightKg: 74.5,
    weeklyPaceKg: -0.5,
    projectedDate: null,
    projectionReason: 'not_enough_trend',
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
}));

vi.mock('@/hooks/useFoodEntries', () => ({
  useAddEntry: () => ({ addEntry: vi.fn() }),
}));

vi.mock('@/hooks/useBrowserModalBack', () => ({
  useBrowserModalBack: vi.fn(),
  closeBrowserModalsThen: (fn: () => void) => fn(),
}));

vi.mock('@/services/diaryEvents', () => ({
  diaryEvents: { emitChange: mocks.emitDiaryChange, subscribe: vi.fn(() => vi.fn()) },
}));

vi.mock('@/components/cardio/CardioTrackerModal', () => ({
  CardioTrackerModal: 'CardioTrackerModal',
}));
vi.mock('@/components/diary/DescribeMealModal', () => ({ DescribeMealModal: 'DescribeMealModal' }));
vi.mock('@/components/diary/FoodLogModal', () => ({ FoodLogModal: 'FoodLogModal' }));
vi.mock('@/components/diary/QuickAddCaloriesModal', () => ({
  QuickAddCaloriesModal: 'QuickAddCaloriesModal',
}));
vi.mock('@/components/fasting', () => ({ FastingTimerModal: 'FastingTimerModal' }));
vi.mock('@/components/recipes', () => ({ RecipeBrowseView: 'RecipeBrowseView' }));
vi.mock('@/components/rooms/TrackingPreferencesSheet', () => ({
  TrackingPreferencesSheet: 'TrackingPreferencesSheet',
}));
vi.mock('@/components/trackers', () => ({
  CustomWaterModal: 'CustomWaterModal',
  ProgressPhotosModal: 'ProgressPhotosModal',
  WeightEntryModal: 'WeightEntryModal',
  WeightHistoryModal: 'WeightHistoryModal',
}));
vi.mock('@/components/workouts/CardioHub', () => ({ CardioHub: 'CardioHub' }));
vi.mock('@/components/workouts/WorkoutHubModal', () => ({ WorkoutHubModal: 'WorkoutHubModal' }));
vi.mock('@/components/fasting/FastingTimerModal', () => ({
  FastingTimerModal: 'FastingTimerModal',
}));

import {
  TodayCoachCardV1,
  TodayDayCardV1,
  TodayHeaderV1,
  TodayMealRowV1,
  TodaySquadCardV1,
  TodayStickyBarV1,
} from './TodayV1Components';
import { LogSheetModalV1 } from '@/components/diary/LogSheetModalV1';

let tree: ReactTestRenderer;
const byId = (id: string) => tree.root.findByProps({ testID: id });

beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
});

afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});

describe('Screens 26–28 Design System v1 Today & Log sheet', () => {
  it('renders Screen 26 Header, Your day hero card, and Morning Crew card with lock for hidden members', async () => {
    const onUpgrade = vi.fn();
    const onCoin = vi.fn();
    const onProfile = vi.fn();
    const onOpenDetail = vi.fn();
    const onEdit = vi.fn();
    const onQuickWater = vi.fn();
    const onOpenWater = vi.fn();
    const onRetrySquad = vi.fn();

    await act(async () => {
      tree = create(
        <>
          <TodayHeaderV1
            selectedDate="2026-11-23"
            userName="Priya"
            isPro={false}
            coinBalance={1240}
            onUpgradePress={onUpgrade}
            onCoinPress={onCoin}
            onProfilePress={onProfile}
          />
          <TodayDayCardV1
            eatenCalories={1220}
            targetCalories={2200}
            protein={{ value: 64, target: 140 }}
            carbs={{ value: 118, target: 210 }}
            fat={{ value: 24, target: 55 }}
            steps={{ value: 6420, target: 10000 }}
            water={{ valueMl: 1500, targetMl: 3000 }}
            loading={false}
            error={false}
            onRetry={vi.fn()}
            onOpenDetail={onOpenDetail}
            onEditTracking={onEdit}
            onQuickAddWater={onQuickWater}
            onOpenWater={onOpenWater}
          />
          <TodaySquadCardV1
            rooms={[{ id: 'room-1', name: 'Morning Crew', member_count: 5 } as never]}
            loading={false}
            error={null}
            visible
            onRetry={onRetrySquad}
          />
          <TodayCoachCardV1 isPro={false} onPress={onUpgrade} />
        </>,
      );
    });

    expect(byId('today-header-date').props.children).toBe('MON · 23 NOV');
    expect(byId('today-greeting-title').props.children).toBe('Hello, Priya');
    expect(byId('today-upgrade-pill')).toBeTruthy();
    expect(byId('today-coin-pill')).toBeTruthy();

    await act(async () => byId('today-upgrade-pill').props.onPress());
    await act(async () => byId('today-coin-pill').props.onPress());
    await act(async () => byId('today-profile-avatar').props.onPress());
    expect(onUpgrade).toHaveBeenCalledOnce();
    expect(onCoin).toHaveBeenCalledOnce();
    expect(onProfile).toHaveBeenCalledOnce();

    expect(byId('personal-day-open').props.accessibilityLabel).toBe('980 kcal left');
    await act(async () => byId('edit-daily-tracking').props.onPress());
    await act(async () =>
      byId('today-water-quick-add').props.onPress({ stopPropagation: vi.fn() }),
    );
    expect(onEdit).toHaveBeenCalledOnce();
    expect(onQuickWater).toHaveBeenCalledOnce();

    // Squad card renders member ring for Priya (84%) and lock icon for hidden Jack (score: null)
    expect(byId('today-squad-card')).toBeTruthy();
    expect(tree.root.findAllByType('LockIcon' as React.ElementType)).toHaveLength(1);
    await act(async () => byId('today-squad-invite').props.onPress());
    expect(mocks.routerPush).toHaveBeenCalledWith('/friends');

    // When Pro, TodayHeaderV1 renders Badge outlinePro without a duplicate outer border on the Pressable
    await act(async () => {
      tree.update(
        <TodayHeaderV1
          selectedDate="2026-11-23"
          userName="Priya"
          isPro
          coinBalance={1240}
          onUpgradePress={onUpgrade}
          onCoinPress={onCoin}
          onProfilePress={onProfile}
        />,
      );
    });
    const proPill = byId('today-upgrade-pill');
    const proPillStyle = proPill.props.style({ pressed: false });
    expect(JSON.stringify(proPillStyle)).not.toContain('borderWidth');
    expect(proPill.findByType('Badge' as React.ElementType).props.variant).toBe('outlinePro');
  });

  it('renders Screen 27 scrolled sticky header and meal rows accurately', async () => {
    const onAdd = vi.fn();
    const summary: DiarySectionSummary = {
      section: 'lunch',
      count: 1,
      calories: 610,
      protein: 42,
      carbs: 68,
      fat: 18,
      fiber: 4,
      sugar: 2,
      sodium_mg: 420,
      entries: [{ id: 'e1', food_name: 'Chicken rice bowl' } as never],
    };
    const emptyDinner: DiarySectionSummary = {
      section: 'dinner',
      count: 0,
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sugar: 0,
      sodium_mg: 0,
      entries: [],
    };

    await act(async () => {
      tree = create(
        <>
          <TodayStickyBarV1
            selectedDate="2026-11-23"
            isToday
            caloriesLeft={980}
            onPrevDay={vi.fn()}
            onNextDay={vi.fn()}
            onOpenDatePicker={vi.fn()}
            onOpenCaloriesDetail={vi.fn()}
          />
          <TodayMealRowV1
            section="lunch"
            summary={summary}
            suggested={false}
            onPress={vi.fn()}
            onAdd={onAdd}
          />
          <TodayMealRowV1
            section="dinner"
            summary={emptyDinner}
            suggested
            onPress={vi.fn()}
            onAdd={onAdd}
          />
        </>,
      );
    });

    expect(byId('today-sticky-date-bar')).toBeTruthy();
    expect(byId('card-section-lunch')).toBeTruthy();
    expect(byId('btn-add-food-dinner').props.filled).toBe(true);
    await act(async () => byId('btn-add-food-dinner').props.onPress({ stopPropagation: vi.fn() }));
    expect(onAdd).toHaveBeenCalledOnce();
  });

  it('renders Screen 28 Log sheet bento grid, meal picker, track tiles, and opens flows', async () => {
    const onClose = vi.fn();
    await act(async () => {
      tree = create(<LogSheetModalV1 visible onClose={onClose} />);
    });

    expect(byId('log-hub-view')).toBeTruthy();
    expect(byId('log-search-foods')).toBeTruthy();
    expect(byId('log-tile-photo')).toBeTruthy();
    expect(byId('log-tile-describe')).toBeTruthy();
    expect(byId('log-tile-scan')).toBeTruthy();
    expect(byId('log-tile-saved')).toBeTruthy();
    expect(byId('log-tile-recent')).toBeTruthy();
    expect(byId('log-tile-workout')).toBeTruthy();
    expect(byId('log-tile-cardio')).toBeTruthy();
    expect(byId('log-tile-water')).toBeTruthy();
    expect(byId('log-tile-weight')).toBeTruthy();
    expect(byId('log-tile-fast')).toBeTruthy();
    expect(byId('log-tile-post')).toBeTruthy();

    // Barcode is free (no PRO badge); only Scan meal and Describe show PRO badges
    expect(byId('log-tile-scan').findAllByType('Badge' as React.ElementType)).toHaveLength(0);
    expect(tree.root.findAllByType('Badge' as React.ElementType)).toHaveLength(2);

    // Switch meal section dropdown to Breakfast and close menu
    await act(async () => byId('log-meal-section-picker').props.onPress());
    expect(byId('log-meal-options')).toBeTruthy();
    await act(async () => byId('log-meal-option-breakfast').props.onPress());
    expect(tree.root.findAllByProps({ testID: 'log-meal-options' })).toHaveLength(0);

    // Open Scan meal flow -> mounts FoodLogModal with initialTab="photo" and selected section
    await act(async () => byId('log-tile-photo').props.onPress());
    const photoModal = tree.root.findByType('FoodLogModal' as React.ElementType);
    expect(photoModal.props.initialTab).toBe('photo');
    expect(photoModal.props.defaultSection).toBe('breakfast');

    // Return to picker and open Describe flow
    await act(async () => photoModal.props.onClose());
    await act(async () => byId('log-tile-describe').props.onPress());
    expect(tree.root.findByType('DescribeMealModal' as React.ElementType)).toBeTruthy();

    // Return to picker and tap Post to feed
    await act(async () =>
      tree.root.findByType('DescribeMealModal' as React.ElementType).props.onClose(),
    );
    await act(async () => byId('log-tile-post').props.onPress());
    expect(onClose).toHaveBeenCalledOnce();
    expect(mocks.routerPush).toHaveBeenCalledWith('/feed/create');
  });

  it('renders Ask your coach banner with PRO badge when free and chevron when Pro', async () => {
    const onFreePress = vi.fn();
    const onProPress = vi.fn();

    await act(async () => {
      tree = create(
        <>
          <TodayCoachCardV1 isPro={false} onPress={onFreePress} />
          <TodayCoachCardV1 isPro onPress={onProPress} />
        </>,
      );
    });

    const cards = tree.root.findAllByProps({ testID: 'today-coach-card' });
    expect(cards.filter((c) => String(c.type) === 'Card')).toHaveLength(2);
    expect(tree.root.findAllByType('Badge' as React.ElementType)).toHaveLength(1);
    expect(tree.root.findAllByType('ChevronRightIcon' as React.ElementType)).toHaveLength(1);
  });
});
