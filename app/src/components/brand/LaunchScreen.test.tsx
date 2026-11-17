import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  user: null as { id: string } | null,
  loading: false,
  check: vi.fn(),
  replace: vi.fn(),
}));
vi.mock('react-native', () => ({
  View: 'View',
  StyleSheet: { create: (value: unknown) => value },
}));
vi.mock('@calipartner/ui', () => ({ useTheme: () => ({ colors: {} }) }));
vi.mock('expo-router', () => ({ useRouter: () => ({ replace: state.replace }) }));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: state.user, isLoading: state.loading }),
}));
vi.mock('@/services/onboardingStatus', () => ({ isUserOnboarded: state.check }));
vi.mock('@/components/ErrorState', () => ({ ErrorState: 'ErrorState' }));
vi.mock('./AnimatedLogoSplash', () => ({ AnimatedLogoSplash: 'Splash' }));
import LaunchScreen from '@/app/index';
let tree: ReactTestRenderer;
beforeEach(() => {
  state.user = null;
  state.loading = false;
  vi.clearAllMocks();
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});
const render = async () => {
  await act(async () => {
    tree = create(<LaunchScreen />);
  });
};
const finish = async () => {
  await act(async () => tree.root.findByType('Splash' as React.ElementType).props.onComplete());
};
it('shows splash until finished, then sends a new visitor directly to setup', async () => {
  await render();
  expect(state.replace).not.toHaveBeenCalled();
  await finish();
  expect(state.replace).toHaveBeenCalledWith('/onboarding');
  expect(state.check).not.toHaveBeenCalled();
});
it('waits for session restoration even when motion is skipped', async () => {
  state.loading = true;
  await render();
  await finish();
  expect(state.replace).not.toHaveBeenCalled();
  state.user = { id: 'returning' };
  state.loading = false;
  state.check.mockResolvedValue(true);
  await act(async () => tree.update(<LaunchScreen />));
  expect(state.replace).toHaveBeenCalledWith('/(tabs)/today');
});
it('keeps incomplete signed-in setup in onboarding', async () => {
  state.user = { id: 'new-account' };
  state.check.mockResolvedValue(false);
  await render();
  await finish();
  expect(state.replace).toHaveBeenCalledWith('/onboarding');
});
it('keeps a failed readiness check actionable and retries without replaying the splash', async () => {
  state.user = { id: 'returning' };
  state.check.mockRejectedValueOnce(new Error('network')).mockResolvedValue(true);
  await render();
  await finish();
  expect(state.replace).not.toHaveBeenCalled();
  await act(async () => tree.root.findByType('ErrorState' as React.ElementType).props.onRetry());
  expect(state.replace).toHaveBeenCalledWith('/(tabs)/today');
});
it('ignores a pending result after unmount', async () => {
  let resolve!: (value: boolean) => void;
  state.user = { id: 'returning' };
  state.check.mockReturnValue(
    new Promise<boolean>((done) => {
      resolve = done;
    }),
  );
  await render();
  await finish();
  await act(async () => tree.unmount());
  await act(async () => resolve(true));
  expect(state.replace).not.toHaveBeenCalled();
});
