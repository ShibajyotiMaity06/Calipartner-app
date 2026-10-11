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
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('UNAUTHENTICATED')) {
    return new ProgressServiceError('UNAUTHENTICATED', 'User is not signed in', err);
  }
  if (msg.includes('NOT_A_ROOM_MEMBER')) {
    return new ProgressServiceError('NOT_A_ROOM_MEMBER', 'You are not a member of this room', err);
  }
  if (msg.includes('ROOM_NOT_ACCESSIBLE')) {
    return new ProgressServiceError('ROOM_NOT_ACCESSIBLE', 'Room is locked or archived', err);
  }
  return new ProgressServiceError('UNKNOWN_ERROR', msg, err);
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
      throw parseProgressError(error);
    }

    return data as IndividualProgressData;
  } catch (err) {
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
export async function fetchUserStreaks(
  client: SupabaseClient,
): Promise<UserStreak | null> {
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
