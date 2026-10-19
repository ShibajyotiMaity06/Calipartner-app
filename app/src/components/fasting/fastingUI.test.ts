import { describe, expect, it } from 'vitest';
import {
  evaluateFastingGating,
  FASTING_PROTOCOLS,
  MAX_PLANNED_FASTING_MINUTES,
  MIN_PLANNED_FASTING_MINUTES,
  STRONG_END_FAST_MINUTES,
  CHECK_IN_MAX_HOURS_MINUTES,
  computeFastingState,
  type FastingProtocol,
  type FastingSession,
} from '@calipartner/core';
import { en } from '@/i18n/en';
import { t } from '@/i18n';

describe('Phase UI-7: Fasting UI Logic, Copy & Safety Rules (F01–F06)', () => {
  describe('F01: Fasting Gating & Health Safety Screening', () => {
    it('blocks access for individuals under 18 years of age', () => {
      const result = evaluateFastingGating({
        age: 17,
        healthScreening: null,
      });

      expect(result.canAccess).toBe(false);
      expect(result.reason).toBe('under_18');
      expect(t('fasting.screeningWarningUnder18')).toContain('18 and older');
    });

    it('blocks access if pregnancy or breastfeeding is reported', () => {
      const result = evaluateFastingGating({
        age: 26,
        healthScreening: {
          user_id: 'user-1',
          pregnant_or_breastfeeding: true,
          has_diabetes_or_medication: false,
          has_eating_disorder_history: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      });

      expect(result.canAccess).toBe(false);
      expect(result.reason).toBe('pregnant_or_breastfeeding');
      expect(t('fasting.screeningWarningPregnant')).toContain('pregnancy or breastfeeding');
    });

    it('blocks access if history of disordered eating is reported', () => {
      const result = evaluateFastingGating({
        age: 30,
        healthScreening: {
          user_id: 'user-1',
          pregnant_or_breastfeeding: false,
          has_diabetes_or_medication: false,
          has_eating_disorder_history: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      });

      expect(result.canAccess).toBe(false);
      expect(result.reason).toBe('eating_disorder_history');
      expect(t('fasting.screeningWarningDisorder')).toContain('disordered eating');
    });

    it('blocks access if diabetes or medication is reported', () => {
      const result = evaluateFastingGating({
        age: 35,
        healthScreening: {
          user_id: 'user-1',
          pregnant_or_breastfeeding: false,
          has_diabetes_or_medication: true,
          has_eating_disorder_history: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      });

      expect(result.canAccess).toBe(false);
      expect(result.reason).toBe('diabetes_or_medication');
      expect(t('fasting.screeningWarningDiabetes')).toContain('diabetes');
    });

    it('pauses fasting when low-intake check-in is active', () => {
      const result = evaluateFastingGating({
        age: 25,
        healthScreening: null,
        lowIntakeFlagActive: true,
      });

      expect(result.canAccess).toBe(false);
      expect(result.reason).toBe('low_intake_paused');
    });

    it('allows access for healthy adult with clean screening', () => {
      const result = evaluateFastingGating({
        age: 28,
        healthScreening: {
          user_id: 'user-1',
          pregnant_or_breastfeeding: false,
          has_diabetes_or_medication: false,
          has_eating_disorder_history: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        lowIntakeFlagActive: false,
      });

      expect(result.canAccess).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('strictly forbids ketosis, autophagy, or fat-burning claims in fasting copy (FST-10)', () => {
      const allFastingStrings = JSON.stringify(en.fasting).toLowerCase();

      expect(allFastingStrings).not.toContain('ketosis');
      expect(allFastingStrings).not.toContain('autophagy');
      expect(allFastingStrings).not.toContain('fat burning');
      expect(allFastingStrings).not.toContain('fat-burning');
      expect(allFastingStrings).not.toContain('burn fat');
    });
  });

  describe('F02: Protocols & Maximum Fast Duration Caps', () => {
    it('provides standard supported protocols: 12:12, 14:10, 16:8, 18:6, 20:4, and custom', () => {
      const supportedProtocols: FastingProtocol[] = [
        '12:12',
        '14:10',
        '16:8',
        '18:6',
        '20:4',
        'custom',
      ];

      supportedProtocols.forEach((proto) => {
        expect(FASTING_PROTOCOLS[proto]).toBeDefined();
        expect(FASTING_PROTOCOLS[proto].fastingHours).toBeGreaterThanOrEqual(12);
        expect(FASTING_PROTOCOLS[proto].fastingHours).toBeLessThanOrEqual(20);
      });
    });

    it('enforces maximum planned fast duration cap of 20 hours (1200 minutes)', () => {
      expect(MAX_PLANNED_FASTING_MINUTES).toBe(1200);
      expect(MIN_PLANNED_FASTING_MINUTES).toBe(60);

      expect(FASTING_PROTOCOLS['20:4'].fastingHours).toBe(20);
      expect(FASTING_PROTOCOLS['20:4'].plannedMinutes).toBe(1200);
    });

    it('validates custom duration between 1 and 20 hours', () => {
      const validateCustomHours = (h: number) => h >= 1 && h <= 20;

      expect(validateCustomHours(1)).toBe(true);
      expect(validateCustomHours(16)).toBe(true);
      expect(validateCustomHours(20)).toBe(true);
      expect(validateCustomHours(0)).toBe(false);
      expect(validateCustomHours(21)).toBe(false);
      expect(validateCustomHours(24)).toBe(false);
    });
  });

  describe('F03 & F04: Active Fasting State & Transitions', () => {
    it('computes elapsed and remaining time correctly during an active fast', () => {
      const startTime = new Date('2026-10-19T00:00:00Z');
      const now = new Date('2026-10-19T10:00:00Z'); // 10 hours later = 600 minutes

      const mockSession: FastingSession = {
        id: 'fast-1',
        user_id: 'user-1',
        start_at: startTime.toISOString(),
        end_at: null,
        planned_minutes: 960, // 16 hours
        status: 'active',
        local_date: '2026-10-19',
        created_at: startTime.toISOString(),
        updated_at: startTime.toISOString(),
      };

      const state = computeFastingState(mockSession, now);

      expect(state.isActive).toBe(true);
      expect(state.elapsedMinutes).toBe(600);
      expect(state.remainingMinutes).toBe(360); // 960 - 600
      expect(state.progressPercentage).toBe(63);
      expect(state.isPastPlanned).toBe(false);
    });

    it('marks fast as completed when elapsed time reaches planned duration', () => {
      const startTime = new Date('2026-10-19T00:00:00Z');
      const now = new Date('2026-10-19T16:00:00Z'); // Exactly 16 hours

      const mockSession: FastingSession = {
        id: 'fast-2',
        user_id: 'user-1',
        start_at: startTime.toISOString(),
        end_at: null,
        planned_minutes: 960, // 16 hours
        status: 'active',
        local_date: '2026-10-19',
        created_at: startTime.toISOString(),
        updated_at: startTime.toISOString(),
      };

      const state = computeFastingState(mockSession, now);

      expect(state.isActive).toBe(true);
      expect(state.elapsedMinutes).toBe(960);
      expect(state.remainingMinutes).toBe(0);
      expect(state.progressPercentage).toBe(100);
      expect(state.isPastPlanned).toBe(true);
    });
  });

  describe('F06: Safety Check-in Triggers (20h & 24h Limits)', () => {
    it('triggers 20-hour check-in prompt when fast reaches 20 hours', () => {
      const startTime = new Date('2026-10-19T00:00:00Z');
      const now20h = new Date('2026-10-19T20:00:00Z'); // 20 hours = 1200 minutes

      const mockSession: FastingSession = {
        id: 'fast-3',
        user_id: 'user-1',
        start_at: startTime.toISOString(),
        end_at: null,
        planned_minutes: 1200,
        status: 'active',
        local_date: '2026-10-19',
        created_at: startTime.toISOString(),
        updated_at: startTime.toISOString(),
      };

      const state = computeFastingState(mockSession, now20h);

      expect(state.elapsedMinutes).toBe(CHECK_IN_MAX_HOURS_MINUTES);
      expect(state.checkInPrompt).toBe(true);
      expect(state.strongEndFastPrompt).toBe(false);
      expect(t('fasting.checkIn20Title')).toBe('How are you feeling?');
    });

    it('triggers strong end fast prompt at 24 hours (1440 minutes)', () => {
      const startTime = new Date('2026-10-19T00:00:00Z');
      const now24h = new Date('2026-10-19T24:00:00Z'); // 24 hours = 1440 minutes

      const mockSession: FastingSession = {
        id: 'fast-4',
        user_id: 'user-1',
        start_at: startTime.toISOString(),
        end_at: null,
        planned_minutes: 1200,
        status: 'active',
        local_date: '2026-10-19',
        created_at: startTime.toISOString(),
        updated_at: startTime.toISOString(),
      };

      const state = computeFastingState(mockSession, now24h);

      expect(state.elapsedMinutes).toBe(STRONG_END_FAST_MINUTES);
      expect(state.strongEndFastPrompt).toBe(true);
      expect(t('fasting.checkIn24Title')).toBe('Time to eat.');
      expect(t('fasting.checkIn24Subtitle')).toContain('Prolonged fasts beyond 24 hours are not supported');
    });
  });

  describe('F05: Fasting History & Stats Calculations', () => {
    it('computes completion rate, total fasts, and average duration accurately', () => {
      const mockHistory: FastingSession[] = [
        {
          id: '1',
          user_id: 'u1',
          start_at: '2026-10-16T20:00:00Z',
          end_at: '2026-10-17T12:00:00Z', // 16h = 960m
          planned_minutes: 960,
          status: 'completed',
          local_date: '2026-10-17',
          created_at: '2026-10-16T20:00:00Z',
          updated_at: '2026-10-17T12:00:00Z',
        },
        {
          id: '2',
          user_id: 'u1',
          start_at: '2026-10-17T20:00:00Z',
          end_at: '2026-10-18T10:00:00Z', // 14h = 840m
          planned_minutes: 960,
          status: 'ended_early',
          local_date: '2026-10-18',
          created_at: '2026-10-17T20:00:00Z',
          updated_at: '2026-10-18T10:00:00Z',
        },
      ];

      const totalFasts = mockHistory.length;
      const completedFasts = mockHistory.filter((s) => s.status === 'completed').length;
      const completionRate = Math.round((completedFasts / totalFasts) * 100);
      const totalMinutes = mockHistory.reduce((acc, s) => {
        const m = s.end_at
          ? Math.round((new Date(s.end_at).getTime() - new Date(s.start_at).getTime()) / 60000)
          : s.planned_minutes;
        return acc + m;
      }, 0);
      const avgMinutes = totalMinutes / totalFasts;
      const avgHours = avgMinutes / 60;

      expect(totalFasts).toBe(2);
      expect(completionRate).toBe(50);
      expect(avgHours).toBe(15);
    });

    it('contains plain, supportive strings for CMP-14 table and stats', () => {
      expect(t('fasting.safeFastingNotice')).toContain('Never used for ranking');
      expect(t('fasting.tableHeaderDate')).toBe('Date');
      expect(t('fasting.tableHeaderPlanned')).toBe('Planned');
      expect(t('fasting.tableHeaderActual')).toBe('Actual');
      expect(t('fasting.tableHeaderStatus')).toBe('Status');
    });
  });
});
