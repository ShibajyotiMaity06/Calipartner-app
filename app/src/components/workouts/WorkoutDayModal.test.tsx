import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  plan: null as unknown,
  loading: false,
  error: false,
  save: vi.fn(),
  edit: vi.fn(),
  rebuild: vi.fn(),
  refresh: vi.fn(),
  push: vi.fn(),
  saved: vi.fn(),
  date: '2026-11-11',
}));
vi.mock('react-native', () => ({
  Modal: 'Modal',
  SafeAreaView: 'SafeAreaView',
  ScrollView: 'ScrollView',
  Pressable: 'Pressable',
  View: 'View',
  StyleSheet: { create: (value: unknown) => value },
}));
vi.mock('@calipartner/ui', async () => ({
  ...(await import('../../../../packages/ui/src/tokens')),
  Text: 'Text',
  Button: 'Button',
}));
vi.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
vi.mock('expo-router', () => ({ useRouter: () => ({ push: state.push }) }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'owner' } }) }));
vi.mock('@/hooks/useCurrentLocalDate', () => ({
  useCurrentLocalDate: () => ({ localDate: state.date }),
}));
vi.mock('@/hooks/useBrowserModalBack', () => ({ useBrowserModalBack: vi.fn() }));
vi.mock('@/hooks/useWorkoutPlan', () => ({
  useWorkoutPlan: () => ({
    plan: state.plan,
    loading: state.loading,
    error: state.error,
    refresh: state.refresh,
    edit: state.edit,
    rebuild: state.rebuild,
  }),
}));
vi.mock('@/hooks/useWorkouts', () => ({
  useWorkouts: (date: string) => ({
    workouts:
      date === '2026-11-10'
        ? [{ id: 'previous', name: 'Actual previous workout', exercises: [] }]
        : [],
    loading: false,
    error: null,
    refresh: state.refresh,
  }),
}));
vi.mock('@/services/workoutSessionService', () => ({
  newWorkoutSessionRequest: () => ({}),
  saveNewWorkoutSession: state.save,
}));
vi.mock('@/components/onboarding/WeeklyPlanForm', () => ({ WeeklyPlanForm: 'WeeklyPlanForm' }));
vi.mock('@/components/onboarding/WeeklyPlanPreparing', () => ({
  WeeklyPlanPreparing: 'WeeklyPlanPreparing',
}));
vi.mock('./ExercisePickerModal', () => ({ ExercisePickerModal: 'ExercisePickerModal' }));
vi.mock('./ExerciseSetsForm', () => ({ ExerciseSetsForm: 'ExerciseSetsForm' }));
import { WorkoutDayModal } from './WorkoutDayModal';
let tree: ReactTestRenderer;
const days = Array.from({ length: 7 }, (_, day) => ({
  day,
  title: 'Arms day',
  minutes: 30,
  exercises:
    day === 2
      ? [
          {
            id: 'curl',
            name: 'Seated dumbbell curls',
            equipment: 'dumbbell',
            targetSets: [
              { reps: 10, weightKg: 5 },
              { reps: 8, weightKg: 7.5 },
            ],
          },
        ]
      : [],
}));
beforeEach(() => {
  vi.clearAllMocks();
  state.loading = false;
  state.error = false;
  state.plan = { full_access: false, days: [], can_rebuild: false };
  state.save.mockResolvedValue({ id: 'acknowledged' });
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});
const render = async () => {
  await act(async () => {
    tree = create(<WorkoutDayModal visible onClose={vi.fn()} onSaved={state.saved} />);
  });
};
it('Free shows the Wednesday sample, opens the paywall, and past days show actual history without samples or logging', async () => {
  await render();
  expect(JSON.stringify(tree.toJSON())).toContain('Seated dumbbell curls');
  await act(async () => tree.root.findByProps({ testID: 'workout-plan-upgrade' }).props.onPress());
  expect(state.push).toHaveBeenCalledWith('/paywall');
  await act(async () => tree.root.findByProps({ testID: 'workout-day-previous' }).props.onPress());
  expect(JSON.stringify(tree.toJSON())).toContain('Actual previous workout');
  expect(tree.root.findAllByProps({ testID: 'workout-free-sample' })).toHaveLength(0);
  expect(tree.root.findAllByProps({ testID: 'workout-hub-modal-btn-add-exercise' })).toHaveLength(
    0,
  );
  expect(state.save).not.toHaveBeenCalled();
});
it('custom Save waits for acknowledgement, saves all entered sets and only then reports success', async () => {
  let resolve!: (value: unknown) => void;
  state.save.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  await render();
  const picker = tree.root.findByType('ExercisePickerModal' as React.ElementType);
  let result!: Promise<void>;
  await act(async () => {
    result = picker.props.onSelectExercise({ id: 'exercise', name: 'Curl' }, [
      { reps: 12, weightKg: 5 },
      { reps: 8, weightKg: 7.5 },
    ]);
  });
  expect(state.saved).not.toHaveBeenCalled();
  expect(state.save.mock.calls[0]![1].exercises[0].sets).toEqual([
    { reps: 12, weightKg: 5, isWarmup: false, completed: true },
    { reps: 8, weightKg: 7.5, isWarmup: false, completed: true },
  ]);
  await act(async () => {
    resolve({ id: 'saved' });
    await result;
  });
  expect(state.saved).toHaveBeenCalledWith({ id: 'saved' });
});
it('paid plans edit targets without logging and respect the server rebuild flag', async () => {
  state.plan = {
    id: 'plan',
    revision: 1,
    full_access: true,
    can_rebuild: false,
    tier: 'plus',
    rebuilds_used: 1,
    days,
  };
  await render();
  expect(tree.root.findByProps({ testID: 'workout-build-new-plan' }).props.disabled).toBe(true);
  await act(async () =>
    tree.root.findByProps({ testID: 'workout-plan-edit-curl' }).props.onPress(),
  );
  await act(async () =>
    tree.root
      .findByType('ExerciseSetsForm' as React.ElementType)
      .props.onAdd([{ reps: 15, weightKg: 10 }]),
  );
  expect(state.edit.mock.calls[0]![0].days[2].exercises[0].targetSets).toEqual([
    { reps: 15, weightKg: 10 },
  ]);
  expect(state.save).not.toHaveBeenCalled();
  await act(async () =>
    tree.root.findByProps({ testID: 'workout-plan-remove-curl' }).props.onPress(),
  );
  expect(state.edit.mock.lastCall![0].days[2].exercises).toEqual([]);
});
it('paid rest days show rest copy while custom logging stays available', async () => {
  state.plan = {
    full_access: true,
    can_rebuild: true,
    tier: 'pro',
    days: days.map((day) => ({ ...day, exercises: [] })),
  };
  await render();
  expect(tree.root.findByProps({ testID: 'workout-rest-day' })).toBeDefined();
  expect(tree.root.findByProps({ testID: 'workout-hub-modal-btn-add-exercise' })).toBeDefined();
  expect(tree.root.findAllByProps({ testID: 'workout-save-routine' })).toHaveLength(0);
});
