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
  saveCustom: vi.fn(),
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
  Sheet: 'Sheet',
  Chip: 'Chip',
  NavigationIcon: 'NavigationIcon',
  Button: (await import('@/test/ButtonStub')).ButtonStub,
  useTheme: () => ({ colors: {} }),
}));
vi.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
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
    saveCustom: state.saveCustom,
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
vi.mock('@/components/onboarding/WeeklyPlanForm', () => ({
  WeeklyPlanForm: 'WeeklyPlanForm',
  PlanField: 'PlanField',
}));
vi.mock('@/services/foodService', () => ({ generateClientUuid: () => 'manual-exercise' }));
vi.mock('@/components/onboarding/WeeklyPlanPreparing', () => ({
  WeeklyPlanPreparing: 'WeeklyPlanPreparing',
}));
vi.mock('./WorkoutLoggerModal', () => ({ WorkoutLoggerModal: 'WorkoutLoggerModal' }));
vi.mock('./LoggedWorkoutEditModal', () => ({ LoggedWorkoutEditModal: 'LoggedWorkoutEditModal' }));
vi.mock('./LoggedWorkoutDeleteModal', () => ({
  LoggedWorkoutDeleteModal: 'LoggedWorkoutDeleteModal',
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
it('shows planned reps without zero or stored weights', async () => {
  state.plan = { full_access: true, days, can_rebuild: true, tier: 'pro' };
  await render();
  const text = JSON.stringify(
    tree.root
      .findByProps({ testID: 'workout-paid-routine' })
      .findAllByType('Text' as React.ElementType)
      .map((node) => node.children),
  );
  expect(text).toContain('10 reps');
  expect(text).not.toContain('kg');
});
it('Free shows the Wednesday sample, opens the paywall, and past days show actual history without samples or logging', async () => {
  await render();
  expect(JSON.stringify(tree.toJSON())).toContain('Seated dumbbell curls');
  await act(async () => tree.root.findByProps({ testID: 'workout-plan-upgrade' }).props.onPress());
  expect(state.push).toHaveBeenCalledWith('/paywall');
  const openCalendar = () =>
    tree.root.findByProps({ testID: 'workout-day-calendar' }).props.onPress();
  const choosePreviousDay = () =>
    tree.root.findByProps({ testID: 'day-cell-2026-11-10' }).props.onPress();
  await act(async () => openCalendar());
  expect(tree.root.findByProps({ testID: 'day-cell-2026-11-12' }).props.disabled).toBe(true);
  await act(async () => choosePreviousDay());
  expect(JSON.stringify(tree.toJSON())).not.toContain('Actual previous workout');
  await act(async () => tree.root.findByProps({ testID: 'sheet-date-picker' }).props.onClose());
  expect(tree.root.findByProps({ testID: 'workout-free-sample' })).toBeDefined();
  await act(async () => openCalendar());
  expect(
    tree.root.findByProps({ testID: 'day-cell-2026-11-11' }).props.accessibilityState.selected,
  ).toBe(true);
  await act(async () => choosePreviousDay());
  await act(async () =>
    tree.root.findByProps({ testID: 'workout-calendar-confirm' }).props.onPress(),
  );
  expect(tree.root.findAllByProps({ testID: 'sheet-date-picker' })).toHaveLength(0);
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

it('opens Build a new plan for an eligible Pro account without a saved routine or a setup button', async () => {
  state.plan = {
    id: null,
    revision: 0,
    full_access: true,
    can_rebuild: true,
    tier: 'pro',
    rebuilds_used: 0,
    days: [],
    preferences: null,
  };
  await render();
  expect(tree.root.findByProps({ testID: 'workout-build-new-plan' }).props.disabled).toBe(false);
  expect(tree.root.findAllByProps({ testID: 'workout-setup-plan' })).toHaveLength(0);
  await act(async () =>
    tree.root.findByProps({ testID: 'workout-build-new-plan' }).props.onPress(),
  );
  expect(tree.root.findByType('WeeklyPlanForm' as React.ElementType).props.workoutOnly).toBe(true);
});

it('saves a manual week without opening or calling AI during the Pro cooldown', async () => {
  state.plan = {
    id: 'plan',
    revision: 3,
    full_access: true,
    can_rebuild: false,
    tier: 'pro',
    next_rebuild_at: '2027-05-16T00:00:00Z',
    days: [],
  };
  await render();
  expect(tree.root.findByProps({ testID: 'workout-build-new-plan' }).props.disabled).toBe(true);
  await act(async () => tree.root.findByProps({ testID: 'workout-custom-plan' }).props.onPress());
  await act(async () => tree.root.findByProps({ testID: 'custom-plan-day-0' }).props.onPress());
  await act(async () =>
    tree.root.findByProps({ testID: 'custom-plan-add-exercise' }).props.onPress(),
  );
  await act(async () =>
    tree.root.findByProps({ id: 'custom-plan-exercise-name' }).props.onChange('Seated Chest Press'),
  );
  await act(async () =>
    tree.root
      .findByType('ExerciseSetsForm' as React.ElementType)
      .props.onAdd([{ reps: 12, weightKg: 0 }]),
  );
  await act(async () => tree.root.findByProps({ testID: 'custom-plan-save' }).props.onPress());
  const [content, base] = state.saveCustom.mock.lastCall!;
  expect(base.revision).toBe(3);
  expect(content.days).toHaveLength(7);
  expect(content.days[0].exercises[0]).toMatchObject({
    name: 'Seated Chest Press',
    targetSets: [{ reps: 12, weightKg: 0 }],
  });
  expect(
    content.days.slice(1).every((day: { exercises: unknown[] }) => !day.exercises.length),
  ).toBe(true);
  expect(state.rebuild).not.toHaveBeenCalled();
  expect(tree.root.findAllByProps({ testID: 'workout-build-form' })).toHaveLength(0);
});
