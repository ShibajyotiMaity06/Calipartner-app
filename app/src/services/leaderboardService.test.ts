import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  fetchLeaderboard,
  fetchLeaderboardOptOutStatus,
  LeaderboardServiceError,
  parseLeaderboardError,
  setLeaderboardOptOut,
} from './leaderboardService';

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

describe('leaderboardService', () => {
  it('fetchLeaderboard calls get_leaderboard with week_start', async () => {
    const mockLeaderboard = {
      opted_out: false,
      division: 'cutting',
      cohort_id: 'cutting_asia_in_c0',
      week_start_date: '2026-10-05',
      top_10: [
        { rank: 1, nickname: 'Alice', avatar_url: null, consistency_score: 95, is_me: false },
      ],
      my_rank: { rank: 2, nickname: 'Me', avatar_url: null, consistency_score: 90, is_eligible: true },
      total_in_cohort: 80,
      info_note: 'Ranked by consistency, not restriction.',
    };

    const client = createMockSupabase({
      rpcHandler: async (fn, args) => {
        expect(fn).toBe('get_leaderboard');
        expect(args.p_week_start).toBe('2026-10-05');
        return { data: mockLeaderboard, error: null };
      },
    });

    const result = await fetchLeaderboard(client, '2026-10-05');
    expect(result).toEqual(mockLeaderboard);
  });

  it('setLeaderboardOptOut calls set_leaderboard_opt_out RPC', async () => {
    let calledOptOut: boolean | null = null;
    const client = createMockSupabase({
      rpcHandler: async (fn, args) => {
        expect(fn).toBe('set_leaderboard_opt_out');
        calledOptOut = args.p_opted_out as boolean;
        return { data: null, error: null };
      },
    });

    await setLeaderboardOptOut(client, true);
    expect(calledOptOut).toBe(true);
  });

  it('fetchLeaderboardOptOutStatus queries leaderboard_settings', async () => {
    const client = createMockSupabase({
      fromHandler: (table) => {
        expect(table).toBe('leaderboard_settings');
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { opted_out: true }, error: null }),
            }),
          }),
        };
      },
    });

    const optedOut = await fetchLeaderboardOptOutStatus(client);
    expect(optedOut).toBe(true);
  });

  it('parseLeaderboardError parses unauthenticated error', () => {
    const err = parseLeaderboardError(new Error('UNAUTHENTICATED'));
    expect(err).toBeInstanceOf(LeaderboardServiceError);
    expect(err.code).toBe('UNAUTHENTICATED');
  });
});
