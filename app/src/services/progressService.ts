import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  IndividualProgressData,
  ProgressDateRange,
  RoomProgressData,
  RoomProgressDateRange,
  RoomStreak,
  UserStreak,
} from '@calipartner/core';

export class ProgressServiceError extends Error {
  readonly code: string;
  readonly originalError?: unknown;

  constructor(code: string, message?: string, originalError?: unknown) {
    super(message ?? code);
    this.name = 'ProgressServiceError';
    this.code = code;
    this.originalError = originalError;
  }
}

export function parseProgressError(err: unknown): ProgressServiceError {
  if (err instanceof ProgressServiceError) {
    return err;
  }
  let msg = '';
  if (err && typeof err === 'object') {
    const candidate =
      (err as Record<string, unknown>).message ||
      (err as Record<string, unknown>).error_description ||
      (err as Record<string, unknown>).details;
    if (typeof candidate === 'string') {
      msg = candidate;
    }
  }
  if (!msg) {
    msg = err instanceof Error ? err.message : String(err);
  }
  if (msg === '[object Object]' || !msg) {
    msg = 'Tap retry to refresh your progress summary';
  }
  if (msg.includes('UNAUTHENTICATED') || msg.includes('JWT') || msg.includes('auth')) {
    return new ProgressServiceError(
      'UNAUTHENTICATED',
      'Sign in to view your progress and trends',
      err,
    );
  }
  if (msg.includes('NOT_A_ROOM_MEMBER')) {
    return new ProgressServiceError('NOT_A_ROOM_MEMBER', 'You are not a member of this room', err);
  }
  if (msg.includes('ROOM_NOT_ACCESSIBLE')) {
    return new ProgressServiceError('ROOM_NOT_ACCESSIBLE', 'Room is locked or archived', err);
  }
  return new ProgressServiceError('UNKNOWN_ERROR', msg, err);
}

export function getDefaultIndividualProgress(
  range: ProgressDateRange = '30d',
): IndividualProgressData {
  const now = new Date();
  const endDate: string = now.toISOString().slice(0, 10);
  const startDate: string = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);
  return {
    range,
    start_date: startDate,
    end_date: endDate,
    weight: {
      history: [],
      start_weight_kg: null,
      current_weight_kg: null,
      current_trend_kg: null,
      total_change_kg: null,
      total_change_pct: null,
      target_weight_kg: null,
      weekly_pace_kg: null,
      projected_date: null,
      goal_progress_pct: 0,
    },
    calories: {
      daily: [],
      average_calories: 0,
      average_target: 2000,
      logged_days_count: 0,
      goal_days_count: 0,
      total_days_in_range: 30,
      adherence_pct: 0,
    },
    macros: {
      protein_avg_g: 0,
      carbs_avg_g: 0,
      fat_avg_g: 0,
      protein_target_g: 140,
      carbs_target_g: 200,
      fat_target_g: 65,
    },
    steps: {
      daily: [],
      average_steps: 0,
      total_steps: 0,
      total_distance_km: 0,
      goal_steps: 8000,
    },
    water: {
      daily: [],
      average_water_ml: 0,
      total_water_ml: 0,
      goal_water_ml: 2500,
    },
    workouts: {
      total_workouts: 0,
      sessions_per_week: 0,
      total_duration_minutes: 0,
      total_volume_kg: 0,
      exercise_progression: [],
    },
    consistency: {
      current_streak: 0,
      longest_streak: 0,
      weekly_scores: [],
    },
    goal_progress_pct: 0,
  };
}

/**
 * Fetch individual progress for the current authenticated user.
 * Ranges: 7d, 30d, 90d, 6m, 1y, all
 */
export async function fetchIndividualProgress(
  client: SupabaseClient,
  range: ProgressDateRange = '30d',
): Promise<IndividualProgressData> {
  try {
    const { data, error } = await client.rpc('get_individual_progress', {
      p_range: range,
    });

    if (error) {
      const errStr = JSON.stringify(error);
      if (errStr.includes('target_calories') || errStr.includes('does not exist')) {
        return getDefaultIndividualProgress(range);
      }
      throw parseProgressError(error);
    }

    return (data as IndividualProgressData) ?? getDefaultIndividualProgress(range);
  } catch (err) {
    const errStr = err instanceof Error ? err.message : String(err);
    if (errStr.includes('target_calories') || errStr.includes('does not exist')) {
      return getDefaultIndividualProgress(range);
    }
    throw parseProgressError(err);
  }
}

/**
 * Fetch room progress with privacy enforcement (PRD RPG-1..RPG-7).
 * For rooms > 10 members, selectedMemberIds can be provided (default: me + 3 most recently active).
 */
export async function fetchRoomProgress(
  client: SupabaseClient,
  roomId: string,
  range: RoomProgressDateRange = '30d',
  selectedMemberIds?: string[],
): Promise<RoomProgressData> {
  try {
    const { data, error } = await client.rpc('get_room_progress', {
      p_room_id: roomId,
      p_range: range,
      p_selected_member_ids: selectedMemberIds ?? null,
    });

    if (error) {
      throw parseProgressError(error);
    }

    return data as RoomProgressData;
  } catch (err) {
    throw parseProgressError(err);
  }
}

/**
 * Searchable member picker for room progress (PRD RPG-7).
 */
export async function searchRoomMembersForProgress(
  client: SupabaseClient,
  roomId: string,
  query?: string,
): Promise<
  Array<{
    user_id: string;
    nickname: string;
    username: string;
    avatar_url: string | null;
    status: string;
    is_locked: boolean;
  }>
> {
  try {
    const { data, error } = await client.rpc('search_room_members_for_progress', {
      p_room_id: roomId,
      p_query: query?.trim() ? query.trim() : null,
    });

    if (error) {
      throw parseProgressError(error);
    }

    return (data ?? []) as Array<{
      user_id: string;
      nickname: string;
      username: string;
      avatar_url: string | null;
      status: string;
      is_locked: boolean;
    }>;
  } catch (err) {
    throw parseProgressError(err);
  }
}

/**
 * Fetch current user streaks.
 */
export async function fetchUserStreaks(client: SupabaseClient): Promise<UserStreak | null> {
  try {
    const { data: userData } = await client.auth.getUser();
    if (!userData?.user) return null;

    const { data, error } = await client
      .from('user_streaks')
      .select('*')
      .eq('user_id', userData.user.id)
      .maybeSingle();

    if (error) {
      throw parseProgressError(error);
    }

    return data as UserStreak | null;
  } catch (err) {
    throw parseProgressError(err);
  }
}

/**
 * Fetch room streak.
 */
export async function fetchRoomStreak(
  client: SupabaseClient,
  roomId: string,
): Promise<RoomStreak | null> {
  try {
    const { data, error } = await client
      .from('room_streaks')
      .select('*')
      .eq('room_id', roomId)
      .maybeSingle();

    if (error) {
      throw parseProgressError(error);
    }

    return data as RoomStreak | null;
  } catch (err) {
    throw parseProgressError(err);
  }
}
