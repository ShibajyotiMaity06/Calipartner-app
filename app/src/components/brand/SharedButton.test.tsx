import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
import { themePalettes, radius } from '../../../../packages/ui/src/tokens';
const appearance = vi.hoisted(() => ({
  theme: 'light' as 'light' | 'yellow',
  reduceMotion: false,
}));
vi.mock('../../../../packages/ui/src/theme/useTheme', async () => {
  const { themePalettes } = await import('../../../../packages/ui/src/tokens');
  return {
    useTheme: () => ({
      colors: themePalettes[appearance.theme],
      reduceMotion: appearance.reduceMotion,
    }),
  };
});
vi.mock('react-native', () => ({
  View: 'View',
  Pressable: 'Pressable',
  ActivityIndicator: 'Spinner',
  Animated: {
    View: 'AnimatedView',
    Value: class {},
    timing: () => ({ start: vi.fn(), stop: vi.fn() }),
  },
  StyleSheet: {
    create: (value: unknown) => value,
    absoluteFill: {},
    flatten: (value: unknown) => (Array.isArray(value) ? Object.assign({}, ...value) : value),
  },
}));
vi.mock('../../../../packages/ui/src/components/Text', () => ({ Text: 'Text' }));
vi.mock('../../../../packages/ui/src/components/NavigationIcon', () => ({
  NavigationIcon: 'NavigationIcon',
}));
vi.mock('../../../../packages/ui/src/components/AddIcon', () => ({ AddIcon: 'AddIcon' }));
import { Button } from '../../../../packages/ui/src/components/Button';
let tree: ReactTestRenderer;
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});
it.each(['light', 'yellow'] as const)(
  'enforces shared geometry, button type and brand ink in %s',
  async (theme) => {
    appearance.theme = theme;
    appearance.reduceMotion = false;
    await act(async () => {
      tree = create(
        <Button
          label="Continue"
          size="sm"
          labelColor="white"
          style={{ borderRadius: 2, minHeight: 12, height: 20 }}
          icon={React.createElement('Icon', { color: 'white' })}
        />,
      );
    });
    const button = tree.root.findByType('Pressable' as React.ElementType);
    let styles = Object.assign({}, ...button.props.style({ pressed: false }));
    expect(styles.borderRadius).toBe(radius.button);
    expect(styles.minHeight).toBeGreaterThanOrEqual(44);
    expect(styles.height).toBeUndefined();
    const text = tree.root.findByType('Text' as React.ElementType);
    expect(text.props.variant).toBe('button');
    expect(text.props.color).toBe(themePalettes[theme].onBrand);
    expect(tree.root.findByType('Icon' as React.ElementType).props.color).toBe(
      themePalettes[theme].onBrand,
    );
    await act(async () => button.props.onPressIn({}));
    styles = Object.assign({}, ...button.props.style({ pressed: true }));
    expect(styles.transform).toEqual([{ scale: 0.985 }]);
  },
);
it('keeps loading actions disabled and suppresses scale feedback for reduced motion', async () => {
  appearance.reduceMotion = true;
  const press = vi.fn();
  await act(async () => {
    tree = create(<Button label="Save" loading onPress={press} />);
  });
  const button = tree.root.findByType('Pressable' as React.ElementType);
  expect(button.props.onPress).toBeUndefined();
  expect(button.props.accessibilityState).toMatchObject({ disabled: true, busy: true });
  await act(async () => button.props.onPressIn({}));
  expect(Object.assign({}, ...button.props.style({ pressed: true })).transform).toEqual([
    { scale: 1 },
  ]);
  expect(press).not.toHaveBeenCalled();
});
