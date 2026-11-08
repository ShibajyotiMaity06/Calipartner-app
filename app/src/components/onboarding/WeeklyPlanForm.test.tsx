import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ back: undefined as (() => boolean) | undefined }));
vi.mock('react-native', () => ({
  View: 'View',
  Pressable: 'Pressable',
  TextInput: 'TextInput',
  Modal: 'Modal',
  ScrollView: 'ScrollView',
  Platform: { OS: 'android' },
  BackHandler: {
    addEventListener: (_name: string, fn: () => boolean) => {
      state.back = fn;
      return { remove: vi.fn() };
    },
  },
  StyleSheet: { create: (s: unknown) => s, hairlineWidth: 1 },
}));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
vi.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void | (() => void)) => React.useEffect(callback, [callback]),
}));
vi.mock('@/hooks/useBrowserModalBack', () => ({ useBrowserModalBack: vi.fn() }));
vi.mock('@/components/rooms/SquadViews', () => ({ squadStyles: {} }));
vi.mock('@calipartner/ui', async () => ({
  ...(await import('../../../../packages/ui/src/tokens')),
  Text: 'Text',
  Button: 'Button',
}));
import { WeeklyPlanForm } from './WeeklyPlanForm';
let tree: ReactTestRenderer;
beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});
it('phone Back returns from food inputs to workout inputs and preserves both sets of answers', async () => {
  await act(async () => {
    tree = create(<WeeklyPlanForm onBuild={vi.fn()} onLater={vi.fn()} />);
  });
  await act(async () => tree.root.findByProps({ testID: 'weekly-plan-next' }).props.onPress());
  await act(async () =>
    tree.root.findByProps({ testID: 'plan-country' }).props.onChangeText('India'),
  );
  await act(async () => expect(state.back?.()).toBe(true));
  expect(tree.root.findByProps({ testID: 'plan-location' })).toBeDefined();
  await act(async () => tree.root.findByProps({ testID: 'weekly-plan-next' }).props.onPress());
  expect(tree.root.findByProps({ testID: 'plan-country' }).props.value).toBe('India');
});
it('requires explicit consent and supplies the actual training, equipment and food preferences', async () => {
  const build = vi.fn();
  await act(async () => {
    tree = create(<WeeklyPlanForm onBuild={build} onLater={vi.fn()} />);
  });
  await act(async () =>
    tree.root.findAllByProps({ testID: 'plan-equipment' }).at(-1)!.props.onPress(),
  );
  await act(async () =>
    tree.root.findByProps({ testID: 'plan-equipment-dumbbell' }).props.onPress(),
  );
  await act(async () => tree.root.findByProps({ testID: 'plan-equipment-done' }).props.onPress());
  await act(async () => tree.root.findByProps({ testID: 'weekly-plan-next' }).props.onPress());
  expect(tree.root.findByProps({ testID: 'build-weekly-plan' }).props.disabled).toBe(true);
  for (const [key, value] of [
    ['country', 'India'],
    ['cuisine', 'Indian'],
    ['allergies', 'milk, peanut'],
    ['exclusions', 'none'],
  ])
    await act(async () =>
      tree.root.findByProps({ testID: 'plan-' + key }).props.onChangeText(value),
    );
  await act(async () => tree.root.findByProps({ testID: 'weekly-plan-consent' }).props.onPress());
  await act(async () => tree.root.findByProps({ testID: 'build-weekly-plan' }).props.onPress());
  expect(build).toHaveBeenCalledOnce();
  expect(build.mock.calls[0]![0]).toMatchObject({
    country: 'India',
    workout_days: [0, 2, 4],
    equipment: ['bodyweight', 'dumbbell'],
    allergies: ['milk', 'peanut'],
    exclusions: [],
  });
});

it.each(['', 'none', 'None'])(
  'accepts %j allergies/exclusions as none after explicit consent',
  async (value) => {
    const build = vi.fn();
    await act(async () => {
      tree = create(<WeeklyPlanForm onBuild={build} onLater={vi.fn()} />);
    });
    await act(async () => tree.root.findByProps({ testID: 'weekly-plan-next' }).props.onPress());
    for (const [key, answer] of [
      ['country', 'India'],
      ['cuisine', 'Indian'],
      ['allergies', value],
      ['exclusions', value],
    ])
      await act(async () =>
        tree.root.findByProps({ testID: 'plan-' + key }).props.onChangeText(answer),
      );
    await act(async () => tree.root.findByProps({ testID: 'weekly-plan-consent' }).props.onPress());
    await act(async () => tree.root.findByProps({ testID: 'build-weekly-plan' }).props.onPress());
    expect(build).toHaveBeenCalledWith(expect.objectContaining({ allergies: [], exclusions: [] }));
  },
);
