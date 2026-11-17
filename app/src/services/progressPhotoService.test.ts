import { DatabaseSync } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ owner: 'a', copy: vi.fn(), remove: vi.fn() }));
vi.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    auth: { getSession: async () => ({ data: { session: { user: { id: state.owner } } } }) },
  }),
}));
vi.mock('./progressPhotoFiles', () => ({
  persistPhoto: state.copy,
  removePhoto: state.remove,
  photoUri: (_owner: string, path: string) => 'file:///' + path,
}));
import { deleteProgressPhoto, getProgressPhotos, saveProgressPhoto } from './progressPhotoService';
let sqlite: DatabaseSync, db: SQLiteDatabase;
beforeEach(() => {
  state.owner = 'a';
  vi.clearAllMocks();
  state.copy.mockResolvedValue('one.jpg');
  state.remove.mockResolvedValue(undefined);
  sqlite = new DatabaseSync(':memory:');
  sqlite.exec(
    'CREATE TABLE local_progress_photos(id TEXT PRIMARY KEY,user_id TEXT,photo_uri TEXT,captured_date TEXT,weight_kg REAL,pose TEXT,notes TEXT,created_at TEXT)',
  );
  db = {
    getAllAsync: async (sql: string, params: unknown[]) =>
      sqlite.prepare(sql).all(...(params as [])),
    getFirstAsync: async (sql: string, params: unknown[]) =>
      sqlite.prepare(sql).get(...(params as [])),
    runAsync: async (sql: string, params: unknown[]) => sqlite.prepare(sql).run(...(params as [])),
  } as unknown as SQLiteDatabase;
});
afterEach(() => sqlite.close());
const photo = {
  id: 'one',
  user_id: 'a',
  photo_uri: 'temporary',
  captured_date: '2026-11-16',
  weight_kg: null,
  pose: 'front' as const,
  notes: '',
};
it('persists real images, survives reload, retries once and isolates accounts', async () => {
  await saveProgressPhoto(db, photo);
  await saveProgressPhoto(db, photo);
  expect(state.copy).toHaveBeenCalledOnce();
  expect(await getProgressPhotos(db, 'a')).toEqual([
    expect.objectContaining({ photo_uri: 'file:///one.jpg' }),
  ]);
  state.owner = 'b';
  expect(await getProgressPhotos(db, 'b')).toEqual([]);
  await expect(getProgressPhotos(db, 'a')).rejects.toThrow('ACCOUNT_CHANGED');
  await deleteProgressPhoto(db, 'b', 'one');
  expect(state.remove).not.toHaveBeenCalled();
  state.owner = 'a';
  await deleteProgressPhoto(db, 'a', 'one');
  expect(await getProgressPhotos(db, 'a')).toEqual([]);
});
it('never invents a row when copying fails and cleans a file when persistence fails', async () => {
  state.copy.mockRejectedValueOnce(Error('DISK_FULL'));
  await expect(saveProgressPhoto(db, photo)).rejects.toThrow('DISK_FULL');
  expect(await getProgressPhotos(db, 'a')).toEqual([]);
  const failing = {
    ...db,
    runAsync: async () => {
      throw Error('DATABASE_FULL');
    },
  } as unknown as SQLiteDatabase;
  await expect(saveProgressPhoto(failing, photo)).rejects.toThrow('DATABASE_FULL');
  expect(state.remove).toHaveBeenCalledWith('a', 'one.jpg');
});
