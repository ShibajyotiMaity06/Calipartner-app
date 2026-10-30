import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoomMemberSnapshot } from '@calipartner/core';
const state = vi.hoisted(() => ({
  meals: vi.fn(),
  copy: vi.fn(),
  log: vi.fn(),
  share: vi.fn(),
  flush: vi.fn(),
  workouts: [] as unknown[],
  online: true,
}));
vi.mock('react-native', () => ({
  Modal: 'Modal',
  SafeAreaView: 'SafeAreaView',
  ScrollView: 'ScrollView',
  View: 'View',
  TextInput: 'TextInput',
  Pressable: 'Pressable',
  Image: 'Image',
  StyleSheet: { create: (value: unknown) => value },
  Platform: { OS: 'android' },
}));
vi.mock('@calipartner/ui', () => ({
  Text: 'Text',
  Button: 'Button',
  Card: 'Card',
  Avatar: 'Avatar',
  HiddenMetric: 'HiddenMetric',
  space: [],
  dark: {},
  radius: {},
  type: { body: {} },
  onboardingLayout: { touch: 48 },
}));
vi.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
vi.mock('@/hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isOnline: state.online }),
}));
vi.mock('@/hooks/useCurrentLocalDate', () => ({
  useCurrentLocalDate: () => ({ localDate: '2026-10-30' }),
}));
vi.mock('@/hooks/useWorkouts', () => ({
  useWorkouts: () => ({ workouts: state.workouts, loading: false, error: null, refresh: vi.fn() }),
}));
vi.mock('@/hooks/useRooms', () => ({
  useRooms: () => ({
    rooms: [
      { id: 'room-one', name: 'Room one', state: 'active' },
      { id: 'room-two', name: 'Room two', state: 'active' },
    ],
    loading: false,
    refresh: vi.fn(),
  }),
}));
vi.mock('@/hooks/useSubscription', () => ({ useSubscription: () => ({ hasActiveAccess: true }) }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'self' } }) }));
vi.mock('@/services/roomMealService', () => ({
  getRoomMeals: state.meals,
  copyRoomMeal: state.copy,
}));
vi.mock('@/services/workoutLogService', () => ({ logWorkoutExercise: state.log }));
vi.mock('@/services/roomExtrasService', () => ({ shareRoomWorkout: state.share }));
vi.mock('@/services/syncService', () => ({ flushOutbox: state.flush }));
vi.mock('@/services/foodService', () => ({ generateClientUuid: () => 'retry-id' }));
vi.mock('@/lib/supabase', () => ({ getSupabase: () => ({}) }));
vi.mock('@/db', () => ({
  getDb: async () => ({ getAllAsync: async () => [{ sync_state: 'synced' }] }),
}));
import { NudgeModal } from './NudgeModal';
import { ShareLoggedMealModal } from './ShareLoggedMealModal';
import { MemberComparison } from './MemberComparison';
import { WorkoutLogModal } from '../workouts/WorkoutLogModal';
const members = Array.from({ length: 20 }, (_, index) => ({
  user_id: index ? `member-${index}` : 'self',
  is_self: !index,
  nickname: `Person ${index}`,
  username: `person${index}`,
  role: 'member',
  status: 'active',
  metrics: {
    status: 'active',
    calories: 'locked',
    macros: 'locked',
    water_ml: 'locked',
    workout_status: 'locked',
    weight_kg: 'locked',
    weight_progress: 'locked',
    fasting_status: 'locked',
    goal_completion: index === 3 ? 'locked' : index * 10,
    steps: index === 3 ? 'locked' : 1000,
    logged_today: false,
    meal_checklist: { breakfast: true },
  },
})) as RoomMemberSnapshot[];
let tree: ReactTestRenderer;
const node = (id: string) => tree.root.findByProps({ testID: id });
beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  state.online = true;
  state.workouts = [];
  state.meals.mockImplementation(async (_room, id) => [
    {
      id: `meal-${id}`,
      food_name: `Food ${id}`,
      meal_section: 'breakfast',
      quantity: 100,
      unit: 'g',
      can_copy: true,
    },
  ]);
  state.copy.mockResolvedValue({});
  state.flush.mockResolvedValue({ failed: 0 });
  state.share.mockResolvedValue(undefined);
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});
describe('room usability interactions', () => {
  it('sends a typed nudge to the explicitly chosen member', async () => {
    const send = vi.fn().mockResolvedValue({}),
      close = vi.fn();
    await act(async () => {
      tree = create(
        <NudgeModal
          visible
          targetMember={members[1]!}
          members={members.slice(1)}
          onClose={close}
          onSendNudge={send}
        />,
      );
    });
    expect(node('btn-send-nudge-submit').props.disabled).toBe(true);
    await act(async () => node('choose-room-member').props.onPress());
    await act(async () => node('choose-member-member-10').props.onPress());
    await act(async () => node('nudge-message').props.onChangeText(' Want to walk together? '));
    await act(async () => node('btn-send-nudge-submit').props.onPress());
    expect(send).toHaveBeenCalledWith('member-10', 'Want to walk together?');
    expect(close).toHaveBeenCalledOnce();
  });
  it('loads another partner’s meals, copies a selection, and closes successfully', async () => {
    const close = vi.fn(),
      shared = vi.fn();
    await act(async () => {
      tree = create(
        <ShareLoggedMealModal
          roomId="room"
          userId="self"
          members={members}
          onClose={close}
          onShared={shared}
        />,
      );
    });
    await act(async () => node('choose-room-member').props.onPress());
    await act(async () => node('choose-member-member-5').props.onPress());
    expect(state.meals).toHaveBeenLastCalledWith('room', 'member-5');
    expect(tree.root.findAllByProps({ testID: 'share-meal-choice-meal-member-1' })).toHaveLength(0);
    await act(async () => node('share-meal-choice-meal-member-5').props.onPress());
    await act(async () => node('copy-meal-section-lunch').props.onPress());
    await act(async () => node('send-logged-meal').props.onPress());
    expect(state.copy).toHaveBeenCalledWith(
      'retry-id',
      'room',
      'member-5',
      'meal-member-5',
      'lunch',
    );
    expect(close).toHaveBeenCalledOnce();
    expect(shared).toHaveBeenCalledOnce();
  });
  it('keeps failed meal copies open for retry and the close button works', async () => {
    state.copy.mockRejectedValue(new Error('offline'));
    const close = vi.fn();
    await act(async () => {
      tree = create(
        <ShareLoggedMealModal
          roomId="room"
          userId="self"
          members={members}
          onClose={close}
          onShared={vi.fn()}
        />,
      );
    });
    await act(async () => node('share-meal-choice-meal-member-1').props.onPress());
    await act(async () => node('send-logged-meal').props.onPress());
    expect(close).not.toHaveBeenCalled();
    await act(async () => node('close-share-logged-meal').props.onPress());
    expect(close).toHaveBeenCalledOnce();
  });
  it.each([5, 10, 19])(
    'compares %i selected partners with the caller and shows a lock for hidden metrics',
    (count) => {
      act(() => {
        tree = create(
          <MemberComparison
            members={members.slice(0, count + 1)}
            callerId="self"
            onNudge={vi.fn()}
          />,
        );
      });
      expect(tree.root.findAllByType('Card' as React.ElementType)).toHaveLength(count + 1);
      expect(tree.root.findAllByType('HiddenMetric' as React.ElementType)).toHaveLength(2);
      expect(JSON.stringify(tree.toJSON())).not.toContain('kcal');
    },
  );
  it('starts an empty workout diary, chooses category/exercise, and saves entered sets', async () => {
    state.log.mockImplementation(async (_db, input) => {
      const workout = { id: 'workout', name: input.exerciseName, exercises: [] };
      state.workouts = [workout];
      return workout;
    });
    await act(async () => {
      tree = create(<WorkoutLogModal visible onClose={vi.fn()} />);
    });
    expect(JSON.stringify(tree.toJSON())).not.toContain('Bench Press');
    await act(async () => node('btn-log-workout').props.onPress());
    await act(async () => node('workout-category-lower').props.onPress());
    const choices = tree.root.findAll(
      (item) =>
        typeof item.props.testID === 'string' &&
        item.props.testID.startsWith('workout-exercise-') &&
        item.props.testID !== 'workout-exercise-search',
    );
    expect(choices.length).toBeGreaterThan(5);
    await act(async () => choices[0]!.props.onPress());
    await act(async () => node('workout-reps-0').props.onChangeText('12'));
    await act(async () => node('workout-weight-0').props.onChangeText('25'));
    await act(async () => node('workout-duration').props.onChangeText('30'));
    await act(async () => node('workout-save').props.onPress());
    expect(state.log.mock.calls[0]?.[1]).toMatchObject({
      userId: 'self',
      localDate: '2026-10-30',
      durationMinutes: 30,
      sets: [{ reps: 12, weightKg: 25 }],
    });
    await act(async () => node('share-saved-workout-workout').props.onPress());
    await act(async () => node('share-workout-room-room-two').props.onPress());
    expect(state.share).toHaveBeenCalledWith('retry-id', 'room-two', 'workout');
  });
});
