import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { IndividualProgressData } from '@calipartner/core';

vi.mock('react-native', () => ({
  View: 'View',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: {
    create: <T,>(styles: T) => styles,
  },
}));

vi.mock('@calipartner/ui/v1', async () => {
  const theme = await import('../../../../packages/ui/src/v1/theme');
  return {
    ...theme,
    Badge: 'Badge',
    Card: ({ children, ...rest }: Record<string, unknown>) =>
      React.createElement('Card', rest, children as React.ReactNode),
    DumbbellIcon: 'DumbbellIcon',
    ProgressBar: 'ProgressBar',
    Ring: ({ children, ...rest }: Record<string, unknown>) =>
      React.createElement('Ring', rest, children as React.ReactNode),
    Text: ({ children, ...rest }: Record<string, unknown>) =>
      React.createElement('Text', rest, children as React.ReactNode),
  };
});

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'p-user' } }),
}));
vi.mock('@/hooks/useCurrentLocalDate', () => ({
  useCurrentLocalDate: () => ({ localDate: '2026-11-23' }),
}));
vi.mock('@/hooks/useTargets', () => ({
  useTargets: () => ({
    currentGoalProfile: {
      daily_calorie_target: 1900,
      step_goal: 10000,
      water_ml_goal: 2500,
    },
  }),
}));
vi.mock('@/hooks/useTrackingPreferences', () => ({
  useTrackingPreferences: () => ({
    enabled: { calories: true, protein: true, carbs: true, fat: true, steps: true, water: true },
  }),
}));
vi.mock('@/db', () => ({
  getDb: async () => ({
    getAllAsync: vi.fn().mockResolvedValue([]),
  }),
}));
vi.mock('@/services/accountDataService', () => ({
  loadAccountTable: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/services/fastingService', () => ({
  getFastingHistory: vi.fn().mockResolvedValue([
    { local_date: '2026-11-17', status: 'completed' },
    { local_date: '2026-11-18', status: 'completed' },
  ]),
}));
vi.mock('@/services/workoutService', () => ({
  getWorkoutsCalendarData: vi.fn().mockResolvedValue({ '2026-11-23': 1, '2026-11-19': 1 }),
  getWorkoutsHistory: vi.fn().mockResolvedValue([
    {
      id: 'w1',
      user_id: 'p-user',
      name: 'Push day',
      local_date: '2026-11-23',
      duration_minutes: 45,
    },
  ]),
  getWorkoutById: vi.fn().mockResolvedValue({
    id: 'w1',
    user_id: 'p-user',
    name: 'Push day',
    local_date: '2026-11-23',
    duration_minutes: 45,
    exercises: [
      {
        id: 'ex1',
        exercise_name: 'Bench Press',
        sets: [{ weight_kg: 80, reps: 5, completed: true, is_warmup: false }],
      },
    ],
  }),
}));
vi.mock('@/services/workoutEvents', () => ({
  workoutEvents: { subscribe: () => () => {} },
}));

import {
  ProgressHabitsTabV1,
  ProgressNutritionTabV1,
  ProgressWeightTabV1,
  ProgressWorkoutsTabV1,
} from './ProgressV1Components';

const sampleData: IndividualProgressData = {
  range: '7d',
  start_date: '2026-11-17',
  end_date: '2026-11-23',
  weight: {
    history: [
      { date: '2026-11-17', raw_weight_kg: 74.5, trend_weight_kg: 74.5 },
      { date: '2026-11-23', raw_weight_kg: 73.5, trend_weight_kg: 73.5 },
    ],
    start_weight_kg: 74.5,
    current_weight_kg: 73.5,
    current_trend_kg: 73.5,
    total_change_kg: -1.0,
    total_change_pct: -1.3,
    target_weight_kg: 68.0,
    weekly_pace_kg: -0.3,
    projected_date: '2027-03-20',
    goal_progress_pct: 15.4,
  },
  calories: {
    daily: [
      {
        date: '2026-11-17',
        calories: 1920,
        target_calories: 1900,
        is_logged_day: true,
        is_goal_day: true,
      },
      {
        date: '2026-11-18',
        calories: 1980,
        target_calories: 1900,
        is_logged_day: true,
        is_goal_day: true,
      },
      {
        date: '2026-11-19',
        calories: 2300,
        target_calories: 1900,
        is_logged_day: true,
        is_goal_day: false,
      },
    ],
    average_calories: 1951,
    average_target: 1900,
    logged_days_count: 3,
    goal_days_count: 2,
    total_days_in_range: 7,
    adherence_pct: 66.7,
  },
  macros: {
    protein_avg_g: 129,
    carbs_avg_g: 218,
    fat_avg_g: 54,
    protein_target_g: 140,
    carbs_target_g: 210,
    fat_target_g: 55,
  },
  steps: {
    daily: [{ date: '2026-11-17', steps: 10200, distance_km: 7.5 }],
    average_steps: 9486,
    total_steps: 9486,
    total_distance_km: 7.5,
    goal_steps: 10000,
  },
  water: {
    daily: [{ date: '2026-11-17', water_ml: 2500 }],
    average_water_ml: 2500,
    total_water_ml: 2500,
    goal_water_ml: 2500,
  },
  workouts: {
    total_workouts: 12,
    sessions_per_week: 3.8,
    total_duration_minutes: 540,
    total_volume_kg: 15000,
    daily_sessions: [{ date: '2026-11-23', sessions: 1 }],
    exercise_progression: [
      {
        exercise_id: null,
        exercise_name: 'Bench Press',
        data: [{ local_date: '2026-11-23', heaviest_weight_kg: 80, best_1rm_kg: 93 }],
      },
    ],
  },
  consistency: {
    current_streak: 4,
    longest_streak: 7,
    weekly_scores: [],
  },
  fasting: {
    total_fasts: 7,
    completed_fasts: 6,
    ended_early_fasts: 1,
    completion_rate_pct: 85.7,
    average_duration_minutes: 960,
    average_duration_hours: 16,
    total_fasting_hours: 96,
    fasting_hours_per_week: 96,
    daily_hours: [{ date: '2026-11-17', fasting_hours: 16, completed: true }],
  },
  goal_progress_pct: 15.4,
};

let tree: ReactTestRenderer;

beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});

it('renders Screen 79 Weight tab with real metrics and Log weight action', async () => {
  const onLogWeight = vi.fn();
  await act(async () => {
    tree = create(
      <ProgressWeightTabV1
        data={sampleData}
        weight={{
          logs: [
            {
              id: 'w2',
              user_id: 'p-user',
              weight_kg: 73.5,
              local_date: '2026-11-23',
              logged_at: '2026-11-23T08:00:00Z',
              notes: null,
              created_at: '2026-11-23T08:00:00Z',
              updated_at: '2026-11-23T08:00:00Z',
              deleted_at: null,
            },
            {
              id: 'w1',
              user_id: 'p-user',
              weight_kg: 74.5,
              local_date: '2026-11-17',
              logged_at: '2026-11-17T08:00:00Z',
              notes: null,
              created_at: '2026-11-17T08:00:00Z',
              updated_at: '2026-11-17T08:00:00Z',
              deleted_at: null,
            },
          ],
          startingWeightKg: 74.5,
          latestLog: null,
          latestTrendKg: 73.5,
          weeklyPaceKg: -0.3,
          projectedDate: '2027-03-20',
        }}
        targetWeightKg={68.0}
        useLb={false}
        onLogWeight={onLogWeight}
        onOpenHistory={vi.fn()}
      />,
    );
  });

  expect(tree.root.findByProps({ testID: 'progress-current-weight' }).props.children).toBe('73.5');
  expect(tree.root.findByProps({ testID: 'progress-goal-weight' }).props.children).toBe('68.0 kg');

  await act(async () => {
    tree.root.findByProps({ testID: 'btn-progress-log-weight' }).props.onPress();
  });
  expect(onLogWeight).toHaveBeenCalledTimes(1);
});

it('renders Screen 80 Nutrition tab with daily average and 10% adherence ratio', async () => {
  await act(async () => {
    tree = create(<ProgressNutritionTabV1 data={sampleData} onSelectDay={vi.fn()} />);
  });

  expect(tree.root.findByProps({ testID: 'nutrition-on-target-ratio' }).props.children).toBe(
    '2 of 3',
  );
  expect(tree.root.findByProps({ testID: 'calories-chart' })).toBeDefined();
  expect(tree.root.findByProps({ testID: 'macros-chart' })).toBeDefined();
});

it('renders Screen 81 Workouts tab with heatmap and recent session with PR badge', async () => {
  await act(async () => {
    tree = create(<ProgressWorkoutsTabV1 data={sampleData} onOpenCalendar={vi.fn()} />);
  });

  expect(tree.root.findByProps({ testID: 'workouts-heatmap-today' })).toBeDefined();
  expect(tree.root.findByProps({ testID: 'recent-session-w1' })).toBeDefined();
});

it('renders Screen 83 Habits tab with Perfect days ring and habit strips', async () => {
  await act(async () => {
    tree = create(<ProgressHabitsTabV1 data={sampleData} onSelectDay={vi.fn()} />);
  });

  expect(tree.root.findByProps({ testID: 'habits-perfect-days' })).toBeDefined();
  expect(tree.root.findByProps({ testID: 'steps-chart' })).toBeDefined();
  expect(tree.root.findByProps({ testID: 'water-chart' })).toBeDefined();
  expect(tree.root.findByProps({ testID: 'fasting-chart' })).toBeDefined();
});
