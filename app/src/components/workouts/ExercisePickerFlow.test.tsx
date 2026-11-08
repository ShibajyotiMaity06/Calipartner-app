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
vi.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
vi.mock('@calipartner/ui', async () => ({
  ...(await import('../../../../packages/ui/src/tokens')),
  Text: 'Text',
}));
vi.mock('@/theme/useTheme', () => ({ useTheme: () => ({ colors: {} }) }));
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
it('shows five relevant suggestions, searches the selected category and asks for sets before adding', async () => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const catalog = Array.from({ length: 16 }, (_, index) => ({
    id: String(index),
    name: index < 8 ? `Upper press ${index}` : `Lower squat ${index}`,
    muscle_group: index < 8 ? 'chest' : 'legs',
    equipment: 'bodyweight',
  }));
  api.list.mockImplementation(async (_db, options) =>
    options.searchQuery
      ? catalog.filter((item) => item.name.includes(options.searchQuery))
      : catalog,
  );
  const select = vi.fn(),
    close = vi.fn();
  await act(async () => {
    tree = create(<ExercisePickerModal visible onClose={close} onSelectExercise={select} />);
  });
  const list = () => tree.root.findByProps({ testID: 'exercise-picker-modal-list' });
  expect(list().props.data).toHaveLength(5);
  const filters = tree.root
    .findAllByType('FlatList' as React.ElementType)
    .find((node) => node.props.horizontal)!;
  await act(async () => filters.props.renderItem({ item: 'lower' }).props.onPress());
  expect(list().props.data).toHaveLength(5);
  expect(
    list().props.data.every((item: { muscle_group: string }) => item.muscle_group === 'legs'),
  ).toBe(true);
  await act(async () =>
    tree.root
      .findByProps({ testID: 'exercise-picker-modal-input-search' })
      .props.onChangeText('squat 12'),
  );
  expect(api.list).toHaveBeenLastCalledWith(
    expect.anything(),
    expect.objectContaining({ userId: 'owner', searchQuery: 'squat 12' }),
  );
  expect(list().props.data.map((item: { id: string }) => item.id)).toEqual(['12']);
  await act(async () => list().props.renderItem({ item: list().props.data[0] }).props.onPress());
  expect(select).not.toHaveBeenCalled();
  expect(close).not.toHaveBeenCalled();
  const sets = [
    { reps: 10, weightKg: 0 },
    { reps: 8, weightKg: 0 },
  ];
  await act(async () =>
    tree.root.findByType('ExerciseSetsForm' as React.ElementType).props.onAdd(sets),
  );
  expect(select).toHaveBeenCalledWith(catalog[12], sets);
  expect(close).toHaveBeenCalledOnce();
});
