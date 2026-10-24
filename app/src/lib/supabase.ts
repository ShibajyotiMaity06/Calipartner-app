import { Platform } from 'react-native';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import { secureStoreAdapter } from '@/lib/secureStore';
import { createSessionStorage } from '@/services/sessionPersistence';

export const AUTH_STORAGE_KEY = `sb-${new URL(env.supabaseUrl || 'http://localhost').hostname.split('.')[0]}-auth-token`;
export const sessionStorage = createSessionStorage(AUTH_STORAGE_KEY, secureStoreAdapter);

let client: SupabaseClient | null = null;

/**
 * Supabase client singleton. Uses only the public anon key; all access control
 * is enforced by RLS in the database.
 * SecureStore persists sessions encrypted on-device across app restarts.
 */
export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        storage: sessionStorage,
        storageKey: AUTH_STORAGE_KEY,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: Platform.OS === 'web',
      },
    });
  }
  return client;
}
