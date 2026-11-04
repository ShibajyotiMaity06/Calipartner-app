import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ date: '', error: false, refresh: vi.fn(), opened: vi.fn() }));
vi.mock('react-native', () => ({
  View: 'View',
  Pressable: 'Pressable',
  StyleSheet: { create: (s: unknown) => s, hairlineWidth: 1 },
}));
vi.mock('@calipartner/ui', async () => ({
  ...(await import('../../../../packages/ui/src/tokens')),
  Text: 'Text',
  Button: 'Button',
}));
vi.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
vi.mock('expo-router', async () => {
  const react = await import('react');
  return { useFocusEffect: (fn: () => void) => react.useEffect(fn, [fn]) };
});
vi.mock('@/hooks/useCurrentLocalDate', () => ({
  useCurrentLocalDate: () => ({ localDate: '2026-11-03' }),
}));
vi.mock('@/hooks/useDiary', () => ({
  useDiary: (date: string) => {
    state.date = date;
    return {
      loading: false,
      error: state.error,
      refresh: state.refresh,
      daySummary: {
        totals: { calories: 450, protein: 30, carbs: 50, fat: 15 },
        sections: Object.fromEntries(
          ['breakfast', 'lunch', 'dinner', 'snacks', 'extra'].map((section) => [
            section,
            {
              entries:
                section === 'breakfast'
                  ? [
                      {
                        id: 'eggs',
                        food_name: 'Boiled eggs',
                        quantity: 2,
                        unit: 'eggs',
                        calories: 156,
                        protein: 13,
                        carbs: 1,
                        fat: 11,
                      },
                    ]
                  : [],
            },
          ]),
        ),
      },
    };
  },
}));
vi.mock('@/hooks/useSteps', () => ({
  useSteps: () => ({ steps: 8021, loading: false, error: null, refresh: state.refresh }),
}));
vi.mock('@/hooks/useWater', () => ({
  useWater: () => ({ totalMl: 1500, loading: false, error: false, refresh: state.refresh }),
}));
vi.mock('@/hooks/useWorkouts', () => ({
  useWorkouts: () => ({
    loading: false,
    error: null,
    refresh: state.refresh,
    workouts: [
      {
        id: 'strength',
        name: 'Strength session',
        duration_minutes: 45,
        exercises: [
          {
            id: 'squats',
            exercise_name: 'Squat',
            sets: [{ id: 'set', set_number: 1, reps: 8, weight_kg: 60 }],
          },
        ],
      },
    ],
    getSummary: () => ({ total_sets: 1, total_reps: 8 }),
  }),
}));
vi.mock('@/components/diary/FoodLogModal', () => ({ FoodLogModal: 'FoodLogModal' }));
vi.mock('@/components/diary/DatePickerSheet', () => ({ DatePickerSheet: 'DatePickerSheet' }));
vi.mock('@/components/LoadingState', () => ({ LoadingState: 'LoadingState' }));
import { PersonalDiaryView } from './PersonalDiaryView';
let tree: ReactTestRenderer;
beforeEach(() => {
  state.error = false;
  vi.clearAllMocks();
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});
it('shows actual meals, macros, steps, water and workout sets on the selected diary day', async () => {
  await act(async () => {
    tree = create(<PersonalDiaryView />);
  });
  const content = () => JSON.stringify(tree.toJSON());
  expect(content()).toContain('Boiled eggs');
  expect(content()).toContain('8021');
  expect(content()).toContain('1500 ml');
  expect(content()).toContain('Strength session');
  expect(content()).toContain('Squat');
  for (const meal of ['breakfast', 'lunch', 'dinner', 'snacks', 'extra'])
    expect(tree.root.findByProps({ testID: 'you-meal-' + meal })).toBeDefined();
  await act(async () => tree.root.findByProps({ testID: 'you-previous-day' }).props.onPress());
  expect(state.date).toBe('2026-11-02');
  await act(async () => tree.root.findByProps({ testID: 'you-add-lunch' }).props.onPress());
  expect(tree.root.findByType('FoodLogModal' as React.ElementType).props).toMatchObject({
    defaultSection: 'lunch',
    localDate: '2026-11-02',
  });
});
it('keeps failed diary reads actionable instead of showing empty meals', async () => {
  state.error = true;
  await act(async () => {
    tree = create(<PersonalDiaryView />);
  });
  expect(tree.root.findAllByProps({ testID: 'you-meal-breakfast' })).toHaveLength(0);
  await act(async () => tree.root.findByProps({ testID: 'you-diary-retry' }).props.onPress());
  expect(state.refresh).toHaveBeenCalled();
});
