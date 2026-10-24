import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

interface ChunkManifest {
  format: 'secure-chunks-v1';
  revision: string;
  count: number;
}

let revision = 0;

function manifest(value: string | null): ChunkManifest | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as ChunkManifest;
    return parsed.format === 'secure-chunks-v1' && Number.isInteger(parsed.count) ? parsed : null;
  } catch {
    return null;
  }
}

async function removeChunks(key: string, previous: ChunkManifest | null) {
  if (!previous) return;
  await Promise.all(
    Array.from({ length: previous.count }, (_, i) =>
      SecureStore.deleteItemAsync(`${key}.${previous.revision}.${i}`),
    ),
  );
}

/** Encrypted native persistence, including OAuth sessions larger than SecureStore's per-item limit. */
const persistentStore = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') return globalThis.localStorage.getItem(key);
    const value = await SecureStore.getItemAsync(key);
    const chunks = manifest(value);
    if (!chunks) return value;
    const parts = await Promise.all(
      Array.from({ length: chunks.count }, (_, i) =>
        SecureStore.getItemAsync(`${key}.${chunks.revision}.${i}`),
      ),
    );
    if (parts.some((part) => part === null)) throw new Error('Incomplete secure storage write');
    return parts.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      globalThis.localStorage.setItem(key, value);
      return;
    }
    const previous = manifest(await SecureStore.getItemAsync(key));
    const next: ChunkManifest = {
      format: 'secure-chunks-v1',
      revision: `${Date.now()}-${revision++}`,
      count: 0,
    };
    // 400 Unicode code points fit below 2 KB even with four-byte UTF-8 characters.
    const characters = Array.from(value);
    next.count = Math.max(1, Math.ceil(characters.length / 400));
    try {
      for (let i = 0; i < next.count; i++) {
        await SecureStore.setItemAsync(
          `${key}.${next.revision}.${i}`,
          characters.slice(i * 400, (i + 1) * 400).join(''),
        );
      }
      // Publish only after every chunk is durable. A failed write preserves the old session.
      await SecureStore.setItemAsync(key, JSON.stringify(next));
    } catch (error) {
      await removeChunks(key, next).catch(() => {});
      throw error;
    }
    await removeChunks(key, previous).catch(() => {});
  },

  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      globalThis.localStorage.removeItem(key);
      return;
    }
    const previous = manifest(await SecureStore.getItemAsync(key));
    await SecureStore.deleteItemAsync(key);
    await removeChunks(key, previous).catch(() => {});
  },
};

// Serialize per-key operations so a reader never loses chunks to a simultaneous token rotation.
const pending = new Map<string, Promise<unknown>>();
function serialize<T>(key: string, action: () => Promise<T>): Promise<T> {
  const previous = pending.get(key) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(action);
  pending.set(key, next);
  void next
    .finally(() => {
      if (pending.get(key) === next) pending.delete(key);
    })
    .catch(() => {});
  return next;
}

export const secureStoreAdapter = {
  getItem: (key: string) => serialize(key, () => persistentStore.getItem(key)),
  setItem: (key: string, value: string) =>
    serialize(key, () => persistentStore.setItem(key, value)),
  removeItem: (key: string) => serialize(key, () => persistentStore.removeItem(key)),
};
