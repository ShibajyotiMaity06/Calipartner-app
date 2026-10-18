import { Platform } from 'react-native';
import { getSupabase } from '@/lib/supabase';
import { createLogger } from '@/lib/logger';
import type { DevicePlatform } from '@calipartner/core';

const log = createLogger('deviceService');

const DEVICE_ID_KEY = 'calipartner_device_hash';
const PUSH_TOKEN_KEY = 'calipartner_fcm_token';
let memoryDeviceId: string | null = null;
let memoryPushToken: string | null = null;

function generateRandomHash(): string {
  const chars = 'abcdef0123456789';
  let result = 'dev_';
  for (let i = 0; i < 32; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

/**
 * Returns a stable device hash persisted encrypted in SecureStore.
 * Used for server-side trial-abuse controls (one trial per device).
 */
export async function getOrGenerateDeviceHash(): Promise<string> {
  if (memoryDeviceId) return memoryDeviceId;

  // In Node test environment, return random in-memory device id without loading native modules
  if (
    typeof (globalThis as Record<string, unknown>).__DEV__ === 'undefined' &&
    typeof process !== 'undefined'
  ) {
    memoryDeviceId = generateRandomHash();
    return memoryDeviceId;
  }

  try {
    const { secureStoreAdapter } = await import('@/lib/secureStore');
    const existing = await secureStoreAdapter.getItem(DEVICE_ID_KEY);
    if (existing && existing.length > 0) {
      memoryDeviceId = existing;
      return existing;
    }
    const fresh = generateRandomHash();
    await secureStoreAdapter.setItem(DEVICE_ID_KEY, fresh);
    memoryDeviceId = fresh;
    return fresh;
  } catch {
    memoryDeviceId = generateRandomHash();
    return memoryDeviceId;
  }
}

/**
 * Registers the device's FCM push token in Supabase.
 * Upserts token and updates last_seen timestamp.
 */
export async function registerPushDevice(
  token: string,
  platform?: DevicePlatform,
  appVersion?: string,
): Promise<string | null> {
  const cleanToken = token.trim();
  if (!cleanToken) return null;

  const resolvedPlatform: DevicePlatform =
    platform || (Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web');

  const deviceId = await getOrGenerateDeviceHash();

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('register_device', {
      p_fcm_token: cleanToken,
      p_platform: resolvedPlatform,
      p_app_version: appVersion || '1.0.0',
      p_device_id: deviceId,
    });

    if (error) {
      log.warn(`Failed to register push device: ${error.message}`);
      return null;
    }

    memoryPushToken = cleanToken;
    try {
      const { secureStoreAdapter } = await import('@/lib/secureStore');
      await secureStoreAdapter.setItem(PUSH_TOKEN_KEY, cleanToken);
    } catch {
      // SecureStore not available in tests or web
    }

    log.info(`Push device registered successfully: ${data}`);
    return data as string;
  } catch (err) {
    log.warn(`Error registering push device: ${err}`);
    return null;
  }
}

/**
 * Unregisters the push device token upon sign-out.
 */
export async function unregisterPushDevice(token?: string): Promise<boolean> {
  let targetToken = token || memoryPushToken;

  if (!targetToken) {
    try {
      const { secureStoreAdapter } = await import('@/lib/secureStore');
      targetToken = await secureStoreAdapter.getItem(PUSH_TOKEN_KEY);
    } catch {
      // SecureStore fallback
    }
  }

  if (!targetToken) return false;

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('unregister_device', {
      p_fcm_token: targetToken,
    });

    if (error) {
      log.warn(`Failed to unregister push device: ${error.message}`);
      return false;
    }

    memoryPushToken = null;
    try {
      const { secureStoreAdapter } = await import('@/lib/secureStore');
      await secureStoreAdapter.removeItem(PUSH_TOKEN_KEY);
    } catch {
      // SecureStore fallback
    }

    return Boolean(data);
  } catch (err) {
    log.warn(`Error unregistering push device: ${err}`);
    return false;
  }
}
