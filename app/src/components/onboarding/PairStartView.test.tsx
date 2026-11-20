import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ prepare: vi.fn(), share: vi.fn(), online: true, os: 'android' }));
vi.mock('react-native', () => ({
  View: 'View',
  Modal: 'Modal',
  Share: { share: state.share },
  Platform: {
    get OS() {
      return state.os;
    },
  },
  StyleSheet: { create: (v: unknown) => v },
}));
vi.mock('@calipartner/ui', () => ({
  Button: 'Button',
  NavigationIcon: 'Icon',
  Text: 'Text',
  space: [],
  useTheme: () => ({ colors: {} }),
}));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
vi.mock('expo-clipboard', () => ({ setStringAsync: vi.fn() }));
vi.mock('@/components/brand/CaliPartnerLogo', () => ({ CaliPartnerLogo: 'Logo' }));
vi.mock('expo-router', () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'owner' } }) }));
vi.mock('@/hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isOnline: state.online }),
}));
vi.mock('@/services/pairOnboardingService', () => ({
  preparePairInvite: state.prepare,
  finishPairPrompt: vi.fn(),
}));
vi.mock('@/lib/secureStore', () => ({ secureStoreAdapter: { getItem: async () => null } }));
import { PairStartView } from './PairStartView';
let tree: ReactTestRenderer;
beforeEach(() => {
  vi.clearAllMocks();
  state.online = true;
  state.os = 'android';
  state.prepare.mockResolvedValue({ token: 'invite' });
  state.share.mockResolvedValue({ action: 'dismissedAction' });
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});
it('opens the native share sheet once automatically and again on the explicit action', async () => {
  await act(async () => {
    tree = create(<PairStartView />);
  });
  expect(state.share).toHaveBeenCalledTimes(1);
  await act(async () => tree.update(<PairStartView />));
  expect(state.share).toHaveBeenCalledTimes(1);
  await act(async () => tree.root.findByProps({ testID: 'share-pair-invite' }).props.onPress());
  expect(state.share).toHaveBeenCalledTimes(2);
});
it('waits for connectivity and opens a copyable invite modal on web', async () => {
  state.os = 'web';
  state.online = false;
  await act(async () => {
    tree = create(<PairStartView />);
  });
  expect(state.prepare).not.toHaveBeenCalled();
  state.online = true;
  await act(async () => tree.update(<PairStartView />));
  expect(tree.root.findByType('Modal' as never).props.visible).toBe(true);
  const headerClose = tree.root.findByProps({ testID: 'pair-close-share' });
  expect(headerClose.props.iconOnly).toBe(true);
  expect(headerClose.parent?.props.testID).toBe('pair-share-sheet');
  expect(state.share).not.toHaveBeenCalled();
  await act(async () => tree.root.findByProps({ testID: 'pair-close-share' }).props.onPress());
  expect(tree.root.findByType('Modal' as never).props.visible).toBe(false);
});
