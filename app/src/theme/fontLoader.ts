import * as Font from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { Fraunces_500Medium } from '@expo-google-fonts/fraunces/500Medium';
import { Fraunces_500Medium_Italic } from '@expo-google-fonts/fraunces/500Medium_Italic';
import { Manrope_400Regular } from '@expo-google-fonts/manrope/400Regular';
import { Manrope_500Medium } from '@expo-google-fonts/manrope/500Medium';
import { Manrope_600SemiBold } from '@expo-google-fonts/manrope/600SemiBold';
import { Manrope_700Bold } from '@expo-google-fonts/manrope/700Bold';
import { Manrope_800ExtraBold } from '@expo-google-fonts/manrope/800ExtraBold';
import IoniconsTtf from '@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf';
import PlusJakartaSans400 from '../../assets/fonts/PlusJakartaSans_400Regular.ttf';
import PlusJakartaSans500 from '../../assets/fonts/PlusJakartaSans_500Medium.ttf';
import PlusJakartaSans600 from '../../assets/fonts/PlusJakartaSans_600SemiBold.ttf';
import PlusJakartaSans700 from '../../assets/fonts/PlusJakartaSans_700Bold.ttf';
import PlusJakartaSans800 from '../../assets/fonts/PlusJakartaSans_800ExtraBold.ttf';
import Bricolage700 from '../../assets/fonts/BricolageGrotesque_700Bold.ttf';
import Figtree600 from '../../assets/fonts/Figtree_600SemiBold.ttf';
import AnekDevanagari400 from '../../assets/fonts/AnekDevanagari_400Regular.ttf';
import AnekDevanagari500 from '../../assets/fonts/AnekDevanagari_500Medium.ttf';
import AnekDevanagari600 from '../../assets/fonts/AnekDevanagari_600SemiBold.ttf';
import { getLocale } from '@/i18n';
import { createLogger } from '@/lib/logger';
import { Ionicons } from '@expo/vector-icons';

const log = createLogger('fontLoader');

// Prevent native splash screen from hiding until fonts and initialization complete
if (typeof SplashScreen?.preventAutoHideAsync === 'function') {
  SplashScreen.preventAutoHideAsync().catch(() => {});
}

let baseFontsLoaded = false;
let hindiFontsLoaded = false;

export const DESIGN_SYSTEM_V1_FONTS = {
  Fraunces_500Medium,
  Fraunces_500Medium_Italic,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
};

export async function loadAppFonts(): Promise<boolean> {
  try {
    if (!baseFontsLoaded) {
      await Font.loadAsync({
        ...Ionicons.font,
        Ionicons: IoniconsTtf,
        ...DESIGN_SYSTEM_V1_FONTS,
        // Legacy fonts retained for un-migrated screens until each screen moves to Design System v1.
        PlusJakartaSans_400: PlusJakartaSans400,
        PlusJakartaSans_500: PlusJakartaSans500,
        PlusJakartaSans_600: PlusJakartaSans600,
        PlusJakartaSans_700: PlusJakartaSans700,
        PlusJakartaSans_800: PlusJakartaSans800,
        Bricolage_600: PlusJakartaSans600,
        Bricolage_700: Bricolage700,
        Figtree_400: PlusJakartaSans400,
        Figtree_500: PlusJakartaSans500,
        Figtree_600: Figtree600,
      });
      baseFontsLoaded = true;
    }

    // Load Anek Devanagari only when language is Hindi
    if (getLocale() === 'hi' && !hindiFontsLoaded) {
      await Font.loadAsync({
        AnekDevanagari_400: AnekDevanagari400,
        AnekDevanagari_500: AnekDevanagari500,
        AnekDevanagari_600: AnekDevanagari600,
      });
      hindiFontsLoaded = true;
    }

    return true;
  } catch (error) {
    log.error(
      'Failed to load static fonts',
      error instanceof Error ? error.message : String(error),
    );
    return false;
  }
}

export async function hideSplashScreen(): Promise<void> {
  try {
    if (typeof SplashScreen?.hideAsync === 'function') {
      await SplashScreen.hideAsync();
    }
  } catch {
    // Ignore error if splash was already dismissed
  }
}
