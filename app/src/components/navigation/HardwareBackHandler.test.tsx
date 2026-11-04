import React from 'react';
import { act, create } from 'react-test-renderer';
import { expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  canBack: true,
  back: vi.fn(),
  handler: undefined as (() => boolean) | undefined,
}));
vi.mock('react-native', () => ({
  Platform: { OS: 'android' },
  BackHandler: {
    addEventListener: (_event: string, handler: () => boolean) => {
      state.handler = handler;
      return { remove: vi.fn() };
    },
  },
}));
vi.mock('expo-router', () => ({
  useRouter: () => ({ canGoBack: () => state.canBack, back: state.back }),
}));
import { HardwareBackHandler } from './HardwareBackHandler';
it('phone Back pops the actual navigator and never exits when its history is empty', async () => {
  let tree!: ReturnType<typeof create>;
  await act(async () => {
    tree = create(<HardwareBackHandler />);
  });
  expect(state.handler?.()).toBe(true);
  expect(state.back).toHaveBeenCalledOnce();
  state.canBack = false;
  expect(state.handler?.()).toBe(true);
  expect(state.back).toHaveBeenCalledOnce();
  await act(async () => tree.unmount());
});
