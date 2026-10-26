import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { resolveLocalUrl } from '@/lib/localUrl';

interface Extra {
  appEnv?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  revenueCatAppleKey?: string;
  revenueCatGoogleKey?: string;
}

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

export const env = {
  // Static web exports inline EXPO_PUBLIC_* references but may have no Expo manifest.
  appEnv: process.env.EXPO_PUBLIC_APP_ENV ?? extra.appEnv ?? 'development',
  supabaseUrl: resolveLocalUrl(
    process.env.EXPO_PUBLIC_SUPABASE_URL ?? extra.supabaseUrl ?? '',
    Platform.OS,
  ),
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? extra.supabaseAnonKey ?? '',
  revenueCatAppleKey:
    process.env.EXPO_PUBLIC_REVENUECAT_APPLE_KEY ?? extra.revenueCatAppleKey ?? '',
  revenueCatGoogleKey:
    process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY ?? extra.revenueCatGoogleKey ?? '',
} as const;

export function isSupabaseConfigured(): boolean {
  return env.supabaseUrl.length > 0 && env.supabaseAnonKey.length > 0;
}
