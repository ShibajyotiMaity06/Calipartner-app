import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  user: { id: 'returning' } as { id: string } | null,
  isGuest: false,
  isLoading: false,
  first: '(tabs)',
  replace: vi.fn(),
  missingTargets: false,
}));
vi.mock('expo-router', () => ({
  useRouter: () => ({ replace: state.replace }),
  useSegments: () => [state.first],
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => state }));
vi.mock('@/hooks/useTargets', () => ({
  useTargets: () => ({
    currentGoalProfile: state.missingTargets ? null : { id: 'saved' },
    loading: false,
    error: null,
  }),
}));
import { SessionNavigationGuard } from './SessionNavigationGuard';
let renderer: ReactTestRenderer;
beforeEach(() => {
  state.user = { id: 'returning' };
  state.isGuest = false;
  state.isLoading = false;
  state.first = '(tabs)';
  state.missingTargets = false;
  vi.clearAllMocks();
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(async () => {
  await act(async () => renderer.unmount());
});
describe('session expiry navigation', () => {
  it('returns reset accounts to goal setup without repeating signup', async () => {
    state.missingTargets = true;
    await act(async () => {
      renderer = create(<SessionNavigationGuard />);
    });
    expect(state.replace).toHaveBeenCalledWith('/onboarding');
  });
  it('asks for login when an existing session expires on an open screen', async () => {
    await act(async () => {
      renderer = create(<SessionNavigationGuard />);
    });
    expect(state.replace).not.toHaveBeenCalled();
    state.user = null;
    await act(async () => {
      renderer.update(<SessionNavigationGuard />);
    });
    expect(state.replace).toHaveBeenCalledWith('/auth/sign-in?mode=signin');
  });

  it.each(['loading', 'guest', 'signup'])('does not interrupt %s', async (mode) => {
    state.user = null;
    state.isLoading = mode === 'loading';
    state.isGuest = mode === 'guest';
    state.first = mode === 'signup' ? 'auth' : '(tabs)';
    await act(async () => {
      renderer = create(<SessionNavigationGuard />);
    });
    expect(state.replace).not.toHaveBeenCalled();
  });
});
