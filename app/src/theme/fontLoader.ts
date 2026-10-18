/* eslint-disable @typescript-eslint/no-require-imports */
import * as Font from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { getLocale } from '@/i18n';
import { createLogger } from '@/lib/logger';

const log = createLogger('fontLoader');

// Prevent native splash screen from hiding until fonts and initialization complete
if (typeof SplashScreen?.preventAutoHideAsync === 'function') {
  SplashScreen.preventAutoHideAsync().catch(() => {});
}

let baseFontsLoaded = false;
let hindiFontsLoaded = false;

export async function loadAppFonts(): Promise<boolean> {
  try {
    if (!baseFontsLoaded) {
      await Font.loadAsync({
        Bricolage_600: require('../../assets/fonts/BricolageGrotesque_600SemiBold.ttf'),
        Bricolage_700: require('../../assets/fonts/BricolageGrotesque_700Bold.ttf'),
        Figtree_400: require('../../assets/fonts/Figtree_400Regular.ttf'),
        Figtree_500: require('../../assets/fonts/Figtree_500Medium.ttf'),
        Figtree_600: require('../../assets/fonts/Figtree_600SemiBold.ttf'),
      });
      baseFontsLoaded = true;
    }

    // Load Anek Devanagari only when language is Hindi
    if (getLocale() === 'hi' && !hindiFontsLoaded) {
      await Font.loadAsync({
        AnekDevanagari_400: require('../../assets/fonts/AnekDevanagari_400Regular.ttf'),
        AnekDevanagari_500: require('../../assets/fonts/AnekDevanagari_500Medium.ttf'),
        AnekDevanagari_600: require('../../assets/fonts/AnekDevanagari_600SemiBold.ttf'),
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
