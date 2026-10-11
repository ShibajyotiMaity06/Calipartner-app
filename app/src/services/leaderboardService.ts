import type { SupabaseClient } from '@supabase/supabase-js';
import type { LeaderboardResponse } from '@calipartner/core';

export class LeaderboardServiceError extends Error {
  readonly code: string;
  readonly originalError?: unknown;

  constructor(code: string, message?: string, originalError?: unknown) {
    super(message ?? code);
    this.name = 'LeaderboardServiceError';
    this.code = code;
    this.originalError = originalError;
  }
}

export function parseLeaderboardError(err: unknown): LeaderboardServiceError {
  if (err instanceof LeaderboardServiceError) {
    return err;
  }
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('UNAUTHENTICATED')) {
    return new LeaderboardServiceError('UNAUTHENTICATED', 'User is not signed in', err);
  }
  return new LeaderboardServiceError('UNKNOWN_ERROR', msg, err);
}

/**
 * Fetch leaderboard for the current week (or given week_start_date).
 * Respects opt-out, returns only safe public leaderboard attributes (nickname, avatar, score, rank).
 */
export async function fetchLeaderboard(
  client: SupabaseClient,
  weekStartDate?: string,
): Promise<LeaderboardResponse> {
  try {
    const { data, error } = await client.rpc('get_leaderboard', {
      p_week_start: weekStartDate ?? null,
    });

    if (error) {
      throw parseLeaderboardError(error);
    }

    return data as LeaderboardResponse;
  } catch (err) {
    throw parseLeaderboardError(err);
  }
}

/**
 * Update leaderboard opt-out setting (PRD RNK-6).
 */
export async function setLeaderboardOptOut(
  client: SupabaseClient,
  optedOut: boolean,
): Promise<void> {
  try {
    const { error } = await client.rpc('set_leaderboard_opt_out', {
      p_opted_out: optedOut,
    });

    if (error) {
      throw parseLeaderboardError(error);
    }
  } catch (err) {
    throw parseLeaderboardError(err);
  }
}

/**
 * Fetch current user leaderboard opt-out status.
 */
export async function fetchLeaderboardOptOutStatus(
  client: SupabaseClient,
): Promise<boolean> {
  try {
    const { data: userData } = await client.auth.getUser();
    if (!userData?.user) return false;

    const { data, error } = await client
      .from('leaderboard_settings')
      .select('opted_out')
      .eq('user_id', userData.user.id)
      .maybeSingle();

    if (error) {
      throw parseLeaderboardError(error);
    }

    return data?.opted_out ?? false;
  } catch (err) {
    throw parseLeaderboardError(err);
  }
}
