import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { resolveLocalUrl } from '@/lib/localUrl';

interface Extra {
  appEnv?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

export const env = {
  appEnv: extra.appEnv ?? 'development',
  supabaseUrl: resolveLocalUrl(extra.supabaseUrl ?? '', Platform.OS),
  supabaseAnonKey: extra.supabaseAnonKey ?? '',
} as const;

export function isSupabaseConfigured(): boolean {
  return env.supabaseUrl.length > 0 && env.supabaseAnonKey.length > 0;
}
