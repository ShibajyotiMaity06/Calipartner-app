import { describe, expect, it } from 'vitest';
import {
  calculateCardioPaceAndSpeed,
  calculateEstimated1RM,
  calculateWorkoutCalories,
  calculateWorkoutVolume,
  formatPace,
  getStandardMet,
  summarizeWorkout,
} from './workouts';
import { EXERCISE_DEV_SEED_40 } from './exercise_dataset';
import {
  importExercisesFromCsv,
  importExercisesFromJson,
  validateAndNormalizeExercise,
} from './exercise_importer';
import type { WorkoutWithDetails } from './types';

describe('Workout Volume calculation (PRD 7.8)', () => {
  it('sums reps x weight across all completed sets', () => {
    const sets = [
      { reps: 10, weight_kg: 50, completed: true },
      { reps: 8, weight_kg: 60, completed: true },
      { reps: 6, weight_kg: 70, completed: true },
    ];
    // 10*50 + 8*60 + 6*70 = 500 + 480 + 420 = 1400
    expect(calculateWorkoutVolume(sets)).toBe(1400);
  });

  it('excludes uncompleted sets and warmups by default', () => {
    const sets = [
      { reps: 15, weight_kg: 20, completed: true, is_warmup: true }, // warmup
      { reps: 10, weight_kg: 50, completed: true, is_warmup: false },
      { reps: 8, weight_kg: 60, completed: false, is_warmup: false }, // not completed
    ];
    expect(calculateWorkoutVolume(sets)).toBe(500);
  });

  it('includes warmups when explicitly requested', () => {
    const sets = [
      { reps: 15, weight_kg: 20, completed: true, is_warmup: true }, // 300
      { reps: 10, weight_kg: 50, completed: true, is_warmup: false }, // 500
    ];
    expect(calculateWorkoutVolume(sets, { includeWarmups: true })).toBe(800);
  });

  it('handles null, undefined, or zero values safely', () => {
    const sets = [
      { reps: null, weight_kg: 50, completed: true },
      { reps: 10, weight_kg: null, completed: true },
      { reps: 0, weight_kg: 50, completed: true },
    ];
    expect(calculateWorkoutVolume(sets)).toBe(0);
    expect(calculateWorkoutVolume([])).toBe(0);
  });
});

describe('Estimated 1RM (Epley formula, PRD 7.8)', () => {
  it('returns weight for 1 rep', () => {
    expect(calculateEstimated1RM(100, 1)).toBe(100);
    expect(calculateEstimated1RM(82.5, 1)).toBe(82.5);
  });

  it('calculates 1RM using Weight x (1 + reps / 30) for sets <= 12 reps', () => {
    // 10 reps @ 100 kg -> 100 * (1 + 10/30) = 133.33 -> 133.3
    expect(calculateEstimated1RM(100, 10)).toBe(133.3);

    // 5 reps @ 80 kg -> 80 * (1 + 5/30) = 80 * (1.1666...) = 93.33 -> 93.3
    expect(calculateEstimated1RM(80, 5)).toBe(93.3);

    // 12 reps @ 60 kg -> 60 * (1 + 12/30) = 60 * 1.4 = 84
    expect(calculateEstimated1RM(60, 12)).toBe(84);
  });

  it('returns null for sets > 12 reps according to PRD rule', () => {
    expect(calculateEstimated1RM(60, 13)).toBeNull();
    expect(calculateEstimated1RM(50, 20)).toBeNull();
  });

  it('returns null for invalid inputs (negative or zero reps/weight)', () => {
    expect(calculateEstimated1RM(0, 5)).toBeNull();
    expect(calculateEstimated1RM(-50, 5)).toBeNull();
    expect(calculateEstimated1RM(100, 0)).toBeNull();
    expect(calculateEstimated1RM(100, -2)).toBeNull();
    expect(calculateEstimated1RM(null, 5)).toBeNull();
    expect(calculateEstimated1RM(100, null)).toBeNull();
  });
});

describe('MET-based Calorie Estimate (PRD 7.8 & WRK-8)', () => {
  it('calculates workout calories based on MET, weight, and duration', () => {
    // 60 mins @ 70 kg, strength MET 5.0 -> 5.0 * 70 * 1 hour = 350 kcal
    const res = calculateWorkoutCalories(5.0, 70, 60);
    expect(res.calories).toBe(350);
    expect(res.isEstimate).toBe(true);
  });

  it('adjusts base MET based on effort rating (1-10)', () => {
    const baseMet = getStandardMet('strength');
    expect(baseMet).toBe(5.0);

    const lightMet = getStandardMet('strength', 1);
    const hardMet = getStandardMet('strength', 10);

    expect(lightMet).toBeLessThan(baseMet);
    expect(hardMet).toBeGreaterThan(baseMet);
  });

  it('handles zero or negative duration/weight gracefully', () => {
    expect(calculateWorkoutCalories(5.0, 70, 0).calories).toBe(0);
    expect(calculateWorkoutCalories(5.0, 0, 60).calories).toBe(0);
  });
});

describe('Cardio Pace and Speed (PRD 6.6 WRK-3)', () => {
  it('formats pace correctly into MM:SS', () => {
    expect(formatPace(5.5)).toBe('5:30');
    expect(formatPace(6.0)).toBe('6:00');
    expect(formatPace(4.25)).toBe('4:15');
    expect(formatPace(5.0833)).toBe('5:05');
  });

  it('calculates average pace and speed automatically', () => {
    // 5 km in 30 minutes
    const metrics = calculateCardioPaceAndSpeed(30, 5);
    expect(metrics.speed_km_h).toBe(10);
    expect(metrics.pace_min_km).toBe(6);
    expect(metrics.formatted_pace).toBe('6:00 min/km');
  });

  it('calculates imperial speed and pace', () => {
    // 10 km in 60 minutes
    const metrics = calculateCardioPaceAndSpeed(60, 10);
    expect(metrics.speed_km_h).toBe(10);
    expect(metrics.speed_mph).toBeCloseTo(6.21, 1);
    expect(metrics.pace_min_mile).toBeCloseTo(9.66, 1);
  });

  it('handles 0 or negative inputs gracefully without NaN or infinity', () => {
    const metrics = calculateCardioPaceAndSpeed(0, 0);
    expect(metrics.speed_km_h).toBe(0);
    expect(metrics.pace_min_km).toBe(0);
    expect(metrics.formatted_pace).toBe('0:00 min/km');
  });
});

describe('Workout Summary calculation (PRD 6.6 WRK-8)', () => {
  it('aggregates volume, sets, reps, and exercise progression', () => {
    const workout: WorkoutWithDetails = {
      id: 'w-1',
      user_id: 'u-1',
      type: 'strength',
      duration_minutes: 45,
      local_date: '2026-10-10',
      effort_rating: 7,
      exercises: [
        {
          id: 'we-1',
          workout_id: 'w-1',
          user_id: 'u-1',
          exercise_id: 'ex-bench',
          exercise_name: 'Barbell Bench Press',
          order_in_workout: 1,
          sets: [
            {
              id: 'ws-1',
              workout_exercise_id: 'we-1',
              workout_id: 'w-1',
              user_id: 'u-1',
              set_number: 1,
              reps: 10,
              weight_kg: 60,
              completed: true,
            },
            {
              id: 'ws-2',
              workout_exercise_id: 'we-1',
              workout_id: 'w-1',
              user_id: 'u-1',
              set_number: 2,
              reps: 8,
              weight_kg: 70,
              completed: true,
            },
          ],
        },
      ],
    };

    const summary = summarizeWorkout(workout, 75);
    expect(summary.workout_id).toBe('w-1');
    expect(summary.duration_minutes).toBe(45);
    // 10*60 + 8*70 = 600 + 560 = 1160 kg
    expect(summary.total_volume_kg).toBe(1160);
    expect(summary.total_sets).toBe(2);
    expect(summary.total_reps).toBe(18);
    expect(summary.is_calorie_estimate).toBe(true);
    expect(summary.estimated_calories).toBeGreaterThan(0);

    expect(summary.exercise_summaries).toHaveLength(1);
    const benchSummary = summary.exercise_summaries[0]!;
    expect(benchSummary.exercise_name).toBe('Barbell Bench Press');
    expect(benchSummary.heaviest_weight_kg).toBe(70);
    // 8 reps at 70 kg -> 70 * (1 + 8/30) = 88.67 -> 88.7
    expect(benchSummary.best_1rm_kg).toBe(88.7);
  });
});

describe('40 Dev Seed Exercise Library', () => {
  it('contains exactly 40 diverse exercises', () => {
    expect(EXERCISE_DEV_SEED_40).toHaveLength(40);
  });

  it('has valid structure and unique IDs for all 40 exercises', () => {
    const ids = new Set<string>();
    const names = new Set<string>();

    for (const ex of EXERCISE_DEV_SEED_40) {
      expect(ex.id).toBeDefined();
      expect(ids.has(ex.id)).toBe(false);
      ids.add(ex.id);

      expect(ex.name.trim().length).toBeGreaterThan(0);
      expect(names.has(ex.name)).toBe(false);
      names.add(ex.name);

      expect(['chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'cardio', 'full_body']).toContain(
        ex.muscle_group,
      );
      expect(ex.attribution).toContain('CC-BY-4.0');
    }
  });
});

describe('Exercise Library Importer (JSON & CSV)', () => {
  it('imports valid JSON array of exercises', () => {
    const raw = [
      {
        name: 'Incline Dumbbell Curl',
        muscle_group: 'arms',
        equipment: 'dumbbell',
        type: 'strength',
      },
    ];
    const imported = importExercisesFromJson(raw);
    expect(imported).toHaveLength(1);
    expect(imported[0]!.name).toBe('Incline Dumbbell Curl');
    expect(imported[0]!.muscle_group).toBe('arms');
    expect(imported[0]!.owner_id).toBeNull();
    expect(imported[0]!.attribution).toBe('CaliPartner Open Exercise Library (CC-BY-4.0)');
  });

  it('rejects invalid muscle groups or empty names in JSON', () => {
    expect(() =>
      importExercisesFromJson([
        {
          name: '',
          muscle_group: 'arms',
          equipment: 'dumbbell',
          type: 'strength',
        },
      ]),
    ).toThrow(/Exercise name cannot be empty/);

    expect(() =>
      importExercisesFromJson([
        {
          name: 'Invalid Exercise',
          muscle_group: 'alien_muscle',
          equipment: 'dumbbell',
          type: 'strength',
        },
      ]),
    ).toThrow(/Invalid muscle group/);
  });

  it('imports valid CSV with standard headers', () => {
    const csv = `name,muscle_group,equipment,type,attribution
Romanian Deadlift,legs,barbell,strength,Custom Attribution
Overhead Press,shoulders,barbell,strength,Custom Attribution`;

    const imported = importExercisesFromCsv(csv);
    expect(imported).toHaveLength(2);
    expect(imported[0]!.name).toBe('Romanian Deadlift');
    expect(imported[0]!.muscle_group).toBe('legs');
    expect(imported[0]!.attribution).toBe('Custom Attribution');
    expect(imported[1]!.name).toBe('Overhead Press');
  });

  it('rejects CSV with missing required headers', () => {
    const invalidCsv = `title,muscle,gear
Squat,legs,barbell`;
    expect(() => importExercisesFromCsv(invalidCsv)).toThrow(/Required header columns/);
  });

  it('validates and normalizes single exercise input', () => {
    const normalized = validateAndNormalizeExercise({
      name: '  Pull-up  ',
      muscle_group: 'BACK',
      equipment: 'BODYWEIGHT',
      type: 'BODYWEIGHT',
    });
    expect(normalized.name).toBe('Pull-up');
    expect(normalized.muscle_group).toBe('back');
    expect(normalized.equipment).toBe('bodyweight');
    expect(normalized.type).toBe('bodyweight');
    expect(normalized.attribution).toBe('CaliPartner Open Exercise Library (CC-BY-4.0)');
  });
});

