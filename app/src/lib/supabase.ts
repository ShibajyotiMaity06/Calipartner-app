import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import { secureStoreAdapter } from '@/lib/secureStore';

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
        storage: secureStoreAdapter,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}
