import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  fetchIndividualProgress,
  fetchRoomProgress,
  fetchRoomStreak,
  fetchUserStreaks,
  parseProgressError,
  ProgressServiceError,
  searchRoomMembersForProgress,
} from './progressService';

function createMockSupabase(overrides: {
  user?: { id: string; email: string } | null;
  fromHandler?: (table: string) => unknown;
  rpcHandler?: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: unknown }>;
}): SupabaseClient {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: overrides.user ?? { id: 'user-123', email: 'test@example.com' } },
        error: null,
      }),
    },
    from: vi.fn().mockImplementation((table: string) => {
      if (overrides.fromHandler) {
        return overrides.fromHandler(table);
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    }),
    rpc: vi.fn().mockImplementation((fn: string, args: Record<string, unknown>) => {
      if (overrides.rpcHandler) {
        return overrides.rpcHandler(fn, args);
      }
      return Promise.resolve({ data: null, error: null });
    }),
  } as unknown as SupabaseClient;
}

describe('progressService', () => {
  it('fetchIndividualProgress calls get_individual_progress with range', async () => {
    const mockData = {
      range: '30d',
      calories: { logged_days_count: 20, goal_days_count: 18, adherence_pct: 90 },
      weight: { start_weight_kg: 80, current_weight_kg: 78 },
    };

    const client = createMockSupabase({
      rpcHandler: async (fn, args) => {
        expect(fn).toBe('get_individual_progress');
        expect(args.p_range).toBe('30d');
        return { data: mockData, error: null };
      },
    });

    const result = await fetchIndividualProgress(client, '30d');
    expect(result).toEqual(mockData);
  });

  it('fetchIndividualProgress parses unauthenticated errors properly', async () => {
    const client = createMockSupabase({
      rpcHandler: async () => {
        return { data: null, error: new Error('UNAUTHENTICATED') };
      },
    });

    await expect(fetchIndividualProgress(client, '7d')).rejects.toThrowError(
      ProgressServiceError,
    );
  });

  it('fetchRoomProgress calls get_room_progress with room_id and range', async () => {
    const mockRoomData = {
      room_id: 'room-1',
      total_members: 3,
      summary_table: [{ user_id: 'user-123', nickname: 'Me', consistency_score: 95 }],
    };

    const client = createMockSupabase({
      rpcHandler: async (fn, args) => {
        expect(fn).toBe('get_room_progress');
        expect(args.p_room_id).toBe('room-1');
        expect(args.p_range).toBe('7d');
        return { data: mockRoomData, error: null };
      },
    });

    const result = await fetchRoomProgress(client, 'room-1', '7d');
    expect(result).toEqual(mockRoomData);
  });

  it('searchRoomMembersForProgress calls search_room_members_for_progress', async () => {
    const mockMembers = [
      { user_id: 'u1', nickname: 'Rahul', username: 'rahul', avatar_url: null, status: 'active', is_locked: false },
    ];

    const client = createMockSupabase({
      rpcHandler: async (fn, args) => {
        expect(fn).toBe('search_room_members_for_progress');
        expect(args.p_room_id).toBe('room-1');
        expect(args.p_query).toBe('rahul');
        return { data: mockMembers, error: null };
      },
    });

    const result = await searchRoomMembersForProgress(client, 'room-1', 'rahul');
    expect(result).toEqual(mockMembers);
  });

  it('fetchUserStreaks queries user_streaks table', async () => {
    const mockStreak = {
      user_id: 'user-123',
      current_streak: 5,
      longest_streak: 12,
      last_logged_date: '2026-10-10',
      updated_at: '2026-10-10T12:00:00Z',
    };

    const client = createMockSupabase({
      fromHandler: (table) => {
        expect(table).toBe('user_streaks');
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: mockStreak, error: null }),
            }),
          }),
        };
      },
    });

    const result = await fetchUserStreaks(client);
    expect(result).toEqual(mockStreak);
  });

  it('fetchRoomStreak queries room_streaks table', async () => {
    const mockRoomStreak = {
      room_id: 'room-1',
      current_streak: 7,
      longest_streak: 14,
      last_achieved_date: '2026-10-10',
      updated_at: '2026-10-10T12:00:00Z',
    };

    const client = createMockSupabase({
      fromHandler: (table) => {
        expect(table).toBe('room_streaks');
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: mockRoomStreak, error: null }),
            }),
          }),
        };
      },
    });

    const result = await fetchRoomStreak(client, 'room-1');
    expect(result).toEqual(mockRoomStreak);
  });

  it('parseProgressError handles error mapping correctly', () => {
    const errAuth = parseProgressError(new Error('PGRST301: UNAUTHENTICATED'));
    expect(errAuth.code).toBe('UNAUTHENTICATED');

    const errMember = parseProgressError(new Error('NOT_A_ROOM_MEMBER'));
    expect(errMember.code).toBe('NOT_A_ROOM_MEMBER');

    const errAccessible = parseProgressError(new Error('ROOM_NOT_ACCESSIBLE'));
    expect(errAccessible.code).toBe('ROOM_NOT_ACCESSIBLE');
  });
});
