import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
import type { WorkoutWithDetails } from '@calipartner/core';
const state = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock('react-native', () => ({
  Modal: 'Modal',
  View: 'View',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
}));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
vi.mock('@calipartner/ui', async () => {
  const tokens = await import('../../../../packages/ui/src/tokens');
  return { ...tokens, Text: 'Text', Button: 'Button', useTheme: () => ({ colors: tokens.light }) };
});
vi.mock('@/hooks/useBrowserModalBack', () => ({ useBrowserModalBack: vi.fn() }));
vi.mock('@/components/onboarding/PlanPrimitives', () => ({ NumberField: 'NumberField' }));
vi.mock('@/services/workoutSessionService', () => ({ newWorkoutSessionRequest: () => ({}) }));
vi.mock('@/services/loggedWorkoutEditService', () => ({ saveLoggedWorkoutSets: state.save }));
import { LoggedWorkoutCard } from './LoggedWorkoutCard';
import { LoggedWorkoutEditModal } from './LoggedWorkoutEditModal';
import { LoggedWorkoutDeleteModal } from './LoggedWorkoutDeleteModal';
let tree: ReactTestRenderer;
const workout = {
  id: 'saved',
  name: 'Squat',
  type: 'strength',
  exercises: [
    {
      id: 'exercise',
      exercise_name: 'Squat',
      sets: [{ id: 'set', set_number: 1, reps: 10, weight_kg: 0, completed: true }],
    },
  ],
} as WorkoutWithDetails;
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
  vi.clearAllMocks();
});
it('shows a workout name once, omits absent weight, and exposes labelled edit/delete controls', async () => {
  const edit = vi.fn(),
    remove = vi.fn();
  await act(async () => {
    tree = create(<LoggedWorkoutCard workout={workout} onEdit={edit} onDelete={remove} />);
  });
  const texts = tree.root
    .findAll((node) => String(node.type) === 'Text')
    .map((node) => node.props.children);
  expect(texts.filter((value) => value === 'Squat')).toHaveLength(1);
  expect(texts.join(' ')).toContain('10 reps');
  expect(texts.join(' ')).not.toContain('0 kg');
  for (const action of ['edit', 'delete']) {
    const button = tree.root.findByProps({ testID: `logged-workout-${action}-saved` });
    expect(button.props.accessibilityLabel).toContain('Squat');
    await act(async () => button.props.onPress());
  }
  expect(edit).toHaveBeenCalledOnce();
  expect(remove).toHaveBeenCalledOnce();
});
it('keeps edits open after failure and closes only after an acknowledged retry', async () => {
  const close = vi.fn(),
    refresh = vi.fn();
  let acknowledge!: () => void;
  state.save.mockRejectedValueOnce(new Error('offline')).mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        acknowledge = resolve;
      }),
  );
  await act(async () => {
    tree = create(<LoggedWorkoutEditModal workout={workout} onClose={close} onSaved={refresh} />);
  });
  expect(tree.root.findByProps({ testID: 'logged-edit-0-weight-0' }).props.value).toBeNull();
  await act(async () =>
    tree.root.findByProps({ testID: 'logged-edit-0-reps-0' }).props.onChange(12),
  );
  await act(async () => tree.root.findByProps({ testID: 'logged-edit-save' }).props.onPress());
  expect(close).not.toHaveBeenCalled();
  expect(tree.root.findByProps({ accessibilityRole: 'alert' })).toBeDefined();
  await act(async () => {
    void tree.root.findByProps({ testID: 'logged-edit-save' }).props.onPress();
  });
  expect(close).not.toHaveBeenCalled();
  expect(tree.root.findByProps({ testID: 'logged-edit-save' }).props.disabled).toBe(true);
  await act(async () => acknowledge());
  expect(close).toHaveBeenCalledOnce();
  expect(refresh).toHaveBeenCalledOnce();
  expect(state.save.mock.lastCall![2]).toEqual([[{ reps: 12, weightKg: 0 }]]);
});
it('requires confirmation for deletion and retains a failed delete for retry', async () => {
  const close = vi.fn(),
    remove = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
  await act(async () => {
    tree = create(<LoggedWorkoutDeleteModal name="Squat" onClose={close} onDelete={remove} />);
  });
  expect(remove).not.toHaveBeenCalled();
  await act(async () => tree.root.findByProps({ testID: 'logged-delete-confirm' }).props.onPress());
  expect(close).not.toHaveBeenCalled();
  await act(async () => tree.root.findByProps({ testID: 'logged-delete-confirm' }).props.onPress());
  expect(close).toHaveBeenCalledOnce();
});
