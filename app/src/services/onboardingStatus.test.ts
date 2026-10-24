import { describe, expect, it, vi } from 'vitest';
import { isUserOnboarded } from './onboardingStatus';
import * as targetsModule from '@/services/targetsService';
import type { TargetsDb } from '@/services/targetsService';
import type { SupabaseClient } from '@supabase/supabase-js';

describe('isUserOnboarded', () => {
  const fakeDb: TargetsDb = {
    runAsync: vi.fn(),
    getAllAsync: vi.fn(),
    getFirstAsync: vi.fn(),
  };

  it('returns false for null or undefined user id', async () => {
    expect(await isUserOnboarded(null, fakeDb)).toBe(false);
    expect(await isUserOnboarded(undefined, fakeDb)).toBe(false);
    expect(await isUserOnboarded('', fakeDb)).toBe(false);
  });

  it('reports unavailable server data instead of classifying an existing user as new', async () => {
    vi.spyOn(targetsModule, 'getCurrentLocalGoalProfile').mockResolvedValue(null);
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
      maybeSingle: async () => ({ data: null, error: { message: 'Network unavailable' } }),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.order.mockReturnValue(query);
    query.limit.mockReturnValue(query);
    const client = { from: () => query } as unknown as SupabaseClient;
    await expect(isUserOnboarded('existing-user', fakeDb, client)).rejects.toThrow(
      'Network unavailable',
    );
  });

  it('returns true if local goal profile exists in SQLite', async () => {
    vi.spyOn(targetsModule, 'getCurrentLocalGoalProfile').mockResolvedValue({
      id: 'gp-1',
      user_id: 'user-123',
    } as any);

    const result = await isUserOnboarded('user-123', fakeDb);
    expect(result).toBe(true);
  });

  it('returns true and caches locally if goal profile exists in Supabase', async () => {
    vi.spyOn(targetsModule, 'getCurrentLocalGoalProfile').mockResolvedValue(null);
    const saveLocalSpy = vi.spyOn(targetsModule, 'saveLocalGoalProfile').mockResolvedValue();

    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'goal_profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: { id: 'remote-gp-1', user_id: 'user-456' },
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      }),
    } as any;

    const result = await isUserOnboarded('user-456', fakeDb, mockSupabase);
    expect(result).toBe(true);
    expect(saveLocalSpy).toHaveBeenCalled();
  });

  it('requires saved targets even when an existing account has a nickname', async () => {
    vi.spyOn(targetsModule, 'getCurrentLocalGoalProfile').mockResolvedValue(null);

    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'goal_profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                  }),
                }),
              }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 'user-789', nickname: 'Alex', username: 'alex_fitness' },
                error: null,
              }),
            }),
          }),
        };
      }),
    } as any;

    const result = await isUserOnboarded('user-789', fakeDb, mockSupabase);
    expect(result).toBe(false);
  });

  it('returns false if neither local nor remote profile exists', async () => {
    vi.spyOn(targetsModule, 'getCurrentLocalGoalProfile').mockResolvedValue(null);

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    } as any;

    const result = await isUserOnboarded('brand-new-user', fakeDb, mockSupabase);
    expect(result).toBe(false);
  });
});
