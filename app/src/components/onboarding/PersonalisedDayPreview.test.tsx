import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
import type { GoalProfile, WeeklyPlanView } from '@calipartner/core';
vi.mock('react-native', () => ({
  View: 'View',
  StyleSheet: { create: (value: unknown) => value },
}));
vi.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
vi.mock('@calipartner/ui', async () => ({
  ...(await import('../../../../packages/ui/src/tokens')),
  Text: 'Text',
  Button: 'Button',
  Avatar: 'Avatar',
}));
vi.mock('@/components/coach/CoachMessageBubble', () => ({ CoachMessageBubble: 'Bubble' }));
vi.mock('@/components/diary/NutrientSummary', () => ({ NutrientSummary: 'Nutrients' }));
vi.mock('@/components/rooms/SquadViews', () => ({ ProgressTrack: 'Track', squadStyles: {} }));
import { CoachMessageBubble } from '@/components/coach/CoachMessageBubble';
import { PersonalisedDayPreview } from './PersonalisedDayPreview';
let tree: ReactTestRenderer;
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});
const plan = {
  preferences: { cuisine: 'Indian', session_minutes: 30 },
  days: [
    {
      day: 0,
      workout: {
        title: 'Full body',
        minutes: 30,
        exercises: [{ name: 'Squat', equipment: 'bodyweight', sets: 3, reps: 8, rest_seconds: 60 }],
      },
      meals: ['breakfast', 'lunch', 'dinner', 'snacks'].map((section) => ({
        section,
        name: section + ' dish',
        ingredients: ['private ingredient 100 g'],
        portion: '100 g',
        calories: 500,
        protein: 30,
        carbs: 60,
        fat: 15,
      })),
    },
  ],
} as WeeklyPlanView;
const targets = {
  daily_calorie_target: 2200,
  protein_grams: 150,
  carb_grams: 260,
  fat_grams: 60,
  step_goal: 7000,
  water_ml_goal: 2600,
} as GoalProfile;
it('shows four sectioned meals without ingredients, five personalised messages per goal, and local preview copy feedback', async () => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  await act(async () => {
    tree = create(
      <PersonalisedDayPreview
        plan={plan}
        name="Alex"
        goal="cut"
        targets={targets}
        stage={0}
        onNext={vi.fn()}
      />,
    );
  });
  for (const section of ['breakfast', 'lunch', 'dinner', 'snacks'])
    expect(tree.root.findByProps({ testID: `preview-meal-${section}` })).toBeDefined();
  expect(JSON.stringify(tree.toJSON())).not.toContain('private ingredient');
  for (const goal of ['cut', 'bulk', 'maintain'] as const) {
    await act(async () =>
      tree.update(
        <PersonalisedDayPreview
          plan={plan}
          name="Alex"
          goal={goal}
          targets={targets}
          stage={1}
          onNext={vi.fn()}
        />,
      ),
    );
    const messages = tree.root
      .findAllByType(CoachMessageBubble)
      .map((bubble) => bubble.props.message);
    expect(messages.filter((message) => message.role === 'assistant')).toHaveLength(3);
    expect(messages.filter((message) => message.role === 'user')).toHaveLength(2);
    expect(messages[0].content).toContain('Alex');
    expect(messages[0].content).toContain('2200');
    expect(messages[1].content).toContain('Squat');
    expect(messages[1].content).toContain('bodyweight');
  }
  await act(async () =>
    tree.update(
      <PersonalisedDayPreview
        plan={plan}
        name="Alex"
        goal="cut"
        targets={targets}
        stage={2}
        onNext={vi.fn()}
      />,
    ),
  );
  await act(async () => tree.root.findByProps({ testID: 'demo-copy-workout' }).props.onPress());
  expect(tree.root.findByProps({ testID: 'demo-copy-workout' }).props.disabled).toBe(true);
});
