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
    const outbox = await db.getAllAsync<{ payload: string }>('SELECT * FROM outbox');
    expect(outbox).toHaveLength(1);
    const payload = JSON.parse(outbox[0]!.payload);
    expect(payload).toMatchObject({ local_date: '2026-10-29', notes: 'Morning' });
    expect(payload).not.toHaveProperty('sync_state');
  });
});
