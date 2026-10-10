import type {
  CardioMetrics,
  WorkoutSummary,
  WorkoutType,
  WorkoutWithDetails,
} from './types';

/**
 * PRD 7.8: Workout volume = Sum over all sets of (reps x weight)
 * Handles null/undefined reps or weights gracefully.
 */
export function calculateWorkoutVolume(
  sets: Array<{
    reps?: number | null;
    weight_kg?: number | null;
    completed?: boolean;
    is_warmup?: boolean;
  }>,
  options?: { includeWarmups?: boolean },
): number {
  if (!sets || sets.length === 0) return 0;

  const includeWarmups = options?.includeWarmups ?? false;

  let totalVolume = 0;
  for (const set of sets) {
    if (set.completed === false) continue;
    if (!includeWarmups && set.is_warmup === true) continue;

    const reps = set.reps && set.reps > 0 ? set.reps : 0;
    const weight = set.weight_kg && set.weight_kg > 0 ? set.weight_kg : 0;

    totalVolume += reps * weight;
  }

  return Math.round(totalVolume * 100) / 100;
}

/**
 * PRD 7.8: Estimated 1RM (Epley) = Weight x (1 + reps / 30)
 * Explicit rule: "used for sets of 12 reps or fewer".
 * If reps > 12 or reps < 1 or weight <= 0, returns null.
 * For 1 rep, the 1RM is the weight lifted itself.
 */
export function calculateEstimated1RM(
  weightKg: number | null | undefined,
  reps: number | null | undefined,
): number | null {
  if (!weightKg || weightKg <= 0) return null;
  if (!reps || reps <= 0) return null;
  if (reps > 12) return null;

  if (reps === 1) {
    return Math.round(weightKg * 10) / 10;
  }

  const oneRm = weightKg * (1 + reps / 30);
  return Math.round(oneRm * 10) / 10;
}

/**
 * Standard MET values (Compendium of Physical Activities)
 * Adjusted by optional effort rating (1-10).
 */
export function getStandardMet(
  type: WorkoutType,
  effortRating?: number | null,
): number {
  let baseMet = 5.0;

  switch (type) {
    case 'strength':
      baseMet = 5.0; // Moderate resistance training
      break;
    case 'cardio':
      baseMet = 7.0; // General conditioning/cardio
      break;
    case 'walk_run':
      baseMet = 6.5; // Moderate run/brisk walk combo
      break;
    case 'sports':
      baseMet = 6.0; // General competitive sports
      break;
    case 'yoga_mobility':
      baseMet = 3.0; // Stretching, Hatha yoga
      break;
    case 'other':
    default:
      baseMet = 4.5;
      break;
  }

  if (effortRating && effortRating >= 1 && effortRating <= 10) {
    // Scale MET smoothly between light (effort 1-3) and vigorous (effort 8-10)
    // Multiplier between ~0.75x (effort 1) to 1.35x (effort 10)
    const multiplier = 0.75 + ((effortRating - 1) / 9) * 0.6;
    return Math.round(baseMet * multiplier * 10) / 10;
  }

  return baseMet;
}

/**
 * PRD 7.8: Workout calories (informational) = MET x weight (kg) x duration (hours)
 * PRD 6.6 WRK-8: "The estimate is never added to the calorie target."
 */
export function calculateWorkoutCalories(
  met: number,
  weightKg: number,
  durationMinutes: number,
): { calories: number; isEstimate: true } {
  if (met <= 0 || weightKg <= 0 || durationMinutes <= 0) {
    return { calories: 0, isEstimate: true };
  }

  const durationHours = durationMinutes / 60;
  const burned = Math.round(met * weightKg * durationHours);

  return {
    calories: burned,
    isEstimate: true,
  };
}

/**
 * Format minutes and seconds into MM:SS
 */
export function formatPace(paceDecimalMinutes: number): string {
  if (!isFinite(paceDecimalMinutes) || paceDecimalMinutes <= 0) {
    return '0:00';
  }
  const mins = Math.floor(paceDecimalMinutes);
  const secs = Math.round((paceDecimalMinutes - mins) * 60);
  if (secs === 60) {
    return `${mins + 1}:00`;
  }
  const paddedSecs = secs < 10 ? `0${secs}` : `${secs}`;
  return `${mins}:${paddedSecs}`;
}

/**
 * PRD 6.6 WRK-3: Cardio workouts: duration, optional distance,
 * and average pace or speed calculated automatically.
 */
export function calculateCardioPaceAndSpeed(
  durationMinutes: number,
  distanceKm: number,
): CardioMetrics {
  if (durationMinutes <= 0 || distanceKm <= 0) {
    return {
      speed_km_h: 0,
      pace_min_km: 0,
      formatted_pace: '0:00 min/km',
      speed_mph: 0,
      pace_min_mile: 0,
      formatted_pace_mile: '0:00 min/mi',
    };
  }

  const hours = durationMinutes / 60;
  const speedKmH = Math.round((distanceKm / hours) * 100) / 100;
  const paceMinKm = Math.round((durationMinutes / distanceKm) * 100) / 100;

  // Imperial conversions (1 km = 0.621371 miles)
  const distanceMiles = distanceKm * 0.621371;
  const speedMph = Math.round((distanceMiles / hours) * 100) / 100;
  const paceMinMile = Math.round((durationMinutes / distanceMiles) * 100) / 100;

  return {
    speed_km_h: speedKmH,
    pace_min_km: paceMinKm,
    formatted_pace: `${formatPace(paceMinKm)} min/km`,
    speed_mph: speedMph,
    pace_min_mile: paceMinMile,
    formatted_pace_mile: `${formatPace(paceMinMile)} min/mi`,
  };
}

/**
 * PRD 6.6 WRK-8: Per-workout summary: duration, total volume (7.8)
 * and an informational calorie estimate (MET-based, 7.8).
 */
export function summarizeWorkout(
  workout: WorkoutWithDetails,
  userWeightKg = 70, // Default 70 kg if not provided
): WorkoutSummary {
  const met = getStandardMet(workout.type, workout.effort_rating);
  const calEstimate = calculateWorkoutCalories(
    met,
    userWeightKg,
    workout.duration_minutes,
  );

  let totalVolume = 0;
  let totalSets = 0;
  let totalReps = 0;

  const exerciseSummaries: WorkoutSummary['exercise_summaries'] = [];

  for (const ex of workout.exercises || []) {
    const sets = ex.sets || [];
    const exVolume = calculateWorkoutVolume(sets);
    totalVolume += exVolume;

    let best1rm: number | null = null;
    let heaviestWeight: number | null = null;

    for (const set of sets) {
      if (set.completed === false) continue;
      totalSets += 1;
      if (set.reps) totalReps += set.reps;

      if (set.weight_kg && (heaviestWeight === null || set.weight_kg > heaviestWeight)) {
        heaviestWeight = set.weight_kg;
      }

      const est1rm = calculateEstimated1RM(set.weight_kg, set.reps);
      if (est1rm !== null && (best1rm === null || est1rm > best1rm)) {
        best1rm = est1rm;
      }
    }

    exerciseSummaries.push({
      exercise_id: ex.exercise_id,
      exercise_name: ex.exercise_name,
      set_count: sets.length,
      total_volume_kg: exVolume,
      best_1rm_kg: best1rm,
      heaviest_weight_kg: heaviestWeight,
    });
  }

  return {
    workout_id: workout.id,
    duration_minutes: workout.duration_minutes,
    total_volume_kg: Math.round(totalVolume * 100) / 100,
    total_sets: totalSets,
    total_reps: totalReps,
    estimated_calories: calEstimate.calories,
    is_calorie_estimate: true,
    exercise_summaries: exerciseSummaries,
  };
}
