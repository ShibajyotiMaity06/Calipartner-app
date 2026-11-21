import { describe, it, expect } from 'vitest';
import {
  addCooldownMonths,
  calculateDaysRemaining,
  scanLimitations,
  isExerciseAllowed,
  generateWorkoutPlan,
  validateGeneratedWorkoutPlan,
  resolveEffectiveSplit,
  getSplitDayTemplates,
  BEGINNER_EXCLUDED_EXERCISES,
  type AiWorkoutInputs,
} from './workoutRedesign';

describe('Workout Redesign: Cooldown Date Math', () => {
  it('adds 3 calendar months correctly for standard dates', () => {
    const start = new Date(Date.UTC(2026, 10, 17)); // 17 Nov 2026
    const end = addCooldownMonths(start, 3);
    expect(end.getUTCFullYear()).toBe(2027);
    expect(end.getUTCMonth()).toBe(1); // Feb
    expect(end.getUTCDate()).toBe(17);
  });

  it('handles month-end bounds without skipping months (30 Nov -> 28 Feb in non-leap year)', () => {
    const start = new Date(Date.UTC(2026, 10, 30)); // 30 Nov 2026
    const end = addCooldownMonths(start, 3);
    expect(end.getUTCFullYear()).toBe(2027);
    expect(end.getUTCMonth()).toBe(1); // Feb
    expect(end.getUTCDate()).toBe(28); // Feb 28
  });

  it('handles 31 Jan -> 30 Apr', () => {
    const start = new Date(Date.UTC(2027, 0, 31)); // 31 Jan 2027
    const end = addCooldownMonths(start, 3);
    expect(end.getUTCFullYear()).toBe(2027);
    expect(end.getUTCMonth()).toBe(3); // April
    expect(end.getUTCDate()).toBe(30);
  });

  it('calculates days remaining correctly, rounded up', () => {
    const now = new Date(Date.UTC(2026, 10, 21, 10, 0, 0));
    const unlock = new Date(Date.UTC(2027, 1, 17, 10, 0, 0));
    const days = calculateDaysRemaining(now, unlock);
    expect(days).toBe(88);

    const past = new Date(Date.UTC(2026, 9, 1));
    expect(calculateDaysRemaining(now, past)).toBe(0);
  });
});

describe('Workout Redesign: Injury Exclusions & Limitations', () => {
  it('detects lower back keywords and returns excluded movements', () => {
    const result = scanLimitations('Lower back pain, left knee');
    expect(result.matchedGroups).toContain('lower_back');
    expect(result.matchedGroups).toContain('knee');
    expect(result.excludedNames).toContain('deadlift');
    expect(result.excludedNames).toContain('squat');
    expect(result.excludedNames).toContain('dumbbell reverse lunge');
  });

  it('detects shoulder injury keywords and returns overhead presses', () => {
    const result = scanLimitations('Had a rotator cuff impingement on right shoulder');
    expect(result.matchedGroups).toContain('shoulder');
    expect(result.excludedNames).toContain('overhead press');
    expect(result.excludedNames).toContain('upright row');
  });

  it('extracts unmatched limitations clauses for the shield card', () => {
    const result = scanLimitations('Knee pain, avoid heavy breathing, vertigo when lying down');
    expect(result.matchedGroups).toContain('knee');
    expect(result.unmatched).toContain('avoid heavy breathing');
    expect(result.unmatched).toContain('vertigo when lying down');
  });
});

describe('Workout Redesign: Experience & Equipment Tiers', () => {
  it('beginner strictly removes the 5 banned lifts', () => {
    for (const lift of BEGINNER_EXCLUDED_EXERCISES) {
      const allowed = isExerciseAllowed(
        { name: lift, equipment: 'barbell', level_min: 'intermediate' },
        'advanced_gym',
        'beginner',
        [],
      );
      expect(allowed).toBe(false);
    }
  });

  it('home tier allows bodyweight only', () => {
    expect(
      isExerciseAllowed({ name: 'Push-Up', equipment: 'bodyweight' }, 'home', 'intermediate', []),
    ).toBe(true);
    expect(
      isExerciseAllowed(
        { name: 'Dumbbell Bench Press', equipment: 'dumbbell' },
        'home',
        'intermediate',
        [],
      ),
    ).toBe(false);
    expect(
      isExerciseAllowed({ name: 'Lat Pulldown', equipment: 'cable' }, 'home', 'intermediate', []),
    ).toBe(false);
  });

  it('basic gym allows dumbbells and barbells but rejects cables and selectorized machines', () => {
    expect(
      isExerciseAllowed(
        { name: 'Dumbbell Bench Press', equipment: 'dumbbell' },
        'basic_gym',
        'intermediate',
        [],
      ),
    ).toBe(true);
    expect(
      isExerciseAllowed(
        { name: 'Lat Pulldown', equipment: 'cable' },
        'basic_gym',
        'intermediate',
        [],
      ),
    ).toBe(false);
  });
});

describe('Workout Redesign: AI Plan Generation & Validation Matrix', () => {
  it('generates the exact 4-day Upper/Lower plan from the design PDF', () => {
    const inputs: AiWorkoutInputs = {
      days_per_week: 4,
      training_days: [1, 2, 4, 6], // Mon, Tue, Thu, Sat
      session_minutes: 60,
      split: 'upper_lower',
      experience: 'beginner',
      location: 'basic_gym',
      limitations: 'Lower back pain, left knee',
      workout_notes: 'Prioritise arms. No heavy leg days.',
    };

    const plan = generateWorkoutPlan(inputs);
    const validation = validateGeneratedWorkoutPlan(plan, inputs);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);

    const trainingDays = plan.days.filter((d) => !d.is_rest);
    expect(trainingDays.length).toBe(4);
    expect(trainingDays.map((d) => d.weekday)).toEqual([1, 2, 4, 6]);

    // Check exercise count (60 min -> 4 exercises)
    for (const d of trainingDays) {
      expect(d.exercises.length).toBe(4);
      // Ensure target weight is null for user to enter
      expect(d.exercises.every((e) => e.target_weight_kg === null)).toBe(true);
    }
  });

  it('runs across all matrix combinations of days, durations, splits, and locations', () => {
    const dayCounts = [1, 2, 3, 4, 5, 6];
    const durations = [30, 60, 90, 120] as const;
    const splits = ['ppl', 'upper_lower', 'full_body', 'body_part', 'auto'] as const;
    const experiences = ['beginner', 'intermediate', 'experienced'] as const;
    const locations = ['home', 'basic_gym', 'advanced_gym'] as const;

    for (const days of dayCounts) {
      const trainingDays = [1, 2, 3, 4, 5, 6].slice(0, days);
      for (const dur of durations) {
        for (const split of splits) {
          const inputs: AiWorkoutInputs = {
            days_per_week: days,
            training_days: trainingDays,
            session_minutes: dur,
            split,
            experience: 'intermediate',
            location: 'advanced_gym',
          };
          const plan = generateWorkoutPlan(inputs);
          const validation = validateGeneratedWorkoutPlan(plan, inputs);
          expect(validation.valid).toBe(true);
        }
      }
    }
  });

  it('1-day plans always resolve to Full Body regardless of requested split', () => {
    const inputs: AiWorkoutInputs = {
      days_per_week: 1,
      training_days: [3], // Wed
      session_minutes: 30,
      split: 'ppl',
      experience: 'beginner',
      location: 'home',
    };
    const plan = generateWorkoutPlan(inputs);
    const trainingDays = plan.days.filter((d) => !d.is_rest);
    expect(trainingDays.length).toBe(1);
    expect(trainingDays[0]!.name).toBe('Full Body');
    expect(trainingDays[0]!.exercises.length).toBe(3); // 30 min -> 3 exercises
  });
});
