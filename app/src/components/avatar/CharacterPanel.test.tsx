import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({
  handlers: {} as Record<
    string,
    (event?: unknown, gesture?: { dx?: number; dy?: number; vy?: number }) => unknown
  >,
  durations: [] as number[],
}));
vi.mock('react-native', () => ({
  View: 'View',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  Platform: { OS: 'ios' },
  StyleSheet: { create: (s: unknown) => s },
  PanResponder: {
    create: (handlers: typeof mock.handlers) => {
      mock.handlers = handlers;
      return { panHandlers: {} };
    },
  },
  Animated: {
    Value: class {
      listener?: (event: { value: number }) => void;
      addListener(fn: (event: { value: number }) => void) {
        this.listener = fn;
        return 'listener';
      }
      removeListener() {}
      stopAnimation() {}
      setValue(value: number) {
        this.listener?.({ value });
      }
    },
    timing: (
      value: { setValue: (n: number) => void },
      options: { toValue: number; duration: number },
    ) => ({
      start: () => {
        mock.durations.push(options.duration);
        value.setValue(options.toValue);
      },
    }),
  },
}));
vi.mock('@calipartner/ui', async () => ({
  ...(await import('../../../../packages/ui/src/tokens')),
  useReducedMotion: () => true,
  useTheme: () => ({ colors: {} }),
}));
import { CharacterPanel } from './CharacterPanel';
let tree: ReactTestRenderer;
afterEach(async () => {
  await act(async () => tree?.unmount());
  mock.durations = [];
});
it('expands the character after a native drag, restores the panel on upward drag and supports a tap with reduced motion', async () => {
  await act(async () => {
    tree = create(
      <CharacterPanel character={(height) => <div data-stage data-height={height} />}>
        <div>Items</div>
      </CharacterPanel>,
    );
  });
  await act(async () =>
    tree.root
      .findByProps({ testID: 'character-stage' })
      .props.onLayout({ nativeEvent: { layout: { height: 700 } } }),
  );
  const expandedHeight = tree.root.findByProps({ 'data-stage': true }).props['data-height'];
  expect(mock.handlers.onMoveShouldSetPanResponderCapture?.({}, { dx: 50, dy: 1 })).toBe(false);
  expect(mock.handlers.onMoveShouldSetPanResponderCapture?.({}, { dx: 1, dy: 50 })).toBe(true);
  await act(async () => {
    mock.handlers.onPanResponderGrant?.();
    mock.handlers.onPanResponderMove?.({}, { dy: 400 });
    mock.handlers.onPanResponderRelease?.({}, { vy: 1 });
  });
  expect(
    tree.root.findByProps({ testID: 'character-panel-handle' }).props.accessibilityState.expanded,
  ).toBe(false);
  expect(tree.root.findByProps({ 'data-stage': true }).props['data-height']).toBeGreaterThan(
    expandedHeight,
  );
  expect(tree.root.findAllByProps({ testID: 'character-items-scroll' })).toHaveLength(0);
  await act(async () => {
    mock.handlers.onPanResponderGrant?.();
    mock.handlers.onPanResponderMove?.({}, { dy: -400 });
    mock.handlers.onPanResponderRelease?.({}, { vy: -1 });
  });
  expect(
    tree.root.findByProps({ testID: 'character-panel-handle' }).props.accessibilityState.expanded,
  ).toBe(true);
  const now = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 1000);
  await act(async () =>
    tree.root.findByProps({ testID: 'character-panel-handle' }).props.onPress(),
  );
  now.mockRestore();
  expect(
    tree.root.findByProps({ testID: 'character-panel-handle' }).props.accessibilityState.expanded,
  ).toBe(false);
  expect(mock.durations.every((duration) => duration === 0)).toBe(true);
});
