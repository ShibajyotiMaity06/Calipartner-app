import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  reduced: false,
  change: undefined as ((value: boolean) => void) | undefined,
}));
vi.mock('react-native', () => ({
  Modal: 'Modal',
  View: 'View',
  Pressable: 'Pressable',
  SafeAreaView: 'SafeAreaView',
  StyleSheet: { create: (value: unknown) => value },
  Platform: { OS: 'ios' },
  AccessibilityInfo: {
    isReduceTransparencyEnabled: async () => false,
    isReduceMotionEnabled: async () => state.reduced,
    addEventListener: (name: string, callback: (value: boolean) => void) => {
      if (name === 'reduceMotionChanged') state.change = callback;
      return { remove: vi.fn() };
    },
  },
}));
import { Sheet } from './Sheet';
let tree: ReactTestRenderer;
beforeEach(() => {
  state.reduced = false;
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});
it('opens sheets without slide motion when Reduce Motion is enabled', async () => {
  state.reduced = true;
  await act(async () => {
    tree = create(
      <Sheet visible onClose={vi.fn()}>
        Content
      </Sheet>,
    );
  });
  expect(tree.root.findByType('Modal' as React.ElementType).props.animationType).toBe('none');
});
it('uses action-driven slide motion when the system allows it', async () => {
  await act(async () => {
    tree = create(
      <Sheet visible onClose={vi.fn()}>
        Content
      </Sheet>,
    );
  });
  expect(tree.root.findByType('Modal' as React.ElementType).props.animationType).toBe('slide');
});
it('responds to changes in the system motion setting', async () => {
  await act(async () => {
    tree = create(
      <Sheet visible onClose={vi.fn()}>
        Content
      </Sheet>,
    );
  });
  await act(async () => state.change?.(true));
  expect(tree.root.findByType('Modal' as React.ElementType).props.animationType).toBe('none');
});
