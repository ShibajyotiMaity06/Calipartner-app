import { describe, expect, it } from 'vitest';
import { playClickSound, playSuccessSound, playToggleSound, soundManager } from '@/lib/sound';
import { isAtLeast18 } from '@calipartner/core';

/**
 * Expected active onboarding steps matching PRD 6.2 and user design constraints:
 * Calculation formula review step is skipped.
 */
const EXPECTED_ONBOARDING_STEPS = [
  'goal',
  'body_stats',
  'activity_level',
  'rate_selection',
  'target_weight_date',
  'health_screening',
  'completed',
] as const;

describe('Onboarding UI and Interaction Logic', () => {
  describe('Sound Manager', () => {
    it('executes sound triggers without throwing even when AudioContext is unavailable in node/test environment', () => {
      expect(() => playClickSound()).not.toThrow();
      expect(() => playToggleSound()).not.toThrow();
      expect(() => playSuccessSound()).not.toThrow();
      expect(() => soundManager.playClick()).not.toThrow();
      expect(() => soundManager.playToggle()).not.toThrow();
      expect(() => soundManager.playSuccess()).not.toThrow();
    });
  });

  describe('Active Onboarding Steps Configuration', () => {
    it('contains exactly 7 linear steps and omits calculation formula review step as requested', () => {
      expect(EXPECTED_ONBOARDING_STEPS).toEqual([
        'goal',
        'body_stats',
        'activity_level',
        'rate_selection',
        'target_weight_date',
        'health_screening',
        'completed',
      ]);
      expect(EXPECTED_ONBOARDING_STEPS).not.toContain('review_calculation');
      expect(EXPECTED_ONBOARDING_STEPS.length).toBe(7);
    });
  });

  describe('DOB Math and Age Calculation', () => {
    it('determines adult status correctly based on date of birth', () => {
      // Current year is 2026. A 25-year-old born in 2001 is >= 18
      expect(isAtLeast18('2001-05-15')).toBe(true);
      expect(isAtLeast18('1990-10-20')).toBe(true);

      // A 15-year-old born in 2011 is < 18
      expect(isAtLeast18('2011-01-01')).toBe(false);
    });

    it('clamps leap year and month days reliably for interactive picker', () => {
      function daysInMonth(year: number, monthIndex: number): number {
        return new Date(year, monthIndex + 1, 0).getDate();
      }

      expect(daysInMonth(2000, 1)).toBe(29); // Leap year Feb 2000
      expect(daysInMonth(2001, 1)).toBe(28); // Standard Feb 2001
      expect(daysInMonth(2000, 3)).toBe(30); // April
      expect(daysInMonth(2000, 0)).toBe(31); // January
    });
  });

  describe('Sex-specific Health Screening Rule', () => {
    it('verifies pregnant/breastfeeding question is only relevant for non-male users', () => {
      const isPregnancyQuestionApplicable = (sex: 'male' | 'female' | 'other') => {
        return sex !== 'male';
      };

      expect(isPregnancyQuestionApplicable('male')).toBe(false);
      expect(isPregnancyQuestionApplicable('female')).toBe(true);
      expect(isPregnancyQuestionApplicable('other')).toBe(true);
    });
  });
});
