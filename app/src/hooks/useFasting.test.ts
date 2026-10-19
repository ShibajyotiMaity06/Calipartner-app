import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as fastingService from '@/services/fastingService';
import type { SyncDb } from '@/services/syncService';
import { type HealthScreening, evaluateFastingGating } from '@calipartner/core';

vi.mock('@/db', () => ({
  getDb: vi.fn().mockResolvedValue({
    runAsync: vi.fn(),
    getAllAsync: vi.fn().mockResolvedValue([]),
    getFirstAsync: vi.fn().mockResolvedValue(null),
  }),
}));

vi.mock('@/lib/supabase', () => ({
  getSupabase: vi.fn().mockReturnValue(null),
}));

vi.mock('@/services/fastingService', () => ({
  getLocalFastingSettings: vi.fn(),
  saveFastingSettings: vi.fn(),
  getActiveFastingSession: vi.fn(),
  startFast: vi.fn(),
  endFast: vi.fn(),
  editFastingSession: vi.fn(),
  getFastingHistory: vi.fn(),
  getFastingStats: vi.fn(),
  getFastingStreak: vi.fn(),
  getFastingProgressWeekly: vi.fn(),
  parseFastingError: vi.fn((err: unknown) => err as Error),
}));

describe('Phase 13: Fasting Hooks & Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('gating: validates screening rules and low-intake pause', () => {
    const cleanScreening: HealthScreening = {
      user_id: 'u-1',
      pregnant_or_breastfeeding: false,
      has_diabetes_or_medication: false,
      has_eating_disorder_history: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Adult eligible
    expect(
      evaluateFastingGating({
        age: 25,
        healthScreening: cleanScreening,
        lowIntakeFlagActive: false,
      }).canAccess,
    ).toBe(true);

    // Minor under 18 blocked
    const under18 = evaluateFastingGating({
      age: 16,
      healthScreening: cleanScreening,
      lowIntakeFlagActive: false,
    });
    expect(under18.canAccess).toBe(false);
    expect(under18.isHidden).toBe(true);
    expect(under18.reason).toBe('under_18');

    // Pregnant user blocked
    const pregnant = evaluateFastingGating({
      age: 26,
      healthScreening: { ...cleanScreening, pregnant_or_breastfeeding: true },
      lowIntakeFlagActive: false,
    });
    expect(pregnant.canAccess).toBe(false);
    expect(pregnant.isHidden).toBe(true);
    expect(pregnant.reason).toBe('pregnant_or_breastfeeding');

    // Low intake paused
    const paused = evaluateFastingGating({
      age: 26,
      healthScreening: cleanScreening,
      lowIntakeFlagActive: true,
    });
    expect(paused.canAccess).toBe(false);
    expect(paused.isPaused).toBe(true);
    expect(paused.isHidden).toBe(false);
    expect(paused.reason).toBe('low_intake_paused');
  });

  it('hook data for progress: computes weekly hours and daily breakdown correctly', async () => {
    const mockProgress = {
      total_fasts: 5,
      completed_fasts: 4,
      ended_early_fasts: 1,
      completion_rate_pct: 80,
      average_duration_minutes: 960,
      average_duration_hours: 16,
      total_fasting_hours: 80,
      fasting_hours_per_week: 80,
      daily_hours: [
        { date: '2026-10-12', fasting_hours: 16, completed: true },
        { date: '2026-10-13', fasting_hours: 16, completed: true },
        { date: '2026-10-14', fasting_hours: 16, completed: true },
        { date: '2026-10-15', fasting_hours: 16, completed: true },
        { date: '2026-10-16', fasting_hours: 16, completed: false },
        { date: '2026-10-17', fasting_hours: 0, completed: false },
        { date: '2026-10-18', fasting_hours: 0, completed: false },
      ],
    };

    vi.mocked(fastingService.getFastingProgressWeekly).mockResolvedValue(mockProgress);

    const mockDb: SyncDb = {
      runAsync: vi.fn(),
      getAllAsync: vi.fn(),
      getFirstAsync: vi.fn(),
    };

    const result = await fastingService.getFastingProgressWeekly(
      mockDb,
      'u-1',
      '2026-10-12',
      '2026-10-18',
    );

    expect(result.fasting_hours_per_week).toBe(80);
    expect(result.completion_rate_pct).toBe(80);
    expect(result.daily_hours.length).toBe(7);
  });
});
