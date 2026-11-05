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
import { getContrastRatio } from '../contrast';
it('reserves yellow for fat, uses light red calories and the existing border brown for selection', () => {
  expect(nutritionColors.fat).toBe('#F4D477');
  expect(nutritionColors.calories).toBe('#F69B96');
  expect(dark.selection).toBe(dark.copper);
  expect(getContrastRatio(dark.selection, dark.s2)).toBeGreaterThanOrEqual(4.5);
  for (const color of Object.values(nutritionColors))
    expect(getContrastRatio(color, dark.s2)).toBeGreaterThanOrEqual(4.5);
});
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
