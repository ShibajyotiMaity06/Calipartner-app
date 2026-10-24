import type { GoalProfile, HealthScreening } from '@calipartner/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { generateClientUuid } from './foodService';
import { beforeTrackingSync } from './accountSyncGate';

export interface TargetsDb {
  withTransactionAsync?(action: () => Promise<void>): Promise<void>;
  runAsync(sql: string, ...params: unknown[]): Promise<unknown>;
  getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null>;
}

const repairJobs = new WeakMap<TargetsDb, Map<string, Promise<void>>>();

/** Repair previously generated non-UUID IDs without recalculating or replacing the user's targets. */
export function repairLegacyGoalProfile(db: TargetsDb, userId: string): Promise<void> {
  let jobs = repairJobs.get(db);
  if (!jobs) {
    jobs = new Map();
    repairJobs.set(db, jobs);
  }
  const existing = jobs.get(userId);
  if (existing) return existing;
  const job = repairLegacyGoalProfileOnce(db, userId).finally(() => jobs.delete(userId));
  jobs.set(userId, job);
  return job;
}

async function repairLegacyGoalProfileOnce(db: TargetsDb, userId: string): Promise<void> {
  const profile = await getCurrentLocalGoalProfile(db, userId);
  if (
    !profile ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(profile.id)
  )
    return;
  const repaired = { ...profile, id: generateClientUuid() };
  const repair = async () => {
    await persistPendingGoalProfile(db, repaired);
    await db.runAsync(`DELETE FROM local_goal_profiles WHERE id = ? AND user_id = ?`, [
      profile.id,
      userId,
    ]);
    await db.runAsync(`DELETE FROM outbox WHERE id = ?`, [profile.id]);
  };
  if (db.withTransactionAsync) await db.withTransactionAsync(repair);
  else await repair();
}

async function persistPendingGoalProfile(db: TargetsDb, profile: GoalProfile): Promise<void> {
  await saveLocalGoalProfile(db, profile, false);
  await db.runAsync(
    `INSERT INTO outbox (id, entity, operation, payload, created_at, attempts, last_error)
     VALUES (?, ?, 'upsert', ?, ?, 0, ?)
     ON CONFLICT (id) DO UPDATE SET payload = excluded.payload, attempts = 0, last_error = excluded.last_error`,
    [profile.id, 'goal_profiles', JSON.stringify(profile), new Date().toISOString(), null],
  );
}

export interface LocalGoalProfileRow {
  gym_days?: number | null;
  input_height_cm?: number | null;
  id: string;
  user_id: string;
  goal: string;
  activity_level: string;
  current_weight_kg: number;
  body_fat_percentage: number | null;
  weekly_rate_kg: number;
  target_weight_kg: number | null;
  target_date: string | null;
  daily_calorie_target: number;
  protein_grams: number;
  fat_grams: number;
  carb_grams: number;
  bmr: number;
  tdee: number;
  step_goal: number;
  water_ml_goal: number;
  effective_from: string;
  confirmed_at: string;
  recompute_reason: string | null;
  created_at: string;
  is_synced: number;
}

export interface LocalHealthScreeningRow {
  user_id: string;
  pregnant_or_breastfeeding: number;
  has_diabetes_or_medication: number;
  has_eating_disorder_history: number;
  updated_at: string;
  created_at: string;
  is_synced: number;
}

/**
 * Saves a GoalProfile to local SQLite database.
 */
export async function saveLocalGoalProfile(
  db: TargetsDb,
  profile: GoalProfile,
  isSynced = false,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO local_goal_profiles (
      id, user_id, goal, activity_level, current_weight_kg, body_fat_percentage,
      weekly_rate_kg, target_weight_kg, target_date, daily_calorie_target,
      protein_grams, fat_grams, carb_grams, bmr, tdee, step_goal, water_ml_goal,
      effective_from, confirmed_at, recompute_reason, created_at, is_synced, gym_days, input_height_cm
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (id) DO UPDATE SET
      goal = excluded.goal,
      activity_level = excluded.activity_level,
      current_weight_kg = excluded.current_weight_kg,
      body_fat_percentage = excluded.body_fat_percentage,
      weekly_rate_kg = excluded.weekly_rate_kg,
      target_weight_kg = excluded.target_weight_kg,
      target_date = excluded.target_date,
      daily_calorie_target = excluded.daily_calorie_target,
      protein_grams = excluded.protein_grams,
      fat_grams = excluded.fat_grams,
      carb_grams = excluded.carb_grams,
      bmr = excluded.bmr,
      tdee = excluded.tdee,
      step_goal = excluded.step_goal,
      water_ml_goal = excluded.water_ml_goal,
      effective_from = excluded.effective_from,
      confirmed_at = excluded.confirmed_at,
      recompute_reason = excluded.recompute_reason,
      is_synced = excluded.is_synced,
      gym_days = excluded.gym_days,
      input_height_cm = excluded.input_height_cm`,
    [
      profile.id,
      profile.user_id,
      profile.goal,
      profile.activity_level,
      profile.current_weight_kg,
      profile.body_fat_percentage,
      profile.weekly_rate_kg,
      profile.target_weight_kg,
      profile.target_date,
      profile.daily_calorie_target,
      profile.protein_grams,
      profile.fat_grams,
      profile.carb_grams,
      profile.bmr,
      profile.tdee,
      profile.step_goal,
      profile.water_ml_goal,
      profile.effective_from,
      profile.confirmed_at,
      profile.recompute_reason,
      profile.created_at,
      isSynced ? 1 : 0,
      profile.gym_days ?? null,
      profile.input_height_cm ?? null,
    ],
  );
}

/**
 * Retrieves the current (latest by effective_from) GoalProfile from SQLite.
 */
export async function getCurrentLocalGoalProfile(
  db: TargetsDb,
  userId: string,
): Promise<GoalProfile | null> {
  const row = await db.getFirstAsync<LocalGoalProfileRow>(
    `SELECT * FROM local_goal_profiles WHERE user_id = ? ORDER BY effective_from DESC LIMIT 1`,
    [userId],
  );

  if (!row) return null;

  return {
    id: row.id,
    user_id: row.user_id,
    goal: row.goal as GoalProfile['goal'],
    activity_level: row.activity_level as GoalProfile['activity_level'],
    ...(row.gym_days != null ? { gym_days: row.gym_days } : {}),
    ...(row.input_height_cm != null ? { input_height_cm: row.input_height_cm } : {}),
    current_weight_kg: row.current_weight_kg,
    body_fat_percentage: row.body_fat_percentage,
    weekly_rate_kg: row.weekly_rate_kg,
    target_weight_kg: row.target_weight_kg,
    target_date: row.target_date,
    daily_calorie_target: row.daily_calorie_target,
    protein_grams: row.protein_grams,
    fat_grams: row.fat_grams,
    carb_grams: row.carb_grams,
    bmr: row.bmr,
    tdee: row.tdee,
    step_goal: row.step_goal,
    water_ml_goal: row.water_ml_goal,
    effective_from: row.effective_from,
    confirmed_at: row.confirmed_at,
    recompute_reason: row.recompute_reason as GoalProfile['recompute_reason'],
    created_at: row.created_at,
  };
}

/** Restore a returning user's exact saved targets, never another user's or invented defaults. */
export async function restoreGoalProfile(
  db: TargetsDb,
  supabase: SupabaseClient,
  userId: string,
): Promise<GoalProfile | null> {
  const { data, error } = await supabase
    .from('goal_profiles')
    .select('*')
    .eq('user_id', userId)
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const local = await getCurrentLocalGoalProfile(db, userId);
  if (!data) return local;
  const remote = data as GoalProfile;
  if (remote.user_id !== userId) throw new Error('Goal profile owner mismatch');
  // Unsynced edits always win over a server copy, including edits to the same profile ID.
  const pending = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM local_goal_profiles WHERE user_id = ? AND is_synced = 0 LIMIT 1`,
    [userId],
  );
  if (pending || (local && Date.parse(local.effective_from) > Date.parse(remote.effective_from))) {
    return local;
  }
  await saveLocalGoalProfile(db, remote, true);
  return remote;
}

/**
 * Saves HealthScreening to local SQLite database.
 */
export async function saveLocalHealthScreening(
  db: TargetsDb,
  screening: HealthScreening,
  isSynced = false,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO local_health_screening (
      user_id, pregnant_or_breastfeeding, has_diabetes_or_medication,
      has_eating_disorder_history, updated_at, created_at, is_synced
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (user_id) DO UPDATE SET
      pregnant_or_breastfeeding = excluded.pregnant_or_breastfeeding,
      has_diabetes_or_medication = excluded.has_diabetes_or_medication,
      has_eating_disorder_history = excluded.has_eating_disorder_history,
      updated_at = excluded.updated_at,
      is_synced = excluded.is_synced`,
    [
      screening.user_id,
      screening.pregnant_or_breastfeeding ? 1 : 0,
      screening.has_diabetes_or_medication ? 1 : 0,
      screening.has_eating_disorder_history ? 1 : 0,
      screening.updated_at,
      screening.created_at,
      isSynced ? 1 : 0,
    ],
  );
}

/**
 * Retrieves HealthScreening from local SQLite.
 */
export async function getLocalHealthScreening(
  db: TargetsDb,
  userId: string,
): Promise<HealthScreening | null> {
  const row = await db.getFirstAsync<LocalHealthScreeningRow>(
    `SELECT * FROM local_health_screening WHERE user_id = ? LIMIT 1`,
    [userId],
  );

  if (!row) return null;

  return {
    user_id: row.user_id,
    pregnant_or_breastfeeding: row.pregnant_or_breastfeeding === 1,
    has_diabetes_or_medication: row.has_diabetes_or_medication === 1,
    has_eating_disorder_history: row.has_eating_disorder_history === 1,
    updated_at: row.updated_at,
    created_at: row.created_at,
  };
}

/**
 * Saves GoalProfile locally and syncs to Supabase.
 * If offline or sync fails, enqueues to outbox table for reliable background sync.
 */
export async function saveGoalProfileWithSync(
  db: TargetsDb,
  supabase: SupabaseClient | null,
  profile: GoalProfile,
  isOnline: boolean,
): Promise<{ synced: boolean; error?: string }> {
  let synced = false;
  let accountWasReset = false;
  let syncError: string | undefined;

  // Persist and queue before touching the network so a slow/failed request cannot lose targets.
  const persist = async () => {
    await persistPendingGoalProfile(db, profile);
  };
  if (db.withTransactionAsync) await db.withTransactionAsync(persist);
  else await persist();

  if (isOnline && supabase) {
    try {
      accountWasReset = await beforeTrackingSync();
      const { error } = accountWasReset
        ? { error: null }
        : await syncGoalProfile(supabase, profile);
      if (!error) {
        synced = !accountWasReset;
      } else {
        syncError = error.message;
      }
    } catch (e: unknown) {
      syncError = e instanceof Error ? e.message : String(e);
    }
  }

  if (accountWasReset) throw new Error('Account data was reset; enter your targets again');

  if (synced) {
    await saveLocalGoalProfile(db, profile, true);
    await db.runAsync(`DELETE FROM outbox WHERE id = ?`, [profile.id]);
  } else if (syncError) {
    await db.runAsync(`UPDATE outbox SET last_error = ? WHERE id = ?`, [syncError, profile.id]);
  }

  return { synced, error: syncError };
}

/**
 * Saves HealthScreening locally and syncs to Supabase.
 * Enqueues to outbox if offline.
 */
export async function saveHealthScreeningWithSync(
  db: TargetsDb,
  supabase: SupabaseClient | null,
  screening: HealthScreening,
  isOnline: boolean,
): Promise<{ synced: boolean; error?: string }> {
  let synced = false;
  let syncError: string | undefined;

  if (isOnline && supabase) {
    try {
      const { error } = await supabase.from('health_screening').upsert(screening);
      if (!error) {
        synced = true;
      } else {
        syncError = error.message;
      }
    } catch (e: unknown) {
      syncError = e instanceof Error ? e.message : String(e);
    }
  }

  await saveLocalHealthScreening(db, screening, synced);

  if (!synced) {
    const outboxId = `hs-${screening.user_id}`;
    await db.runAsync(
      `INSERT INTO outbox (id, entity, operation, payload, created_at, attempts, last_error)
       VALUES (?, ?, 'upsert', ?, ?, 0, ?)
       ON CONFLICT (id) DO UPDATE SET payload = excluded.payload, attempts = 0, last_error = excluded.last_error`,
      [
        outboxId,
        'health_screening',
        JSON.stringify(screening),
        new Date().toISOString(),
        syncError ?? null,
      ],
    );
  }

  return { synced, error: syncError };
}

/**
 * Flushes pending goal_profiles and health_screening entries in the SQLite outbox queue.
 */
export async function flushTargetsOutbox(
  db: TargetsDb,
  supabase: SupabaseClient,
  userId: string,
): Promise<{ flushedCount: number }> {
  await beforeTrackingSync();
  const rows = await db.getAllAsync<{ id: string; entity: string; payload: string }>(
    `SELECT id, entity, payload FROM outbox WHERE entity IN ('goal_profiles', 'health_screening') ORDER BY created_at ASC`,
  );

  let flushedCount = 0;

  for (const row of rows) {
    try {
      const payload = JSON.parse(row.payload) as Record<string, unknown>;
      if (payload.user_id !== userId) continue;
      const { error } =
        row.entity === 'goal_profiles'
          ? await syncGoalProfile(supabase, payload as unknown as GoalProfile)
          : await supabase.from(row.entity).upsert(payload);
      if (!error) {
        // Mark synced locally if goal profile
        if (row.entity === 'goal_profiles') {
          await db.runAsync(`UPDATE local_goal_profiles SET is_synced = 1 WHERE id = ?`, [row.id]);
        } else if (row.entity === 'health_screening') {
          const userId = payload.user_id as string;
          await db.runAsync(`UPDATE local_health_screening SET is_synced = 1 WHERE user_id = ?`, [
            userId,
          ]);
        }

        // Delete from outbox
        await db.runAsync(`DELETE FROM outbox WHERE id = ?`, [row.id]);
        flushedCount++;
      } else {
        await db.runAsync(
          `UPDATE outbox SET attempts = attempts + 1, last_error = ? WHERE id = ?`,
          [error.message, row.id],
        );
      }
    } catch (e: unknown) {
      const errStr = e instanceof Error ? e.message : String(e);
      await db.runAsync(`UPDATE outbox SET attempts = attempts + 1, last_error = ? WHERE id = ?`, [
        errStr,
        row.id,
      ]);
    }
  }

  return { flushedCount };
}

/** Profile measurements sync before the dependent plan; retries remain idempotent. */
async function syncGoalProfile(supabase: SupabaseClient, profile: GoalProfile) {
  if (profile.gym_days != null && profile.input_height_cm != null) {
    const { error } = await supabase
      .from('profiles')
      .update({ height_cm: profile.input_height_cm })
      .eq('id', profile.user_id);
    if (error) return { error };
  }
  return supabase.from('goal_profiles').upsert(profile);
}
