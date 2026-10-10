import { describe, expect, it } from 'vitest';
import {
  calculateDefaultWaterGoalMl,
  calculateDistanceFromStepsKm,
  calculateDistanceFromStepsMeters,
  calculateGoalProgressPercent,
  calculateProjectedDate,
  calculateStrideLengthCm,
  calculateWalkingCalories,
  calculateWeeklyPace,
  calculateWeightTrend,
  deduplicateActivitySources,
} from './trackers';
import type { ActivityDay } from './types';

describe('Trackers Core - Water Goal', () => {
  it('calculates 35ml per kg rounded to nearest 250ml', () => {
    // 70kg * 35 = 2450 -> nearest 250 is 2500
    expect(calculateDefaultWaterGoalMl(70)).toBe(2500);
    // 60kg * 35 = 2100 -> nearest 250 is 2000
    expect(calculateDefaultWaterGoalMl(60)).toBe(2000);
    // 80kg * 35 = 2800 -> nearest 250 is 2750
    expect(calculateDefaultWaterGoalMl(80)).toBe(2750);
  });

  it('enforces minimum 1500ml floor', () => {
    // 35kg * 35 = 1225 -> rounded is 1250 -> floor is 1500
    expect(calculateDefaultWaterGoalMl(35)).toBe(1500);
    expect(calculateDefaultWaterGoalMl(40)).toBe(1500);
  });

  it('enforces maximum 4000ml cap', () => {
    // 130kg * 35 = 4550 -> cap is 4000
    expect(calculateDefaultWaterGoalMl(130)).toBe(4000);
    expect(calculateDefaultWaterGoalMl(200)).toBe(4000);
  });

  it('handles invalid inputs safely with default', () => {
    expect(calculateDefaultWaterGoalMl(0)).toBe(2000);
    expect(calculateDefaultWaterGoalMl(-10)).toBe(2000);
  });
});

describe('Trackers Core - Stride, Distance & Walking Calories', () => {
  it('calculates stride length based on sex factor', () => {
    // Male: 180cm * 0.415 = 74.7cm
    expect(calculateStrideLengthCm(180, 'male')).toBe(74.7);
    // Female: 165cm * 0.413 = 68.145 -> 68.15cm
    expect(calculateStrideLengthCm(165, 'female')).toBe(68.15);
    // Other: 170cm * 0.414 = 70.38cm
    expect(calculateStrideLengthCm(170, 'other')).toBe(70.38);
  });

  it('calculates distance from steps in km and meters', () => {
    const strideCm = 75; // 75 cm
    // 10,000 steps * 75 cm = 750,000 cm = 7.5 km
    expect(calculateDistanceFromStepsKm(10000, strideCm)).toBe(7.5);
    expect(calculateDistanceFromStepsMeters(10000, strideCm)).toBe(7500);

    // 0 steps
    expect(calculateDistanceFromStepsKm(0, strideCm)).toBe(0);
    expect(calculateDistanceFromStepsMeters(0, strideCm)).toBe(0);
  });

  it('calculates informational walking calories (0.5 x weight x distance)', () => {
    // 70kg * 10km * 0.5 = 350 kcal
    expect(calculateWalkingCalories(70, 10)).toBe(350);
    // 80kg * 5.5km * 0.5 = 220 kcal
    expect(calculateWalkingCalories(80, 5.5)).toBe(220);
    // 0 distance or weight
    expect(calculateWalkingCalories(0, 5)).toBe(0);
    expect(calculateWalkingCalories(70, 0)).toBe(0);
  });
});

describe('Trackers Core - Weight Trend (7-day moving average)', () => {
  it('returns raw value when fewer than 3 entries in 7-day window', () => {
    const entries = [
      { date: '2026-10-01', weightKg: 80.0 },
      { date: '2026-10-03', weightKg: 79.5 },
    ];

    const trend = calculateWeightTrend(entries);
    expect(trend).toHaveLength(2);
    expect(trend[0]!.rawWeightKg).toBe(80.0);
    expect(trend[0]!.trendWeightKg).toBe(80.0);
    expect(trend[0]!.entryCountInWindow).toBe(1);

    expect(trend[1]!.rawWeightKg).toBe(79.5);
    expect(trend[1]!.trendWeightKg).toBe(79.5);
    expect(trend[1]!.entryCountInWindow).toBe(2);
  });

  it('calculates moving average when 3 or more entries exist in 7-day window', () => {
    const entries = [
      { date: '2026-10-01', weightKg: 80.0 },
      { date: '2026-10-03', weightKg: 79.0 },
      { date: '2026-10-05', weightKg: 78.0 },
    ];

    const trend = calculateWeightTrend(entries);
    expect(trend).toHaveLength(3);
    // On 2026-10-05: window has all 3 entries (avg = (80+79+78)/3 = 79.0)
    expect(trend[2]!.trendWeightKg).toBe(79.0);
    expect(trend[2]!.rawWeightKg).toBe(78.0);
    expect(trend[2]!.entryCountInWindow).toBe(3);
  });

  it('excludes entries older than 6 days from the window', () => {
    const entries = [
      { date: '2026-10-01', weightKg: 80.0 }, // 10 days before Oct 11 -> outside window
      { date: '2026-10-08', weightKg: 78.0 }, // 3 days before Oct 11 -> inside
      { date: '2026-10-11', weightKg: 77.0 }, // inside (only 2 in window -> raw value)
    ];

    const trend = calculateWeightTrend(entries);
    expect(trend[2]!.entryCountInWindow).toBe(2);
    expect(trend[2]!.trendWeightKg).toBe(77.0); // raw because count < 3
  });
});

describe('Trackers Core - Weekly Pace & Projection', () => {
  it('calculates weekly pace over 14 days', () => {
    const points = [
      { date: '2026-10-01', rawWeightKg: 82.0, trendWeightKg: 82.0, entryCountInWindow: 3 },
      { date: '2026-10-08', rawWeightKg: 81.5, trendWeightKg: 81.5, entryCountInWindow: 3 },
      { date: '2026-10-15', rawWeightKg: 81.0, trendWeightKg: 81.0, entryCountInWindow: 3 },
    ];

    // (81.0 - 82.0) / 2 weeks = -0.5 kg/week
    const pace = calculateWeeklyPace(points);
    expect(pace.weeklyPaceKg).toBe(-0.5);
    expect(pace.daysSpan).toBe(14);
  });

  it('calculates weekly pace over available span of at least 7 days', () => {
    const points = [
      { date: '2026-10-01', rawWeightKg: 80.0, trendWeightKg: 80.0, entryCountInWindow: 3 },
      { date: '2026-10-08', rawWeightKg: 79.6, trendWeightKg: 79.6, entryCountInWindow: 3 },
    ];

    // (79.6 - 80.0) / 1 week = -0.4 kg/week
    const pace = calculateWeeklyPace(points);
    expect(pace.weeklyPaceKg).toBe(-0.4);
    expect(pace.daysSpan).toBe(7);
  });

  it('returns null pace if span is under 7 days', () => {
    const points = [
      { date: '2026-10-01', rawWeightKg: 80.0, trendWeightKg: 80.0, entryCountInWindow: 3 },
      { date: '2026-10-04', rawWeightKg: 79.8, trendWeightKg: 79.8, entryCountInWindow: 3 },
    ];

    const pace = calculateWeeklyPace(points);
    expect(pace.weeklyPaceKg).toBeNull();
  });

  it('projects target date when pace points towards target and >= 0.05 kg/week', () => {
    // Current trend: 80kg, Target: 75kg, Weekly pace: -0.5 kg/week
    // 5kg to lose / 0.5 = 10 weeks = 70 days
    const res = calculateProjectedDate({
      currentTrendKg: 80,
      targetWeightKg: 75,
      weeklyPaceKg: -0.5,
      todayDate: '2026-10-10',
    });

    expect(res.reason).toBe('on_track');
    expect(res.weeksRemaining).toBe(10);
    expect(res.projectedDate).toBe('2026-12-19'); // 2026-10-10 + 70 days
  });

  it('rejects projection if pace is below 0.05 kg/week (not enough trend)', () => {
    const res = calculateProjectedDate({
      currentTrendKg: 80,
      targetWeightKg: 75,
      weeklyPaceKg: -0.02,
      todayDate: '2026-10-10',
    });

    expect(res.reason).toBe('not_enough_trend');
    expect(res.projectedDate).toBeNull();
  });

  it('rejects projection if pace points away from target (wrong direction)', () => {
    // User wants to cut (target 75 from 80), but pace is +0.3 (gaining)
    const res = calculateProjectedDate({
      currentTrendKg: 80,
      targetWeightKg: 75,
      weeklyPaceKg: 0.3,
      todayDate: '2026-10-10',
    });

    expect(res.reason).toBe('wrong_direction');
    expect(res.projectedDate).toBeNull();
  });

  it('detects already achieved target', () => {
    const res = calculateProjectedDate({
      currentTrendKg: 75.05,
      targetWeightKg: 75.0,
      weeklyPaceKg: -0.3,
      todayDate: '2026-10-10',
    });

    expect(res.reason).toBe('achieved');
    expect(res.projectedDate).toBe('2026-10-10');
  });

  it('calculates goal progress percent for both cuts and bulks', () => {
    // Cut: Start 90kg, current trend 80kg, target 70kg -> 10kg lost of 20kg goal = 50%
    expect(calculateGoalProgressPercent(90, 80, 70)).toBe(50);

    // Bulk: Start 60kg, current trend 65kg, target 70kg -> 5kg gained of 10kg goal = 50%
    expect(calculateGoalProgressPercent(60, 65, 70)).toBe(50);

    // Clamped at 0 if moved backwards
    expect(calculateGoalProgressPercent(90, 92, 70)).toBe(0);

    // Clamped at 100 if surpassed
    expect(calculateGoalProgressPercent(90, 68, 70)).toBe(100);
  });
});

describe('Trackers Core - Activity Source Priority & Deduplication', () => {
  const existingHealth: ActivityDay = {
    id: 'act-1',
    user_id: 'user-1',
    local_date: '2026-10-10',
    steps: 8500,
    distance_m: 6400,
    source: 'health_platform',
    created_at: '2026-10-10T00:00:00Z',
    updated_at: '2026-10-10T00:00:00Z',
  };

  it('health platform beats phone pedometer and manual entry', () => {
    // Attempt to overwrite health_platform with lower priority pedometer (6000 steps)
    const res = deduplicateActivitySources(existingHealth, {
      steps: 6000,
      source: 'pedometer',
    });
    // Health platform retains priority!
    expect(res.source).toBe('health_platform');
    expect(res.steps).toBe(8500);
  });

  it('health platform beats manual entry', () => {
    const res = deduplicateActivitySources(existingHealth, {
      steps: 10000,
      source: 'manual',
    });
    expect(res.source).toBe('health_platform');
    expect(res.steps).toBe(8500);
  });

  it('higher priority source replaces lower priority source', () => {
    const existingManual: ActivityDay = {
      id: 'act-2',
      user_id: 'user-1',
      local_date: '2026-10-10',
      steps: 3000,
      distance_m: 2100,
      source: 'manual',
      created_at: '2026-10-10T00:00:00Z',
      updated_at: '2026-10-10T00:00:00Z',
    };

    const res = deduplicateActivitySources(existingManual, {
      steps: 7500,
      distance_m: 5600,
      source: 'health_platform',
    });

    expect(res.source).toBe('health_platform');
    expect(res.steps).toBe(7500);
    expect(res.distance_m).toBe(5600);
  });

  it('platform-measured distance beats calculated distance', () => {
    const res = deduplicateActivitySources(null, {
      steps: 5000,
      distance_m: 4100, // platform measured
      strideLengthCm: 70, // calculated would be 3500m
      source: 'health_platform',
    });

    expect(res.distance_m).toBe(4100);
  });

  it('calculates distance from stride when distance is not provided', () => {
    const res = deduplicateActivitySources(null, {
      steps: 4000,
      strideLengthCm: 75,
      source: 'pedometer',
    });

    // 4000 * 75 / 100 = 3000 meters
    expect(res.distance_m).toBe(3000);
  });
});
