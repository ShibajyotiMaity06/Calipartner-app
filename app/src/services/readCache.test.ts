import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { invalidateReadCache, memoryRead } from './readCache';
beforeEach(() => {
  invalidateReadCache();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());
it('coalesces concurrent reads, reuses only unexpired values, and isolates accounts', async () => {
  const read = vi.fn(async () => ({ value: 1 }));
  await Promise.all([memoryRead('a', 'rooms', read), memoryRead('a', 'rooms', read)]);
  await memoryRead('a', 'rooms', read);
  expect(read).toHaveBeenCalledTimes(1);
  await memoryRead('b', 'rooms', read);
  expect(read).toHaveBeenCalledTimes(2);
  vi.advanceTimersByTime(30001);
  await memoryRead('a', 'rooms', read);
  expect(read).toHaveBeenCalledTimes(3);
});
it('a mutation prevents an older in-flight read from repopulating the cache', async () => {
  let resolve!: (value: string) => void;
  const stale = memoryRead(
    'a',
    'chat:one',
    () =>
      new Promise<string>((r) => {
        resolve = r;
      }),
  );
  invalidateReadCache('chat:one', 'a');
  await memoryRead('a', 'chat:one', async () => 'new');
  resolve('old');
  await stale;
  expect(await memoryRead('a', 'chat:one', async () => 'wrong')).toBe('new');
});
it('errors are never cached and selective invalidation leaves avatar reads intact', async () => {
  await expect(
    memoryRead('a', 'rooms', async () => {
      throw Error('DENIED');
    }),
  ).rejects.toThrow('DENIED');
  expect(await memoryRead('a', 'rooms', async () => [])).toEqual([]);
  await memoryRead('a', 'avatar', async () => 1);
  invalidateReadCache('rooms');
  expect(await memoryRead('a', 'avatar', async () => 2)).toBe(1);
});
