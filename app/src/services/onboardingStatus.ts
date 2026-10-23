import type { GoalProfile } from '@calipartner/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getCurrentLocalGoalProfile,
  saveLocalGoalProfile,
  type TargetsDb,
} from '@/services/targetsService';

/**
 * Checks whether a user has already completed onboarding.
 * Checks local SQLite first, then verifies with Supabase (remote database)
 * to ensure returning users on new devices/browsers are never prompted again.
 */
export async function isUserOnboarded(
  userId?: string | null,
  customDb?: TargetsDb,
  customSupabase?: SupabaseClient,
): Promise<boolean> {
  if (!userId) return false;

  try {
    // 1. Fast offline check in local SQLite
    const db: TargetsDb = customDb ?? (await (await import('@/db')).getDb());
    const localGoal = await getCurrentLocalGoalProfile(db, userId);
    if (localGoal) {
      return true;
    }

    // Also check guest profile if guest
    if (userId === 'guest-user') {
      const guestGoal = await getCurrentLocalGoalProfile(db, 'guest-user');
      return Boolean(guestGoal);
    }

    // 2. Query Supabase goal_profiles (remote source of truth for completed onboarding)
    const supabase: SupabaseClient =
      customSupabase ?? (await import('@/lib/supabase')).getSupabase();
    const { data: goalRow, error: goalError } = await supabase
      .from('goal_profiles')
      .select('*')
      .eq('user_id', userId)
      .order('effective_from', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!goalError && goalRow) {
      // User has completed onboarding goals previously in DB!
      // Cache this profile into local SQLite so future checks work offline
      try {
        await saveLocalGoalProfile(db, goalRow as unknown as GoalProfile, true);
      } catch {
        // Non-blocking caching
      }
      return true;
    }

    // 3. Check Supabase profiles table for an existing configured profile
    const { data: profileRow, error: profileError } = await supabase
      .from('profiles')
      .select('id, nickname, username')
      .eq('id', userId)
      .maybeSingle();

    if (!profileError && profileRow && (profileRow.nickname || profileRow.username)) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}
