import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  paid: false,
  focused: true,
  lookup: vi.fn(),
  replace: vi.fn(),
  decode: vi.fn(),
  stop: vi.fn(),
}));
vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Modal: 'Modal',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  KeyboardAvoidingView: 'KeyboardAvoidingView',
  TextInput: 'TextInput',
  View: 'View',
  Platform: { OS: 'ios' },
  StyleSheet: { create: (v: unknown) => v, absoluteFill: {} },
}));
vi.mock('@calipartner/ui', async () => ({
  ...(await import('../../../../packages/ui/src/tokens')),
  Text: 'Text',
  Button: 'Button',
  Sheet: 'Sheet',
  LogHubView: 'LogHub',
}));
vi.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
vi.mock('expo-camera', () => ({
  CameraView: 'Camera',
  useCameraPermissions: () => [{ granted: true }, vi.fn()],
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
vi.mock('@zxing/library', () => ({ DecodeHintType: { TRY_HARDER: 3 } }));
vi.mock('@zxing/browser', () => ({
  BrowserMultiFormatReader: class {
    decodeFromConstraints = state.decode;
  },
}));
vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => ({ hasActiveAccess: state.paid, loading: false }),
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'owner' } }) }));
vi.mock('@/hooks/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isOnline: true }) }));
vi.mock('@/services/barcodeScanService', () => ({ lookupBarcode: state.lookup }));
vi.mock('@/services/barcodeImageService', () => ({ decodeBarcodeImage: vi.fn() }));
vi.mock('@/hooks/useSectionSuggestions', () => ({
  useSectionSuggestions: () => ({ suggestions: [] }),
}));
vi.mock('expo-router', async () => ({
  useRouter: () => ({ replace: state.replace }),
  useFocusEffect: (callback: () => void | (() => void)) => {
    const focused = state.focused;
    React.useEffect(() => (focused ? callback() : undefined), [callback, focused]);
  },
}));
vi.mock('./FoodLogModal', () => ({ FoodLogModal: 'FoodLog' }));
vi.mock('@/components/workouts/WorkoutLoggerModal', () => ({ WorkoutLoggerModal: 'Workout' }));
vi.mock('@/components/trackers', () => ({ CustomWaterModal: 'Water', WeightEntryModal: 'Weight' }));
vi.mock('@/components/recipes', () => ({ RecipeBrowseView: 'Recipe' }));
vi.mock('./QuickAddCaloriesModal', () => ({ QuickAddCaloriesModal: 'QuickCalories' }));
vi.mock('@/components/fasting', () => ({ FastingTimerModal: 'Fasting' }));
vi.mock('@/hooks/useFoodEntries', () => ({ useAddEntry: () => ({ addEntry: vi.fn() }) }));
vi.mock('@/hooks/useWater', () => ({ useWater: () => ({ addWater: vi.fn() }) }));
vi.mock('@/hooks/useWeight', () => ({
  useWeight: () => ({ logWeight: vi.fn(), latestLog: null }),
}));
vi.mock('@/theme/useTheme', () => ({ useTheme: () => ({ colors: {} }) }));
vi.mock('@/hooks/useCurrentLocalDate', () => ({
  useCurrentLocalDate: () => ({ localDate: '2026-10-27' }),
}));
import { Platform } from 'react-native';
import { AdvancedNutrition } from './AdvancedNutrition';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { MealSectionCard } from './MealSectionCard';
import LogScreen from '@/app/(tabs)/log';
const nutrients = {
  calories: 200,
  protein: 5,
  carbs: 30,
  fat: 7,
  fiber: 4.3,
  sugar: 11.7,
  sodium_mg: 349,
  nutrition_details: { saturated_fat: 2.8, cholesterol_mg: 17 },
};
let renderer: ReactTestRenderer;
beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  state.paid = false;
  state.focused = true;
  Platform.OS = 'ios';
  state.decode.mockResolvedValue({ stop: state.stop });
});
afterEach(async () => {
  if (renderer) await act(async () => renderer.unmount());
});
it('renders locked Free placeholders without advanced values in text or accessibility labels', async () => {
  await act(async () => {
    renderer = create(<AdvancedNutrition nutrients={nutrients} />);
  });
  const text = JSON.stringify(renderer.toJSON());
  for (const value of ['4.3', '11.7', '349', '2.8']) expect(text).not.toContain(value);
  expect(text).toContain('Plus or Pro');
  expect(text).toContain('Locked');
  state.paid = true;
  await act(async () => renderer.update(<AdvancedNutrition nutrients={nutrients} />));
  expect(JSON.stringify(renderer.toJSON())).toContain('349 mg');
  state.paid = false;
  await act(async () => renderer.update(<AdvancedNutrition nutrients={nutrients} />));
  expect(JSON.stringify(renderer.toJSON())).not.toContain('349');
});
it('keeps server-redacted nutrients locked even when the local paid state is stale', async () => {
  state.paid = true;
  await act(async () => {
    renderer = create(
      <AdvancedNutrition nutrients={{ ...nutrients, nutrition_details: { locked: true } }} />,
    );
  });
  expect(JSON.stringify(renderer.toJSON())).toContain('Connect and scan again');
  expect(JSON.stringify(renderer.toJSON())).not.toContain('349');
});
const scanner = (visible = true) => (
  <BarcodeScannerModal
    visible={visible}
    onClose={vi.fn()}
    onFoodFound={vi.fn()}
    onCreateCustomFood={vi.fn()}
  />
);
it('manual barcode lookup exposes a usable confirmation and keeps controls stacked', async () => {
  state.lookup.mockResolvedValue({
    food: { name: 'A long packaged cereal name', calories_per_100g: 200 },
  });
  await act(async () => {
    renderer = create(scanner());
  });
  await act(async () =>
    renderer.root.findByProps({ testID: 'btn-show-type-number' }).props.onPress(),
  );
  await act(async () =>
    renderer.root
      .findByProps({ testID: 'input-manual-barcode' })
      .props.onChangeText('4006381333931'),
  );
  await act(async () =>
    renderer.root.findByProps({ testID: 'btn-lookup-manual-barcode' }).props.onPress(),
  );
  expect(state.lookup).toHaveBeenCalledWith('4006381333931', undefined, true, 'owner');
  expect(renderer.root.findByProps({ testID: 'btn-add-scanned-food' })).toBeDefined();
  const row = renderer.root.findByProps({ testID: 'input-manual-barcode' }).parent!;
  expect(row.props.style).toMatchObject({ flexDirection: 'column', alignItems: 'stretch' });
});
it('restarts the web decoder on retry and releases it on close', async () => {
  Platform.OS = 'web';
  state.lookup.mockResolvedValue({ food: null });
  await act(async () => {
    renderer = create(scanner());
  });
  await act(async () =>
    renderer.root.findByProps({ testID: 'btn-grant-camera-permission' }).props.onPress(),
  );
  await act(async () => {
    await vi.dynamicImportSettled();
  });
  expect(state.decode).toHaveBeenCalledOnce();
  const [constraints, , callback] = state.decode.mock.calls[0]!;
  expect(constraints.video).toMatchObject({
    facingMode: { ideal: 'environment' },
    width: { ideal: 1920 },
  });
  await act(async () => callback({ getText: () => '4006381333931' }));
  await act(async () => renderer.root.findByProps({ testID: 'barcode-retry' }).props.onPress());
  await act(async () => {
    await vi.dynamicImportSettled();
  });
  expect(state.decode).toHaveBeenCalledTimes(2);
  expect(state.stop).toHaveBeenCalled();
  await act(async () => renderer.update(scanner(false)));
  expect(state.stop.mock.calls.length).toBeGreaterThan(1);
});
it('reopens the cached Log tab with its picker after a previous food flow closes', async () => {
  await act(async () => {
    renderer = create(<LogScreen />);
  });
  await act(async () =>
    renderer.root.findByType('LogHub' as React.ElementType).props.onSelectTile('food'),
  );
  await act(async () => renderer.root.findByType('FoodLog' as React.ElementType).props.onClose());
  expect(state.replace).toHaveBeenCalledWith('/today');
  state.focused = false;
  await act(async () => renderer.update(<LogScreen />));
  state.focused = true;
  await act(async () => renderer.update(<LogScreen />));
  expect(renderer.root.findByProps({ testID: 'log-sheet-modal' }).props.visible).toBe(true);
  expect(renderer.root.findAllByType('LogHub' as React.ElementType)).toHaveLength(1);
  expect(renderer.root.findAllByType('FoodLog' as React.ElementType)).toHaveLength(0);
});
it('shows separate meal metrics and preserves add, edit and delete actions for logged food', async () => {
  const add = vi.fn(),
    edit = vi.fn(),
    remove = vi.fn();
  const entry = {
    ...nutrients,
    id: 'logged',
    food_name: 'Long food name to wrap at narrow widths',
    quantity: 100,
    unit: 'g',
  };
  await act(async () => {
    renderer = create(
      <MealSectionCard
        section="lunch"
        summary={{ ...nutrients, section: 'lunch', entries: [entry] } as never}
        onAddFood={add}
        onEditEntry={edit}
        onDeleteEntry={remove}
        onCopyMeal={vi.fn()}
      />,
    );
  });
  expect(renderer.root.findByProps({ testID: 'meal-metrics-lunch' }).children).toHaveLength(4);
  const event = { stopPropagation: vi.fn() };
  await act(async () =>
    renderer.root.findByProps({ testID: 'btn-add-food-lunch' }).props.onPress(event),
  );
  await act(async () =>
    renderer.root.findByProps({ testID: 'entry-row-logged' }).props.onPress(event),
  );
  await act(async () =>
    renderer.root.findByProps({ testID: 'btn-delete-logged' }).props.onPress(event),
  );
  expect(add).toHaveBeenCalledWith('lunch');
  expect(edit).toHaveBeenCalledWith(entry);
  expect(remove).toHaveBeenCalledWith('logged');
});
