import {
  calculateDistanceFromStepsKm,
  calculateDistanceFromStepsMeters,
  calculateWalkingCalories,
  deduplicateActivitySources,
  type ActivityDay,
  type ActivitySource,
} from '@calipartner/core';
import { createLogger } from '@/lib/logger';
import { generateClientUuid } from './foodService';
import {
  enqueueOutbox,
  type SyncDb,
} from './syncService';

const log = createLogger('activityService');

export interface RawActivityRow {
  id: string;
  user_id: string;
  local_date: string;
  steps: number;
  distance_m: number;
  source: string;
  active_calories: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

function mapRowToActivityDay(row: RawActivityRow): ActivityDay {
  return {
    id: row.id,
    user_id: row.user_id,
    local_date: row.local_date,
    steps: Number(row.steps),
    distance_m: Number(row.distance_m),
    source: row.source as ActivitySource,
    active_calories: Number(row.active_calories),
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  };
}

/**
 * Fetches the activity record for a specific user and local date.
 */
export async function getActivityDay(
  db: SyncDb,
  userId: string,
  localDate: string,
): Promise<ActivityDay | null> {
  const row = await db.getFirstAsync<RawActivityRow>(
    `SELECT * FROM local_activity_days
     WHERE user_id = ? AND local_date = ? AND deleted_at IS NULL LIMIT 1`,
    [userId, localDate],
  );
  return row ? mapRowToActivityDay(row) : null;
}

/**
 * Upserts a daily activity reading with source de-duplication:
 * Source priority: Health Connect/HealthKit (3) > Pedometer (2) > Manual (1).
 * De-duplicated so steps are never double-counted.
 * Platform-measured distance beats calculated distance.
 * Merge-safe: one row per user per local date.
 */
export async function upsertActivityDay(
  db: SyncDb,
  userId: string,
  input: {
    localDate: string;
    steps: number;
    distanceM?: number | null;
    source: ActivitySource;
    strideLengthCm?: number;
  },
): Promise<ActivityDay> {
  const now = new Date().toISOString();
  const existing = await getActivityDay(db, userId, input.localDate);

  // Apply deterministic priority deduplication
  const dedupeResult = deduplicateActivitySources(existing, {
    steps: input.steps,
    distance_m: input.distanceM ?? null,
    source: input.source,
    strideLengthCm: input.strideLengthCm,
  });

  const recordId = existing?.id ?? generateClientUuid();

  await db.runAsync(
    `INSERT INTO local_activity_days (
      id, user_id, local_date, steps, distance_m, source, active_calories, created_at, updated_at, deleted_at, sync_state
    ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, NULL, 'pending')
    ON CONFLICT (user_id, local_date) DO UPDATE SET
      steps = excluded.steps,
      distance_m = excluded.distance_m,
      source = excluded.source,
      updated_at = excluded.updated_at,
      sync_state = 'pending'`,
    [
      recordId,
      userId,
      input.localDate,
      dedupeResult.steps,
      dedupeResult.distance_m,
      dedupeResult.source,
      now,
      now,
    ],
  );

  await enqueueOutbox(db, {
    id: recordId,
    entity: 'activity_days',
    operation: 'upsert',
    payload: {
      id: recordId,
      user_id: userId,
      local_date: input.localDate,
      steps: dedupeResult.steps,
      distance_m: dedupeResult.distance_m,
      source: dedupeResult.source,
      created_at: existing?.created_at ?? now,
      updated_at: now,
    },
  });

  log.info(
    `Upserted activity for ${userId} on ${input.localDate}: ${dedupeResult.steps} steps (${dedupeResult.source})`,
  );

  return {
    id: recordId,
    user_id: userId,
    local_date: input.localDate,
    steps: dedupeResult.steps,
    distance_m: dedupeResult.distance_m,
    source: dedupeResult.source,
    active_calories: 0,
    created_at: existing?.created_at ?? now,
    updated_at: now,
    deleted_at: null,
  };
}

/**
 * Computes derived metrics from steps & distance:
 * distance in km, walking calories estimate.
 */
export function getActivityMetrics(
  activity: ActivityDay | null,
  userWeightKg = 70,
  userStrideLengthCm = 70,
): {
  steps: number;
  distanceM: number;
  distanceKm: number;
  walkingCalories: number;
  source: ActivitySource | null;
} {
  if (!activity) {
    return {
      steps: 0,
      distanceM: 0,
      distanceKm: 0,
      walkingCalories: 0,
      source: null,
    };
  }

  const distanceM = activity.distance_m > 0
    ? activity.distance_m
    : calculateDistanceFromStepsMeters(activity.steps, userStrideLengthCm);

  const distanceKm = distanceM > 0
    ? Math.round((distanceM / 1000) * 100) / 100
    : calculateDistanceFromStepsKm(activity.steps, userStrideLengthCm);

  const walkingCalories = calculateWalkingCalories(userWeightKg, distanceKm);

  return {
    steps: activity.steps,
    distanceM,
    distanceKm,
    walkingCalories,
    source: activity.source,
  };
}
