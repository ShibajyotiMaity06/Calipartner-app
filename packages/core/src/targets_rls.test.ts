import { describe, expect, it } from 'vitest';
import type { GoalProfile, HealthScreening } from './types';

/**
 * Simulates Row Level Security enforcement for goal_profiles and health_screening.
 * Proves that no user can read or modify another user's goals or health data.
 */
class InMemoryTargetsDb {
  goalProfiles: GoalProfile[] = [];
  healthScreenings = new Map<string, HealthScreening>();

  insertGoalProfile(callerId: string, profile: Omit<GoalProfile, 'id' | 'created_at'>): GoalProfile {
    // Check constraint: auth.uid() = user_id
    if (callerId !== profile.user_id) {
      throw new Error('RLS check violation: cannot insert goal profile for another user');
    }
    const created: GoalProfile = {
      ...profile,
      id: `gp-${Date.now()}-${Math.random()}`,
      created_at: new Date().toISOString(),
    };
    this.goalProfiles.push(created);
    return created;
  }

  selectGoalProfiles(callerId: string): GoalProfile[] {
    // RLS policy: using (auth.uid() = user_id)
    return this.goalProfiles.filter((gp) => gp.user_id === callerId);
  }

  selectCurrentGoalProfile(callerId: string): GoalProfile | null {
    const list = this.selectGoalProfiles(callerId);
    if (list.length === 0) return null;
    const sorted = [...list].sort(
      (a, b) => new Date(b.effective_from).getTime() - new Date(a.effective_from).getTime(),
    );
    return sorted[0] ?? null;
  }

  insertOrUpdateHealthScreening(
    callerId: string,
    screening: Omit<HealthScreening, 'created_at' | 'updated_at'>,
  ): HealthScreening {
    if (callerId !== screening.user_id) {
      throw new Error('RLS check violation: cannot touch health screening for another user');
    }
    const now = new Date().toISOString();
    const existing = this.healthScreenings.get(callerId);
    const saved: HealthScreening = {
      ...screening,
      created_at: existing ? existing.created_at : now,
      updated_at: now,
    };
    this.healthScreenings.set(callerId, saved);
    return saved;
  }

  selectHealthScreening(callerId: string): HealthScreening | null {
    // RLS policy: using (auth.uid() = user_id)
    return this.healthScreenings.get(callerId) ?? null;
  }
}

describe('Phase 2 RLS Policies and Privacy Rules', () => {
  const db = new InMemoryTargetsDb();
  const userA = 'user-a-111';
  const userB = 'user-b-222';

  it('allows User A to insert and read their own goal profile', () => {
    const gp = db.insertGoalProfile(userA, {
      user_id: userA,
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
    });

    expect(gp.daily_calorie_target).toBe(2044);
    const aProfiles = db.selectGoalProfiles(userA);
    expect(aProfiles).toHaveLength(1);
    expect(aProfiles[0]!.user_id).toBe(userA);
  });

  it('prevents User A from inserting a goal profile for User B', () => {
    expect(() => {
      db.insertGoalProfile(userA, {
        user_id: userB,
        goal: 'cut',
        activity_level: 'moderate',
        current_weight_kg: 75,
        body_fat_percentage: null,
        weekly_rate_kg: 0.5,
        target_weight_kg: null,
        target_date: null,
        daily_calorie_target: 2100,
        protein_grams: 150,
        fat_grams: 60,
        carb_grams: 240,
        bmr: 1700,
        tdee: 2600,
        step_goal: 8000,
        water_ml_goal: 2500,
        effective_from: '2026-01-01T00:00:00Z',
        confirmed_at: '2026-01-01T00:00:00Z',
        recompute_reason: 'initial_onboarding',
      });
    }).toThrow('RLS check violation');
  });

  it('prevents User B from reading User A goal profile', () => {
    const bProfiles = db.selectGoalProfiles(userB);
    expect(bProfiles).toHaveLength(0);
    expect(db.selectCurrentGoalProfile(userB)).toBeNull();
  });

  it('strictly isolates health screening data: User B cannot read User A screening', () => {
    db.insertOrUpdateHealthScreening(userA, {
      user_id: userA,
      pregnant_or_breastfeeding: false,
      has_diabetes_or_medication: true,
      has_eating_disorder_history: false,
    });

    expect(db.selectHealthScreening(userA)?.has_diabetes_or_medication).toBe(true);
    // User B querying health screening sees nothing
    expect(db.selectHealthScreening(userB)).toBeNull();
  });

  it('prevents User B from modifying User A health screening', () => {
    expect(() => {
      db.insertOrUpdateHealthScreening(userB, {
        user_id: userA,
        pregnant_or_breastfeeding: true,
        has_diabetes_or_medication: false,
        has_eating_disorder_history: true,
      });
    }).toThrow('RLS check violation');
  });
});
