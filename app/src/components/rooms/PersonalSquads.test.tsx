import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  leave: vi.fn(),
  refresh: vi.fn(),
  push: vi.fn(),
}));
vi.mock('react-native', () => ({
  View: 'View',
  StyleSheet: { create: (value: unknown) => value },
}));
vi.mock('@calipartner/ui', async () => ({
  ...(await import('../../../../packages/ui/src/tokens')),
  Text: 'Text',
  Button: 'Button',
  Sheet: 'Sheet',
}));
vi.mock('expo-router', async () => {
  const React = await import('react');
  return {
    useRouter: () => ({ push: state.push }),
    useFocusEffect: (callback: () => void) => React.useEffect(callback, [callback]),
  };
});
vi.mock('@/hooks/useRooms', () => ({
  useRooms: () => ({
    rooms: [{ id: 'crew', name: 'My crew', member_count: 3, member_cap: 20 }],
    refresh: state.refresh,
    leaveRoom: state.leave,
    loading: false,
    error: null,
  }),
}));
import { PersonalSquads } from './PersonalSquads';
let tree: ReactTestRenderer;
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
  vi.clearAllMocks();
});
it('opens the exact squad, requires leave confirmation, preserves failed requests and prevents duplicate submissions', async () => {
  let acknowledge!: () => void;
  state.leave.mockRejectedValueOnce(new Error('offline')).mockImplementationOnce(
    () =>
      new Promise<void>((done) => {
        acknowledge = done;
      }),
  );
  await act(async () => {
    tree = create(<PersonalSquads />);
  });
  tree.root.findByProps({ testID: 'personal-open-squad-crew' }).props.onPress();
  expect(state.push).toHaveBeenLastCalledWith({
    pathname: '/(tabs)/room',
    params: { room: 'crew' },
  });
  await act(async () =>
    tree.root.findByProps({ testID: 'personal-leave-squad-crew' }).props.onPress(),
  );
  expect(state.leave).not.toHaveBeenCalled();
  await act(async () =>
    tree.root.findByProps({ testID: 'personal-confirm-leave' }).props.onPress(),
  );
  expect(tree.root.findByProps({ testID: 'personal-leave-sheet' }).props.visible).toBe(true);
  await act(async () => {
    const confirm = tree.root.findByProps({ testID: 'personal-confirm-leave' }).props.onPress;
    confirm();
    confirm();
  });
  expect(state.leave).toHaveBeenCalledTimes(2);
  await act(async () => {
    acknowledge();
  });
  expect(tree.root.findByProps({ testID: 'personal-leave-sheet' }).props.visible).toBe(false);
});
