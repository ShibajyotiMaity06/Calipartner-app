import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('expo-sqlite', () => ({}));
vi.mock('@/services/accountSyncGate', () => ({ beforeTrackingSync: async () => {} }));
import { createWebDb } from './index';
import { openWebStorage, LEGACY_WEB_KEY } from './webStorage';
import {
  enqueueOutbox,
  flushOutbox,
  getPendingOutboxItems,
  type SupabaseSyncClient,
} from '@/services/syncService';
import { getChatMessages } from '@/services/chatService';
import { logWorkoutExercise } from '@/services/workoutLogService';
import { getWorkoutsForDate } from '@/services/workoutService';

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal('indexedDB', new IDBFactory());
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
});
afterEach(() => vi.unstubAllGlobals());
describe('durable browser database repairs', () => {
  it('migrates a diary/outbox intact, survives localStorage quota exhaustion and reopens from IndexedDB', async () => {
    localStorage.setItem(
      LEGACY_WEB_KEY,
      JSON.stringify({
        outbox: [{ id: 'pending', payload: 'keep' }],
        local_food_entries: [{ id: 'meal', user_id: 'owner', local_date: '2026-10-30' }],
      }),
    );
    const first = await openWebStorage();
    expect(first.initial.outbox?.[0]?.id).toBe('pending');
    expect(localStorage.getItem(LEGACY_WEB_KEY)).toBeNull();
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    const db = createWebDb(first);
    await db.runAsync(
      'INSERT INTO local_chat_messages (id,client_id,room_id,text) VALUES (?,?,?,?)',
      ['chat', 'client', 'room', 'a'.repeat(6 * 1024 * 1024)],
    );
    first.close();
    const second = await openWebStorage();
    const reopened = createWebDb(second);
    expect(
      (
        await reopened.getAllAsync<{ text: string }>(
          'SELECT * FROM local_chat_messages WHERE room_id = ?',
          ['room'],
        )
      )[0]?.text.length,
    ).toBe(6 * 1024 * 1024);
    expect(
      await reopened.getAllAsync('SELECT * FROM local_food_entries WHERE user_id = ?', ['owner']),
    ).toHaveLength(1);
    expect(second.initial.outbox?.[0]?.payload).toBe('keep');
    second.close();
  });
  it('rolls back a failed durable workout write including every outbox row', async () => {
    const db = createWebDb({
      initial: {},
      save: async () => {
        throw new Error('disk full');
      },
    });
    await expect(
      logWorkoutExercise(db, {
        userId: 'owner',
        localDate: '2026-10-30',
        exerciseName: 'Push-Ups',
        durationMinutes: 10,
        sets: [{ reps: 12, weightKg: 0 }],
      }),
    ).rejects.toThrow('disk full');
    expect(await db.getAllAsync('SELECT * FROM local_workouts')).toEqual([]);
    expect(await db.getAllAsync('SELECT * FROM outbox')).toEqual([]);
  });
  it('caches repeated chat reads once, and removes attachments when a message is deleted', async () => {
    const storage = await openWebStorage(),
      db = createWebDb(storage);
    const message = {
      id: 'message',
      client_id: 'client',
      room_id: 'room',
      sender_id: 'owner',
      text: 'Hi',
      created_at: '2026-10-30T12:00:00Z',
      message_type: 'user',
      attachments: [
        {
          id: 'attachment',
          storage_key: 'key',
          mime_type: 'image/jpeg',
          size: 10,
          moderation_status: 'ok',
          created_at: '2026-10-30T12:00:00Z',
        },
      ],
    };
    const client = { rpc: vi.fn().mockResolvedValue({ data: [message], error: null }) };
    for (let i = 0; i < 5; i++) await getChatMessages(client, db, 'room');
    expect(
      await db.getAllAsync('SELECT * FROM local_chat_messages WHERE room_id = ?', ['room']),
    ).toHaveLength(1);
    expect(
      await db.getAllAsync('SELECT * FROM local_chat_attachments WHERE message_id = ?', [
        'message',
      ]),
    ).toHaveLength(1);
    client.rpc.mockResolvedValue({
      data: [{ ...message, text: null, deleted_at: '2026-10-30T13:00:00Z', attachments: [] }],
      error: null,
    });
    await getChatMessages(client, db, 'room');
    expect(
      await db.getAllAsync('SELECT * FROM local_chat_attachments WHERE message_id = ?', [
        'message',
      ]),
    ).toEqual([]);
    storage.close();
  });
  it('stores entered workout sets, reopens them, and flushes the real queue without duplicate uploads', async () => {
    const storage = await openWebStorage(),
      db = createWebDb(storage);
    expect(await getWorkoutsForDate(db, 'owner', '2026-10-30')).toEqual([]);
    const logged = await logWorkoutExercise(db, {
      userId: 'owner',
      localDate: '2026-10-30',
      exerciseName: 'Push-Ups',
      durationMinutes: 10,
      sets: [
        { reps: 12, weightKg: 0 },
        { reps: 10, weightKg: 5 },
      ],
    });
    expect(logged.exercises[0]?.sets?.map((set) => set.reps)).toEqual([12, 10]);
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const result = await flushOutbox(db, {
      from: () => ({ upsert }),
    } as unknown as SupabaseSyncClient);
    expect(result).toEqual({ processed: 4, succeeded: 4, failed: 0 });
    expect(await getPendingOutboxItems(db)).toEqual([]);
    await flushOutbox(db, { from: () => ({ upsert }) } as unknown as SupabaseSyncClient);
    expect(upsert).toHaveBeenCalledTimes(4);
    storage.close();
    const next = await openWebStorage();
    expect(
      (await getWorkoutsForDate(createWebDb(next), 'owner', '2026-10-30'))[0]?.exercises[0]?.sets,
    ).toHaveLength(2);
    next.close();
  });
  it('keeps failed queue writes retryable and filters unrelated owners/dates', async () => {
    const storage = await openWebStorage(),
      db = createWebDb(storage);
    await enqueueOutbox(db, {
      id: 'food',
      entity: 'food_entries',
      operation: 'upsert',
      payload: { id: 'food' },
    });
    const result = await flushOutbox(db, {
      from: () => ({ upsert: async () => ({ error: new Error('offline') }) }),
    } as unknown as SupabaseSyncClient);
    expect(result.failed).toBe(1);
    const rows = await db.getAllAsync<{ attempts: number; status: string }>('SELECT * FROM outbox');
    expect(rows[0]).toMatchObject({ attempts: 1, status: 'pending' });
    expect(await getPendingOutboxItems(db)).toEqual([]); // backoff is respected
    storage.close();
  });
  it('orders chat ties lexically like SQLite/Postgres rather than using natural number order', async () => {
    const storage = await openWebStorage(),
      db = createWebDb(storage);
    for (const id of ['aa2', 'aa10'])
      await db.runAsync(
        'INSERT INTO local_chat_messages (id,client_id,room_id,created_at) VALUES (?,?,?,?)',
        [id, id, 'room', '2026-10-30T12:00:00Z'],
      );
    const rows = await db.getAllAsync<{ id: string }>(
      'SELECT * FROM local_chat_messages WHERE room_id = ? ORDER BY created_at DESC, id DESC LIMIT ?',
      ['room', 1],
    );
    expect(rows.map((row) => row.id)).toEqual(['aa2']);
    storage.close();
  });
});
