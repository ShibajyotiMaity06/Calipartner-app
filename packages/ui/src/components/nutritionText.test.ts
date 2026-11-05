import { expect, it, vi } from 'vitest';
vi.mock('react-native', () => ({
  Text: 'Text',
  StyleSheet: {
    flatten: (value: unknown) =>
      Object.assign({}, ...(Array.isArray(value) ? value.flat(Infinity).filter(Boolean) : [value])),
  },
}));
import { StyleSheet } from 'react-native';
import { Text } from './Text';
import { dark, nutritionColors } from '../tokens/colors';
it.each(['calories', 'protein', 'carbs', 'fat'] as const)(
  'applies the fixed %s text identity over a legacy neutral colour',
  (nutrient) => {
    const element = Text({ nutrient, children: '50', style: { color: dark.textMid } });
    expect(StyleSheet.flatten(element.props.style).color).toBe(nutritionColors[nutrient]);
  },
);
it('preserves on-brand contrast for nutrition actions', () => {
  const element = Text({ nutrient: 'calories', children: 'Calories', color: dark.onBrand });
  expect(StyleSheet.flatten(element.props.style).color).toBe(dark.onBrand);
});
it('preserves explicit error styling for validation messages', () => {
  const element = Text({
    nutrient: 'calories',
    children: 'Calories required',
    color: dark.danger,
    accessibilityRole: 'alert',
  });
  expect(StyleSheet.flatten(element.props.style).color).toBe(dark.danger);
});
