const DEVICE_ID_KEY = 'calipartner_device_hash';
let memoryDeviceId: string | null = null;

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
