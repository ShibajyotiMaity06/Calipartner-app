import type { IndividualProgressData } from './types.ts';
import {
  calculateGoalProgressPercent,
  calculateWeeklyPace,
  calculateWeightTrend,
  getDaysDifference,
} from './trackers.ts';
import { getPreviousDateString } from './progress.ts';
import { calculateEstimated1RM } from './workouts.ts';

/** Derive estimates with the existing validated formula, never in SQL or the screen. */
export function enrichProgress(data: IndividualProgressData): IndividualProgressData {
  if (!data.workouts.strength_sets) return data;
  const exercises = new Map<
    string,
    IndividualProgressData['workouts']['exercise_progression'][number]
  >();
  let volume = 0;
  for (const set of data.workouts.strength_sets) {
    const key = set.exercise_id ?? set.exercise_name;
    const exercise = exercises.get(key) ?? {
      exercise_id: set.exercise_id,
      exercise_name: set.exercise_name,
      data: [],
    };
    const day = exercise.data.find((item) => item.local_date === set.date) ?? {
      local_date: set.date,
      heaviest_weight_kg: 0,
      best_1rm_kg: 0,
    };
    day.heaviest_weight_kg = Math.max(day.heaviest_weight_kg, set.weight_kg ?? 0);
    day.best_1rm_kg = Math.max(
      day.best_1rm_kg,
      calculateEstimated1RM(set.weight_kg, set.reps) ?? 0,
    );
    if (!exercise.data.includes(day)) exercise.data.push(day);
    exercise.data.sort((a, b) => a.local_date.localeCompare(b.local_date));
    exercises.set(key, exercise);
    volume += (set.weight_kg ?? 0) * set.reps;
  }
  return {
    ...data,
    workouts: {
      ...data.workouts,
      total_volume_kg: volume,
      exercise_progression: [...exercises.values()],
    },
  };
}

export function weightMilestone(
  start: number | null,
  current: number | null,
  target: number | null,
) {
  const valid = (value: number | null): value is number =>
    value !== null && Number.isFinite(value) && value > 0;
  return {
    change: valid(start) && valid(current) ? current - start : null,
    remaining: valid(current) && valid(target) ? Math.abs(target - current) : null,
    percent:
      valid(start) && valid(current) && valid(target)
        ? calculateGoalProgressPercent(start, current, target)
        : null,
    maintaining: valid(start) && valid(target) && Math.abs(start - target) < 0.1,
  };
}

/** Missing measurements are never invented as zero; all boundaries come from the stored-zone RPC. */
export function summarizeProgress(data: IndividualProgressData) {
  const entries = data.weight.history
    .filter(
      (p) =>
        p.date >= data.start_date &&
        p.date <= data.end_date &&
        p.raw_weight_kg != null &&
        Number.isFinite(p.raw_weight_kg),
    )
    .map((p) => ({ date: p.date, weightKg: p.raw_weight_kg! }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const average = (values: number[]) =>
    values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  const recent = entries.filter((p) => getDaysDifference(data.end_date, p.date) <= 6);
  const foodDays = data.calories.daily.filter((d) => d.calories > 0);
  const totalDays = Math.max(1, getDaysDifference(data.end_date, data.start_date) + 1);
  const gridDays = Math.min(totalDays, 90);
  const logged = new Set(data.calories.daily.filter((d) => d.is_logged_day).map((d) => d.date));
  const strength =
    data.workouts.exercise_progression
      .flatMap((ex) =>
        ex.data
          .filter(
            (point) =>
              point.local_date >= data.start_date &&
              point.local_date <= data.end_date &&
              point.best_1rm_kg > 0,
          )
          .map((point) => ({ name: ex.exercise_name, value: point.best_1rm_kg })),
      )
      .sort((a, b) => b.value - a.value)[0] ?? null;
  return {
    proteinGoalPercent:
      data.macros.food_days &&
      data.macros.protein_goal_days !== undefined &&
      data.macros.protein_target_g > 0
        ? Math.round((100 * data.macros.protein_goal_days) / data.macros.food_days)
        : null,
    rolling: average(recent.map((p) => p.weightKg)),
    lowest: entries.length ? Math.min(...entries.map((p) => p.weightKg)) : null,
    periodChange: entries.length > 1 ? entries.at(-1)!.weightKg - entries[0]!.weightKg : null,
    pace: calculateWeeklyPace(calculateWeightTrend(entries)).weeklyPaceKg,
    calories: average(foodDays.map((d) => d.calories)),
    calorieTarget: average(foodDays.map((d) => d.target_calories)),
    foodDays: foodDays.length,
    goalDays: data.calories.daily.filter((d) => d.is_goal_day).length,
    qualifyingDays: data.calories.daily.filter((d) => d.is_logged_day).length,
    steps: average(data.steps.daily.filter((d) => d.steps > 0).map((d) => d.steps)),
    water: average(data.water.daily.filter((d) => d.water_ml > 0).map((d) => d.water_ml)),
    totalDays,
    strength,
    dates: Array.from({ length: gridDays }, (_, i) => ({
      date: getPreviousDateString(data.end_date, gridDays - 1 - i),
      logged: logged.has(getPreviousDateString(data.end_date, gridDays - 1 - i)),
    })),
  };
}
