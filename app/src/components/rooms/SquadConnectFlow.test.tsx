import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Modal: 'Modal',
  Platform: { OS: 'web' },
  Alert: { alert: vi.fn() },
  Linking: { openURL: vi.fn() },
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  TextInput: 'TextInput',
  TouchableOpacity: 'TouchableOpacity',
  View: 'View',
  StyleSheet: { create: (value: unknown) => value },
}));
vi.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
vi.mock('react-native-svg', () => ({ default: 'Svg', Path: 'Path', Rect: 'Rect' }));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
vi.mock('@calipartner/ui', () => ({
  Avatar: 'Avatar',
  Button: 'Button',
  Chip: 'Chip',
  Card: 'Card',
  CheckIcon: 'CheckIcon',
  onboardingLayout: {},
  onboardingType: {},
  useTheme: () => ({ colors: {} }),
  Text: 'Text',
  dark: {},
  radius: {},
  space: [0, 4, 8, 12, 16],
}));
vi.mock('@/lib/sound', () => ({ playClickSound: vi.fn(), playSuccessSound: vi.fn() }));
import { SquadConnectFlow } from './SquadConnectFlow';

describe('squad connection controls', () => {
  it('opens real username search for free users without starting a room or an upgrade', async () => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    const findFriend = vi.fn();
    const createRoom = vi.fn();
    const paywall = vi.fn();
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        <SquadConnectFlow
          isPlusOrPro={false}
          onFindFriend={findFriend}
          onOpenPaywall={paywall}
          onCreateSquad={createRoom}
          onJoinSquad={vi.fn()}
        />,
      );
    });
    await act(async () =>
      renderer.root.findByProps({ testID: 'squad-add-friends' }).props.onPress(),
    );
    expect(findFriend).toHaveBeenCalledOnce();
    expect(createRoom).not.toHaveBeenCalled();
    expect(paywall).not.toHaveBeenCalled();
    expect(renderer.root.findAllByProps({ testID: 'modal-plus-required' })).toHaveLength(0);
    await act(async () => renderer.unmount());
  });
  it('returns to the choice screen and never continues into creation or sends a create request', async () => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    const createRoom = vi.fn();
    const paywall = vi.fn();
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        <SquadConnectFlow
          isPlusOrPro={false}
          onOpenPaywall={paywall}
          onCreateSquad={createRoom}
          onJoinSquad={vi.fn()}
        />,
      );
    });
    await act(async () =>
      renderer.root.findByProps({ testID: 'option-create-squad' }).props.onPress(),
    );
    expect(renderer.root.findByProps({ testID: 'squad-name' })).toBeDefined();
    await act(async () => renderer.root.findByProps({ testID: 'squad-back' }).props.onPress());
    expect(renderer.root.findByProps({ testID: 'option-create-squad' })).toBeDefined();
    expect(renderer.root.findAllByProps({ testID: 'squad-name' })).toHaveLength(0);
    expect(createRoom).not.toHaveBeenCalled();
    expect(paywall).not.toHaveBeenCalled();
    await act(async () => renderer.unmount());
  });
});
