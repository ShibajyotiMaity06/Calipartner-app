import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { controls } from '../tokens/controls';

const palette = vi.hoisted(() => ({ danger: 'danger', textOff: 'disabled', s3: 'feedback' }));
vi.mock('../theme/useTheme', () => ({
  useTheme: () => ({ colors: palette, reduceMotion: true }),
}));
vi.mock('./Text', () => ({ Text: 'Text' }));
vi.mock('./NavigationIcon', () => ({ NavigationIcon: 'NavigationIcon' }));
vi.mock('./AddIcon', () => ({ AddIcon: 'AddIcon' }));
vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  View: 'View',
  ActivityIndicator: 'ActivityIndicator',
  Animated: {
    View: 'AnimatedView',
    Value: class {},
    timing: () => ({ start: vi.fn(), stop: vi.fn() }),
  },
  StyleSheet: {
    create: (value: unknown) => value,
    flatten: (value: unknown) => value,
    absoluteFill: {},
  },
}));
import { Button } from './Button';

let tree: ReactTestRenderer;
beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(async () => {
  await act(async () => tree.unmount());
});

it('renders a centered, borderless cancel action and retains tap size and accessibility', async () => {
  const close = vi.fn();
  await act(async () => {
    tree = create(
      <Button
        variant="cancel"
        label="Cancel request"
        onPress={close}
        testID="cancel"
        style={{ borderWidth: 2, backgroundColor: 'legacy', width: '100%', flex: 1 }}
      />,
    );
  });
  const button = tree.root.findByType('Pressable' as React.ElementType);
  const style = Object.assign({}, ...button.props.style());
  expect(style).toMatchObject({
    alignSelf: 'center',
    backgroundColor: 'transparent',
    borderWidth: 0,
    width: 'auto',
    minWidth: controls.touch,
    minHeight: controls.touch,
  });
  expect(button.props.accessibilityLabel).toBe('Cancel request');
  expect(tree.root.findByType('Text' as React.ElementType).props.color).toBe(palette.danger);
  act(() => button.props.onPress());
  expect(close).toHaveBeenCalledOnce();
});

it('keeps disabled cancel actions borderless and prevents activation', async () => {
  const close = vi.fn();
  await act(async () => {
    tree = create(<Button variant="cancel" label="Cancel" onPress={close} disabled />);
  });
  const button = tree.root.findByType('Pressable' as React.ElementType);
  expect(Object.assign({}, ...button.props.style()).backgroundColor).toBe('transparent');
  expect(button.props.accessibilityState.disabled).toBe(true);
  expect(button.props.onPress).toBeUndefined();
  expect(tree.root.findByType('Text' as React.ElementType).props.color).toBe(palette.textOff);
});
