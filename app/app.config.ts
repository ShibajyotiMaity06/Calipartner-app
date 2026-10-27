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
    icon: './assets/ios-icon.png',
    bundleIdentifier: 'app.calipartner.mobile',
    googleServicesFile: process.env.GOOGLE_SERVICES_INFO_PLIST ?? './GoogleService-Info.plist',
    infoPlist: {
      NSMotionUsageDescription:
        'CaliPartner uses your motion sensors to count your steps during walking and running workouts.',
      NSLocationWhenInUseUsageDescription:
        'CaliPartner uses your location to track your running distance, pace, and route.',
    },
  },
  web: { favicon: './assets/favicon.png' },
  android: {
    package: 'app.calipartner.mobile',
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
    permissions: [
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.ACTIVITY_RECOGNITION',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.health.READ_STEPS',
      'android.permission.health.READ_DISTANCE',
    ],
    adaptiveIcon: {
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
  },
  plugins: [
    [
      'expo-notifications',
      {
        icon: './assets/android-icon-monochrome.png',
        color: '#F48C46',
      },
    ],
    'expo-router',
    'expo-video',
    [
      'expo-camera',
      {
        cameraPermission: 'Allow CaliPartner to photograph food and scan product barcodes.',
        recordAudioAndroid: false,
      },
    ],
    'react-native-health-connect',
    ['expo-build-properties', { android: { minSdkVersion: 26 } }],
    [
      '@kingstinct/react-native-healthkit',
      {
        NSHealthShareUsageDescription:
          'CaliPartner reads your daily steps and walking distance to update your activity, including steps recorded while the app is closed.',
        NSHealthUpdateUsageDescription: false,
        background: false,
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'Choose food photos, product barcodes, or media to share with your room.',
        cameraPermission:
          'Photograph your food, scan a product barcode, or take a photo to share with your room.',
        microphonePermission: false,
      },
    ],
    'expo-dev-client',
    'expo-secure-store',
    'expo-sqlite',
    'expo-status-bar',
    [
      'expo-font',
      {
        fonts: [
          './assets/fonts/PlusJakartaSans_400Regular.ttf',
          './assets/fonts/PlusJakartaSans_500Medium.ttf',
          './assets/fonts/PlusJakartaSans_600SemiBold.ttf',
          './assets/fonts/PlusJakartaSans_700Bold.ttf',
          './assets/fonts/PlusJakartaSans_800ExtraBold.ttf',
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
