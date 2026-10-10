import type {
  ActivityDay,
  ActivitySource,
  ProjectedDateResult,
  Sex,
  WeeklyPaceResult,
  WeightTrendPoint,
} from './types';

/**
 * 1. Default water goal:
 * 35 ml x body weight (kg), rounded to nearest 250 ml, min 1,500 ml, max 4,000 ml.
 * (PRD 6.5 WAT-2, PRD 7.8)
 */
export function calculateDefaultWaterGoalMl(weightKg: number): number {
  if (weightKg <= 0 || !Number.isFinite(weightKg)) return 2000;
  const raw = 35 * weightKg;
  const rounded = Math.round(raw / 250) * 250;
  return Math.min(4000, Math.max(1500, rounded));
}

/**
 * 2. Stride length:
 * Height (cm) x 0.415 for male, x 0.413 for female, x 0.414 for other.
 * (PRD 7.8)
 */
export function calculateStrideLengthCm(
  heightCm: number,
  sex: Sex | 'other',
): number {
  if (heightCm <= 0 || !Number.isFinite(heightCm)) return 70;
  const factor = sex === 'male' ? 0.415 : sex === 'female' ? 0.413 : 0.414;
  return Math.round(heightCm * factor * 100) / 100;
}

/**
 * 3. Distance from steps in kilometers:
 * Steps x stride length (cm) / 100,000 = km
 * (PRD 7.8)
 */
export function calculateDistanceFromStepsKm(
  steps: number,
  strideLengthCm: number,
): number {
  if (steps <= 0 || strideLengthCm <= 0) return 0;
  const km = (steps * strideLengthCm) / 100000;
  return Math.round(km * 1000) / 1000;
}

/**
 * Distance from steps in meters:
 * Steps x stride length (cm) / 100 = meters
 */
export function calculateDistanceFromStepsMeters(
  steps: number,
  strideLengthCm: number,
): number {
  if (steps <= 0 || strideLengthCm <= 0) return 0;
  const meters = (steps * strideLengthCm) / 100;
  return Math.round(meters * 100) / 100;
}

/**
 * 4. Informational walking calories:
 * 0.5 x weight (kg) x distance (km)
 * Note: Shown for information only; not added to daily calorie target.
 * (PRD 7.8)
 */
export function calculateWalkingCalories(
  weightKg: number,
  distanceKm: number,
): number {
  if (weightKg <= 0 || distanceKm <= 0) return 0;
  return Math.round(0.5 * weightKg * distanceKm);
}

/**
 * Helper to calculate date difference in whole days (dateA - dateB).
 */
export function getDaysDifference(dateStrA: string, dateStrB: string): number {
  const tA = new Date(dateStrA + 'T00:00:00Z').getTime();
  const tB = new Date(dateStrB + 'T00:00:00Z').getTime();
  return Math.round((tA - tB) / (1000 * 60 * 60 * 24));
}

/**
 * Helper to add days to a YYYY-MM-DD string.
 */
export function addDaysToDateString(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0]!;
}

/**
 * 5. Weight trend:
 * 7-day moving average of weigh-ins (uses raw value when fewer than 3 entries in window).
 * (PRD 6.5 TRK-1, PRD 7.8)
 */
export function calculateWeightTrend(
  entries: Array<{ date: string; weightKg: number }>,
): WeightTrendPoint[] {
  if (!entries || entries.length === 0) return [];

  // Sort ascending by date
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const results: WeightTrendPoint[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i]!;
    // Window: all entries in [current.date - 6 days, current.date]
    const windowEntries = sorted.filter((e) => {
      const diff = getDaysDifference(current.date, e.date);
      return diff >= 0 && diff <= 6;
    });

    if (windowEntries.length >= 3) {
      const sum = windowEntries.reduce((acc, e) => acc + e.weightKg, 0);
      const avg = sum / windowEntries.length;
      results.push({
        date: current.date,
        rawWeightKg: current.weightKg,
        trendWeightKg: Math.round(avg * 100) / 100,
        entryCountInWindow: windowEntries.length,
      });
    } else {
      results.push({
        date: current.date,
        rawWeightKg: current.weightKg,
        trendWeightKg: current.weightKg,
        entryCountInWindow: windowEntries.length,
      });
    }
  }

  return results;
}

/**
 * 6. Weekly pace:
 * (trend weight today - trend weight 14 days ago) / 2 weeks, in kg per week.
 * If 14 days is not available, calculates over available span of at least 7 days.
 * (PRD 7.8)
 */
export function calculateWeeklyPace(
  trendPoints: WeightTrendPoint[],
): WeeklyPaceResult {
  if (!trendPoints || trendPoints.length < 2) {
    return { weeklyPaceKg: null, daysSpan: 0 };
  }

  const sorted = [...trendPoints].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1]!;

  // 1. Look for entry approximately 14 days ago (12 to 16 days)
  const fourteenDaysAgoTarget = addDaysToDateString(latest.date, -14);
  const exactFourteen = sorted.find((e) => e.date === fourteenDaysAgoTarget);

  if (exactFourteen) {
    const pace = (latest.trendWeightKg - exactFourteen.trendWeightKg) / 2;
    return {
      weeklyPaceKg: Math.round(pace * 1000) / 1000,
      daysSpan: 14,
    };
  }

  // 2. Check earliest point if span is at least 7 days
  const earliest = sorted[0]!;
  const spanDays = getDaysDifference(latest.date, earliest.date);

  if (spanDays >= 7) {
    const weeks = spanDays / 7;
    const pace = (latest.trendWeightKg - earliest.trendWeightKg) / weeks;
    return {
      weeklyPaceKg: Math.round(pace * 1000) / 1000,
      daysSpan: spanDays,
    };
  }

  return { weeklyPaceKg: null, daysSpan: spanDays };
}

/**
 * 7. Projected date to target:
 * Today + (target weight - trend weight) / weekly pace.
 * Shown only when pace points towards target and is at least 0.05 kg/week;
 * otherwise "not enough trend yet" (PRD 7.8).
 */
export function calculateProjectedDate(input: {
  currentTrendKg: number;
  targetWeightKg: number;
  weeklyPaceKg: number | null;
  todayDate: string;
}): ProjectedDateResult {
  const { currentTrendKg, targetWeightKg, weeklyPaceKg, todayDate } = input;

  const diffKg = targetWeightKg - currentTrendKg;

  // Already achieved if within 100g
  if (Math.abs(diffKg) < 0.1) {
    return {
      projectedDate: todayDate,
      weeksRemaining: 0,
      reason: 'achieved',
    };
  }

  // Minimum pace check: must be at least 0.05 kg/week
  if (weeklyPaceKg === null || Math.abs(weeklyPaceKg) < 0.05) {
    return {
      projectedDate: null,
      weeksRemaining: null,
      reason: 'not_enough_trend',
    };
  }

  // Direction check:
  // Cutting: diffKg < 0 -> pace must be negative
  // Bulking: diffKg > 0 -> pace must be positive
  const isCutting = diffKg < 0;
  const isLosing = weeklyPaceKg < 0;

  if ((isCutting && !isLosing) || (!isCutting && isLosing)) {
    return {
      projectedDate: null,
      weeksRemaining: null,
      reason: 'wrong_direction',
    };
  }

  const weeksRemaining = diffKg / weeklyPaceKg;
  const daysRemaining = Math.max(1, Math.round(weeksRemaining * 7));
  const projectedDate = addDaysToDateString(todayDate, daysRemaining);

  return {
    projectedDate,
    weeksRemaining: Math.round(weeksRemaining * 10) / 10,
    reason: 'on_track',
  };
}

/**
 * 8. Goal progress %:
 * (starting weight - current trend weight) / (starting weight - target weight) x 100,
 * limited to 0 to 100; works for cuts and bulks.
 * (PRD 7.8)
 */
export function calculateGoalProgressPercent(
  startingWeightKg: number,
  currentTrendWeightKg: number,
  targetWeightKg: number,
): number {
  const totalDiff = startingWeightKg - targetWeightKg;
  if (Math.abs(totalDiff) < 0.001) return 100;

  const currentDiff = startingWeightKg - currentTrendWeightKg;
  const progress = (currentDiff / totalDiff) * 100;

  return Math.min(100, Math.max(0, Math.round(progress * 10) / 10));
}

/**
 * 9. Activity source priority & de-duplication:
 * Priority: Health Connect / HealthKit (3) > Phone pedometer (2) > Manual entry (1).
 * De-duplicated so steps are never double-counted.
 * Platform-measured distance beats calculated distance.
 * (PRD 6.5 STP-1, STP-2)
 */
const SOURCE_PRIORITY: Record<ActivitySource, number> = {
  health_platform: 3,
  pedometer: 2,
  manual: 1,
};

export function deduplicateActivitySources(
  existing: ActivityDay | null,
  incoming: {
    steps: number;
    distance_m?: number | null;
    source: ActivitySource;
    strideLengthCm?: number;
  },
): { steps: number; distance_m: number; source: ActivitySource } {
  const incomingPriority = SOURCE_PRIORITY[incoming.source] ?? 1;

  // Resolve distance: platform-measured distance beats calculated distance
  let resolvedDistanceM = 0;
  if (incoming.distance_m != null && incoming.distance_m > 0) {
    resolvedDistanceM = Math.round(incoming.distance_m * 100) / 100;
  } else if (incoming.strideLengthCm && incoming.strideLengthCm > 0) {
    resolvedDistanceM = calculateDistanceFromStepsMeters(
      incoming.steps,
      incoming.strideLengthCm,
    );
  }

  if (!existing) {
    return {
      steps: incoming.steps,
      distance_m: resolvedDistanceM,
      source: incoming.source,
    };
  }

  const existingPriority = SOURCE_PRIORITY[existing.source] ?? 1;

  // If existing reading has strictly higher priority, do NOT overwrite with lower priority
  if (existingPriority > incomingPriority) {
    return {
      steps: existing.steps,
      distance_m: existing.distance_m,
      source: existing.source,
    };
  }

  // If incoming has strictly higher priority, incoming wins
  if (incomingPriority > existingPriority) {
    return {
      steps: incoming.steps,
      distance_m: resolvedDistanceM > 0 ? resolvedDistanceM : existing.distance_m,
      source: incoming.source,
    };
  }

  // Same priority: take highest steps / distance
  return {
    steps: Math.max(existing.steps, incoming.steps),
    distance_m: Math.max(existing.distance_m, resolvedDistanceM),
    source: incoming.source,
  };
}
