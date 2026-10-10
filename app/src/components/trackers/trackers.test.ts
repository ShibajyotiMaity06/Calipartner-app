import { describe, expect, it } from 'vitest';
import { en } from '@/i18n/en';
import { t } from '@/i18n';

describe('Phase 4 Tracker UI Logic & Presentation', () => {
  describe('Water Card & Modal UI Logic', () => {
    it('calculates progress percentage and remaining volume accurately', () => {
      const calculateWaterProgress = (totalMl: number, goalMl: number) => {
        const percent = goalMl > 0 ? Math.min(100, Math.round((totalMl / goalMl) * 100)) : 0;
        const remaining = Math.max(0, goalMl - totalMl);
        const isGoalMet = totalMl >= goalMl && goalMl > 0;
        return { percent, remaining, isGoalMet };
      };

      // 0 ml of 2000 ml
      expect(calculateWaterProgress(0, 2000)).toEqual({
        percent: 0,
        remaining: 2000,
        isGoalMet: false,
      });

      // 1250 ml of 2500 ml
      expect(calculateWaterProgress(1250, 2500)).toEqual({
        percent: 50,
        remaining: 1250,
        isGoalMet: false,
      });

      // 3000 ml of 2500 ml (over goal)
      expect(calculateWaterProgress(3000, 2500)).toEqual({
        percent: 100,
        remaining: 0,
        isGoalMet: true,
      });

      // Edge case 0 goal
      expect(calculateWaterProgress(500, 0)).toEqual({
        percent: 0,
        remaining: 0,
        isGoalMet: false,
      });
    });

    it('validates custom water inputs between 10ml and 5000ml', () => {
      const isValidWater = (input: string) => {
        const parsed = parseInt(input.trim(), 10);
        return !isNaN(parsed) && parsed >= 10 && parsed <= 5000;
      };

      expect(isValidWater('250')).toBe(true);
      expect(isValidWater('10')).toBe(true);
      expect(isValidWater('5000')).toBe(true);
      expect(isValidWater('9')).toBe(false);
      expect(isValidWater('5001')).toBe(false);
      expect(isValidWater('abc')).toBe(false);
      expect(isValidWater('')).toBe(false);
    });

    it('formats accessible progress label with i18n interpolation', () => {
      const text = t('trackers.water.progressA11y', {
        current: 1500,
        goal: 2000,
        percent: 75,
      });
      expect(text).toBe('1500 ml of 2000 ml consumed, 75% of daily goal');
    });
  });

  describe('Steps & Distance UI Logic', () => {
    it('computes step progress toward goal and clamps appropriately', () => {
      const computeStepProgress = (steps: number, goal: number) => {
        const ratio = goal > 0 ? steps / goal : 0;
        const percent = Math.min(100, Math.round(ratio * 100));
        const isGoalMet = steps >= goal && goal > 0;
        return { percent, isGoalMet };
      };

      expect(computeStepProgress(4000, 8000)).toEqual({ percent: 50, isGoalMet: false });
      expect(computeStepProgress(8000, 8000)).toEqual({ percent: 100, isGoalMet: true });
      expect(computeStepProgress(12000, 8000)).toEqual({ percent: 100, isGoalMet: true });
      expect(computeStepProgress(0, 8000)).toEqual({ percent: 0, isGoalMet: false });
    });

    it('validates manual step inputs and optional distance inputs', () => {
      const validateManualSteps = (steps: string, distance?: string) => {
        const s = parseInt(steps.trim(), 10);
        if (isNaN(s) || s < 1 || s > 100000) return false;
        if (distance && distance.trim()) {
          const d = parseFloat(distance.trim());
          if (isNaN(d) || d < 0 || d > 150000) return false;
        }
        return true;
      };

      expect(validateManualSteps('5000')).toBe(true);
      expect(validateManualSteps('5000', '3500')).toBe(true);
      expect(validateManualSteps('0')).toBe(false);
      expect(validateManualSteps('100001')).toBe(false);
      expect(validateManualSteps('5000', '-10')).toBe(false);
      expect(validateManualSteps('5000', '200000')).toBe(false);
    });

    it('maps all step sources to user-friendly translated labels', () => {
      expect(en.trackers.steps.source.healthPlatform).toBe('Health Platform');
      expect(en.trackers.steps.source.pedometer).toBe('Phone Sensor');
      expect(en.trackers.steps.source.manual).toBe('Manual Entry');
    });
  });

  describe('Weight & Trend UI Logic', () => {
    it('validates weight values between 20kg and 500kg and YYYY-MM-DD date format', () => {
      const validateWeightEntry = (weight: string, date: string) => {
        const w = parseFloat(weight.trim());
        if (isNaN(w) || w < 20 || w > 500) return false;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) return false;
        return true;
      };

      expect(validateWeightEntry('74.5', '2026-10-10')).toBe(true);
      expect(validateWeightEntry('19.9', '2026-10-10')).toBe(false);
      expect(validateWeightEntry('500.1', '2026-10-10')).toBe(false);
      expect(validateWeightEntry('75', '10-10-2026')).toBe(false);
      expect(validateWeightEntry('75', 'invalid-date')).toBe(false);
    });

    it('formats weight change and percentage accurately', () => {
      const formatWeightChange = (current: number, start: number) => {
        const diff = current - start;
        const pct = start > 0 ? (diff / start) * 100 : 0;
        return {
          diffKg: Number(diff.toFixed(1)),
          pct: Number(pct.toFixed(1)),
        };
      };

      expect(formatWeightChange(78.5, 82.0)).toEqual({
        diffKg: -3.5,
        pct: -4.3,
      });

      expect(formatWeightChange(80.0, 75.0)).toEqual({
        diffKg: 5.0,
        pct: 6.7,
      });
    });

    it('handles trend presentation states: not enough trend vs projected date', () => {
      const getTrendPresentation = (
        hasEnoughTrend: boolean,
        pace: number | null,
        projectedDate: string | null,
      ) => {
        if (!hasEnoughTrend || pace === null) {
          return en.trackers.weight.notEnoughTrend;
        }
        if (projectedDate) {
          return `Target date: ${projectedDate}`;
        }
        return 'Maintaining pace towards target';
      };

      expect(getTrendPresentation(false, null, null)).toBe(
        'Not enough trend yet (need 3+ days)',
      );
      expect(getTrendPresentation(true, -0.45, '2026-12-15')).toBe(
        'Target date: 2026-12-15',
      );
      expect(getTrendPresentation(true, -0.02, null)).toBe(
        'Maintaining pace towards target',
      );
    });
  });

  describe('Health Permission Screen & Denied Guide', () => {
    it('provides clear step-by-step guidance for Android Health Connect', () => {
      expect(en.trackers.permissions.androidInstructions).toContain('Health Connect');
      expect(en.trackers.permissions.androidInstructions).toContain('App permissions');
      expect(en.trackers.permissions.androidInstructions).toContain('CaliPartner');
      expect(en.trackers.permissions.androidInstructions).toContain('Steps and Distance');
    });

    it('provides clear step-by-step guidance for iOS Apple Health', () => {
      expect(en.trackers.permissions.iosInstructions).toContain('Privacy & Security');
      expect(en.trackers.permissions.iosInstructions).toContain('Health');
      expect(en.trackers.permissions.iosInstructions).toContain('CaliPartner');
      expect(en.trackers.permissions.iosInstructions).toContain('Steps and Walking');
    });

    it('includes reassurance that manual logging is always supported when permissions are denied', () => {
      expect(en.trackers.permissions.fallbackNotice).toContain('log steps manually');
    });
  });
});
