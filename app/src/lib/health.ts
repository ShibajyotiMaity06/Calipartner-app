import { isHealthResponse, type HealthResponse } from '@calipartner/core';
import { isSupabaseConfigured } from '@/lib/env';
import { getSupabase } from '@/lib/supabase';

/**
 * Checks connectivity to Supabase.
 * Tries the `health` Edge Function first; if not deployed yet, falls back to
 * a lightweight ping on the database endpoint.
 */
export async function fetchHealth(): Promise<HealthResponse> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured (see app/.env.example)');
  }

  const supabase = getSupabase();

  try {
    const { data, error } = await supabase.functions.invoke<unknown>('health', {
      method: 'GET',
    });
    if (!error && isHealthResponse(data)) {
      return data;
    }
  } catch {
    // Edge function not deployed to cloud project yet; check database connectivity directly
  }

  // Fallback: ping the live database
  const { error: dbError } = await supabase
    .from('reserved_usernames')
    .select('word', { count: 'exact', head: true });

  if (dbError) {
    throw new Error(`Connection check failed: ${dbError.message}`);
  }

  return {
    status: 'ok',
    time: new Date().toISOString(),
  };
}
