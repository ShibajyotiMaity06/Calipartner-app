import type { ExpoConfig, ConfigContext } from 'expo/config';

/**
 * Only EXPO_PUBLIC_* (non-secret) values are read here and exposed to the app via `extra`.
 * Never add secrets or service-role keys to this file or to the app environment.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'CaliPartner',
  slug: 'calipartner',
  version: '0.1.0',
  scheme: 'calipartner',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'app.calipartner.mobile',
  },
  android: {
    package: 'app.calipartner.mobile',
    adaptiveIcon: {
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
  },
  plugins: [
    'expo-router',
    'expo-dev-client',
    'expo-sqlite',
    'expo-status-bar',
    [
      'expo-font',
      {
        fonts: [
          './assets/fonts/BricolageGrotesque_600SemiBold.ttf',
          './assets/fonts/BricolageGrotesque_700Bold.ttf',
          './assets/fonts/Figtree_400Regular.ttf',
          './assets/fonts/Figtree_500Medium.ttf',
          './assets/fonts/Figtree_600SemiBold.ttf',
          './assets/fonts/AnekDevanagari_400Regular.ttf',
          './assets/fonts/AnekDevanagari_500Medium.ttf',
          './assets/fonts/AnekDevanagari_600SemiBold.ttf',
        ],
      },
    ],
    [
      'expo-splash-screen',
      { image: './assets/splash-icon.png', imageWidth: 200, backgroundColor: '#0E0B08' },
    ],
  ],
  experiments: { typedRoutes: true },
  extra: {
    appEnv: process.env.EXPO_PUBLIC_APP_ENV ?? 'development',
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
    revenueCatAppleKey: process.env.EXPO_PUBLIC_REVENUECAT_APPLE_KEY ?? '',
    revenueCatGoogleKey: process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY ?? '',
  },
});
