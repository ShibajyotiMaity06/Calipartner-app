import type { LocalDb } from './accountDataService';
vi.mock('./accountDataService', async (original) => ({
  ...(await original<object>()),
  withOnlineSave: async <T>(db: LocalDb, action: (db: LocalDb) => Promise<T>) => action(db),
  saveRemote: (await import('../test/remoteWrites')).recordRemoteWrite,
}));
import { recordedWrites } from '../test/remoteWrites';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('expo-sqlite', () => ({}));
import { createWebDb } from '@/db';
import { deleteWeightLog, editWeightLog, getWeightLogs, logWeight } from './weightService';

beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
  });
});
afterEach(() => vi.unstubAllGlobals());
describe('browser weight persistence', () => {
  it('saves, edits and deletes by UUID across restarts while preserving ownership', async () => {
    let db = createWebDb();
    const entry = await logWeight(db, 'a', 80, '2026-10-29', undefined, 'Morning');
    db = createWebDb();
    expect(await editWeightLog(db, 'b', entry.id, 90)).toBeNull();
    expect(await editWeightLog(db, 'a', entry.id, 79.5, 'Corrected')).toMatchObject({
      weight_kg: 79.5,
      notes: 'Corrected',
    });
    db = createWebDb();
    expect((await getWeightLogs(db, 'a'))[0]).toMatchObject({ id: entry.id, weight_kg: 79.5 });
    await deleteWeightLog(db, 'a', entry.id);
    expect(await getWeightLogs(createWebDb(), 'a')).toEqual([]);
  });
  it('recovers swapped date/notes and saves a valid retry payload', async () => {
    let db = createWebDb();
    const entry = await logWeight(db, 'a', 80, '2026-10-29', undefined, 'Morning');
    await db.runAsync(
      "UPDATE local_weight_logs SET local_date = ?, notes = ?, updated_at = ?, sync_state = 'pending' WHERE id = ? AND user_id = ?",
      ['Morning', '2026-10-29', entry.updated_at, entry.id, 'a'],
    );
    db = createWebDb();
    expect((await getWeightLogs(db, 'a'))[0]).toMatchObject({
      id: entry.id,
      local_date: '2026-10-29',
      notes: 'Morning',
    });
    const outbox = await recordedWrites(db);
    expect(outbox).toHaveLength(1);
    const payload = outbox[0]!.payload;
    expect(payload).toMatchObject({ local_date: '2026-10-29', notes: 'Morning' });
    expect(payload).not.toHaveProperty('sync_state');
  });
});

it('edits the selected date without replacing other weigh-ins and rejects future dates before saving', async () => {
  const db = createWebDb();
  const older = await logWeight(db, 'a', 80, '2026-10-22');
  const latest = await logWeight(db, 'a', 79, '2026-10-29');
  await editWeightLog(db, 'a', latest.id, 78.5, 'Corrected', '2026-10-28', '2026-10-30');
  expect(await getWeightLogs(createWebDb(), 'a')).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: older.id, weight_kg: 80, local_date: '2026-10-22' }),
      expect.objectContaining({ id: latest.id, weight_kg: 78.5, local_date: '2026-10-28' }),
    ]),
  );
  await expect(
    logWeight(db, 'a', 78, '2026-11-01', undefined, undefined, '2026-10-30'),
  ).rejects.toThrow('INVALID_DATE');
  await expect(
    editWeightLog(db, 'a', latest.id, 78, undefined, '2026-11-01', '2026-10-30'),
  ).rejects.toThrow('INVALID_DATE');
  expect(await getWeightLogs(db, 'a')).toHaveLength(2);
});
