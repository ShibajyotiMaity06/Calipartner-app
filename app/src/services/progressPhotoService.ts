import type { SQLiteDatabase } from 'expo-sqlite';
import { persistPhoto, photoUri, removePhoto } from './progressPhotoFiles';
import { getSupabase } from '@/lib/supabase';

export interface ProgressPhoto {
  id: string;
  user_id: string;
  photo_uri: string;
  captured_date: string;
  weight_kg: number | null;
  pose: 'front' | 'side' | 'back';
  notes: string;
  created_at: string;
}
async function assertOwner(owner: string) {
  if ((await getSupabase().auth.getSession()).data.session?.user.id !== owner)
    throw new Error('ACCOUNT_CHANGED');
}
export async function getProgressPhotos(
  db: SQLiteDatabase,
  owner: string,
): Promise<ProgressPhoto[]> {
  await assertOwner(owner);
  const rows = await db.getAllAsync<ProgressPhoto>(
    'SELECT * FROM local_progress_photos WHERE user_id = ? ORDER BY captured_date DESC',
    [owner],
  );
  return rows.map((row) => ({ ...row, photo_uri: photoUri(owner, row.photo_uri) }));
}
export async function saveProgressPhoto(
  db: SQLiteDatabase,
  photo: Omit<ProgressPhoto, 'created_at'>,
): Promise<void> {
  await assertOwner(photo.user_id);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(photo.captured_date) ||
    !['front', 'side', 'back'].includes(photo.pose) ||
    (photo.weight_kg !== null && (!Number.isFinite(photo.weight_kg) || photo.weight_kg <= 0)) ||
    photo.notes.length > 1000
  )
    throw new Error('INVALID_PHOTO');
  const existing = await db.getFirstAsync<ProgressPhoto>(
    'SELECT * FROM local_progress_photos WHERE user_id = ? AND id = ?',
    [photo.user_id, photo.id],
  );
  if (existing) return;
  const stored = await persistPhoto(photo.user_id, photo.id, photo.photo_uri);
  try {
    await assertOwner(photo.user_id);
    await db.runAsync(
      'INSERT INTO local_progress_photos (id,user_id,photo_uri,captured_date,weight_kg,pose,notes,created_at) VALUES (?,?,?,?,?,?,?,?)',
      [
        photo.id,
        photo.user_id,
        stored,
        photo.captured_date,
        photo.weight_kg,
        photo.pose,
        photo.notes,
        new Date().toISOString(),
      ],
    );
  } catch (error) {
    await removePhoto(photo.user_id, stored).catch(() => undefined);
    throw error;
  }
}
export async function deleteProgressPhoto(
  db: SQLiteDatabase,
  owner: string,
  id: string,
): Promise<void> {
  await assertOwner(owner);
  const row = await db.getFirstAsync<ProgressPhoto>(
    'SELECT * FROM local_progress_photos WHERE user_id = ? AND id = ?',
    [owner, id],
  );
  if (!row) return;
  await removePhoto(owner, row.photo_uri);
  await db.runAsync('DELETE FROM local_progress_photos WHERE user_id = ? AND id = ?', [owner, id]);
}
