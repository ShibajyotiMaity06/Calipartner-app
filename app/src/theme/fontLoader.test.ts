import { expect, it, vi } from 'vitest';

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

vi.mock('expo-font', () => ({
  loadAsync: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: vi.fn().mockResolvedValue(undefined),
  hideAsync: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@expo-google-fonts/fraunces/500Medium', () => ({ Fraunces_500Medium: 1 }));
vi.mock('@expo-google-fonts/fraunces/500Medium_Italic', () => ({ Fraunces_500Medium_Italic: 2 }));
vi.mock('@expo-google-fonts/manrope/400Regular', () => ({ Manrope_400Regular: 3 }));
vi.mock('@expo-google-fonts/manrope/500Medium', () => ({ Manrope_500Medium: 4 }));
vi.mock('@expo-google-fonts/manrope/600SemiBold', () => ({ Manrope_600SemiBold: 5 }));
vi.mock('@expo-google-fonts/manrope/700Bold', () => ({ Manrope_700Bold: 6 }));
vi.mock('@expo-google-fonts/manrope/800ExtraBold', () => ({ Manrope_800ExtraBold: 7 }));
vi.mock('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf', () => ({
  default: 8,
}));

import { colors, fonts, PrimaryButton, ScreenTitle, type } from '@calipartner/ui/v1';
import * as Font from 'expo-font';
import { DESIGN_SYSTEM_V1_FONTS, loadAppFonts } from './fontLoader';

it('resolves @calipartner/ui/v1 inside the app workspace', () => {
  expect(colors.apricot).toBe('#F4B67D');
  expect(fonts.display).toBe('Fraunces_500Medium');
  expect(fonts.displayItalic).toBe('Fraunces_500Medium_Italic');
  expect(fonts.regular).toBe('Manrope_400Regular');
  expect(fonts.bold).toBe('Manrope_700Bold');
  expect(type.displayXL.fontSize).toBe(104);
  expect(typeof PrimaryButton).toBe('function');
  expect(typeof ScreenTitle).toBe('function');
});

it('loads all Fraunces and Manrope static fonts in fontLoader', async () => {
  expect(Object.keys(DESIGN_SYSTEM_V1_FONTS)).toEqual([
    'Fraunces_500Medium',
    'Fraunces_500Medium_Italic',
    'Manrope_400Regular',
    'Manrope_500Medium',
    'Manrope_600SemiBold',
    'Manrope_700Bold',
    'Manrope_800ExtraBold',
  ]);
  const loaded = await loadAppFonts();
  expect(loaded).toBe(true);
  expect(Font.loadAsync).toHaveBeenCalled();
  const passedMap = vi.mocked(Font.loadAsync).mock.calls[0]?.[0] as Record<string, unknown>;
  for (const key of Object.keys(DESIGN_SYSTEM_V1_FONTS)) {
    expect(passedMap[key]).toBeDefined();
  }
});
