/** Account-scoped, bounded read cache. Mutations invalidate before notifying readers. */
const entries = new Map<string, { value: unknown; expires: number }>();
const pending = new Map<string, Promise<unknown>>();
let generation = 0;

export function invalidateReadCache(prefix = '', owner?: string): void {
  generation++;
  for (const key of new Set([...entries.keys(), ...pending.keys()])) {
    const [account, resource] = JSON.parse(key) as [string, string];
    if ((!owner || account === owner) && resource.startsWith(prefix)) {
      entries.delete(key);
      pending.delete(key);
    }
  }
}

export async function memoryRead<T>(
  owner: string,
  resource: string,
  read: () => Promise<T>,
  ttl = 30000,
): Promise<T> {
  const key = JSON.stringify([owner, resource]);
  const cached = entries.get(key);
  if (cached && cached.expires > Date.now()) return cached.value as T;
  if (pending.has(key)) return pending.get(key) as Promise<T>;
  const version = generation;
  const task = read().then((value) => {
    if (version === generation) {
      if (entries.size >= 200) entries.delete(entries.keys().next().value!);
      entries.set(key, { value, expires: Date.now() + ttl });
    }
    return value;
  });
  pending.set(key, task);
  try {
    return await task;
  } finally {
    if (pending.get(key) === task) pending.delete(key);
  }
}
