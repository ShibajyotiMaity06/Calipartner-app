import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoachMealDraft, Food, FoodCandidateItem } from '@calipartner/core';

const mocks = vi.hoisted(() => ({
  getDiaryDaySummary: vi.fn(),
  repeatPreviousMeal: vi.fn(),
  emitChange: vi.fn(),
  saveCoachMeal: vi.fn(),
  lookupBarcode: vi.fn(),
  fastingStart: vi.fn(),
  fastingEnd: vi.fn(),
  fastingUpdateSettings: vi.fn(),
}));

vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Alert: { alert: vi.fn() },
  Image: 'Image',
  KeyboardAvoidingView: 'KeyboardAvoidingView',
  Modal: 'Modal',
  Platform: { OS: 'ios' },
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: {
    create: (v: unknown) => v,
    flatten: (v: unknown) =>
      Array.isArray(v) ? Object.assign({}, ...v.flat(Infinity).filter(Boolean)) : v,
    absoluteFill: {},
  },
  TextInput: 'TextInput',
  View: 'View',
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));

vi.mock('@calipartner/ui', async () => ({
  ...(await import('../../../../packages/ui/src/tokens')),
  Button: (props: Record<string, unknown>) => React.createElement('Button', props),
  Chip: (props: Record<string, unknown>) => React.createElement('Chip', props),
  Sheet: ({ children, ...rest }: Record<string, unknown>) =>
    React.createElement('Sheet', rest, children as React.ReactNode),
  Text: ({ children, ...rest }: Record<string, unknown>) =>
    React.createElement('Text', rest, children as React.ReactNode),
}));

vi.mock('@calipartner/ui/v1', async () => {
  const theme = await import('../../../../packages/ui/src/v1/theme');
  return {
    ...theme,
    BarcodeIcon: 'BarcodeIcon',
    CameraIcon: 'CameraIcon',
    ChartBarIcon: 'ChartBarIcon',
    CheckIcon: 'CheckIcon',
    Checkbox: (props: Record<string, unknown>) => React.createElement('Checkbox', props),
    ChevronLeftIcon: 'ChevronLeftIcon',
    ChevronRightIcon: 'ChevronRightIcon',
    Chip: (props: Record<string, unknown>) => React.createElement('Chip', props),
    CloseIcon: 'CloseIcon',
    CubeIcon: 'CubeIcon',
    DropletIcon: 'DropletIcon',
    EditIcon: 'EditIcon',
    FeedImageIcon: 'FeedImageIcon',
    FlameIcon: 'FlameIcon',
    FlashIcon: 'FlashIcon',
    IconButton: (props: Record<string, unknown>) => React.createElement('IconButton', props),
    InfoCircleIcon: 'InfoCircleIcon',
    LinkButton: (props: Record<string, unknown>) => React.createElement('LinkButton', props),
    PlusIcon: 'PlusIcon',
    PrimaryButton: (props: Record<string, unknown>) => React.createElement('PrimaryButton', props),
    PulseIcon: 'PulseIcon',
    Ring: ({ children, ...rest }: Record<string, unknown>) =>
      React.createElement('Ring', rest, children as React.ReactNode),
    ScaleIcon: 'ScaleIcon',
    SearchIcon: 'SearchIcon',
    SecondaryButton: (props: Record<string, unknown>) =>
      React.createElement('SecondaryButton', props),
    Segmented: (props: Record<string, unknown>) => React.createElement('Segmented', props),
    Sheet: ({ children, ...rest }: Record<string, unknown>) =>
      React.createElement('Sheet', rest, children as React.ReactNode),
    SwitchRow: (props: Record<string, unknown>) => React.createElement('SwitchRow', props),
    Text: ({ children, ...rest }: Record<string, unknown>) =>
      React.createElement('Text', rest, children as React.ReactNode),
  };
});

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));
vi.mock('@/hooks/useBrowserModalBack', () => ({ useBrowserModalBack: vi.fn() }));
vi.mock('@/hooks/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isOnline: true }) }));
vi.mock('@/lib/supabase', () => ({ getSupabase: () => ({}) }));
vi.mock('@/db', () => ({ getDb: async () => ({}) }));
vi.mock('@/services/aiFoodPhotoService', () => ({
  swapCandidateFood: (target: Record<string, unknown>, food: Record<string, unknown>) => ({
    ...target,
    matched_food: food,
  }),
  updateCandidateQuantity: (
    item: Record<string, unknown> & { quantity: number; nutrients: Record<string, number> },
    qty: number,
  ) => {
    const ratio = item.quantity > 0 ? qty / item.quantity : 1;
    return {
      ...item,
      quantity: qty,
      nutrients: {
        ...item.nutrients,
        calories: Math.round((item.nutrients.calories ?? 0) * ratio),
        protein: Math.round((item.nutrients.protein ?? 0) * ratio),
        carbs: Math.round((item.nutrients.carbs ?? 0) * ratio),
        fat: Math.round((item.nutrients.fat ?? 0) * ratio),
      },
    };
  },
}));
vi.mock('@/services/foodService', () => ({
  getDiaryDaySummary: mocks.getDiaryDaySummary,
  generateClientUuid: () => 'uuid-1',
  searchLocalFoods: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/services/weeklyPlanService', () => ({
  repeatPreviousMeal: mocks.repeatPreviousMeal,
}));
vi.mock('@/services/diaryEvents', () => ({
  diaryEvents: { emitChange: mocks.emitChange },
}));
vi.mock('@/services/coachMealService', () => ({
  prepareCoachMealSave: (draft: unknown) => ({ id: 'coach-save-1', draft }),
  saveCoachMeal: mocks.saveCoachMeal,
}));
vi.mock('@/services/barcodeScanService', () => ({
  lookupBarcode: mocks.lookupBarcode,
}));
vi.mock('@/services/barcodeImageService', () => ({
  decodeBarcodeImage: vi.fn(),
}));
vi.mock('expo-camera', () => ({
  CameraView: 'CameraView',
  useCameraPermissions: () => [{ granted: true, status: 'granted' }, vi.fn()],
}));
vi.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: vi.fn(),
  launchCameraAsync: vi.fn(),
  requestCameraPermissionsAsync: async () => ({ granted: true }),
}));
vi.mock('expo-image-manipulator', () => ({
  manipulateAsync: vi.fn(),
  SaveFormat: { JPEG: 'jpeg' },
}));
vi.mock('@/hooks/useFasting', () => ({
  useFasting: () => ({
    settings: {
      enabled: true,
      protocol: '16:8',
      custom_fasting_hours: 16,
      eating_window_start: '10:00',
      eating_window_end: '18:00',
    },
    activeSession: {
      id: 'sess-1',
      start_at: new Date(Date.now() - 872 * 60_000).toISOString(),
      planned_minutes: 960,
    },
    computedState: {
      isActive: true,
      elapsedMinutes: 872,
      remainingMinutes: 88,
      progressPercentage: 91,
      isPastPlanned: false,
      checkInPrompt: false,
      strongEndFastPrompt: false,
    },
    scheduledState: { isEatingWindow: false },
    history: [],
    stats: { totalCompleted: 5, completionRate: 80, averageMinutes: 940 },
    streak: 3,
    gating: { canAccess: true, isPaused: false, reason: null },
    loading: false,
    planLoading: false,
    error: null,
    hasPaidAccess: true,
    screeningReady: true,
    startFast: mocks.fastingStart,
    endFast: mocks.fastingEnd,
    updateSettings: mocks.fastingUpdateSettings,
    completeScreening: vi.fn(),
    editSession: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock('./AdvancedNutrition', () => ({ AdvancedNutrition: 'AdvancedNutrition' }));
vi.mock('./QuantityModal', () => ({ QuantityModal: 'QuantityModal' }));
vi.mock('../diary/AdvancedNutrition', () => ({ AdvancedNutrition: 'AdvancedNutrition' }));
vi.mock('../diary/QuantityModal', () => ({ QuantityModal: 'QuantityModal' }));
vi.mock('../fasting/FastingProtocolModal', () => ({
  FastingProtocolModal: 'FastingProtocolModal',
}));
vi.mock('../fasting/FastingEditTimesModal', () => ({
  FastingEditTimesModal: 'FastingEditTimesModal',
}));
vi.mock('../fasting/FastingHistoryModal', () => ({
  FastingHistoryModal: 'FastingHistoryModal',
}));
vi.mock('../fasting/FastingIntroModal', () => ({ FastingIntroModal: 'FastingIntroModal' }));
vi.mock('../fasting/FastingSafetyCheckInModal', () => ({
  FastingSafetyCheckInModal: 'FastingSafetyCheckInModal',
}));
vi.mock('./CustomFoodModal', () => ({ CustomFoodModal: 'CustomFood' }));
vi.mock('./DescribeMealModal', () => ({ DescribeMealModal: 'DescribeMealModal' }));
vi.mock('./FoodFavoritesView', () => ({ FoodFavoritesView: 'FoodFavoritesView' }));
vi.mock('./MyMealsView', () => ({ MyMealsView: 'MyMealsView' }));
vi.mock('./FoodFavoriteButton', () => ({ FoodFavoriteButton: 'FoodFavoriteButton' }));
vi.mock('./NutrientSummary', () => ({ NutrientSummary: 'NutrientSummary' }));
vi.mock('@/components/rooms/PaywallModal', () => ({ PaywallModal: 'PaywallModal' }));
vi.mock('@/components/recipes', () => ({ RecipeBrowseView: 'RecipeBrowseView' }));
vi.mock('@/components/food_photo', () => ({
  AiConsentSheet: 'AiConsentSheet',
  FoodPhotoAnalyzingOverlay: 'FoodPhotoAnalyzingOverlay',
  FoodPhotoCameraModal: 'FoodPhotoCameraModal',
  FoodPhotoDailyLimitModal: 'FoodPhotoDailyLimitModal',
  FoodPhotoResultsEditor: 'FoodPhotoResultsEditor',
}));
vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => ({
    hasActiveAccess: true,
    currentTier: 'pro',
    isTrial: false,
    loading: false,
  }),
}));
vi.mock('@/hooks/useFoodSearch', () => ({
  useFoodSearch: () => ({ query: '', setQuery: vi.fn(), results: [], loading: false }),
}));
vi.mock('@/hooks/useFoodLibrary', () => ({
  useFoodLibrary: () => ({
    foods: [],
    loading: false,
    error: false,
    busy: false,
    isFavorite: () => false,
    refresh: vi.fn(),
    clearRecentFoods: vi.fn(),
  }),
}));
vi.mock('@/hooks/usePreviouslyLogged', () => ({
  usePreviouslyLogged: () => ({
    items: [
      {
        food: {
          id: 'eggs-1',
          source: 'usda',
          name: 'Scrambled eggs',
          brand: null,
          barcode: null,
          serving_units: [{ unit: 'serving', grams: 100 }],
          calories_per_100g: 182,
          protein_per_100g: 12,
          carbs_per_100g: 2,
          fat_per_100g: 13,
          fiber_per_100g: 0,
          sugar_per_100g: 1,
          sodium_mg_per_100g: 150,
          owner_id: null,
          attribution: null,
        },
        stats: { last_quantity: 100, last_unit: 'g', use_count: 3 },
      },
    ],
    loading: false,
    error: false,
    saveError: null,
    saving: false,
    refresh: vi.fn(),
  }),
}));
vi.mock('@/hooks/useFoodEntries', () => ({
  useAddEntry: () => ({ addEntry: vi.fn().mockResolvedValue({ id: 'entry-1' }), error: null }),
}));
vi.mock('@/components/food_photo/ScanSweep', () => ({ ScanSweep: 'ScanSweep' }));

import { CoachMealDraftCard } from '../coach/CoachMealDraftCard';
import { FastingTimerModal } from '../fasting/FastingTimerModal';
import { FoodPhotoCameraModal } from '../food_photo/FoodPhotoCameraModal';
import { FoodPhotoResultsEditor } from '../food_photo/FoodPhotoResultsEditor';
import { TrackingPreferencesSheet } from '../rooms/TrackingPreferencesSheet';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { FoodLogModal } from './FoodLogModal';
import { RepeatYesterdayMeals } from './RepeatYesterdayMeals';

function allText(tree: ReactTestRenderer): string {
  const out: string[] = [];
  const walk = (n: unknown) => {
    if (typeof n === 'string' || typeof n === 'number') out.push(String(n));
    else if (Array.isArray(n)) n.forEach(walk);
    else if (n && typeof n === 'object') {
      const obj = n as { children?: unknown[] };
      if (obj.children) obj.children.forEach(walk);
    }
  };
  walk(tree.toJSON());
  return out.join(' ');
}

const sampleFood: Food = {
  id: 'yogurt-1',
  source: 'usda',
  name: 'Plain Greek yogurt',
  brand: null,
  barcode: '0123456789012',
  serving_units: [{ unit: 'tub', grams: 170 }],
  calories_per_100g: 59,
  protein_per_100g: 10,
  carbs_per_100g: 3.5,
  fat_per_100g: 0,
  fiber_per_100g: 0,
  sugar_per_100g: 3.5,
  sodium_mg_per_100g: 35,
  owner_id: null,
  attribution: null,
};

let tree: ReactTestRenderer | null = null;

beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
});

afterEach(async () => {
  if (tree) {
    await act(async () => {
      tree?.unmount();
    });
    tree = null;
  }
});

describe('Screens 29–36 Design System v1 + AI alignment', () => {
  it('renders Screen 29 camera controls and switches to Barcode / Describe', async () => {
    const onBarcode = vi.fn();
    const onDescribe = vi.fn();
    await act(async () => {
      tree = create(
        <FoodPhotoCameraModal
          visible
          defaultSection="dinner"
          onClose={vi.fn()}
          onPhotoCaptured={vi.fn()}
          onSwitchToBarcode={onBarcode}
          onSwitchToDescribe={onDescribe}
        />,
      );
    });
    expect(allText(tree!)).toContain('Center your meal in the frame');
    await act(async () =>
      tree!.root.findByProps({ testID: 'camera-mode-barcode' }).props.onPress(),
    );
    await act(async () =>
      tree!.root.findByProps({ testID: 'camera-describe-meal' }).props.onPress(),
    );
    expect(onBarcode).toHaveBeenCalledOnce();
    expect(onDescribe).toHaveBeenCalledOnce();
  });

  it('renders Screen 30 Meal recognized and scales candidates with multiplier pills', async () => {
    const candidates: FoodCandidateItem[] = [
      {
        id: 'c1',
        detected_name: 'Salmon',
        estimated_grams: 150,
        confidence: 0.94,
        matched_food: { ...sampleFood, id: 'f1', name: 'Salmon' },
        quantity: 150,
        unit: 'g',
        nutrients: {
          calories: 312,
          protein: 30,
          carbs: 0,
          fat: 20,
          fiber: 0,
          sugar: 0,
          sodium_mg: 80,
        },
        is_estimate: true,
      },
    ];
    const onSave = vi.fn().mockResolvedValue(undefined);
    await act(async () => {
      tree = create(
        <FoodPhotoResultsEditor
          visible
          imageUri="file://meal.jpg"
          initialCandidates={candidates}
          defaultSection="dinner"
          onClose={vi.fn()}
          onSaveMeal={onSave}
          onRetakePhoto={vi.fn()}
        />,
      );
    });
    expect(allText(tree!)).toContain('AI ESTIMATE · TAP TO ADJUST');
    expect(allText(tree!)).toContain('312');

    await act(async () => {
      tree!.root.findByProps({ testID: 'segmented-meal-multiplier' }).props.onChange('2');
    });
    expect(allText(tree!)).toContain('624');
    await act(async () => {
      tree!.root.findByProps({ testID: 'btn-save-photo-meal' }).props.onPress();
    });
    expect(onSave).toHaveBeenCalledOnce();
    expect(onSave.mock.calls[0]?.[0]?.[0]?.quantity).toBe(300);
  });

  it('renders Screen 31 Barcode product sheet and scales servings before logging', async () => {
    mocks.lookupBarcode.mockResolvedValue({ food: sampleFood });
    const onFoodFound = vi.fn();
    await act(async () => {
      tree = create(
        <BarcodeScannerModal
          visible
          defaultSection="dinner"
          onClose={vi.fn()}
          onFoodFound={onFoodFound}
          onCreateCustomFood={vi.fn()}
        />,
      );
    });
    await act(async () =>
      tree!.root.findByProps({ testID: 'btn-show-type-number' }).props.onPress(),
    );
    await act(async () =>
      tree!.root
        .findByProps({ testID: 'input-manual-barcode' })
        .props.onChangeText('0123456789012'),
    );
    await act(async () =>
      tree!.root.findByProps({ testID: 'btn-lookup-manual-barcode' }).props.onPress(),
    );

    expect(tree!.root.findByProps({ testID: 'barcode-detected-pill' })).toBeDefined();
    expect(allText(tree!)).toContain('Plain Greek yogurt');
    expect(allText(tree!)).toContain('100');

    await act(async () => {
      tree!.root.findByProps({ testID: 'btn-servings-plus' }).props.onPress();
    });
    await act(async () => {
      tree!.root.findByProps({ testID: 'btn-servings-plus' }).props.onPress();
    });
    expect(allText(tree!)).toContain('201');
    await act(async () => {
      tree!.root.findByProps({ testID: 'btn-add-scanned-food' }).props.onPress();
    });
    expect(onFoodFound).toHaveBeenCalledWith(sampleFood, { quantity: 2, unit: 'tub' });
  });

  it('renders Screen 34 Fasting timer ring and window with zero health claims', async () => {
    await act(async () => {
      tree = create(<FastingTimerModal visible onClose={vi.fn()} />);
    });
    const txt = allText(tree!);
    expect(txt).toContain('INTERMITTENT FASTING');
    expect(txt).toContain('14:32');
    expect(txt).toContain('1h 28m to go');
    expect(txt).toContain('Eating window');
    expect(txt).not.toMatch(/ketosis|autophagy|fat burning/i);
  });

  it('renders Screen 35 Repeat yesterday v1 pre-selecting only unlogged meals', async () => {
    mocks.repeatPreviousMeal.mockResolvedValue(1);
    mocks.getDiaryDaySummary
      .mockResolvedValueOnce({
        localDate: '2026-11-22',
        totals: { calories: 1754, protein: 90, carbs: 160, fat: 60 },
        sections: {
          breakfast: {
            calories: 340,
            entries: [{ food_name: 'Oatmeal' }],
          },
          lunch: {
            calories: 610,
            entries: [{ food_name: 'Chicken bowl' }],
          },
          dinner: {
            calories: 540,
            entries: [{ food_name: 'Salmon quinoa bowl' }],
          },
          snacks: {
            calories: 264,
            entries: [{ food_name: 'Greek yogurt' }],
          },
          extra: { calories: 0, entries: [] },
        },
      })
      .mockResolvedValueOnce({
        localDate: '2026-11-23',
        totals: { calories: 950, protein: 50, carbs: 90, fat: 30 },
        sections: {
          breakfast: { calories: 340, entries: [{ food_name: 'Oatmeal' }] },
          lunch: { calories: 610, entries: [{ food_name: 'Chicken bowl' }] },
          dinner: { calories: 0, entries: [] },
          snacks: { calories: 0, entries: [] },
          extra: { calories: 0, entries: [] },
        },
      });

    await act(async () => {
      tree = create(
        <RepeatYesterdayMeals localDate="2026-11-23" variant="v1" remainingCalories={980} />,
      );
    });
    await act(async () => {
      tree!.root.findByProps({ testID: 'home-repeat-yesterday' }).props.onPress();
    });
    const txt = allText(tree!);
    expect(txt).toContain('Repeat yesterday');
    expect(txt).toContain('Already logged today');
    expect(txt).toContain('2 meals · 804 kcal');
    expect(txt).toContain('Leaves 176 kcal today');
    expect(tree!.root.findByProps({ testID: 'repeat-checkbox-breakfast' }).props.checked).toBe(
      false,
    );
    expect(tree!.root.findByProps({ testID: 'repeat-checkbox-dinner' }).props.checked).toBe(true);
    expect(tree!.root.findByProps({ testID: 'repeat-checkbox-snacks' }).props.checked).toBe(true);

    await act(async () => {
      tree!.root.findByProps({ testID: 'repeat-add-to-today' }).props.onPress();
    });
    expect(mocks.repeatPreviousMeal).toHaveBeenCalledTimes(2);
    expect(mocks.repeatPreviousMeal).toHaveBeenNthCalledWith(1, 'user-1', '2026-11-23', 'dinner');
    expect(mocks.repeatPreviousMeal).toHaveBeenNthCalledWith(2, 'user-1', '2026-11-23', 'snacks');
    expect(mocks.emitChange).toHaveBeenCalledOnce();
  });

  it('renders Screen 36 Customize your day switches and saves toggles', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    await act(async () => {
      tree = create(
        <TrackingPreferencesSheet
          enabled={{
            calories: true,
            protein: true,
            carbs: true,
            fat: true,
            steps: true,
            water: false,
          }}
          onClose={vi.fn()}
          onSave={onSave}
        />,
      );
    });
    expect(allText(tree!)).toContain('Customize your day');
    await act(async () => {
      tree!.root.findByProps({ testID: 'track-water' }).props.onValueChange(true);
    });
    await act(async () => {
      tree!.root.findByProps({ testID: 'save-tracking-preferences' }).props.onPress();
    });
    expect(onSave).toHaveBeenCalledWith({
      calories: true,
      protein: true,
      carbs: true,
      fat: true,
      steps: true,
      water: true,
    });
  });

  it('renders Coach AI meal card matching Screen 30 macro pills and eyebrow', async () => {
    const draft: CoachMealDraft = {
      description: 'Salmon quinoa bowl',
      mealSection: 'dinner',
      localDate: '2026-11-23',
      items: [
        {
          name: 'Salmon',
          quantity: 150,
          unit: 'g',
          calories: 312,
          protein: 38,
          carbs: 0,
          fat: 18,
          fiber: 0,
          sugar: 0,
          sodium_mg: 90,
        },
      ],
    };
    await act(async () => {
      tree = create(<CoachMealDraftCard draft={draft} />);
    });
    const txt = allText(tree!);
    expect(txt).toContain('AI ESTIMATE · TAP TO ADJUST');
    expect(txt).toContain('Salmon quinoa bowl');
    expect(txt).toContain('312');
    expect(txt).toContain('Protein 38 g');
  });

  it('renders Screen 32 Your foods with Saved/Recent/Meals tabs and floating summary pill', async () => {
    await act(async () => {
      tree = create(
        <FoodLogModal visible defaultSection="dinner" localDate="2026-11-23" onClose={vi.fn()} />,
      );
    });
    const txt = allText(tree!);
    expect(txt).toContain('ADDING TO DINNER');
    expect(txt).toContain('Your foods');
    expect(txt).toContain('+ New food');
    expect(txt).toContain('Scrambled eggs');

    await act(async () => {
      tree!.root.findByProps({ testID: 'select-history-eggs-1' }).props.onPress();
    });
    const afterSelect = allText(tree!);
    expect(afterSelect).toContain('1 added');
    expect(afterSelect).toContain('182 kcal to Dinner');
    expect(tree!.root.findByProps({ testID: 'save-food-selection' })).toBeDefined();
  });
});
