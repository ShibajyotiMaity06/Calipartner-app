import { isHealthResponse, type HealthResponse } from '@calipartner/core';
import { isSupabaseConfigured } from '@/lib/env';
import { getSupabase } from '@/lib/supabase';

/** Calls the `health` Edge Function. Throws on any failure. */
export async function fetchHealth(): Promise<HealthResponse> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured (see app/.env.example)');
  }
  const { data, error } = await getSupabase().functions.invoke<unknown>('health', {
    method: 'GET',
  });
  if (error) throw error;
  if (!isHealthResponse(data)) throw new Error('Unexpected health response');
  return data;
}
