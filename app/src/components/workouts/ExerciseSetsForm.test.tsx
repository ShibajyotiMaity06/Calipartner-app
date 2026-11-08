import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('react-native', () => ({ View: 'View', Pressable: 'Pressable' }));
vi.mock('@calipartner/ui', async () => ({
  ...(await import('../../../../packages/ui/src/tokens')),
  Text: 'Text',
  Button: 'Button',
}));
vi.mock('@/components/onboarding/PlanPrimitives', () => ({ NumberField: 'NumberField' }));
import { ExerciseSetsForm } from './ExerciseSetsForm';
let tree: ReactTestRenderer;
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});
it('asks for set count, preserves different reps per set and leaves optional weights at zero', async () => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const add = vi.fn();
  await act(async () => {
    tree = create(<ExerciseSetsForm name="Squat" onAdd={add} onCancel={vi.fn()} />);
  });
  expect(tree.root.findAllByProps({ testID: 'exercise-set-reps-0' })).toHaveLength(0);
  await act(async () => tree.root.findByProps({ testID: 'exercise-set-count' }).props.onChange(3));
  for (const [index, reps] of [10, 8, 6].entries())
    await act(async () =>
      tree.root.findByProps({ testID: `exercise-set-reps-${index}` }).props.onChange(reps),
    );
  await act(async () => tree.root.findByProps({ testID: 'exercise-add-weights' }).props.onPress());
  await act(async () =>
    tree.root.findByProps({ testID: 'exercise-set-weight-1' }).props.onChange(20),
  );
  await act(async () => tree.root.findByProps({ testID: 'exercise-confirm-sets' }).props.onPress());
  expect(add).toHaveBeenCalledWith([
    { reps: 10, weightKg: 0 },
    { reps: 8, weightKg: 20 },
    { reps: 6, weightKg: 0 },
  ]);
});
it('keeps incomplete, fractional and oversized set drafts editable without adding an exercise', async () => {
  const add = vi.fn();
  await act(async () => {
    tree = create(<ExerciseSetsForm name="Squat" onAdd={add} onCancel={vi.fn()} />);
  });
  for (const count of [null, 0, 1.5, 21, 3]) {
    await act(async () =>
      tree.root.findByProps({ testID: 'exercise-set-count' }).props.onChange(count),
    );
    await act(async () =>
      tree.root.findByProps({ testID: 'exercise-confirm-sets' }).props.onPress(),
    );
    expect(add).not.toHaveBeenCalled();
    expect(tree.root.findByProps({ accessibilityRole: 'alert' })).toBeDefined();
  }
});
