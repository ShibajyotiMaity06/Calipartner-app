import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { migrations } from '@/db/migrations';
import { saveCheckIn } from './checkInService';
import { OWNER_RECIPES, getRecipeDetail, logRecipe } from './recipeService';
import { flushOutbox, type SyncDb, type SupabaseSyncClient } from './syncService';

function database() {
  const sqlite = new DatabaseSync(':memory:');
  for (const migration of migrations) sqlite.exec(migration.sql);
  const db: SyncDb = {
    async runAsync(sql, ...args) {
      return sqlite.prepare(sql).run(...(args[0] as []));
    },
    async getFirstAsync<T>(sql: string, ...args: unknown[]) {
      return (sqlite.prepare(sql).get(...(args[0] as [])) as T) ?? null;
    },
    async getAllAsync<T>(sql: string, ...args: unknown[]) {
      return sqlite.prepare(sql).all(...(args[0] as [])) as T[];
    },
    async withTransactionAsync(action) {
      sqlite.exec('begin');
      try {
        await action();
        sqlite.exec('commit');
      } catch (e) {
        sqlite.exec('rollback');
        throw e;
      }
    },
  };
  return { db, sqlite };
}
const input = {
  userId: 'owner',
  roomId: 'room',
  localDate: '2026-11-01',
  activities: ['rest'] as ['rest'],
  note: 'Resting today',
  share: false,
  occurredAt: '2026-11-02T02:00:00Z',
};

describe('offline daily check-ins', () => {
  it('persists one row and one queued UUID on retries, with the stored local day and private sharing', async () => {
    const { db, sqlite } = database();
    await saveCheckIn(db, input);
    await saveCheckIn(db, { ...input, note: 'Updated note' });
    const rows = sqlite.prepare('select * from local_squad_check_ins').all();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      local_date: '2026-11-01',
      note: 'Updated note',
      share_with_squad: 0,
      sync_state: 'pending',
    });
    const queue = sqlite.prepare('select * from outbox').all();
    expect(queue).toHaveLength(1);
    expect(JSON.parse(queue[0]!.payload as string)).toMatchObject({
      id: rows[0]!.id,
      local_date: '2026-11-01',
      occurred_at: '2026-11-02T02:00:00Z',
      share_with_squad: false,
    });
    sqlite.close();
  });
  it('rolls back the check-in if its durable outbox write fails', async () => {
    const { db, sqlite } = database();
    sqlite.exec('drop table outbox');
    await expect(saveCheckIn(db, input)).rejects.toThrow();
    expect(sqlite.prepare('select * from local_squad_check_ins').all()).toEqual([]);
    sqlite.close();
  });
  it('syncs by the composite day key and marks the local check-in synced', async () => {
    const { db, sqlite } = database();
    await saveCheckIn(db, input);
    let options: unknown;
    const client = {
      from: () => ({
        upsert: async (_value: unknown, next: unknown) => {
          options = next;
          return { error: null };
        },
      }),
    } as unknown as SupabaseSyncClient;
    expect(await flushOutbox(db, client)).toMatchObject({ succeeded: 1, failed: 0 });
    expect(options).toEqual({ onConflict: 'user_id,room_id,local_date' });
    expect(sqlite.prepare('select sync_state from local_squad_check_ins').get()).toEqual({
      sync_state: 'synced',
    });
    expect(sqlite.prepare('select * from outbox').all()).toEqual([]);
    sqlite.close();
  });
});
it('logs supplied recipe nutrition into the real native schema and rolls back a log without an outbox record', async () => {
  const { db, sqlite } = database();
  const recipe = OWNER_RECIPES[0]!;
  await getRecipeDetail(db, recipe.id, 'owner');
  const entry = await logRecipe(db, {
    userId: 'owner',
    recipeId: recipe.id,
    servings: 1.5,
    mealSection: 'dinner',
    localDate: '2026-11-01',
  });
  expect(entry.calories).toBe(517.5);
  expect(entry.protein).toBe(69);
  expect(sqlite.prepare('select count(*) as count from local_food_entries').get()).toMatchObject({
    count: 1,
  });
  sqlite.exec('drop table outbox');
  await expect(
    logRecipe(db, {
      userId: 'owner',
      recipeId: recipe.id,
      servings: 1,
      mealSection: 'dinner',
      localDate: '2026-11-01',
    }),
  ).rejects.toThrow();
  expect(sqlite.prepare('select count(*) as count from local_food_entries').get()).toMatchObject({
    count: 1,
  });
  sqlite.close();
});
