import { describe, expect, it } from 'vitest';
import {
  buildFastingReminderSchedules,
  calculateFastingProgress,
  calculateFastingStats,
  calculateFastingStreak,
  calculateScheduledWindow,
  computeFastingState,
  DEFAULT_FASTING_SETTINGS,
  evaluateFastingGating,
  evaluateFastingSafetyPrompts,
  FASTING_PROTOCOLS,
  getFoodLogFastingPrompt,
  getProtocolPlannedMinutes,
  MAX_PLANNED_FASTING_MINUTES,
  MIN_PLANNED_FASTING_MINUTES,
  validatePlannedMinutes,
} from './fasting';
import type { FastingSession, FastingSettings, HealthScreening } from './types';

describe('Phase 13: Fasting Tracker Logic (PRD 6.20, 7.9, 8.1)', () => {
  // ---------------------------------------------------------------------------
  // 1. Protocols & Validation
  // ---------------------------------------------------------------------------
  describe('Protocols & Planned Duration Validation (PRD 6.20 FST-2, 7.9)', () => {
    it('defines standard supported protocols up to 20 hours', () => {
      expect(FASTING_PROTOCOLS['12:12'].plannedMinutes).toBe(720);
      expect(FASTING_PROTOCOLS['14:10'].plannedMinutes).toBe(840);
      expect(FASTING_PROTOCOLS['16:8'].plannedMinutes).toBe(960);
      expect(FASTING_PROTOCOLS['18:6'].plannedMinutes).toBe(1080);
      expect(FASTING_PROTOCOLS['20:4'].plannedMinutes).toBe(1200);
      expect(FASTING_PROTOCOLS['custom'].protocol).toBe('custom');
    });

    it('enforces maximum planned fast of 20 hours (1200 minutes) and minimum 1 hour (60 minutes)', () => {
      expect(MIN_PLANNED_FASTING_MINUTES).toBe(60);
      expect(MAX_PLANNED_FASTING_MINUTES).toBe(1200);
      expect(validatePlannedMinutes(1200).valid).toBe(true);
      expect(validatePlannedMinutes(960).valid).toBe(true);
      expect(validatePlannedMinutes(720).valid).toBe(true);

      // Rejects under 1 hour
      const under1h = validatePlannedMinutes(59);
      expect(under1h.valid).toBe(false);

      // Rejects over 20 hours
      const over20h = validatePlannedMinutes(1201);
      expect(over20h.valid).toBe(false);
      expect(over20h.error).toContain('Maximum planned fast duration is 20 hours');
    });

    it('strictly prohibits OMAD and multi-day fasts (PRD 6.20 FST-2)', () => {
      // OMAD (e.g. 23:1 -> 1380 minutes)
      const omad = validatePlannedMinutes(23 * 60);
      expect(omad.valid).toBe(false);
      expect(omad.error).toContain('OMAD and multi-day fasts are not permitted');

      // 24 hours
      const oneDay = validatePlannedMinutes(24 * 60);
      expect(oneDay.valid).toBe(false);

      // Multi-day (e.g. 36 hours, 48 hours)
      const multiDay = validatePlannedMinutes(36 * 60);
      expect(multiDay.valid).toBe(false);
    });

    it('validates minimum planned fast duration (1 hour)', () => {
      expect(validatePlannedMinutes(60).valid).toBe(true);
      expect(validatePlannedMinutes(30).valid).toBe(false);
      expect(validatePlannedMinutes(0).valid).toBe(false);
      expect(validatePlannedMinutes(-10).valid).toBe(false);
    });

    it('gets planned minutes for standard and custom protocols', () => {
      expect(getProtocolPlannedMinutes('16:8')).toBe(960);
      expect(getProtocolPlannedMinutes('20:4')).toBe(1200);
      expect(getProtocolPlannedMinutes('custom', 15)).toBe(900);
      // Custom clamps between 1 and 20 hours
      expect(getProtocolPlannedMinutes('custom', 25)).toBe(1200);
      expect(getProtocolPlannedMinutes('custom', 0)).toBe(60);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Fast State Computation (Clock-based, Timestamps)
  // ---------------------------------------------------------------------------
  describe('Fast State Computation from Timestamps (PRD 6.20 FST-3, FST-12, 7.9)', () => {
    it('computes elapsed, remaining and progress percentage for active session', () => {
      const startAt = '2026-10-18T10:00:00.000Z';
      const session: FastingSession = {
        id: 'sess-1',
        user_id: 'user-1',
        start_at: startAt,
        planned_minutes: 960, // 16 hours
        status: 'active',
        local_date: '2026-10-18',
        created_at: startAt,
        updated_at: startAt,
      };

      // 4 hours in (240 minutes)
      const now = '2026-10-18T14:00:00.000Z';
      const state = computeFastingState(session, now);

      expect(state.isActive).toBe(true);
      expect(state.elapsedMinutes).toBe(240);
      expect(state.remainingMinutes).toBe(720); // 960 - 240
      expect(state.progressPercentage).toBe(25); // 240 / 960 * 100
      expect(state.isPastPlanned).toBe(false);
      expect(state.isCompleted).toBe(false);
      expect(state.checkInPrompt).toBe(false);
      expect(state.strongEndFastPrompt).toBe(false);
    });

    it('computes completed state when session ended at or after planned duration', () => {
      const startAt = '2026-10-18T00:00:00.000Z';
      const endAt = '2026-10-18T16:30:00.000Z'; // 16.5 hours = 990 minutes
      const session: FastingSession = {
        id: 'sess-2',
        user_id: 'user-1',
        start_at: startAt,
        planned_minutes: 960, // 16 hours
        end_at: endAt,
        status: 'completed',
        local_date: '2026-10-18',
        created_at: startAt,
        updated_at: endAt,
      };

      const state = computeFastingState(session);
      expect(state.isActive).toBe(false);
      expect(state.isCompleted).toBe(true);
      expect(state.elapsedMinutes).toBe(990);
      expect(state.remainingMinutes).toBe(0);
      expect(state.progressPercentage).toBe(100);
      expect(state.isPastPlanned).toBe(true);
    });

    it('computes ended_early state neutrally when ended before planned duration', () => {
      const startAt = '2026-10-18T00:00:00.000Z';
      const endAt = '2026-10-18T12:00:00.000Z'; // 12 hours = 720 minutes (planned 960)
      const session: FastingSession = {
        id: 'sess-3',
        user_id: 'user-1',
        start_at: startAt,
        planned_minutes: 960,
        end_at: endAt,
        status: 'ended_early',
        local_date: '2026-10-18',
        created_at: startAt,
        updated_at: endAt,
      };

      const state = computeFastingState(session);
      expect(state.isActive).toBe(false);
      expect(state.isCompleted).toBe(false);
      expect(state.elapsedMinutes).toBe(720);
      expect(state.remainingMinutes).toBe(0);
      expect(state.progressPercentage).toBe(75);
    });

    it('survives kill-and-reopen correctly without drift or state loss', () => {
      // Simulate app killed at 12:00 and reopened at 15:30
      const startAt = '2026-10-18T08:00:00.000Z';
      const session: FastingSession = {
        id: 'sess-kill-test',
        user_id: 'user-1',
        start_at: startAt,
        planned_minutes: 960,
        status: 'active',
        local_date: '2026-10-18',
        created_at: startAt,
        updated_at: startAt,
      };

      // State before kill (12:00 -> 4h elapsed)
      const stateBeforeKill = computeFastingState(session, '2026-10-18T12:00:00.000Z');
      expect(stateBeforeKill.elapsedMinutes).toBe(240);

      // State upon reopening after 3.5 hours (15:30 -> 7.5h = 450m elapsed)
      const stateAfterReopen = computeFastingState(session, '2026-10-18T15:30:00.000Z');
      expect(stateAfterReopen.elapsedMinutes).toBe(450);
      expect(stateAfterReopen.remainingMinutes).toBe(510);
      expect(stateAfterReopen.isActive).toBe(true);
    });

    it('handles time zone change safely (UTC arithmetic)', () => {
      // Fast started in UTC, user flies to Tokyo (+9h)
      const startAt = '2026-10-18T04:00:00.000Z';
      const session: FastingSession = {
        id: 'sess-tz-test',
        user_id: 'user-1',
        start_at: startAt,
        planned_minutes: 960,
        status: 'active',
        local_date: '2026-10-18',
        created_at: startAt,
        updated_at: startAt,
      };

      // 6 hours later evaluated anywhere on earth
      const evalTime = '2026-10-18T10:00:00.000Z';
      const state = computeFastingState(session, evalTime);
      expect(state.elapsedMinutes).toBe(360);
      expect(state.remainingMinutes).toBe(600);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Safety Prompts & Interceptions (PRD 6.20 FST-5, FST-11, 7.9, 8.1)
  // ---------------------------------------------------------------------------
  describe('Safety Prompts & Food Logging Interceptions', () => {
    it('triggers check-in prompt when fast runs 2 hours past plan', () => {
      // Planned: 16 hours (960 min)
      // At 17.5 hours (1050 min) -> not yet 2 hours past plan
      const prompts1 = evaluateFastingSafetyPrompts(1050, 960);
      expect(prompts1.checkInPrompt).toBe(false);
      expect(prompts1.strongEndFastPrompt).toBe(false);

      // At 18 hours (1080 min) -> exactly 2 hours past plan (120 min)
      const prompts2 = evaluateFastingSafetyPrompts(1080, 960);
      expect(prompts2.checkInPrompt).toBe(true);
      expect(prompts2.strongEndFastPrompt).toBe(false);
      expect(prompts2.reason).toBe('past_plan_2h');
    });

    it('triggers check-in prompt when fast runs past 20 hours regardless of plan', () => {
      // Planned 14 hours (840 min)
      // At 20.5 hours (1230 min) -> past 20h mark
      const prompts = evaluateFastingSafetyPrompts(1230, 840);
      expect(prompts.checkInPrompt).toBe(true);
      expect(prompts.strongEndFastPrompt).toBe(false);
    });

    it('triggers strong end-fast prompt at or past 24 hours (1440 min)', () => {
      const prompts = evaluateFastingSafetyPrompts(1440, 960);
      expect(prompts.checkInPrompt).toBe(true);
      expect(prompts.strongEndFastPrompt).toBe(true);
      expect(prompts.reason).toBe('at_or_past_24h');

      const promptsOver = evaluateFastingSafetyPrompts(1500, 960);
      expect(promptsOver.strongEndFastPrompt).toBe(true);
    });

    it('shows non-blocking prompt when food is logged during active fast (PRD FST-5)', () => {
      const promptActive = getFoodLogFastingPrompt(true);
      expect(promptActive.shouldPrompt).toBe(true);
      expect(promptActive.title).toBe('Log this and end your fast?');
      expect(promptActive.message).toContain('keep your timer going');

      const promptInactive = getFoodLogFastingPrompt(false);
      expect(promptInactive.shouldPrompt).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Scheduled-Window Mode (PRD 6.20 FST-4)
  // ---------------------------------------------------------------------------
  describe('Scheduled-Window Mode Calculation', () => {
    it('detects eating window during normal daytime window (12:00 to 20:00 UTC)', () => {
      // At 14:30 UTC -> inside eating window
      const result = calculateScheduledWindow({
        eatingWindowStart: '12:00',
        eatingWindowEnd: '20:00',
        referenceTime: '2026-10-18T14:30:00.000Z',
      });

      expect(result.isEatingWindow).toBe(true);
      expect(result.plannedFastingMinutes).toBe(960); // 16 hours fasting
    });

    it('detects fasting window during normal daytime window (12:00 to 20:00 UTC)', () => {
      // At 08:00 UTC -> inside fasting window
      const result = calculateScheduledWindow({
        eatingWindowStart: '12:00',
        eatingWindowEnd: '20:00',
        referenceTime: '2026-10-18T08:00:00.000Z',
      });

      expect(result.isEatingWindow).toBe(false);
    });

    it('handles overnight eating windows seamlessly (20:00 to 02:00 UTC)', () => {
      // At 22:00 UTC -> inside overnight eating window
      const resultLateNight = calculateScheduledWindow({
        eatingWindowStart: '20:00',
        eatingWindowEnd: '02:00',
        referenceTime: '2026-10-18T22:00:00.000Z',
      });
      expect(resultLateNight.isEatingWindow).toBe(true);

      // At 01:00 UTC -> inside overnight eating window
      const resultEarlyMorning = calculateScheduledWindow({
        eatingWindowStart: '20:00',
        eatingWindowEnd: '02:00',
        referenceTime: '2026-10-18T01:00:00.000Z',
      });
      expect(resultEarlyMorning.isEatingWindow).toBe(true);

      // At 10:00 UTC -> fasting window
      const resultFasting = calculateScheduledWindow({
        eatingWindowStart: '20:00',
        eatingWindowEnd: '02:00',
        referenceTime: '2026-10-18T10:00:00.000Z',
      });
      expect(resultFasting.isEatingWindow).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Gating Matrix (PRD 6.20 FST-1, FST-11, 6.2 ONB-11, 7.9, 8.1)
  // ---------------------------------------------------------------------------
  describe('Gating Matrix', () => {
    const cleanScreening: HealthScreening = {
      user_id: 'user-1',
      pregnant_or_breastfeeding: false,
      has_diabetes_or_medication: false,
      has_eating_disorder_history: false,
      created_at: '2026-10-01T00:00:00.000Z',
      updated_at: '2026-10-01T00:00:00.000Z',
    };

    it('allows eligible adult with clean screening and no low-intake flag', () => {
      const result = evaluateFastingGating({
        age: 25,
        healthScreening: cleanScreening,
        lowIntakeFlagActive: false,
      });

      expect(result.canAccess).toBe(true);
      expect(result.isPaused).toBe(false);
      expect(result.isHidden).toBe(false);
      expect(result.reason).toBeUndefined();
    });

    it('hides feature for under-18 users (PRD 8.1)', () => {
      const result = evaluateFastingGating({
        age: 17,
        healthScreening: cleanScreening,
        lowIntakeFlagActive: false,
      });

      expect(result.canAccess).toBe(false);
      expect(result.isHidden).toBe(true);
      expect(result.reason).toBe('under_18');
    });

    it('hides feature for pregnant or breastfeeding users (PRD ONB-11, 7.9)', () => {
      const screening: HealthScreening = {
        ...cleanScreening,
        pregnant_or_breastfeeding: true,
      };

      const result = evaluateFastingGating({
        age: 28,
        healthScreening: screening,
        lowIntakeFlagActive: false,
      });

      expect(result.canAccess).toBe(false);
      expect(result.isHidden).toBe(true);
      expect(result.reason).toBe('pregnant_or_breastfeeding');
    });

    it('hides feature for users with diabetes or food-affecting medication (PRD ONB-11, 7.9)', () => {
      const screening: HealthScreening = {
        ...cleanScreening,
        has_diabetes_or_medication: true,
      };

      const result = evaluateFastingGating({
        age: 32,
        healthScreening: screening,
        lowIntakeFlagActive: false,
      });

      expect(result.canAccess).toBe(false);
      expect(result.isHidden).toBe(true);
      expect(result.reason).toBe('diabetes_or_medication');
    });

    it('hides feature for users with an eating disorder history (PRD ONB-11, 7.9, 8.1)', () => {
      const screening: HealthScreening = {
        ...cleanScreening,
        has_eating_disorder_history: true,
      };

      const result = evaluateFastingGating({
        age: 22,
        healthScreening: screening,
        lowIntakeFlagActive: false,
      });

      expect(result.canAccess).toBe(false);
      expect(result.isHidden).toBe(true);
      expect(result.reason).toBe('eating_disorder_history');
    });

    it('pauses (but does not hide) fasting when low-intake flag is active (PRD FST-11, 7.9)', () => {
      const result = evaluateFastingGating({
        age: 26,
        healthScreening: cleanScreening,
        lowIntakeFlagActive: true,
      });

      expect(result.canAccess).toBe(false);
      expect(result.isPaused).toBe(true);
      expect(result.isHidden).toBe(false);
      expect(result.reason).toBe('low_intake_paused');
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Stats & Fasting Streak (PRD 6.20 FST-7, FST-8, 7.9)
  // ---------------------------------------------------------------------------
  describe('Stats & Personal Streak Calculation', () => {
    const mockSessions: FastingSession[] = [
      {
        id: 's-1',
        user_id: 'user-1',
        start_at: '2026-10-15T00:00:00.000Z',
        end_at: '2026-10-15T16:00:00.000Z', // 16 hours
        planned_minutes: 960,
        status: 'completed',
        local_date: '2026-10-15',
        created_at: '2026-10-15T00:00:00.000Z',
        updated_at: '2026-10-15T16:00:00.000Z',
      },
      {
        id: 's-2',
        user_id: 'user-1',
        start_at: '2026-10-16T00:00:00.000Z',
        end_at: '2026-10-16T12:00:00.000Z', // 12 hours (ended early)
        planned_minutes: 960,
        status: 'ended_early',
        local_date: '2026-10-16',
        created_at: '2026-10-16T00:00:00.000Z',
        updated_at: '2026-10-16T12:00:00.000Z',
      },
      {
        id: 's-3',
        user_id: 'user-1',
        start_at: '2026-10-17T00:00:00.000Z',
        end_at: '2026-10-17T16:00:00.000Z', // 16 hours
        planned_minutes: 960,
        status: 'completed',
        local_date: '2026-10-17',
        created_at: '2026-10-17T00:00:00.000Z',
        updated_at: '2026-10-17T16:00:00.000Z',
      },
      {
        id: 's-4',
        user_id: 'user-1',
        start_at: '2026-10-18T00:00:00.000Z',
        end_at: '2026-10-18T16:30:00.000Z', // 16.5 hours
        planned_minutes: 960,
        status: 'completed',
        local_date: '2026-10-18',
        created_at: '2026-10-18T00:00:00.000Z',
        updated_at: '2026-10-18T16:30:00.000Z',
      },
    ];

    it('calculates completion rate, averages and total fasting hours', () => {
      const stats = calculateFastingStats(mockSessions);
      expect(stats.total_fasts).toBe(4);
      expect(stats.completed_fasts).toBe(3);
      expect(stats.ended_early_fasts).toBe(1);
      expect(stats.completion_rate_pct).toBe(75);
      expect(stats.longest_fast_minutes).toBe(990); // 16.5 hours
      expect(stats.total_fasting_hours).toBe(60.5); // 16 + 12 + 16 + 16.5
    });

    it('calculates personal streak correctly (PRD 7.9)', () => {
      // Days 17 and 18 are consecutive completed fasts, day 16 was ended early
      const streak = calculateFastingStreak(mockSessions, 'UTC', '2026-10-18T20:00:00.000Z');
      expect(streak.current_streak).toBe(2);
      expect(streak.longest_streak).toBe(2);
      expect(streak.last_completed_date).toBe('2026-10-18');
    });

    it('maintains streak if today is in progress and yesterday was completed', () => {
      // Day 17 was completed, Day 18 has no completed fast yet
      const streak = calculateFastingStreak(
        mockSessions.slice(0, 3),
        'UTC',
        '2026-10-18T10:00:00.000Z',
      );
      expect(streak.current_streak).toBe(1);
    });

    it('resets streak to 0 if a gap of 2 or more days occurs', () => {
      const streak = calculateFastingStreak(
        mockSessions.slice(0, 1), // Only Day 15
        'UTC',
        '2026-10-18T20:00:00.000Z',
      );
      expect(streak.current_streak).toBe(0);
      expect(streak.longest_streak).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // 7. Local Notification Schedules & Rescheduling (PRD 6.20 FST-6)
  // ---------------------------------------------------------------------------
  describe('Local Notification Schedules & Rescheduling', () => {
    const settings: FastingSettings = {
      ...DEFAULT_FASTING_SETTINGS,
      user_id: 'user-1',
      enabled: true,
      eating_window_end: '20:00',
    };

    it('schedules fast end reminder for active fast', () => {
      const activeSession: FastingSession = {
        id: 'sess-remind',
        user_id: 'user-1',
        start_at: '2026-10-18T10:00:00.000Z',
        planned_minutes: 960, // ends at 02:00 next day
        status: 'active',
        local_date: '2026-10-18',
        created_at: '2026-10-18T10:00:00.000Z',
        updated_at: '2026-10-18T10:00:00.000Z',
      };

      const schedules = buildFastingReminderSchedules({
        settings,
        activeSession,
        referenceTime: new Date('2026-10-18T12:00:00.000Z'),
      });

      const fastEndSchedule = schedules.find((s) => s.id === 'fasting_end_sess-remind');
      expect(fastEndSchedule).toBeDefined();
      expect(fastEndSchedule?.title).toBe('Fast completed!');
      expect(fastEndSchedule?.body).toContain('Break your fast gently');

      const closingSchedule = schedules.find((s) => s.id === 'fasting_eating_window_closing');
      expect(closingSchedule).toBeDefined();
      expect(closingSchedule?.trigger.hour).toBe(19);
      expect(closingSchedule?.trigger.minute).toBe(30);
    });

    it('suppresses reminders that fall into quiet hours', () => {
      const activeSession: FastingSession = {
        id: 'sess-quiet',
        user_id: 'user-1',
        start_at: '2026-10-18T07:00:00.000Z',
        planned_minutes: 960, // ends at 23:00 UTC
        status: 'active',
        local_date: '2026-10-18',
        created_at: '2026-10-18T07:00:00.000Z',
        updated_at: '2026-10-18T07:00:00.000Z',
      };

      const schedules = buildFastingReminderSchedules({
        settings,
        activeSession,
        quietHoursSettings: {
          enabled: true,
          start: '22:00',
          end: '07:00',
        },
        referenceTime: new Date('2026-10-18T08:00:00.000Z'),
      });

      const fastEndSchedule = schedules.find((s) => s.id === 'fasting_end_sess-quiet');
      expect(fastEndSchedule).toBeUndefined(); // Suppressed because 23:00 falls in quiet hours
    });

    it('reschedules correctly on session edit (start time or planned minutes changed)', () => {
      const initialSession: FastingSession = {
        id: 'sess-edit',
        user_id: 'user-1',
        start_at: '2026-10-18T10:00:00.000Z',
        planned_minutes: 960,
        status: 'active',
        local_date: '2026-10-18',
        created_at: '2026-10-18T10:00:00.000Z',
        updated_at: '2026-10-18T10:00:00.000Z',
      };

      const refTime = new Date('2026-10-18T12:00:00.000Z');
      const initialSchedules = buildFastingReminderSchedules({
        settings,
        activeSession: initialSession,
        referenceTime: refTime,
      });

      const initialDiff = initialSchedules.find((s) => s.id === 'fasting_end_sess-edit')?.trigger.seconds;

      // Edit planned minutes from 960 to 720 (12 hours)
      const editedSession: FastingSession = {
        ...initialSession,
        planned_minutes: 720,
        updated_at: '2026-10-18T12:00:00.000Z',
      };

      const editedSchedules = buildFastingReminderSchedules({
        settings,
        activeSession: editedSession,
        referenceTime: refTime,
      });

      const editedDiff = editedSchedules.find((s) => s.id === 'fasting_end_sess-edit')?.trigger.seconds;
      expect(editedDiff).toBeLessThan(initialDiff!);
      expect(initialDiff! - editedDiff!).toBe(240 * 60); // Exactly 4 hours (240 mins) less
    });
  });

  // ---------------------------------------------------------------------------
  // 8. Progress Data Calculation (PRD 6.20 FST-7)
  // ---------------------------------------------------------------------------
  describe('Progress Calculation (Fasting Hours / Week)', () => {
    it('computes weekly fasting hours and daily breakdown for range', () => {
      const sessions: FastingSession[] = [
        {
          id: 'p-1',
          user_id: 'user-1',
          start_at: '2026-10-12T00:00:00.000Z',
          end_at: '2026-10-12T16:00:00.000Z',
          planned_minutes: 960,
          status: 'completed',
          local_date: '2026-10-12',
          created_at: '2026-10-12T00:00:00.000Z',
          updated_at: '2026-10-12T16:00:00.000Z',
        },
        {
          id: 'p-2',
          user_id: 'user-1',
          start_at: '2026-10-13T00:00:00.000Z',
          end_at: '2026-10-13T16:00:00.000Z',
          planned_minutes: 960,
          status: 'completed',
          local_date: '2026-10-13',
          created_at: '2026-10-13T00:00:00.000Z',
          updated_at: '2026-10-13T16:00:00.000Z',
        },
        {
          id: 'p-3',
          user_id: 'user-1',
          start_at: '2026-10-14T00:00:00.000Z',
          end_at: '2026-10-14T16:00:00.000Z',
          planned_minutes: 960,
          status: 'completed',
          local_date: '2026-10-14',
          created_at: '2026-10-14T00:00:00.000Z',
          updated_at: '2026-10-14T16:00:00.000Z',
        },
      ];

      const progress = calculateFastingProgress(sessions, '2026-10-12', '2026-10-18');
      expect(progress.total_fasts).toBe(3);
      expect(progress.completed_fasts).toBe(3);
      expect(progress.total_fasting_hours).toBe(48); // 3 * 16h
      expect(progress.fasting_hours_per_week).toBe(48); // 7-day range
      expect(progress.daily_hours.length).toBe(7);
      expect(progress.daily_hours[0]?.fasting_hours).toBe(16);
      expect(progress.daily_hours[0]?.completed).toBe(true);
      expect(progress.daily_hours[3]?.fasting_hours).toBe(0);
      expect(progress.daily_hours[3]?.completed).toBe(false);
    });
  });
});
