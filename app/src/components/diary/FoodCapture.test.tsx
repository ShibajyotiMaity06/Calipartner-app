import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const flow = vi.hoisted(() => ({ analyze: vi.fn(), add: vi.fn() }));
vi.mock('@calipartner/ui', async () => ({
  ...(await import('../../../../packages/ui/src/tokens')),
  Text: 'Text',
}));
vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Modal: 'Modal',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  Text: 'Text',
  TextInput: 'TextInput',
  View: 'View',
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'owner' } }) }));
vi.mock('@/db', () => ({ getDb: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ getSupabase: () => ({}) }));
vi.mock('@/hooks/useFoodSearch', () => ({
  useFoodSearch: () => ({ results: [], query: '', setQuery: vi.fn(), loading: false }),
}));
vi.mock('@/hooks/usePreviouslyLogged', () => ({
  usePreviouslyLogged: () => ({ items: [], loading: false }),
}));
vi.mock('@/hooks/useFoodEntries', () => ({
  useAddEntry: () => ({ addEntry: flow.add, error: null }),
}));
vi.mock('@/services/aiFoodPhotoService', () => ({
  checkAiProcessingConsent: async () => true,
  analyzeFoodPhoto: flow.analyze,
  acceptAiProcessingConsent: vi.fn(),
  getAiFoodPhotoUsageStatus: vi.fn(),
  savePhotoCandidatesToDiary: vi.fn(),
}));
vi.mock('@/theme/useTheme', () => ({ useTheme: () => ({ colors: {} }) }));
vi.mock('./BarcodeScannerModal', () => ({ BarcodeScannerModal: 'BarcodeScanner' }));
vi.mock('./CustomFoodModal', () => ({ CustomFoodModal: 'CustomFood' }));
vi.mock('./QuantityModal', () => ({ QuantityModal: 'Quantity' }));
vi.mock('@/components/recipes', () => ({ RecipeBrowseView: 'Recipes' }));
vi.mock('@/components/food_photo', () => ({
  AiConsentSheet: 'Consent',
  FoodPhotoAnalyzingOverlay: 'Analyzing',
  FoodPhotoCameraModal: 'Camera',
  FoodPhotoDailyLimitModal: 'Limit',
  FoodPhotoResultsEditor: 'Results',
}));
import { FoodLogModal } from './FoodLogModal';
let renderer: ReactTestRenderer;
beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  flow.add.mockResolvedValue({ id: 'saved' });
});
afterEach(async () => {
  await act(async () => renderer.unmount());
});
describe('food capture paths', () => {
  it.each(['NO_FOOD_DETECTED', 'MODEL_ERROR'])(
    'shows an honest %s error without sample food',
    async (code) => {
      flow.analyze.mockRejectedValue({ code });
      await act(async () => {
        renderer = create(
          <FoodLogModal
            visible
            initialTab="photo"
            defaultSection="lunch"
            localDate="2026-10-26"
            onClose={vi.fn()}
          />,
        );
      });
      await act(async () =>
        renderer.root.findByProps({ testID: 'btn-start-photo-scan' }).props.onPress(),
      );
      await act(async () =>
        renderer.root
          .findByType('Camera' as React.ElementType)
          .props.onPhotoCaptured({ base64: 'image', mimeType: 'image/jpeg' }),
      );
      expect(renderer.root.findAllByType('Results' as React.ElementType)).toHaveLength(0);
      expect(renderer.root.findByProps({ testID: 'food-photo-error' }).props.children).toContain(
        code === 'NO_FOOD_DETECTED' ? 'food photo' : 'could not analyze',
      );
      expect(flow.add).not.toHaveBeenCalled();
    },
  );
  it('takes a scanned food through quantity selection and really saves the selected day and meal', async () => {
    const closed = vi.fn();
    await act(async () => {
      renderer = create(
        <FoodLogModal
          visible
          initialTab="scan"
          defaultSection="breakfast"
          localDate="2026-10-25"
          onClose={closed}
        />,
      );
    });
    const food = { id: 'product', name: 'Cereal', barcode: '4006381333931' };
    await act(async () =>
      renderer.root.findByType('BarcodeScanner' as React.ElementType).props.onFoodFound(food),
    );
    await act(async () =>
      renderer.root
        .findByType('Quantity' as React.ElementType)
        .props.onSave({ food, quantity: 40, unit: 'g', mealSection: 'breakfast' }),
    );
    expect(flow.add).toHaveBeenCalledWith({
      food,
      quantity: 40,
      unit: 'g',
      mealSection: 'breakfast',
      localDate: '2026-10-25',
      source: 'scan',
    });
    expect(closed).toHaveBeenCalledOnce();
  });
});
