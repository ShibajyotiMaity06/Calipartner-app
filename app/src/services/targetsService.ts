import type { GoalProfile, HealthScreening } from '@calipartner/core';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface TargetsDb {
  runAsync(sql: string, ...params: unknown[]): Promise<unknown>;
  getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null>;
}

export interface LocalGoalProfileRow {
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
      effective_from, confirmed_at, recompute_reason, created_at, is_synced
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      is_synced = excluded.is_synced`,
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
  let syncError: string | undefined;

  if (isOnline && supabase) {
    try {
      const { error } = await supabase.from('goal_profiles').upsert(profile);
      if (!error) {
        synced = true;
      } else {
        syncError = error.message;
      }
    } catch (e: unknown) {
      syncError = e instanceof Error ? e.message : String(e);
    }
  }

  // 1. Save locally with sync status
  await saveLocalGoalProfile(db, profile, synced);

  // 2. If not synced, queue into SQLite outbox
  if (!synced) {
    await db.runAsync(
      `INSERT INTO outbox (id, entity, operation, payload, created_at, attempts, last_error)
       VALUES (?, ?, 'upsert', ?, ?, 0, ?)
       ON CONFLICT (id) DO UPDATE SET payload = excluded.payload, attempts = 0, last_error = excluded.last_error`,
      [profile.id, 'goal_profiles', JSON.stringify(profile), new Date().toISOString(), syncError ?? null],
    );
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
      [outboxId, 'health_screening', JSON.stringify(screening), new Date().toISOString(), syncError ?? null],
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
): Promise<{ flushedCount: number }> {
  const rows = await db.getAllAsync<{ id: string; entity: string; payload: string }>(
    `SELECT id, entity, payload FROM outbox WHERE entity IN ('goal_profiles', 'health_screening') ORDER BY created_at ASC`,
  );

  let flushedCount = 0;

  for (const row of rows) {
    try {
      const payload = JSON.parse(row.payload) as Record<string, unknown>;
      const { error } = await supabase.from(row.entity).upsert(payload);
      if (!error) {
        // Mark synced locally if goal profile
        if (row.entity === 'goal_profiles') {
          await db.runAsync(`UPDATE local_goal_profiles SET is_synced = 1 WHERE id = ?`, [row.id]);
        } else if (row.entity === 'health_screening') {
          const userId = payload.user_id as string;
          await db.runAsync(`UPDATE local_health_screening SET is_synced = 1 WHERE user_id = ?`, [userId]);
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
      await db.runAsync(
        `UPDATE outbox SET attempts = attempts + 1, last_error = ? WHERE id = ?`,
        [errStr, row.id],
      );
    }
  }

  return { flushedCount };
}
