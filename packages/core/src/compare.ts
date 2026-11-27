/**
 * Pure compare calculation rules matching `74..78 · Compare` and screen 78
 * ("How compare works"). Zero React or Supabase imports.
 */

export type CompareRange = 'today' | '7d' | '30d';

export interface CompareDayMetricInput {
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  steps?: number | null;
  water?: number | null;
  workoutsCompleted?: number;
  isRestDay?: boolean;
  hasAnyLogged?: boolean;
}

export interface CompareTargetsInput {
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  steps?: number | null;
  water?: number | null;
}

export interface CompareTrackerFlags {
  calories: boolean;
  protein: boolean;
  carbs: boolean;
  fat: boolean;
  steps: boolean;
  water: boolean;
  workouts?: boolean;
}

export type DaysTogetherStatus = 'both' | 'one' | 'neither';

export interface CompareDayEntry {
  date: string;
  label: string;
  status: DaysTogetherStatus;
  left_pct: number | null;
  right_pct: number | null;
}

export interface CompareHeadToHeadItem {
  key: 'workouts' | 'steps' | 'water';
  left_value: number;
  right_value: number;
  unit: 'count' | 'pct';
}

export interface CompareMacroItem {
  key: 'protein' | 'carbs' | 'fat';
  left_pct: number;
  right_pct: number;
}

export interface CompareTodayTrackerRow {
  key: 'workout' | 'meals' | 'calories' | 'protein' | 'carbs' | 'fat' | 'steps' | 'water';
  left_tracks: boolean;
  right_tracks: boolean;
  left_pct: number | null;
  right_pct: number | null;
  left_label?: string | null;
  right_label?: string | null;
  left_is_rest?: boolean;
  right_is_rest?: boolean;
  left_done?: boolean;
  right_done?: boolean;
}

export interface CompareWorkoutSummary {
  shared: boolean;
  count: number;
  splits: Array<{ label: string; count: number }>;
  duration_minutes: number;
  volume_kg: number;
}

export interface CompareMealSummary {
  shared: boolean;
  top_items: Array<{ name: string; count: number }>;
  meals_per_day: number;
}

export interface SquadComparePayload {
  room_id: string;
  range: CompareRange;
  is_pro: boolean;
  locked: boolean;
  left: {
    user_id: string;
    name: string;
    overall_pct: number;
    tracker_count: number;
    workouts_shared: boolean;
    meals_shared: boolean;
  };
  right: {
    user_id: string;
    name: string;
    overall_pct: number;
    tracker_count: number;
    workouts_shared: boolean;
    meals_shared: boolean;
  };
  in_sync_pct: number;
  days_together: number;
  shared_workouts: number;
  days_strip: CompareDayEntry[];
  head_to_head: CompareHeadToHeadItem[];
  macros: CompareMacroItem[];
  today_rows: CompareTodayTrackerRow[];
  workouts_detail: {
    left: CompareWorkoutSummary;
    right: CompareWorkoutSummary;
  } | null;
  meals_detail: {
    left: CompareMealSummary;
    right: CompareMealSummary;
  } | null;
}

function clampPct(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

/**
 * Rule 5:
 * - Steps, water and protein cap at 100%.
 * - Calories, carbs and fat are on target (100%) within +-10%.
 */
export function scoreCappedMetric(
  actual: number | null | undefined,
  target: number | null | undefined,
): number {
  if (
    actual == null ||
    target == null ||
    !Number.isFinite(actual) ||
    !Number.isFinite(target) ||
    target <= 0
  ) {
    return 0;
  }
  return clampPct((Math.max(0, actual) / target) * 100);
}

export function scoreTargetBandMetric(
  actual: number | null | undefined,
  target: number | null | undefined,
  tolerance = 0.1,
): number {
  if (
    actual == null ||
    target == null ||
    !Number.isFinite(actual) ||
    !Number.isFinite(target) ||
    target <= 0
  ) {
    return 0;
  }
  if (actual <= 0) return 0;
  const deviation = Math.abs(actual - target) / target;
  if (deviation <= tolerance) return 100;
  const extraDeviation = deviation - tolerance;
  return clampPct((1 - extraDeviation / (1 - tolerance)) * 100);
}

export function rawPercentOfTarget(
  actual: number | null | undefined,
  target: number | null | undefined,
): number {
  if (
    actual == null ||
    target == null ||
    !Number.isFinite(actual) ||
    !Number.isFinite(target) ||
    target <= 0
  ) {
    return 0;
  }
  return Math.max(0, Math.round((Math.max(0, actual) / target) * 100));
}

/**
 * Rule 4 & 5: Compute a single day's score (0..100) using only the user's enabled trackers.
 * A day with nothing logged counts as 0% for enabled trackers.
 * Planned rest days never count against workouts.
 */
export function computeCompareDayScore(
  day: CompareDayMetricInput,
  targets: CompareTargetsInput | null | undefined,
  tracking: CompareTrackerFlags,
): number | null {
  if (!targets) return null;
  const scores: number[] = [];
  const logged =
    day.hasAnyLogged ??
    ((day.calories ?? 0) > 0 ||
      (day.protein ?? 0) > 0 ||
      (day.carbs ?? 0) > 0 ||
      (day.fat ?? 0) > 0 ||
      (day.steps ?? 0) > 0 ||
      (day.water ?? 0) > 0 ||
      (day.workoutsCompleted ?? 0) > 0);

  if (tracking.calories && (targets.calories ?? 0) > 0) {
    scores.push(logged ? scoreTargetBandMetric(day.calories, targets.calories) : 0);
  }
  if (tracking.protein && (targets.protein ?? 0) > 0) {
    scores.push(logged ? scoreCappedMetric(day.protein, targets.protein) : 0);
  }
  if (tracking.carbs && (targets.carbs ?? 0) > 0) {
    scores.push(logged ? scoreTargetBandMetric(day.carbs, targets.carbs) : 0);
  }
  if (tracking.fat && (targets.fat ?? 0) > 0) {
    scores.push(logged ? scoreTargetBandMetric(day.fat, targets.fat) : 0);
  }
  if (tracking.steps && (targets.steps ?? 0) > 0) {
    scores.push(logged ? scoreCappedMetric(day.steps, targets.steps) : 0);
  }
  if (tracking.water && (targets.water ?? 0) > 0) {
    scores.push(logged ? scoreCappedMetric(day.water, targets.water) : 0);
  }
  if (tracking.workouts && !day.isRestDay) {
    scores.push((day.workoutsCompleted ?? 0) > 0 ? 100 : 0);
  }

  if (scores.length === 0) return null;
  return Math.round(scores.reduce((sum, val) => sum + val, 0) / scores.length);
}

/**
 * Rule 6: In sync is 100 minus the average gap between daily scores.
 */
export function computeInSyncPercent(
  pairs: Array<{ left: number | null | undefined; right: number | null | undefined }>,
): number {
  const valid = pairs.filter(
    (p): p is { left: number; right: number } =>
      typeof p.left === 'number' &&
      Number.isFinite(p.left) &&
      typeof p.right === 'number' &&
      Number.isFinite(p.right),
  );
  if (valid.length === 0) return 0;
  const avgGap =
    valid.reduce((sum, pair) => sum + Math.abs(pair.left - pair.right), 0) / valid.length;
  return Math.round(clampPct(100 - avgGap));
}

export function classifyDaysTogetherStatus(
  leftPct: number | null | undefined,
  rightPct: number | null | undefined,
  threshold = 80,
): DaysTogetherStatus {
  const leftHit = typeof leftPct === 'number' && Number.isFinite(leftPct) && leftPct >= threshold;
  const rightHit =
    typeof rightPct === 'number' && Number.isFinite(rightPct) && rightPct >= threshold;
  if (leftHit && rightHit) return 'both';
  if (leftHit || rightHit) return 'one';
  return 'neither';
}

export function formatCompareVolumeKg(volumeKg: number): string {
  if (!Number.isFinite(volumeKg) || volumeKg <= 0) return '0 kg';
  if (volumeKg >= 1000) {
    return `${(volumeKg / 1000).toFixed(1).replace(/\.0$/, '')}k kg`;
  }
  return `${Math.round(volumeKg)} kg`;
}

export function formatCompareDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '0m';
  const rounded = Math.round(minutes);
  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}
