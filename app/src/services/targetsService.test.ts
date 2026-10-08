import { describe, expect, it } from 'vitest';
import type { GoalProfile, HealthScreening } from '@calipartner/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  flushTargetsOutbox,
  getCurrentLocalGoalProfile,
  getLocalHealthScreening,
  saveGoalProfileWithSync,
  saveHealthScreeningWithSync,
  type LocalGoalProfileRow,
  type LocalHealthScreeningRow,
  type TargetsDb,
} from './targetsService';

interface OutboxRow {
  id: string;
  entity: string;
  operation: string;
  payload: string;
  created_at: string;
  last_error: string | null;
}

class MockTargetsDb implements TargetsDb {
  tables = {
    local_goal_profiles: [] as LocalGoalProfileRow[],
    local_health_screening: [] as LocalHealthScreeningRow[],
    outbox: [] as OutboxRow[],
  };

  async runAsync(sql: string, ...args: unknown[]): Promise<unknown> {
    const params = (Array.isArray(args[0]) ? args[0] : args) as unknown[];
    const trimmed = sql.trim();
    if (trimmed.startsWith('INSERT INTO local_goal_profiles')) {
      const p = params;
      const id = String(p[0]);
      const existingIdx = this.tables.local_goal_profiles.findIndex((r) => r.id === id);
      const row: LocalGoalProfileRow = {
        id,
        user_id: String(p[1]),
        goal: String(p[2]),
        activity_level: String(p[3]),
        current_weight_kg: Number(p[4]),
        body_fat_percentage: p[5] != null ? Number(p[5]) : null,
        weekly_rate_kg: Number(p[6]),
        target_weight_kg: p[7] != null ? Number(p[7]) : null,
        target_date: p[8] != null ? String(p[8]) : null,
        daily_calorie_target: Number(p[9]),
        protein_grams: Number(p[10]),
        fat_grams: Number(p[11]),
        carb_grams: Number(p[12]),
        bmr: Number(p[13]),
        tdee: Number(p[14]),
        step_goal: Number(p[15]),
        water_ml_goal: Number(p[16]),
        effective_from: String(p[17]),
        confirmed_at: String(p[18]),
        recompute_reason: p[19] != null ? String(p[19]) : null,
        created_at: String(p[20]),
        is_synced: Number(p[21]),
      };
      if (existingIdx >= 0) this.tables.local_goal_profiles[existingIdx] = row;
      else this.tables.local_goal_profiles.push(row);
      return { changes: 1 };
    }

    if (trimmed.startsWith('INSERT INTO local_health_screening')) {
      const p = params;
      const uid = String(p[0]);
      const existingIdx = this.tables.local_health_screening.findIndex((r) => r.user_id === uid);
      const row: LocalHealthScreeningRow = {
        user_id: uid,
        pregnant_or_breastfeeding: Number(p[1]),
        has_diabetes_or_medication: Number(p[2]),
        has_eating_disorder_history: Number(p[3]),
        updated_at: String(p[4]),
        created_at: String(p[5]),
        is_synced: Number(p[6]),
      };
      if (existingIdx >= 0) this.tables.local_health_screening[existingIdx] = row;
      else this.tables.local_health_screening.push(row);
      return { changes: 1 };
    }

    if (trimmed.startsWith('INSERT INTO outbox')) {
      const p = params;
      this.tables.outbox.push({
        id: String(p[0]),
        entity: String(p[1]),
        operation: 'upsert',
        payload: String(p[2]),
        created_at: String(p[3]),
        last_error: p[4] != null ? String(p[4]) : null,
      });
      return { changes: 1 };
    }

    if (trimmed.startsWith('UPDATE local_goal_profiles SET is_synced')) {
      const id = String(params[0]);
      const row = this.tables.local_goal_profiles.find((r) => r.id === id);
      if (row) row.is_synced = 1;
      return { changes: 1 };
    }

    if (trimmed.startsWith('UPDATE local_health_screening SET is_synced')) {
      const uid = String(params[0]);
      const row = this.tables.local_health_screening.find((r) => r.user_id === uid);
      if (row) row.is_synced = 1;
      return { changes: 1 };
    }

    if (trimmed.startsWith('DELETE FROM outbox')) {
      const id = String(params[0]);
      this.tables.outbox = this.tables.outbox.filter((r) => r.id !== id);
      return { changes: 1 };
    }

    return { changes: 1 };
  }

  async getAllAsync<T>(sql: string): Promise<T[]> {
    if (sql.includes('FROM outbox')) {
      return this.tables.outbox as unknown as T[];
    }
    return [] as T[];
  }

  async getFirstAsync<T>(sql: string, ...args: unknown[]): Promise<T | null> {
    const params = (Array.isArray(args[0]) ? args[0] : args) as unknown[];
    if (sql.includes('FROM local_goal_profiles')) {
      const uid = String(params[0]);
      const userRows = this.tables.local_goal_profiles.filter((r) => r.user_id === uid);
      if (userRows.length === 0) return null;
      userRows.sort(
        (a, b) => new Date(b.effective_from).getTime() - new Date(a.effective_from).getTime(),
      );
      return (userRows[0] ?? null) as unknown as T;
    }

    if (sql.includes('FROM local_health_screening')) {
      const uid = String(params[0]);
      const row = this.tables.local_health_screening.find((r) => r.user_id === uid);
      return (row ?? null) as unknown as T;
    }

    return null;
  }
}

describe('TargetsService', () => {
  const userId = 'user-test-456';
  const sampleGoal: GoalProfile = {
    id: 'gp-1',
    user_id: userId,
    goal: 'cut',
    activity_level: 'moderate',
    current_weight_kg: 70,
    body_fat_percentage: null,
    weekly_rate_kg: 0.5,
    target_weight_kg: 65,
    target_date: '2026-06-01',
    daily_calorie_target: 2044,
    protein_grams: 140,
    fat_grams: 57,
    carb_grams: 243,
    bmr: 1674,
    tdee: 2594,
    step_goal: 8000,
    water_ml_goal: 2500,
    effective_from: '2026-01-01T00:00:00Z',
    confirmed_at: '2026-01-01T00:00:00Z',
    recompute_reason: 'initial_onboarding',
    created_at: '2026-01-01T00:00:00Z',
  };

  const sampleScreening: HealthScreening = {
    user_id: userId,
    pregnant_or_breastfeeding: false,
    has_diabetes_or_medication: true,
    has_eating_disorder_history: false,
    updated_at: '2026-01-01T00:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
  };

  it('saves goal profile locally and queues in outbox when offline', async () => {
    const db = new MockTargetsDb();
    const result = await saveGoalProfileWithSync(db, null, sampleGoal, false);

    expect(result.synced).toBe(false);

    // Profile is queryable locally immediately
    const saved = await getCurrentLocalGoalProfile(db, userId);
    expect(saved).not.toBeNull();
    expect(saved?.daily_calorie_target).toBe(2044);

    // Outbox contains pending item
    expect(db.tables.outbox).toHaveLength(1);
    expect(db.tables.outbox[0]?.entity).toBe('goal_profiles');
  });

  it('saves health screening locally and queues in outbox when offline', async () => {
    const db = new MockTargetsDb();
    const result = await saveHealthScreeningWithSync(db, null, sampleScreening, false);

    expect(result.synced).toBe(false);

    const saved = await getLocalHealthScreening(db, userId);
    expect(saved).not.toBeNull();
    expect(saved?.has_diabetes_or_medication).toBe(true);

    expect(db.tables.outbox).toHaveLength(1);
    expect(db.tables.outbox[0]?.entity).toBe('health_screening');
  });

  it('flushes outbox successfully when network becomes available', async () => {
    const db = new MockTargetsDb();
    await saveGoalProfileWithSync(db, null, sampleGoal, false);
    await saveHealthScreeningWithSync(db, null, sampleScreening, false);

    expect(db.tables.outbox).toHaveLength(2);

    // Mock Supabase client
    const remoteUpserts: Record<string, Record<string, unknown>[]> = {
      goal_profiles: [],
      health_screening: [],
    };

    const mockSupabase = {
      from(entity: string) {
        return {
          upsert: async (payload: Record<string, unknown>) => {
            const list = remoteUpserts[entity] ?? [];
            list.push(payload);
            remoteUpserts[entity] = list;
            return { error: null };
          },
        };
      },
    } as unknown as SupabaseClient;

    const flushResult = await flushTargetsOutbox(db, mockSupabase);
    expect(flushResult.flushedCount).toBe(2);
    expect(db.tables.outbox).toHaveLength(0);
    expect(remoteUpserts.goal_profiles).toHaveLength(1);
    expect(remoteUpserts.health_screening).toHaveLength(1);
  });
});
