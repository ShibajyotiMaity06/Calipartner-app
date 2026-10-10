import { createLogger } from '@/lib/logger';

const log = createLogger('syncService');

export type SyncState = 'synced' | 'pending' | 'failed';
export type OutboxStatus = 'pending' | 'in_flight' | 'failed';
export type OutboxOperation = 'upsert' | 'delete';

export interface OutboxItem {
  id: string;
  entity: string;
  operation: OutboxOperation;
  payload: Record<string, unknown>;
  created_at: string;
  attempts: number;
  last_error: string | null;
  status: OutboxStatus;
  next_retry_at: string | null;
  updated_at: string | null;
}

export interface SyncDb {
  runAsync(sql: string, ...params: unknown[]): Promise<unknown>;
  getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null>;
}

export interface SupabaseSyncClient {
  from(table: string): {
    upsert(
      values: Record<string, unknown> | Array<Record<string, unknown>>,
      options?: { onConflict?: string },
    ): PromiseLike<{ error: Error | null; data?: unknown }>;
    update(values: Record<string, unknown>): {
      eq(column: string, value: unknown): PromiseLike<{ error: Error | null }>;
    };
    select(columns?: string): {
      gt(column: string, value: unknown): {
        order(
          column: string,
          options?: { ascending?: boolean },
        ): PromiseLike<{ error: Error | null; data: Array<Record<string, unknown>> | null }>;
      };
      order(
        column: string,
        options?: { ascending?: boolean },
      ): PromiseLike<{ error: Error | null; data: Array<Record<string, unknown>> | null }>;
    };
  };
}

export const MAX_SYNC_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 60000;

/**
 * Calculates exponential backoff delay in ms based on attempt count.
 */
export function calculateBackoffMs(attempt: number): number {
  const exp = Math.min(attempt, 6);
  const backoff = BASE_BACKOFF_MS * Math.pow(2, exp);
  return Math.min(backoff, MAX_BACKOFF_MS);
}

/**
 * Recovers stuck 'in_flight' records to 'pending' upon app launch or sync init.
 * Ensures crash resilience if the app was killed mid-sync.
 */
export async function recoverInFlightOutbox(db: SyncDb): Promise<number> {
  const now = new Date().toISOString();
  const res = (await db.runAsync(
    `UPDATE outbox SET status = 'pending', updated_at = ? WHERE status = 'in_flight'`,
    [now],
  )) as { changes?: number };
  const recovered = res?.changes ?? 0;
  if (recovered > 0) {
    log.info(`Recovered ${recovered} stuck in_flight outbox items to pending`);
  }
  return recovered;
}

/**
 * Enqueues an entity operation into the SQLite outbox and marks the local item pending.
 */
export async function enqueueOutbox(
  db: SyncDb,
  item: {
    id: string;
    entity: string;
    operation: OutboxOperation;
    payload: Record<string, unknown>;
  },
): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO outbox (id, entity, operation, payload, created_at, attempts, last_error, status, next_retry_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, NULL, 'pending', NULL, ?)
     ON CONFLICT (id) DO UPDATE SET
       payload = excluded.payload,
       operation = excluded.operation,
       status = 'pending',
       updated_at = excluded.updated_at`,
    [item.id, item.entity, item.operation, JSON.stringify(item.payload), now, now],
  );
}

/**
 * Reads pending outbox items that are ready to be sent (now >= next_retry_at).
 */
export async function getPendingOutboxItems(
  db: SyncDb,
  limit = 50,
): Promise<OutboxItem[]> {
  const nowIso = new Date().toISOString();
  const rows = await db.getAllAsync<{
    id: string;
    entity: string;
    operation: string;
    payload: string;
    created_at: string;
    attempts: number;
    last_error: string | null;
    status: string;
    next_retry_at: string | null;
    updated_at: string | null;
  }>(
    `SELECT id, entity, operation, payload, created_at, attempts, last_error, status, next_retry_at, updated_at
     FROM outbox
     WHERE status = 'pending' AND (next_retry_at IS NULL OR next_retry_at <= ?)
     ORDER BY created_at ASC
     LIMIT ?`,
    [nowIso, limit],
  );

  return rows.map((r) => ({
    id: r.id,
    entity: r.entity,
    operation: r.operation as OutboxOperation,
    payload: JSON.parse(r.payload),
    created_at: r.created_at,
    attempts: r.attempts,
    last_error: r.last_error,
    status: r.status as OutboxStatus,
    next_retry_at: r.next_retry_at,
    updated_at: r.updated_at,
  }));
}

/**
 * Maps entity name to corresponding local mirror table.
 */
function getLocalTableName(entity: string): string | null {
  switch (entity) {
    case 'food_entries':
      return 'local_food_entries';
    case 'user_food_stats':
      return 'local_user_food_stats';
    case 'foods':
      return 'local_foods';
    case 'saved_meals':
      return 'local_saved_meals';
    case 'water_logs':
      return 'local_water_logs';
    case 'weight_logs':
      return 'local_weight_logs';
    case 'activity_days':
      return 'local_activity_days';
    case 'exercises':
      return 'local_exercises';
    case 'workouts':
      return 'local_workouts';
    case 'workout_exercises':
      return 'local_workout_exercises';
    case 'workout_sets':
      return 'local_workout_sets';
    default:
      return null;
  }
}

/**
 * Flushes all pending outbox items to Supabase.
 * Executes idempotent upserts and updates sync_state locally.
 */
export async function flushOutbox(
  db: SyncDb,
  supabase: SupabaseSyncClient,
  limit = 50,
): Promise<{ processed: number; succeeded: number; failed: number }> {
  const items = await getPendingOutboxItems(db, limit);
  if (items.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  let succeeded = 0;
  let failed = 0;

  for (const item of items) {
    // 1. Mark as in_flight
    const flightTime = new Date().toISOString();
    await db.runAsync(
      `UPDATE outbox SET status = 'in_flight', updated_at = ? WHERE id = ?`,
      [flightTime, item.id],
    );

    try {
      // 2. Perform operation on Supabase
      if (item.operation === 'delete') {
        const { error } = await supabase
          .from(item.entity)
          .update({ deleted_at: flightTime })
          .eq('id', item.id);
        if (error) throw error;
      } else {
        // Upsert by primary key (id, user_id+food_id, or user_id+local_date)
        const onConflict =
          item.entity === 'user_food_stats'
            ? 'user_id,food_id'
            : item.entity === 'activity_days'
              ? 'user_id,local_date'
              : 'id';
        const { error } = await supabase.from(item.entity).upsert(item.payload, { onConflict });
        if (error) throw error;
      }

      // 3. Mark succeeded locally: delete from outbox and update local sync_state to 'synced'
      await db.runAsync(`DELETE FROM outbox WHERE id = ?`, [item.id]);

      const localTable = getLocalTableName(item.entity);
      if (localTable) {
        if (item.entity === 'user_food_stats') {
          await db.runAsync(
            `UPDATE ${localTable} SET sync_state = 'synced' WHERE user_id = ? AND food_id = ?`,
            [item.payload.user_id, item.payload.food_id],
          );
        } else if (item.entity === 'activity_days') {
          await db.runAsync(
            `UPDATE ${localTable} SET sync_state = 'synced' WHERE user_id = ? AND local_date = ?`,
            [item.payload.user_id, item.payload.local_date],
          );
        } else {
          await db.runAsync(
            `UPDATE ${localTable} SET sync_state = 'synced' WHERE id = ?`,
            [item.id],
          );
        }
      }

      succeeded += 1;
    } catch (err: unknown) {
      failed += 1;
      const nextAttempt = item.attempts + 1;
      const errorMessage = err instanceof Error ? err.message : String(err);
      const isPermanentlyFailed = nextAttempt >= MAX_SYNC_ATTEMPTS;
      const backoffMs = calculateBackoffMs(nextAttempt);
      const nextRetryAt = new Date(Date.now() + backoffMs).toISOString();

      await db.runAsync(
        `UPDATE outbox SET
           status = ?,
           attempts = ?,
           last_error = ?,
           next_retry_at = ?,
           updated_at = ?
         WHERE id = ?`,
        [
          isPermanentlyFailed ? 'failed' : 'pending',
          nextAttempt,
          errorMessage,
          isPermanentlyFailed ? null : nextRetryAt,
          new Date().toISOString(),
          item.id,
        ],
      );

      const localTable = getLocalTableName(item.entity);
      if (localTable && isPermanentlyFailed) {
        if (item.entity === 'user_food_stats') {
          await db.runAsync(
            `UPDATE ${localTable} SET sync_state = 'failed' WHERE user_id = ? AND food_id = ?`,
            [item.payload.user_id, item.payload.food_id],
          );
        } else {
          await db.runAsync(
            `UPDATE ${localTable} SET sync_state = 'failed' WHERE id = ?`,
            [item.id],
          );
        }
      }
    }
  }

  return { processed: items.length, succeeded, failed };
}

/**
 * Gets the last pulled timestamp for an entity.
 */
export async function getSyncCursor(db: SyncDb, entity: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ last_pulled_at: string }>(
    `SELECT last_pulled_at FROM sync_cursors WHERE entity = ?`,
    [entity],
  );
  return row ? row.last_pulled_at : null;
}

/**
 * Sets the last pulled timestamp for an entity.
 */
export async function setSyncCursor(
  db: SyncDb,
  entity: string,
  pulledAt: string,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO sync_cursors (entity, last_pulled_at) VALUES (?, ?)
     ON CONFLICT (entity) DO UPDATE SET last_pulled_at = excluded.last_pulled_at`,
    [entity, pulledAt],
  );
}

/**
 * Pulls remote delta updates since the last sync cursor, applying Last-Write-Wins.
 */
export async function pullEntityDelta(
  db: SyncDb,
  supabase: SupabaseSyncClient,
  entity: string,
): Promise<{ pulledCount: number; cursorUpdated: string | null }> {
  const cursor = await getSyncCursor(db, entity);

  const queryBuilder = supabase.from(entity).select('*');
  let result;
  if (cursor) {
    result = await queryBuilder.gt('updated_at', cursor).order('updated_at', { ascending: true });
  } else {
    result = await queryBuilder.order('updated_at', { ascending: true });
  }

  if (result.error) throw result.error;
  const remoteRows: Array<Record<string, unknown>> = result.data || [];

  if (remoteRows.length === 0) {
    return { pulledCount: 0, cursorUpdated: cursor };
  }

  let latestRemoteUpdated = cursor;

  for (const row of remoteRows) {
    const remoteUpdated = (typeof row.updated_at === 'string' ? row.updated_at : null) || new Date().toISOString();
    if (!latestRemoteUpdated || remoteUpdated > latestRemoteUpdated) {
      latestRemoteUpdated = remoteUpdated;
    }

    if (entity === 'food_entries') {
      const local = await db.getFirstAsync<{ updated_at: string; sync_state: string }>(
        `SELECT updated_at, sync_state FROM local_food_entries WHERE id = ?`,
        [String(row.id)],
      );

      // Last write wins:
      // If local does not exist OR local is not pending OR remote is newer than local:
      if (!local || local.sync_state !== 'pending' || remoteUpdated > local.updated_at) {
        await db.runAsync(
          `INSERT INTO local_food_entries (
            id, user_id, food_id, meal_section, quantity, unit,
            calories, protein, carbs, fat, fiber, sugar, sodium_mg,
            food_name, brand_name, logged_at, local_date, source,
            shared_meal_id, created_at, updated_at, deleted_at, sync_state
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')
          ON CONFLICT (id) DO UPDATE SET
            user_id = excluded.user_id,
            food_id = excluded.food_id,
            meal_section = excluded.meal_section,
            quantity = excluded.quantity,
            unit = excluded.unit,
            calories = excluded.calories,
            protein = excluded.protein,
            carbs = excluded.carbs,
            fat = excluded.fat,
            fiber = excluded.fiber,
            sugar = excluded.sugar,
            sodium_mg = excluded.sodium_mg,
            food_name = excluded.food_name,
            brand_name = excluded.brand_name,
            logged_at = excluded.logged_at,
            local_date = excluded.local_date,
            source = excluded.source,
            shared_meal_id = excluded.shared_meal_id,
            updated_at = excluded.updated_at,
            deleted_at = excluded.deleted_at,
            sync_state = 'synced'`,
          [
            row.id,
            row.user_id,
            row.food_id ?? null,
            row.meal_section,
            row.quantity,
            row.unit,
            row.calories,
            row.protein,
            row.carbs,
            row.fat,
            row.fiber ?? 0,
            row.sugar ?? 0,
            row.sodium_mg ?? 0,
            row.food_name,
            row.brand_name ?? null,
            row.logged_at,
            row.local_date,
            row.source,
            row.shared_meal_id ?? null,
            row.created_at ?? row.logged_at,
            row.updated_at,
            row.deleted_at ?? null,
          ],
        );
      }
    } else if (entity === 'user_food_stats') {
      const local = await db.getFirstAsync<{ updated_at: string; sync_state: string }>(
        `SELECT updated_at, sync_state FROM local_user_food_stats WHERE user_id = ? AND food_id = ?`,
        [row.user_id, row.food_id],
      );

      if (!local || local.sync_state !== 'pending' || remoteUpdated > local.updated_at) {
        await db.runAsync(
          `INSERT INTO local_user_food_stats (
            user_id, food_id, use_count, last_used_at, last_quantity, last_unit, last_meal_section, hidden, updated_at, sync_state
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')
          ON CONFLICT (user_id, food_id) DO UPDATE SET
            use_count = excluded.use_count,
            last_used_at = excluded.last_used_at,
            last_quantity = excluded.last_quantity,
            last_unit = excluded.last_unit,
            last_meal_section = excluded.last_meal_section,
            hidden = excluded.hidden,
            updated_at = excluded.updated_at,
            sync_state = 'synced'`,
          [
            row.user_id,
            row.food_id,
            row.use_count,
            row.last_used_at,
            row.last_quantity,
            row.last_unit,
            row.last_meal_section,
            row.hidden ? 1 : 0,
            row.updated_at,
          ],
        );
      }
    } else if (entity === 'foods') {
      // Custom foods created by owner or synced foods
      const unitsJson = typeof row.serving_units === 'string' ? row.serving_units : JSON.stringify(row.serving_units ?? []);
      await db.runAsync(
        `INSERT INTO local_foods (
          id, source, name, brand, barcode, serving_units,
          calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g,
          fiber_per_100g, sugar_per_100g, sodium_mg_per_100g,
          owner_id, attribution, created_at, updated_at, deleted_at, sync_state
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')
        ON CONFLICT (id) DO UPDATE SET
          name = excluded.name,
          brand = excluded.brand,
          barcode = excluded.barcode,
          serving_units = excluded.serving_units,
          calories_per_100g = excluded.calories_per_100g,
          protein_per_100g = excluded.protein_per_100g,
          carbs_per_100g = excluded.carbs_per_100g,
          fat_per_100g = excluded.fat_per_100g,
          fiber_per_100g = excluded.fiber_per_100g,
          sugar_per_100g = excluded.sugar_per_100g,
          sodium_mg_per_100g = excluded.sodium_mg_per_100g,
          attribution = excluded.attribution,
          updated_at = excluded.updated_at,
          deleted_at = excluded.deleted_at,
          sync_state = 'synced'`,
        [
          row.id,
          row.source,
          row.name,
          row.brand ?? null,
          row.barcode ?? null,
          unitsJson,
          row.calories_per_100g,
          row.protein_per_100g,
          row.carbs_per_100g,
          row.fat_per_100g,
          row.fiber_per_100g ?? 0,
          row.sugar_per_100g ?? 0,
          row.sodium_mg_per_100g ?? 0,
          row.owner_id ?? null,
          row.attribution ?? null,
          row.created_at ?? new Date().toISOString(),
          row.updated_at,
          row.deleted_at ?? null,
        ],
      );
    } else if (entity === 'water_logs') {
      await db.runAsync(
        `INSERT INTO local_water_logs (
          id, user_id, amount_ml, logged_at, local_date, created_at, updated_at, deleted_at, sync_state
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'synced')
        ON CONFLICT (id) DO UPDATE SET
          amount_ml = excluded.amount_ml,
          logged_at = excluded.logged_at,
          local_date = excluded.local_date,
          updated_at = excluded.updated_at,
          deleted_at = excluded.deleted_at,
          sync_state = 'synced'`,
        [
          row.id,
          row.user_id,
          row.amount_ml,
          row.logged_at,
          row.local_date,
          row.created_at ?? row.logged_at,
          row.updated_at,
          row.deleted_at ?? null,
        ],
      );
    } else if (entity === 'weight_logs') {
      await db.runAsync(
        `INSERT INTO local_weight_logs (
          id, user_id, weight_kg, logged_at, local_date, notes, created_at, updated_at, deleted_at, sync_state
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')
        ON CONFLICT (id) DO UPDATE SET
          weight_kg = excluded.weight_kg,
          logged_at = excluded.logged_at,
          local_date = excluded.local_date,
          notes = excluded.notes,
          updated_at = excluded.updated_at,
          deleted_at = excluded.deleted_at,
          sync_state = 'synced'`,
        [
          row.id,
          row.user_id,
          row.weight_kg,
          row.logged_at,
          row.local_date,
          row.notes ?? null,
          row.created_at ?? row.logged_at,
          row.updated_at,
          row.deleted_at ?? null,
        ],
      );
    } else if (entity === 'activity_days') {
      await db.runAsync(
        `INSERT INTO local_activity_days (
          id, user_id, local_date, steps, distance_m, source, active_calories, created_at, updated_at, deleted_at, sync_state
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')
        ON CONFLICT (user_id, local_date) DO UPDATE SET
          steps = excluded.steps,
          distance_m = excluded.distance_m,
          source = excluded.source,
          active_calories = excluded.active_calories,
          updated_at = excluded.updated_at,
          deleted_at = excluded.deleted_at,
          sync_state = 'synced'`,
        [
          row.id,
          row.user_id,
          row.local_date,
          row.steps,
          row.distance_m ?? 0,
          row.source,
          row.active_calories ?? 0,
          row.created_at ?? new Date().toISOString(),
          row.updated_at,
          row.deleted_at ?? null,
        ],
      );
    } else if (entity === 'exercises') {
      await db.runAsync(
        `INSERT INTO local_exercises (
          id, name, muscle_group, equipment, type, owner_id, attribution, created_at, updated_at, deleted_at, sync_state
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')
        ON CONFLICT (id) DO UPDATE SET
          name = excluded.name,
          muscle_group = excluded.muscle_group,
          equipment = excluded.equipment,
          type = excluded.type,
          owner_id = excluded.owner_id,
          attribution = excluded.attribution,
          updated_at = excluded.updated_at,
          deleted_at = excluded.deleted_at,
          sync_state = 'synced'`,
        [
          row.id,
          row.name,
          row.muscle_group,
          row.equipment,
          row.type,
          row.owner_id ?? null,
          row.attribution ?? null,
          row.created_at ?? new Date().toISOString(),
          row.updated_at,
          row.deleted_at ?? null,
        ],
      );
    } else if (entity === 'workouts') {
      await db.runAsync(
        `INSERT INTO local_workouts (
          id, user_id, type, name, start_time, duration_minutes, local_date, notes, effort_rating, created_at, updated_at, deleted_at, sync_state
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')
        ON CONFLICT (id) DO UPDATE SET
          user_id = excluded.user_id,
          type = excluded.type,
          name = excluded.name,
          start_time = excluded.start_time,
          duration_minutes = excluded.duration_minutes,
          local_date = excluded.local_date,
          notes = excluded.notes,
          effort_rating = excluded.effort_rating,
          updated_at = excluded.updated_at,
          deleted_at = excluded.deleted_at,
          sync_state = 'synced'`,
        [
          row.id,
          row.user_id,
          row.type,
          row.name ?? null,
          row.start_time ?? null,
          row.duration_minutes ?? 0,
          row.local_date,
          row.notes ?? null,
          row.effort_rating ?? null,
          row.created_at ?? new Date().toISOString(),
          row.updated_at,
          row.deleted_at ?? null,
        ],
      );
    } else if (entity === 'workout_exercises') {
      await db.runAsync(
        `INSERT INTO local_workout_exercises (
          id, workout_id, user_id, exercise_id, exercise_name, order_in_workout, notes, created_at, updated_at, deleted_at, sync_state
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')
        ON CONFLICT (id) DO UPDATE SET
          workout_id = excluded.workout_id,
          user_id = excluded.user_id,
          exercise_id = excluded.exercise_id,
          exercise_name = excluded.exercise_name,
          order_in_workout = excluded.order_in_workout,
          notes = excluded.notes,
          updated_at = excluded.updated_at,
          deleted_at = excluded.deleted_at,
          sync_state = 'synced'`,
        [
          row.id,
          row.workout_id,
          row.user_id,
          row.exercise_id ?? null,
          row.exercise_name,
          row.order_in_workout ?? 0,
          row.notes ?? null,
          row.created_at ?? new Date().toISOString(),
          row.updated_at,
          row.deleted_at ?? null,
        ],
      );
    } else if (entity === 'workout_sets') {
      await db.runAsync(
        `INSERT INTO local_workout_sets (
          id, workout_exercise_id, workout_id, user_id, set_number, reps, weight_kg, duration_seconds, distance_meters, is_warmup, completed, created_at, updated_at, deleted_at, sync_state
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')
        ON CONFLICT (id) DO UPDATE SET
          workout_exercise_id = excluded.workout_exercise_id,
          workout_id = excluded.workout_id,
          user_id = excluded.user_id,
          set_number = excluded.set_number,
          reps = excluded.reps,
          weight_kg = excluded.weight_kg,
          duration_seconds = excluded.duration_seconds,
          distance_meters = excluded.distance_meters,
          is_warmup = excluded.is_warmup,
          completed = excluded.completed,
          updated_at = excluded.updated_at,
          deleted_at = excluded.deleted_at,
          sync_state = 'synced'`,
        [
          row.id,
          row.workout_exercise_id,
          row.workout_id,
          row.user_id,
          row.set_number ?? 1,
          row.reps ?? null,
          row.weight_kg ?? null,
          row.duration_seconds ?? null,
          row.distance_meters ?? null,
          row.is_warmup ? 1 : 0,
          row.completed ? 1 : 0,
          row.created_at ?? new Date().toISOString(),
          row.updated_at,
          row.deleted_at ?? null,
        ],
      );
    }
  }

  if (latestRemoteUpdated) {
    await setSyncCursor(db, entity, latestRemoteUpdated);
  }

  return { pulledCount: remoteRows.length, cursorUpdated: latestRemoteUpdated };
}

/**
 * High-level sync function: flushes outbox (push), then pulls latest deltas.
 */
export async function syncAll(
  db: SyncDb,
  supabase: SupabaseSyncClient,
): Promise<{
  pushResult: { processed: number; succeeded: number; failed: number };
  pulledEntries: number;
  pulledStats: number;
  pulledFoods: number;
  pulledWater: number;
  pulledWeight: number;
  pulledActivity: number;
  pulledExercises: number;
  pulledWorkouts: number;
  pulledWorkoutExercises: number;
  pulledWorkoutSets: number;
}> {
  await recoverInFlightOutbox(db);

  // 1. Push pending local changes
  const pushResult = await flushOutbox(db, supabase);

  // 2. Pull remote changes
  const pullEntries = await pullEntityDelta(db, supabase, 'food_entries');
  const pullStats = await pullEntityDelta(db, supabase, 'user_food_stats');
  const pullFoods = await pullEntityDelta(db, supabase, 'foods');
  const pullWater = await pullEntityDelta(db, supabase, 'water_logs');
  const pullWeight = await pullEntityDelta(db, supabase, 'weight_logs');
  const pullActivity = await pullEntityDelta(db, supabase, 'activity_days');
  const pullExercises = await pullEntityDelta(db, supabase, 'exercises');
  const pullWorkouts = await pullEntityDelta(db, supabase, 'workouts');
  const pullWorkoutExercises = await pullEntityDelta(db, supabase, 'workout_exercises');
  const pullWorkoutSets = await pullEntityDelta(db, supabase, 'workout_sets');

  return {
    pushResult,
    pulledEntries: pullEntries.pulledCount,
    pulledStats: pullStats.pulledCount,
    pulledFoods: pullFoods.pulledCount,
    pulledWater: pullWater.pulledCount,
    pulledWeight: pullWeight.pulledCount,
    pulledActivity: pullActivity.pulledCount,
    pulledExercises: pullExercises.pulledCount,
    pulledWorkouts: pullWorkouts.pulledCount,
    pulledWorkoutExercises: pullWorkoutExercises.pulledCount,
    pulledWorkoutSets: pullWorkoutSets.pulledCount,
  };
}

/**
 * Returns overall pending outbox count and status summary.
 */
export async function getSyncStatus(
  db: SyncDb,
): Promise<{ pendingCount: number; failedCount: number }> {
  const pendingRow = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM outbox WHERE status = 'pending'`,
  );
  const failedRow = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM outbox WHERE status = 'failed'`,
  );

  return {
    pendingCount: pendingRow?.count ?? 0,
    failedCount: failedRow?.count ?? 0,
  };
}
