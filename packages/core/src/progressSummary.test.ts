import { describe, expect, it } from 'vitest';
import { enrichProgress, summarizeProgress, weightMilestone } from './progressSummary';
describe('weight milestones', () => {
  it('handles gain, loss, overshooting, regression and missing weights without false completion', () => {
    expect(weightMilestone(80, 75, 70)).toMatchObject({ percent: 50, change: -5, remaining: 5 });
    expect(weightMilestone(60, 65, 70).percent).toBe(50);
    expect(weightMilestone(80, 68, 70).percent).toBe(100);
    expect(weightMilestone(80, 82, 70).percent).toBe(0);
    expect(weightMilestone(80, null, 70).percent).toBeNull();
    expect(weightMilestone(80, 75, null).percent).toBeNull();
    expect(weightMilestone(70, 70, 70).maintaining).toBe(true);
  });
});

import type { IndividualProgressData } from './types';
function fixture(): IndividualProgressData {
  return {
    range: '7d',
    start_date: '2026-11-10',
    end_date: '2026-11-16',
    weight: {
      history: [],
      start_weight_kg: null,
      current_weight_kg: null,
      current_trend_kg: null,
      total_change_kg: null,
      total_change_pct: null,
      target_weight_kg: null,
      weekly_pace_kg: null,
      projected_date: null,
      goal_progress_pct: null,
    },
    calories: {
      daily: [],
      average_calories: 0,
      average_target: 0,
      logged_days_count: 0,
      goal_days_count: 0,
      total_days_in_range: 7,
      adherence_pct: 0,
    },
    macros: {
      protein_avg_g: 0,
      carbs_avg_g: 0,
      fat_avg_g: 0,
      protein_target_g: 100,
      carbs_target_g: 200,
      fat_target_g: 60,
    },
    steps: { daily: [], average_steps: 0, total_steps: 0, total_distance_km: 0, goal_steps: 8000 },
    water: { daily: [], average_water_ml: 0, total_water_ml: 0, goal_water_ml: 2000 },
    workouts: {
      total_workouts: 0,
      sessions_per_week: 0,
      total_duration_minutes: 0,
      total_volume_kg: 0,
      exercise_progression: [],
    },
    consistency: { current_streak: 0, longest_streak: 0, weekly_scores: [] },
    goal_progress_pct: null,
  };
}
describe('progress summaries', () => {
  it('keeps missing measurements unknown and includes every day in the selected range', () => {
    const result = summarizeProgress(fixture());
    expect(result).toMatchObject({
      rolling: null,
      lowest: null,
      periodChange: null,
      calories: null,
      calorieTarget: null,
      steps: null,
      water: null,
      strength: null,
      proteinGoalPercent: null,
      totalDays: 7,
    });
    expect(result.dates).toHaveLength(7);
    expect(result.dates[0]).toEqual({ date: '2026-11-10', logged: false });
  });
  it('uses actual food/measurement days and excludes weights outside the range', () => {
    const data = fixture();
    data.weight.history = [
      { date: '2026-11-09', raw_weight_kg: 50, trend_weight_kg: 50 },
      { date: '2026-11-16', raw_weight_kg: 78, trend_weight_kg: 79 },
      { date: '2026-11-10', raw_weight_kg: 80, trend_weight_kg: 80 },
      { date: '2026-11-12', raw_weight_kg: null, trend_weight_kg: 79 },
    ];
    data.calories.daily = [
      {
        date: '2026-11-10',
        calories: 1800,
        target_calories: 2000,
        is_logged_day: true,
        is_goal_day: true,
      },
      {
        date: '2026-11-11',
        calories: 0,
        target_calories: 2000,
        is_logged_day: false,
        is_goal_day: false,
      },
      {
        date: '2026-11-12',
        calories: 2200,
        target_calories: 2000,
        is_logged_day: true,
        is_goal_day: false,
      },
    ];
    data.macros.food_days = 2;
    data.macros.protein_goal_days = 1;
    data.steps.daily = [
      { date: '2026-11-10', steps: 8000, distance_km: 5 },
      { date: '2026-11-11', steps: 0, distance_km: 0 },
    ];
    data.water.daily = [
      { date: '2026-11-10', water_ml: 2000 },
      { date: '2026-11-11', water_ml: 0 },
    ];
    expect(summarizeProgress(data)).toMatchObject({
      rolling: 79,
      lowest: 78,
      periodChange: -2,
      calories: 2000,
      foodDays: 2,
      goalDays: 1,
      qualifyingDays: 2,
      steps: 8000,
      water: 2000,
      proteinGoalPercent: 50,
    });
    data.start_date = '2025-01-01';
    data.range = 'all';
    expect(summarizeProgress(data).dates).toHaveLength(90);
    data.weight.history = [data.weight.history[1]!];
    expect(summarizeProgress(data).periodChange).toBeNull();
  });
  it('uses the shared strength formula, groups exercise days and never invents a high-rep 1RM', () => {
    const data = fixture();
    data.workouts.strength_sets = [
      { exercise_id: null, exercise_name: 'Press', date: '2026-11-16', weight_kg: 60, reps: 5 },
      { exercise_id: null, exercise_name: 'Press', date: '2026-11-16', weight_kg: 50, reps: 8 },
      { exercise_id: null, exercise_name: 'Squat', date: '2026-11-16', weight_kg: 80, reps: 20 },
    ];
    const enriched = enrichProgress(data);
    expect(enriched.workouts.total_volume_kg).toBe(2300);
    expect(enriched.workouts.exercise_progression).toHaveLength(2);
    expect(enriched.workouts.exercise_progression[0]!.data).toHaveLength(1);
    expect(summarizeProgress(enriched).strength).toEqual({ name: 'Press', value: 70 });
    expect(data.workouts.exercise_progression).toEqual([]);
    expect(enrichProgress(fixture()).workouts.exercise_progression).toEqual([]);
  });
});
