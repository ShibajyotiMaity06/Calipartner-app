export type CardioMode = 'running' | 'cycling' | 'steps';

export interface CardioSessionMetrics {
  mode: CardioMode;
  duration_seconds: number;
  distance_m: number | null;
  step_count: number | null;
  target: number;
  estimated_calories: number | null;
}

export function cardioGoalReached(session: CardioSessionMetrics) {
  return (
    (session.mode === 'steps' ? (session.step_count ?? 0) : (session.distance_m ?? 0)) >=
    session.target
  );
}

export function speedKmh(distanceKm: number, durationSeconds: number) {
  return distanceKm > 0 && durationSeconds > 0 ? (distanceKm * 3600) / durationSeconds : null;
}

export function paceForSpeed(speed: number | null) {
  if (speed === null || speed <= 0) return null;
  const secondsPerKm = Math.round(3600 / speed);
  return { minutes: Math.floor(secondsPerKm / 60), seconds: secondsPerKm % 60 };
}

export function estimateOutdoorCardioCalories(
  mode: Exclude<CardioMode, 'steps'>,
  weightKg: number,
  distanceKm: number,
  durationSeconds: number,
) {
  if (!Number.isFinite(weightKg) || weightKg <= 0 || distanceKm <= 0 || durationSeconds <= 0)
    return null;
  if (mode === 'running') return Math.round(distanceKm * weightKg * 1.036);
  const speed = speedKmh(distanceKm, durationSeconds) ?? 0;
  const met =
    speed < 16
      ? 4
      : speed < 19
        ? 6.8
        : speed < 22.5
          ? 8
          : speed < 25.5
            ? 10
            : speed < 30.5
              ? 12
              : 15.8;
  return Math.round(((met * 3.5 * weightKg) / 200) * (durationSeconds / 60));
}
