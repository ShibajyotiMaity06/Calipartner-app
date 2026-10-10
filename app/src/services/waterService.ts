import {
  calculateDefaultWaterGoalMl,
  type WaterLog,
} from '@calipartner/core';
import { createLogger } from '@/lib/logger';
import { generateClientUuid } from './foodService';
import {
  enqueueOutbox,
  type SyncDb,
} from './syncService';

const log = createLogger('waterService');

export interface RawWaterRow {
  id: string;
  user_id: string;
  amount_ml: number;
  logged_at: string;
  local_date: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

function mapRowToWaterLog(row: RawWaterRow): WaterLog {
  return {
    id: row.id,
    user_id: row.user_id,
    amount_ml: Number(row.amount_ml),
    logged_at: row.logged_at,
    local_date: row.local_date,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  };
}

/**
 * Logs a water intake entry with idempotent client UUID and sync outbox queue.
 */
export async function logWater(
  db: SyncDb,
  userId: string,
  amountMl: number,
  localDate?: string,
  loggedAt?: string,
): Promise<WaterLog> {
  const now = new Date().toISOString();
  const id = generateClientUuid();
  const date = localDate ?? now.split('T')[0]!;
  const time = loggedAt ?? now;

  await db.runAsync(
    `INSERT INTO local_water_logs (
      id, user_id, amount_ml, logged_at, local_date, created_at, updated_at, deleted_at, sync_state
    ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 'pending')`,
    [id, userId, amountMl, time, date, now, now],
  );

  await enqueueOutbox(db, {
    id,
    entity: 'water_logs',
    operation: 'upsert',
    payload: {
      id,
      user_id: userId,
      amount_ml: amountMl,
      logged_at: time,
      local_date: date,
      created_at: now,
      updated_at: now,
    },
  });

  log.info(`Logged ${amountMl} ml water for ${userId} on ${date}`);
  return {
    id,
    user_id: userId,
    amount_ml: amountMl,
    logged_at: time,
    local_date: date,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
}

/**
 * Returns all active water entries for a user and date.
 */
export async function getWaterLogsForDate(
  db: SyncDb,
  userId: string,
  localDate: string,
): Promise<WaterLog[]> {
  const rows = await db.getAllAsync<RawWaterRow>(
    `SELECT * FROM local_water_logs
     WHERE user_id = ? AND local_date = ? AND deleted_at IS NULL
     ORDER BY logged_at ASC`,
    [userId, localDate],
  );
  return rows.map(mapRowToWaterLog);
}

/**
 * Returns total water consumed in ml for a date.
 */
export async function getWaterTotalForDate(
  db: SyncDb,
  userId: string,
  localDate: string,
): Promise<number> {
  const row = await db.getFirstAsync<{ total: number | null }>(
    `SELECT SUM(amount_ml) as total FROM local_water_logs
     WHERE user_id = ? AND local_date = ? AND deleted_at IS NULL`,
    [userId, localDate],
  );
  return row?.total ? Number(row.total) : 0;
}

/**
 * Undoes the last active water log for a date.
 */
export async function undoLastWaterLog(
  db: SyncDb,
  userId: string,
  localDate: string,
): Promise<WaterLog | null> {
  const last = await db.getFirstAsync<RawWaterRow>(
    `SELECT * FROM local_water_logs
     WHERE user_id = ? AND local_date = ? AND deleted_at IS NULL
     ORDER BY logged_at DESC, rowid DESC
     LIMIT 1`,
    [userId, localDate],
  );

  if (!last) return null;

  return deleteWaterLog(db, userId, last.id);
}

/**
 * Edits an existing water log entry.
 */
export async function editWaterLog(
  db: SyncDb,
  userId: string,
  id: string,
  amountMl: number,
): Promise<WaterLog | null> {
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE local_water_logs SET
       amount_ml = ?,
       updated_at = ?,
       sync_state = 'pending'
     WHERE id = ? AND user_id = ?`,
    [amountMl, now, id, userId],
  );

  const row = await db.getFirstAsync<RawWaterRow>(
    `SELECT * FROM local_water_logs WHERE id = ? AND user_id = ?`,
    [id, userId],
  );

  if (!row) return null;

  await enqueueOutbox(db, {
    id,
    entity: 'water_logs',
    operation: 'upsert',
    payload: {
      id,
      user_id: userId,
      amount_ml: amountMl,
      logged_at: row.logged_at,
      local_date: row.local_date,
      created_at: row.created_at,
      updated_at: now,
    },
  });

  return mapRowToWaterLog(row);
}

/**
 * Soft deletes a water log entry.
 */
export async function deleteWaterLog(
  db: SyncDb,
  userId: string,
  id: string,
): Promise<WaterLog | null> {
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE local_water_logs SET
       deleted_at = ?,
       updated_at = ?,
       sync_state = 'pending'
     WHERE id = ? AND user_id = ?`,
    [now, now, id, userId],
  );

  const row = await db.getFirstAsync<RawWaterRow>(
    `SELECT * FROM local_water_logs WHERE id = ? AND user_id = ?`,
    [id, userId],
  );

  if (!row) return null;

  await enqueueOutbox(db, {
    id,
    entity: 'water_logs',
    operation: 'delete',
    payload: { id, user_id: userId, deleted_at: now, updated_at: now },
  });

  return mapRowToWaterLog(row);
}

/**
 * Computes water progress and goal adherence.
 */
export function getWaterProgress(
  totalMl: number,
  goalMl: number,
): { progressPercent: number; remainingMl: number } {
  const progressPercent = goalMl > 0 ? Math.min(100, Math.round((totalMl / goalMl) * 100)) : 0;
  const remainingMl = Math.max(0, goalMl - totalMl);
  return { progressPercent, remainingMl };
}

export { calculateDefaultWaterGoalMl };
