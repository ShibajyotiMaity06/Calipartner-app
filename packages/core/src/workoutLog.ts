export function validWorkoutLog(
  sets: ReadonlyArray<{ reps: number; weightKg: number }>,
  durationMinutes: number,
): boolean {
  return (
    sets.length >= 1 &&
    sets.length <= 50 &&
    Number.isInteger(durationMinutes) &&
    durationMinutes >= 0 &&
    durationMinutes <= 1440 &&
    sets.every(
      (set) =>
        Number.isInteger(set.reps) &&
        set.reps >= 1 &&
        set.reps <= 100 &&
        Number.isFinite(set.weightKg) &&
        set.weightKg >= 0 &&
        set.weightKg <= 1000,
    )
  );
}
