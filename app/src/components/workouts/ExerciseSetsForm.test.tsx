import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
import { lbToKg } from '@calipartner/core';
vi.mock('react-native', () => ({ View: 'View', Pressable: 'Pressable' }));
vi.mock('@calipartner/ui', async () => ({
  ...(await import('../../../../packages/ui/src/tokens')),
  Text: 'Text',
  Button: 'Button',
}));
vi.mock('@/components/onboarding/PlanPrimitives', () => ({
  NumberField: ({
    leading,
    trailing,
    ...props
  }: {
    leading?: React.ReactNode;
    trailing?: React.ReactNode;
    testID: string;
  }) => React.createElement('NumberField', props, leading, trailing),
}));
import { ExerciseSetsForm } from './ExerciseSetsForm';
let tree: ReactTestRenderer;
it('shows reps only when editing a plan and preserves any existing weight data', async () => {
  const add = vi.fn();
  await act(async () => {
    tree = create(
      <ExerciseSetsForm
        name="Curl"
        planOnly
        initialSets={[{ reps: 10, weightKg: 7.5 }]}
        onAdd={add}
        onCancel={vi.fn()}
      />,
    );
  });
  expect(tree.root.findAllByProps({ testID: 'exercise-set-weight-0' })).toHaveLength(0);
  await act(async () =>
    tree.root.findByProps({ testID: 'exercise-set-reps-0' }).props.onChange(12),
  );
  await act(async () => tree.root.findByProps({ testID: 'exercise-confirm-sets' }).props.onPress());
  expect(add).toHaveBeenCalledWith([{ reps: 12, weightKg: 7.5 }]);
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});
it('asks for set count, preserves different reps per set and always shows paired weight inputs and permits blank weights', async () => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const add = vi.fn();
  await act(async () => {
    tree = create(<ExerciseSetsForm name="Squat" onAdd={add} onCancel={vi.fn()} />);
  });
  expect(tree.root.findByProps({ testID: 'exercise-set-count' }).props.value).toBe(3);
  expect(tree.root.findAllByProps({ testID: 'exercise-set-reps-0' }).length).toBeGreaterThan(0);
  await act(async () => tree.root.findByProps({ testID: 'exercise-set-count' }).props.onChange(3));
  for (const [index, reps] of [10, 8, 6].entries())
    await act(async () =>
      tree.root.findByProps({ testID: `exercise-set-reps-${index}` }).props.onChange(reps),
    );
  expect(tree.root.findAllByProps({ testID: 'exercise-add-weights' })).toHaveLength(0);
  const field = (index: number) =>
    tree.root.findAllByProps({ testID: 'exercise-set-weight-' + index }).at(-1)!;
  expect(field(0).props.value).toBeNull();
  expect(field(0).props.optional).toBe(true);
  await act(async () =>
    tree.root.findByProps({ testID: 'exercise-set-weight-1-unit' }).props.onPress(),
  );
  expect(field(1).props.label).toBe('Weight (lb)');
  await act(async () => field(1).props.onChange(45));
  await act(async () => tree.root.findByProps({ testID: 'exercise-confirm-sets' }).props.onPress());
  expect(add).toHaveBeenCalledWith([
    { reps: 10, weightKg: 0 },
    { reps: 8, weightKg: lbToKg(45) },
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
    if (count === 3)
      await act(async () =>
        tree.root.findByProps({ testID: 'exercise-set-reps-0' }).props.onChange(0),
      );
    await act(async () =>
      tree.root.findByProps({ testID: 'exercise-confirm-sets' }).props.onPress(),
    );
    expect(add).not.toHaveBeenCalled();
    expect(tree.root.findByProps({ accessibilityRole: 'alert' })).toBeDefined();
  }
});

it('changes individual reps with minus/plus and keeps the draft open until a save is acknowledged', async () => {
  let acknowledge!: () => void;
  const add = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        acknowledge = resolve;
      }),
  );
  await act(async () => {
    tree = create(
      <ExerciseSetsForm
        name="Curl"
        initialSets={[
          { reps: 10, weightKg: 5 },
          { reps: 8, weightKg: 7.5 },
        ]}
        onAdd={add}
        onCancel={vi.fn()}
      />,
    );
  });
  await act(async () => tree.root.findByProps({ testID: 'exercise-set-plus-0' }).props.onPress());
  await act(async () => tree.root.findByProps({ testID: 'exercise-set-minus-1' }).props.onPress());
  await act(async () => {
    void tree.root.findByProps({ testID: 'exercise-confirm-sets' }).props.onPress();
  });
  expect(add).toHaveBeenCalledExactlyOnceWith([
    { reps: 11, weightKg: 5 },
    { reps: 7, weightKg: 7.5 },
  ]);
  expect(tree.root.findByProps({ testID: 'exercise-confirm-sets' }).props.disabled).toBe(true);
  await act(async () => acknowledge());
  expect(tree.root.findByProps({ testID: 'exercise-confirm-sets' }).props.disabled).toBe(false);
});

it('increments and decrements set count using stepper buttons', async () => {
  const add = vi.fn();
  await act(async () => {
    tree = create(<ExerciseSetsForm name="Squat" onAdd={add} onCancel={vi.fn()} />);
  });
  expect(tree.root.findByProps({ testID: 'exercise-set-count' }).props.value).toBe(3);
  expect(tree.root.findAllByProps({ testID: 'exercise-set-row-2' })).toHaveLength(1);
  expect(tree.root.findAllByProps({ testID: 'exercise-set-row-3' })).toHaveLength(0);

  await act(async () =>
    tree.root.findByProps({ testID: 'exercise-set-count-plus' }).props.onPress(),
  );
  expect(tree.root.findByProps({ testID: 'exercise-set-count' }).props.value).toBe(4);
  expect(tree.root.findAllByProps({ testID: 'exercise-set-row-3' })).toHaveLength(1);

  await act(async () =>
    tree.root.findByProps({ testID: 'exercise-set-count-minus' }).props.onPress(),
  );
  expect(tree.root.findByProps({ testID: 'exercise-set-count' }).props.value).toBe(3);
  await act(async () =>
    tree.root.findByProps({ testID: 'exercise-set-count-minus' }).props.onPress(),
  );
  expect(tree.root.findByProps({ testID: 'exercise-set-count' }).props.value).toBe(2);
  expect(tree.root.findAllByProps({ testID: 'exercise-set-row-2' })).toHaveLength(0);
  expect(tree.root.findAllByProps({ testID: 'exercise-set-row-1' })).toHaveLength(1);
});
