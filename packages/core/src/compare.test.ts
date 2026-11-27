import { describe, expect, it } from 'vitest';
import {
  classifyDaysTogetherStatus,
  computeCompareDayScore,
  computeInSyncPercent,
  formatCompareDuration,
  formatCompareVolumeKg,
  rawPercentOfTarget,
  scoreCappedMetric,
  scoreTargetBandMetric,
} from './compare';

describe('compare calculation engine', () => {
  it('caps steps, water and protein at 100% and scores 100% within +/-10% band for calories/carbs/fat', () => {
    expect(scoreCappedMetric(12000, 10000)).toBe(100);
    expect(scoreCappedMetric(8000, 10000)).toBe(80);
    expect(scoreTargetBandMetric(2150, 2000)).toBe(100);
    expect(scoreTargetBandMetric(1820, 2000)).toBe(100);
    expect(scoreTargetBandMetric(1400, 2000)).toBeLessThan(100);
    expect(rawPercentOfTarget(208, 200)).toBe(104);
  });

  it('counts unlogged days as 0 and ignores workouts on planned rest days', () => {
    const targets = { calories: 2000, protein: 140, steps: 10000, water: 3000 };
    const tracking = {
      calories: true,
      protein: true,
      carbs: false,
      fat: false,
      steps: true,
      water: true,
      workouts: true,
    };

    expect(
      computeCompareDayScore(
        {
          hasAnyLogged: false,
          isRestDay: false,
        },
        targets,
        tracking,
      ),
    ).toBe(0);

    // On a planned rest day with full macros/steps/water, score is 100 even with 0 workouts.
    expect(
      computeCompareDayScore(
        {
          calories: 2000,
          protein: 140,
          steps: 10000,
          water: 3000,
          workoutsCompleted: 0,
          isRestDay: true,
          hasAnyLogged: true,
        },
        targets,
        tracking,
      ),
    ).toBe(100);
  });

  it('computes in sync as 100 minus average daily gap and classifies days together', () => {
    expect(
      computeInSyncPercent([
        { left: 75, right: 90 },
        { left: 85, right: 100 },
      ]),
    ).toBe(85);
    expect(computeInSyncPercent([])).toBe(0);

    expect(classifyDaysTogetherStatus(82, 95)).toBe('both');
    expect(classifyDaysTogetherStatus(79, 95)).toBe('one');
    expect(classifyDaysTogetherStatus(60, 75)).toBe('neither');
  });

  it('formats volume and duration cleanly', () => {
    expect(formatCompareVolumeKg(14600)).toBe('14.6k kg');
    expect(formatCompareVolumeKg(850)).toBe('850 kg');
    expect(formatCompareDuration(141)).toBe('2h 21m');
  });
});
