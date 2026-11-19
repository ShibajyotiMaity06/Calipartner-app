import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  FlatList: 'FlatList',
  ScrollView: 'ScrollView',
  Modal: 'Modal',
  View: 'View',
  TextInput: 'TextInput',
  TouchableOpacity: 'TouchableOpacity',
  StyleSheet: { create: (value: unknown) => value },
}));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
vi.mock('@/services/foodService', () => ({ generateClientUuid: () => 'private-id' }));
vi.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
vi.mock('@calipartner/ui', async () => ({
  Button: (await import('@/test/ButtonStub')).ButtonStub,
  ...(await import('../../../../packages/ui/src/tokens')),
  Text: 'Text',
  NavigationIcon: 'NavigationIcon',
  useTheme: () => ({ colors: {} }),
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'owner' } }) }));
vi.mock('@/services/accountDataService', () => ({
  loadAccountTable: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/db', () => ({ getDb: async () => ({}) }));
vi.mock('@/hooks/useBrowserModalBack', () => ({ useBrowserModalBack: vi.fn() }));
vi.mock('@/services/workoutService', () => ({
  getExercises: api.list,
  createCustomExercise: vi.fn(),
}));
vi.mock('./ExerciseSetsForm', () => ({ ExerciseSetsForm: 'ExerciseSetsForm' }));
import { ExercisePickerModal } from './ExercisePickerModal';
let tree: ReactTestRenderer;
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});
const catalog = [
  { id: 'press', name: 'Seated Chest Press', owner_id: null },
  { id: 'crushers', name: 'Skull Crushers', owner_id: null },
  { id: 'mine', name: 'A private row', owner_id: 'owner' },
  { id: 'other', name: 'Someone else', owner_id: 'some-other-user' },
];
const search = (query: string) =>
  tree.root.findByProps({ testID: 'exercise-picker-modal-input-search' }).props.onChangeText(query);
const list = () => tree.root.findByProps({ testID: 'exercise-picker-modal-list' });

it('starts with search only, finds names across the catalog and shows only owned workouts under the heart', async () => {
  api.list.mockResolvedValue(catalog);
  const select = vi.fn(),
    close = vi.fn();
  await act(async () => {
    tree = create(<ExercisePickerModal visible onClose={close} onSelectExercise={select} />);
  });
  expect(tree.root.findAllByProps({ testID: 'exercise-picker-modal-list' })).toHaveLength(0);
  expect(tree.root.findAllByProps({ testID: 'chip-muscle-upper' })).toHaveLength(0);
  await act(async () => tree.root.findByProps({ testID: 'workout-my-exercises' }).props.onPress());
  expect(list().props.data).toEqual([catalog[2]]);
  await act(async () => search('skullcrusher'));
  expect(list().props.data).toEqual([catalog[1]]);
  await act(async () => list().props.renderItem({ item: list().props.data[0] }).props.onPress());
  expect(select).not.toHaveBeenCalled();
  const sets = [{ reps: 10, weightKg: 0 }];
  await act(async () =>
    tree.root.findByType('ExerciseSetsForm' as React.ElementType).props.onAdd(sets),
  );
  expect(select).toHaveBeenCalledWith(catalog[1], sets, undefined);
  expect(close).toHaveBeenCalledOnce();
});

it('moves from an empty result through name and sets, then submits a private workout with the log', async () => {
  api.list.mockResolvedValue(catalog);
  const select = vi
    .fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(undefined);
  const close = vi.fn();
  await act(async () => {
    tree = create(
      <ExercisePickerModal visible deferCustomSave onClose={close} onSelectExercise={select} />,
    );
  });
  await act(async () => search('Pendulum Squat'));
  await act(async () =>
    tree.root
      .findByProps({ testID: 'exercise-picker-modal-btn-create-custom-empty' })
      .props.onPress(),
  );
  expect(tree.root.findByProps({ testID: 'input-custom-exercise-name' }).props.value).toBe(
    'Pendulum Squat',
  );
  await act(async () =>
    tree.root.findByProps({ testID: 'btn-save-custom-exercise' }).props.onPress(),
  );
  expect(select).not.toHaveBeenCalled();
  const submit = () =>
    tree.root
      .findByType('ExerciseSetsForm' as React.ElementType)
      .props.onAdd([{ reps: 12, weightKg: 20 }]);
  await act(async () => {
    await expect(submit()).rejects.toThrow('offline');
  });
  expect(close).not.toHaveBeenCalled();
  await act(async () => submit());
  expect(select.mock.calls[0]).toEqual(select.mock.calls[1]);
  expect(select.mock.calls[1]![2]).toMatchObject({
    id: 'private-id',
    name: 'Pendulum Squat',
    owner_id: 'owner',
  });
  expect(close).toHaveBeenCalledOnce();
});
