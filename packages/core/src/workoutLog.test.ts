import { describe, expect, it } from 'vitest';
import { validWorkoutLog } from './workoutLog';
describe('entered workout validation', () => {
  it('accepts bodyweight sets and valid weighted sets', () => {
    expect(
      validWorkoutLog(
        [
          { reps: 12, weightKg: 0 },
          { reps: 8, weightKg: 12.5 },
        ],
        30,
      ),
    ).toBe(true);
  });
  it.each(
    [
      [],
      [{ reps: 0, weightKg: 10 }],
      [{ reps: 1.5, weightKg: 10 }],
      [{ reps: 10, weightKg: -1 }],
      [{ reps: 10, weightKg: NaN }],
      [{ reps: 101, weightKg: 10 }],
    ].map((sets) => ({ sets })),
  )('rejects missing or invalid sets $sets', ({ sets }) => {
    expect(validWorkoutLog(sets, 20)).toBe(false);
  });
  it('rejects invalid durations and oversized sessions', () => {
    expect(validWorkoutLog([{ reps: 10, weightKg: 0 }], 1441)).toBe(false);
    expect(
      validWorkoutLog(
        Array.from({ length: 51 }, () => ({ reps: 10, weightKg: 0 })),
        30,
      ),
    ).toBe(false);
  });
});
