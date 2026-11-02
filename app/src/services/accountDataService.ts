import { getSupabase } from '@/lib/supabase';
import { beforeAccountWrite } from './accountDataGate';
import { diaryEvents } from './diaryEvents';
export interface LocalDb {
  withTransactionAsync?(action: () => Promise<void>): Promise<void>;
  runAsync(sql: string, ...params: unknown[]): Promise<unknown>;
  getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null>;
}

export interface DataClient {
  rpc?(
    name: string,
    args: Record<string, unknown>,
  ): PromiseLike<{ data?: unknown; error: Error | null }>;
  functions?: {
    invoke(
      name: string,
      options: { body: Record<string, unknown> },
    ): Promise<{ data: unknown; error: unknown }>;
  };
  auth?: { getUser(): Promise<{ data: { user: { id: string } | null }; error?: unknown }> };
  from(table: string): {
    upsert(
      values: Record<string, unknown> | Array<Record<string, unknown>>,
      options?: { onConflict?: string },
    ): PromiseLike<{ error: Error | null; data?: unknown }>;
    update(values: Record<string, unknown>): {
      eq(column: string, value: unknown): PromiseLike<{ error: Error | null }>;
    };
    select(columns?: string): {
      gt(
        column: string,
        value: unknown,
      ): {
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

export interface RemoteWrite {
  id: string;
  entity: string;
  operation: 'upsert' | 'delete';
  payload: Record<string, unknown>;
}

const afterSaves = new WeakMap<LocalDb, Array<() => Promise<unknown>>>();
export async function afterOnlineSave(db: LocalDb, action: () => Promise<unknown>): Promise<void> {
  const actions = afterSaves.get(db);
  if (actions) actions.push(action);
  else await action();
}
const requestChanges = new WeakMap<LocalDb, Map<string, RemoteWrite>>();
/** A save completes only after the server acknowledges it. Nothing persists for later delivery. */
export async function saveRemote(
  db: LocalDb,
  item: RemoteWrite,
  client?: DataClient,
): Promise<void> {
  if (item.payload.user_id === 'guest-user' || item.payload.owner_id === 'guest-user')
    throw new Error('UNAUTHENTICATED');
  const changes = requestChanges.get(db);
  if (changes) {
    changes.set(`${item.entity}:${item.id}`, item);
    return;
  }
  await commitChanges([item], client ?? getSupabase());
}
async function commitChanges(
  changes: RemoteWrite[],
  client: DataClient,
  accountChecked = false,
): Promise<void> {
  if (!changes.length) return;
  if (!accountChecked && (await beforeAccountWrite())) throw new Error('ACCOUNT_DATA_RESET');
  const actor = await client.auth?.getUser();
  if (actor?.error || !actor?.data.user) throw new Error('ACCOUNT_CHANGED');
  for (const change of changes) {
    const owner = change.payload.user_id ?? change.payload.owner_id ?? change.payload.sender_id;
    if (owner && owner !== actor.data.user.id) throw new Error('ACCOUNT_CHANGED');
  }
  if (!client.rpc) throw new Error('SAVE_API_REQUIRED');
  const result = await client.rpc('save_tracking_changes', { p_changes: changes });
  if (result.error) throw result.error;
}

const transactions = new WeakSet<LocalDb>();
const saves = new WeakMap<LocalDb, Promise<unknown>>();
/** Roll back the local read cache on network failure, including nested meal/workout saves. */
export async function withOnlineSave<T>(
  db: LocalDb,
  action: (transaction: LocalDb) => Promise<T>,
  verifyAccount = true,
): Promise<T> {
  if (transactions.has(db)) return action(db);
  // A reset may itself clear this database; finish it before reserving the save transaction.
  if (verifyAccount && (await beforeAccountWrite())) throw new Error('ACCOUNT_DATA_RESET');
  const previous = saves.get(db) ?? Promise.resolve();
  const work = previous
    .catch(() => {})
    .then(async () => {
      const transaction: LocalDb = {
        runAsync: db.runAsync.bind(db),
        getAllAsync: db.getAllAsync.bind(db),
        getFirstAsync: db.getFirstAsync.bind(db),
        withTransactionAsync: async (nested) => {
          await nested();
        },
      };
      transactions.add(transaction);
      requestChanges.set(transaction, new Map());
      afterSaves.set(transaction, []);
      try {
        let result!: T;
        const run = async () => {
          result = await action(transaction);
          const changes = [...requestChanges.get(transaction)!.values()];
          if (changes.length) await commitChanges(changes, getSupabase(), verifyAccount);
        };
        if (db.withTransactionAsync) await db.withTransactionAsync(run);
        else await run();
        for (const action of afterSaves.get(transaction) ?? []) void action().catch(() => {});
        if (requestChanges.get(transaction)?.size) diaryEvents.emitChange();
        return result;
      } finally {
        transactions.delete(transaction);
        requestChanges.delete(transaction);
        afterSaves.delete(transaction);
      }
    });
  saves.set(db, work);
  try {
    return await work;
  } finally {
    if (saves.get(db) === work) saves.delete(db);
  }
}

/** Fresh server data replaces the current account's read cache. There are no cursors or merge rules. */
const reads = new WeakMap<LocalDb, Map<string, Promise<void>>>();
export function loadAccountTable(db: LocalDb, entity: string, userId: string): Promise<void> {
  if (userId === 'guest-user') return Promise.resolve();
  let active = reads.get(db);
  if (!active) {
    active = new Map();
    reads.set(db, active);
  }
  const key = `${userId}:${entity}`;
  const existing = active.get(key);
  if (existing) return existing;
  const request = withOnlineSave(
    db,
    (transaction) => readAccountTable(transaction, entity, userId),
    false,
  );
  active.set(key, request);
  void request.finally(() => active.delete(key)).catch(() => {});
  return request;
}
async function readAccountTable(db: LocalDb, entity: string, userId: string): Promise<void> {
  if (userId === 'guest-user') return;
  const client = getSupabase();
  const actor = await client.auth.getUser();
  if (actor.error || actor.data.user?.id !== userId) throw new Error('ACCOUNT_CHANGED');
  const remoteRows: Record<string, unknown>[] = [];
  for (let offset = 0; ; offset += 500) {
    let query = client.from(entity).select('*');
    if (entity !== 'foods' && entity !== 'exercises') query = query.eq('user_id', userId);
    const result = await query
      .order(entity === 'fasting_settings' ? 'user_id' : 'updated_at', { ascending: true })
      .range(offset, offset + 499);
    if (result.error) throw result.error;
    remoteRows.push(...(result.data ?? []));
    if ((result.data?.length ?? 0) < 500) break;
  }
  const write = async () => {
    if (!['foods', 'exercises'].includes(entity))
      await db.runAsync(`DELETE FROM local_${entity} WHERE user_id = ?`, [userId]);
    for (const row of remoteRows) {
      if (entity === 'fasting_settings' || entity === 'fasting_sessions') {
        const columns =
          entity === 'fasting_settings'
            ? [
                'user_id',
                'enabled',
                'protocol',
                'eating_window_start',
                'eating_window_end',
                'custom_fasting_hours',
                'created_at',
                'updated_at',
              ]
            : [
                'id',
                'user_id',
                'start_at',
                'planned_minutes',
                'end_at',
                'status',
                'local_date',
                'created_at',
                'updated_at',
              ];
        const values = columns.map((column) =>
          typeof row[column] === 'boolean' ? Number(row[column]) : (row[column] ?? null),
        );
        await db.runAsync(
          `INSERT INTO local_${entity} (${columns.join(',')},sync_state) VALUES (${columns.map(() => '?').join(',')},'synced')`,
          values,
        );
      } else if (entity === 'food_entries') {
        {
          await db.runAsync(
            `INSERT INTO local_food_entries (
            id, user_id, food_id, meal_section, quantity, unit,
            calories, protein, carbs, fat, fiber, sugar, sodium_mg,
            food_name, brand_name, logged_at, local_date, source,
            shared_meal_id, created_at, updated_at, deleted_at, sync_state, nutrition_details
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)
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
            nutrition_details = excluded.nutrition_details,
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
              typeof row.nutrition_details === 'string'
                ? row.nutrition_details
                : JSON.stringify(row.nutrition_details ?? null),
            ],
          );
        }
      } else if (entity === 'user_food_stats') {
        {
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
        // Catalog records visible to the current account
        const unitsJson =
          typeof row.serving_units === 'string'
            ? row.serving_units
            : JSON.stringify(row.serving_units ?? []);
        await db.runAsync(
          `INSERT INTO local_foods (
          id, source, name, brand, barcode, serving_units,
          calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g,
          fiber_per_100g, sugar_per_100g, sodium_mg_per_100g,
          owner_id, attribution, created_at, updated_at, deleted_at, sync_state, nutrition_details
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)
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
          nutrition_details = excluded.nutrition_details,
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
            typeof row.nutrition_details === 'string'
              ? row.nutrition_details
              : JSON.stringify(row.nutrition_details ?? null),
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
  };
  if (db.withTransactionAsync) await db.withTransactionAsync(write);
  else await write();
}
