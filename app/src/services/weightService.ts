import {
  calculateGoalProgressPercent,
  calculateProjectedDate,
  calculateWeeklyPace,
  calculateWeightTrend,
  type ProjectedDateResult,
  type WeeklyPaceResult,
  type WeightLog,
  type WeightTrendPoint,
} from '@calipartner/core';
import { createLogger } from '@/lib/logger';
import { generateClientUuid } from './foodService';
import { enqueueOutbox, type SyncDb } from './syncService';

const log = createLogger('weightService');

function validWeightDate(date: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(Date.parse(date)) &&
    new Date(date).toISOString().slice(0, 10) === date
  );
}

async function persistWeightMutation(db: SyncDb, work: () => Promise<void>) {
  const transactional = db as SyncDb & {
    withTransactionAsync?: (work: () => Promise<void>) => Promise<void>;
  };
  if (transactional.withTransactionAsync) await transactional.withTransactionAsync(work);
  else await work();
}

export interface RawWeightRow {
  id: string;
  user_id: string;
  weight_kg: number;
  logged_at: string;
  local_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

function mapRowToWeightLog(row: RawWeightRow): WeightLog {
  return {
    id: row.id,
    user_id: row.user_id,
    weight_kg: Number(row.weight_kg),
    logged_at: row.logged_at,
    local_date: row.local_date,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  };
}

/**
 * Logs or backdates a weight entry with offline idempotency and sync outbox queue.
 */
export async function logWeight(
  db: SyncDb,
  userId: string,
  weightKg: number,
  localDate?: string,
  loggedAt?: string,
  notes?: string | null,
): Promise<WeightLog> {
  if (!Number.isFinite(weightKg) || weightKg < 20 || weightKg > 500)
    throw new Error('INVALID_WEIGHT');
  const now = new Date().toISOString();
  const id = generateClientUuid();
  const date = localDate ?? now.split('T')[0]!;
  if (!validWeightDate(date)) throw new Error('INVALID_DATE');
  const time = loggedAt ?? now;

  const persist = async () => {
    await db.runAsync(
      `INSERT INTO local_weight_logs (
      id, user_id, weight_kg, logged_at, local_date, notes, created_at, updated_at, deleted_at, sync_state
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 'pending')`,
      [id, userId, weightKg, time, date, notes ?? null, now, now],
    );

    await enqueueOutbox(db, {
      id,
      entity: 'weight_logs',
      operation: 'upsert',
      payload: {
        id,
        user_id: userId,
        weight_kg: weightKg,
        logged_at: time,
        local_date: date,
        notes: notes ?? null,
        created_at: now,
        updated_at: now,
      },
    });
  };
  await persistWeightMutation(db, persist);

  log.info('Weight entry saved locally');
  return {
    id,
    user_id: userId,
    weight_kg: weightKg,
    logged_at: time,
    local_date: date,
    notes: notes ?? null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
}

/**
 * Returns all active weight logs for a user sorted by date descending.
 */
export async function getWeightLogs(db: SyncDb, userId: string, limit = 100): Promise<WeightLog[]> {
  const rows = await db.getAllAsync<RawWeightRow>(
    `SELECT * FROM local_weight_logs
     WHERE user_id = ? AND deleted_at IS NULL
     ORDER BY local_date DESC, logged_at DESC
     LIMIT ?`,
    [userId, limit],
  );
  // Earlier Log-menu saves interchanged notes and date. Recover the original date and reuse
  // the existing UUID so failed offline uploads can retry without creating another weigh-in.
  for (const row of rows) {
    if (validWeightDate(row.local_date) || !row.notes || !validWeightDate(row.notes)) continue;
    const repaired = {
      ...row,
      local_date: row.notes,
      notes: row.local_date,
      updated_at: new Date().toISOString(),
    };
    await persistWeightMutation(db, async () => {
      await db.runAsync(
        "UPDATE local_weight_logs SET local_date = ?, notes = ?, updated_at = ?, sync_state = 'pending' WHERE id = ? AND user_id = ?",
        [repaired.local_date, repaired.notes, repaired.updated_at, row.id, userId],
      );
      await enqueueOutbox(db, {
        id: row.id,
        entity: 'weight_logs',
        operation: 'upsert',
        payload: { ...mapRowToWeightLog(repaired) },
      });
      await db.runAsync('UPDATE outbox SET attempts = ?, last_error = ? WHERE id = ?', [
        0,
        null,
        row.id,
      ]);
    });
    Object.assign(row, repaired);
  }
  rows.sort(
    (a, b) => b.local_date.localeCompare(a.local_date) || b.logged_at.localeCompare(a.logged_at),
  );
  return rows.map(mapRowToWeightLog);
}

/**
 * Computes weight trend summary: latest raw, 7-day moving average trend,
 * weekly pace, projected date to target, and goal progress %.
 */
export async function getWeightSummary(
  db: SyncDb,
  userId: string,
  profile?: {
    startingWeightKg?: number;
    targetWeightKg?: number | null;
  },
): Promise<{
  latestLog: WeightLog | null;
  latestTrendKg: number | null;
  trendHistory: WeightTrendPoint[];
  weeklyPace: WeeklyPaceResult;
  projection: ProjectedDateResult;
  goalProgressPercent: number;
}> {
  const logs = await getWeightLogs(db, userId, 365);
  if (logs.length === 0) {
    return {
      latestLog: null,
      latestTrendKg: null,
      trendHistory: [],
      weeklyPace: { weeklyPaceKg: null, daysSpan: 0 },
      projection: { projectedDate: null, weeksRemaining: null, reason: 'not_enough_trend' },
      goalProgressPercent: 0,
    };
  }

  // Convert to points { date, weightKg } sorted ascending
  const entries = logs
    .map((l) => ({ date: l.local_date, weightKg: l.weight_kg }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const trendHistory = calculateWeightTrend(entries);
  const latestTrend = trendHistory[trendHistory.length - 1]!;
  const latestLog = logs[0]!;

  const weeklyPace = calculateWeeklyPace(trendHistory);

  const today = new Date().toISOString().split('T')[0]!;
  const targetWeight = profile?.targetWeightKg ?? null;

  const projection =
    targetWeight != null
      ? calculateProjectedDate({
          currentTrendKg: latestTrend.trendWeightKg,
          targetWeightKg: targetWeight,
          weeklyPaceKg: weeklyPace.weeklyPaceKg,
          todayDate: today,
        })
      : { projectedDate: null, weeksRemaining: null, reason: 'not_enough_trend' as const };

  const startWeight =
    profile?.startingWeightKg ?? entries[0]?.weightKg ?? latestTrend.trendWeightKg;
  const goalProgressPercent =
    targetWeight != null
      ? calculateGoalProgressPercent(startWeight, latestTrend.trendWeightKg, targetWeight)
      : 0;

  return {
    latestLog,
    latestTrendKg: latestTrend.trendWeightKg,
    trendHistory,
    weeklyPace,
    projection,
    goalProgressPercent,
  };
}

/**
 * Edits an existing weight log entry.
 */
export async function editWeightLog(
  db: SyncDb,
  userId: string,
  id: string,
  weightKg: number,
  notes?: string | null,
): Promise<WeightLog | null> {
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE local_weight_logs SET
       weight_kg = ?,
       notes = ?,
       updated_at = ?,
       sync_state = 'pending'
     WHERE id = ? AND user_id = ?`,
    [weightKg, notes ?? null, now, id, userId],
  );

  const row = await db.getFirstAsync<RawWeightRow>(
    `SELECT * FROM local_weight_logs WHERE id = ? AND user_id = ?`,
    [id, userId],
  );

  if (!row) return null;

  await enqueueOutbox(db, {
    id,
    entity: 'weight_logs',
    operation: 'upsert',
    payload: {
      id,
      user_id: userId,
      weight_kg: weightKg,
      logged_at: row.logged_at,
      local_date: row.local_date,
      notes: notes ?? null,
      created_at: row.created_at,
      updated_at: now,
    },
  });

  return mapRowToWeightLog(row);
}

/**
 * Soft deletes a weight log entry.
 */
export async function deleteWeightLog(
  db: SyncDb,
  userId: string,
  id: string,
): Promise<WeightLog | null> {
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE local_weight_logs SET
       deleted_at = ?,
       updated_at = ?,
       sync_state = 'pending'
     WHERE id = ? AND user_id = ?`,
    [now, now, id, userId],
  );

  const row = await db.getFirstAsync<RawWeightRow>(
    `SELECT * FROM local_weight_logs WHERE id = ? AND user_id = ?`,
    [id, userId],
  );

  if (!row) return null;

  await enqueueOutbox(db, {
    id,
    entity: 'weight_logs',
    operation: 'delete',
    payload: { id, user_id: userId, deleted_at: now, updated_at: now },
  });

  return mapRowToWeightLog(row);
}
