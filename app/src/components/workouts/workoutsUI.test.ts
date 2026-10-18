import { describe, expect, it } from 'vitest';
import {
  calculateCardioPaceAndSpeed,
  calculateEstimated1RM,
  calculateWorkoutCalories,
  calculateWorkoutVolume,
  formatPace,
  getStandardMet,
} from '@calipartner/core';
import { t } from '@/i18n';
import { en } from '@/i18n/en';

describe('Phase 6 — Workout Tracker UI Logic & Presentation Tests', () => {
  describe('1. i18n & Translation Verification', () => {
    it('verifies all 6 workout type labels exist in i18n', () => {
      expect(en.workouts.types.strength).toBe('Strength');
      expect(en.workouts.types.cardio).toBe('Cardio');
      expect(en.workouts.types.walk_run).toBe('Walk / Run');
      expect(en.workouts.types.sports).toBe('Sports');
      expect(en.workouts.types.yoga_mobility).toBe('Yoga & Mobility');
      expect(en.workouts.types.other).toBe('Other');
    });

    it('verifies timer action and state labels exist', () => {
      expect(en.workouts.timer.start).toBe('Start Timer');
      expect(en.workouts.timer.pause).toBe('Pause');
      expect(en.workouts.timer.resume).toBe('Resume');
      expect(en.workouts.timer.stop).toBe('Stop & Apply');
      expect(en.workouts.timer.running).toBe('Session Running');
      expect(en.workouts.timer.paused).toBe('Session Paused');
    });

    it('verifies PRD 6.6 WRK-8 calorie estimate label and disclaimer', () => {
      expect(en.workouts.calorieEstimateBadge).toBe('ESTIMATE');
      expect(en.workouts.calorieEstimateDisclaimer).toContain(
        'never added to your food calorie target',
      );
    });

    it('verifies quick log sheet options for food and workout exist', () => {
      expect(en.workouts.logSheet.title).toBe('Quick Log');
      expect(en.workouts.logSheet.foodOption).toBe('Log Food');
      expect(en.workouts.logSheet.workoutOption).toBe('Log Workout');
    });

    it('verifies exercise and set headers exist', () => {
      expect(en.workouts.sets.headerSet).toBe('Set');
      expect(en.workouts.sets.headerWarmup).toBe('W');
      expect(en.workouts.sets.headerWeight).toBe('Weight (kg)');
      expect(en.workouts.sets.headerReps).toBe('Reps');
      expect(en.workouts.sets.headerDone).toBe('Done');
    });

    it('interpolates previous performance hint via t helper', () => {
      const hint = t('workouts.exercises.lastTimeHint', { summary: '3 x 8 at 40 kg' });
      expect(hint).toBe('Last time: 3 x 8 at 40 kg');
    });
  });

  describe('2. Fast One-Handed Numeric Entry Logic', () => {
    it('handles weight stepper increments with fast stepping', () => {
      const stepWeight = (current: number, delta: number) =>
        Math.max(0, Math.round((current + delta) * 10) / 10);

      expect(stepWeight(40, 2.5)).toBe(42.5);
      expect(stepWeight(42.5, -2.5)).toBe(40);
      expect(stepWeight(1, -2.5)).toBe(0); // clamps at 0
      expect(stepWeight(0, 5)).toBe(5);
    });

    it('handles reps stepper increments and clamps to non-negative', () => {
      const stepReps = (current: number, delta: number) => Math.max(0, current + delta);

      expect(stepReps(8, 1)).toBe(9);
      expect(stepReps(8, -1)).toBe(7);
      expect(stepReps(0, -1)).toBe(0);
    });

    it('pre-fills next set with previous set reps and weight for 1-tap logging', () => {
      const sets = [
        { setNumber: 1, reps: 8, weightKg: 60, isWarmup: true, completed: true },
        { setNumber: 2, reps: 10, weightKg: 80, isWarmup: false, completed: true },
      ];

      const getNextSetDefaults = (existingSets: typeof sets) => {
        const last = existingSets[existingSets.length - 1];
        return {
          setNumber: existingSets.length + 1,
          reps: last ? last.reps : 10,
          weightKg: last ? last.weightKg : 20,
          isWarmup: false,
          completed: true,
        };
      };

      const next = getNextSetDefaults(sets);
      expect(next).toEqual({
        setNumber: 3,
        reps: 10,
        weightKg: 80,
        isWarmup: false,
        completed: true,
      });
    });

    it('correctly re-indexes remaining sets when a set is deleted', () => {
      const sets = [
        { id: 's1', setNumber: 1, reps: 10 },
        { id: 's2', setNumber: 2, reps: 8 },
        { id: 's3', setNumber: 3, reps: 6 },
      ];

      const deleteSetAtIndex = (list: typeof sets, idx: number) =>
        list.filter((_, i) => i !== idx).map((s, newIdx) => ({ ...s, setNumber: newIdx + 1 }));

      const afterDelete = deleteSetAtIndex(sets, 1); // remove set 2
      expect(afterDelete).toHaveLength(2);
      expect(afterDelete[0]!.setNumber).toBe(1);
      expect(afterDelete[0]!.id).toBe('s1');
      expect(afterDelete[1]!.setNumber).toBe(2);
      expect(afterDelete[1]!.id).toBe('s3');
    });
  });

  describe('3. Cardio Form Presentation & Live Formulas', () => {
    it('computes pace and speed live from duration and distance', () => {
      // 30 mins, 5 km => 10 km/h, 6:00 min/km
      const m1 = calculateCardioPaceAndSpeed(30, 5);
      expect(m1.speed_km_h).toBe(10);
      expect(m1.pace_min_km).toBe(6);
      expect(m1.formatted_pace).toBe('6:00 min/km');

      // 45 mins, 10 km => 13.33 km/h, 4:30 min/km
      const m2 = calculateCardioPaceAndSpeed(45, 10);
      expect(m2.speed_km_h).toBe(13.33);
      expect(m2.pace_min_km).toBe(4.5);
      expect(m2.formatted_pace).toBe('4:30 min/km');
    });

    it('handles zero or negative duration and distance safely', () => {
      const zeroMetrics = calculateCardioPaceAndSpeed(0, 0);
      expect(zeroMetrics.speed_km_h).toBe(0);
      expect(zeroMetrics.formatted_pace).toBe('0:00 min/km');

      const noDist = calculateCardioPaceAndSpeed(45, 0);
      expect(noDist.speed_km_h).toBe(0);
    });

    it('formats decimal pace into readable MM:SS', () => {
      expect(formatPace(5.5)).toBe('5:30');
      expect(formatPace(4.25)).toBe('4:15');
      expect(formatPace(0)).toBe('0:00');
    });
  });

  describe('4. Running Timer Presentation & Duration Application', () => {
    it('formats seconds into MM:SS and HH:MM:SS', () => {
      const formatTime = (secs: number) => {
        const hours = Math.floor(secs / 3600);
        const minutes = Math.floor((secs % 3600) / 60);
        const seconds = secs % 60;
        const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
        if (hours > 0) return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
        return `${pad(minutes)}:${pad(seconds)}`;
      };

      expect(formatTime(0)).toBe('00:00');
      expect(formatTime(75)).toBe('01:15');
      expect(formatTime(3600)).toBe('01:00:00');
      expect(formatTime(3665)).toBe('01:01:05');
    });

    it('converts elapsed seconds to workout minutes on stop (rounded to nearest minute, min 1)', () => {
      const getAppliedMinutes = (elapsedSeconds: number) =>
        Math.max(1, Math.round(elapsedSeconds / 60));

      expect(getAppliedMinutes(30)).toBe(1); // 30s rounds to 1 min min
      expect(getAppliedMinutes(150)).toBe(3); // 2.5 min rounds to 3
      expect(getAppliedMinutes(3600)).toBe(60);
    });
  });

  describe('5. PRD 6.6 / 7.8 Safety & Calculations in View Layer', () => {
    it('calculates total volume correctly for completed sets only', () => {
      const sets = [
        { reps: 10, weight_kg: 50, completed: true, is_warmup: false },
        { reps: 8, weight_kg: 60, completed: true, is_warmup: false },
        { reps: 8, weight_kg: 60, completed: false, is_warmup: false }, // uncompleted ignored
      ];
      // 10*50 + 8*60 = 500 + 480 = 980 kg
      expect(calculateWorkoutVolume(sets)).toBe(980);
    });

    it('excludes warmup sets from volume by default', () => {
      const sets = [
        { reps: 10, weight_kg: 20, completed: true, is_warmup: true },
        { reps: 8, weight_kg: 60, completed: true, is_warmup: false },
      ];
      // only 8*60 = 480 kg
      expect(calculateWorkoutVolume(sets)).toBe(480);
      // with warmups included
      expect(calculateWorkoutVolume(sets, { includeWarmups: true })).toBe(680);
    });

    it('estimates calories using MET and body weight and flags isEstimate = true', () => {
      const met = getStandardMet('strength');
      const res = calculateWorkoutCalories(met, 70, 60); // 5.0 MET * 70kg * 1h = 350 kcal
      expect(res.calories).toBe(350);
      expect(res.isEstimate).toBe(true);
    });

    it('limits 1RM Epley calculation strictly to sets <= 12 reps', () => {
      // 10 reps at 100 kg: 100 * (1 + 10/30) = 133.3 kg
      expect(calculateEstimated1RM(100, 10)).toBe(133.3);
      // 12 reps at 100 kg: 100 * (1 + 12/30) = 140 kg
      expect(calculateEstimated1RM(100, 12)).toBe(140);
      // 13 reps: returns null per explicit PRD rule
      expect(calculateEstimated1RM(100, 13)).toBeNull();
      // 1 rep: weight itself
      expect(calculateEstimated1RM(100, 1)).toBe(100);
    });
  });

  describe('6. Workout History Calendar Matrix Generation', () => {
    it('computes correct calendar cell count and start offset for any month', () => {
      const generateMonthCells = (year: number, month: number) => {
        const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sun
        const startOffset = (firstDayOfWeek + 6) % 7; // Mon = 0
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        return { startOffset, daysInMonth, totalCells: startOffset + daysInMonth };
      };

      // October 2026: Oct 1 is Thursday => startOffset = 3
      const oct2026 = generateMonthCells(2026, 9); // 0-indexed month 9 = October
      expect(oct2026.daysInMonth).toBe(31);
      expect(oct2026.startOffset).toBe(3);
      expect(oct2026.totalCells).toBe(34);
    });

    it('associates workout dots with days containing logged workouts', () => {
      const calendarCounts: Record<string, number> = {
        '2026-10-08': 1,
        '2026-10-10': 2,
      };

      const hasWorkout = (dateStr: string) => (calendarCounts[dateStr] ?? 0) > 0;

      expect(hasWorkout('2026-10-10')).toBe(true);
      expect(hasWorkout('2026-10-08')).toBe(true);
      expect(hasWorkout('2026-10-09')).toBe(false);
    });
  });
});
