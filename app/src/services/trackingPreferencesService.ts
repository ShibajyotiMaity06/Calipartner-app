import {
  DEFAULT_TRACKING,
  validateTrackingPreferences,
  type TrackingPreferences,
} from '@calipartner/core';
import { getSupabase } from '@/lib/supabase';

async function actor(userId: string) {
  const client = getSupabase();
  const auth = await client.auth.getUser();
  if (auth.error || auth.data.user?.id !== userId) throw new Error('ACCOUNT_CHANGED');
  return client;
}
export async function readTrackingPreferences(userId: string): Promise<TrackingPreferences> {
  const client = await actor(userId);
  const { data, error } = await client
    .from('tracking_preferences')
    .select('enabled')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ? validateTrackingPreferences(data.enabled) : { ...DEFAULT_TRACKING };
}
export async function saveTrackingPreferences(
  userId: string,
  enabled: TrackingPreferences,
  requestId: string,
): Promise<TrackingPreferences> {
  const valid = validateTrackingPreferences(enabled);
  const client = await actor(userId);
  const { data, error } = await client
    .from('tracking_preferences')
    .upsert({ user_id: userId, request_id: requestId, enabled: valid })
    .select('request_id,enabled')
    .single();
  if (error) throw error;
  if (data?.request_id !== requestId) throw new Error('TRACKING_NOT_SAVED');
  const saved = validateTrackingPreferences(data.enabled);
  if (
    Object.keys(valid).some(
      (key) => saved[key as keyof TrackingPreferences] !== valid[key as keyof TrackingPreferences],
    )
  )
    throw new Error('TRACKING_NOT_SAVED');
  return saved;
}
