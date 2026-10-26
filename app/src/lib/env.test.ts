import { afterEach, describe, expect, it, vi } from 'vitest';
const config = vi.hoisted(() => ({ extra: {} as Record<string, string> }));
vi.mock('expo-constants', () => ({
  default: {
    get expoConfig() {
      return { extra: config.extra };
    },
  },
}));
vi.mock('react-native', () => ({ Platform: { OS: 'web' } }));
afterEach(() => {
  vi.unstubAllEnvs();
  config.extra = {};
  vi.resetModules();
});
describe('web export configuration', () => {
  it('connects using inlined public settings when the Expo manifest is absent', async () => {
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://public-example.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'public-anon-key');
    const { env, isSupabaseConfigured } = await import('./env');
    expect(env.supabaseUrl).toBe('https://public-example.supabase.co');
    expect(env.supabaseAnonKey).toBe('public-anon-key');
    expect(isSupabaseConfigured()).toBe(true);
  });
  it('keeps the native manifest fallback when public build variables are absent', async () => {
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', undefined);
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', undefined);
    config.extra = {
      supabaseUrl: 'https://manifest-example.supabase.co',
      supabaseAnonKey: 'public-native-key',
    };
    const { env } = await import('./env');
    expect(env.supabaseUrl).toBe(config.extra.supabaseUrl);
    expect(env.supabaseAnonKey).toBe(config.extra.supabaseAnonKey);
  });
});
