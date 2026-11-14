import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, it, expect, vi } from 'vitest';
vi.mock('react-native', () => ({
  AccessibilityInfo: {
    isReduceMotionEnabled: async () => true,
    isReduceTransparencyEnabled: async () => true,
    addEventListener: () => ({ remove: () => {} }),
  },
}));
import { ThemeProvider } from './ThemeProvider';
import { useTheme } from './useTheme';
import type { ThemeContextValue } from './types';
import { themePalettes, lightNutritionColors } from '../tokens/colors';
import { getContrastRatio } from '../contrast';
let tree: ReactTestRenderer;
let current: ThemeContextValue;
function Probe() {
  current = useTheme();
  return null;
}
beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});
it('defaults to Light, switches palettes and persists the explicit choice', async () => {
  const storage = { getItem: vi.fn(async () => null), setItem: vi.fn(async () => {}) };
  await act(async () => {
    tree = create(
      <ThemeProvider storage={storage}>
        <Probe />
      </ThemeProvider>,
    );
  });
  expect(current!.theme).toBe('light');
  expect(current!.colors.bg0).toBe('#DDD5C7');
  expect(current!.reduceMotion).toBe(true);
  await act(async () => current.setTheme('dark'));
  expect(current!.colors.bg0).toBe('#151413');
  expect(storage.setItem).toHaveBeenCalledWith('calipartner.appearance', 'dark');
  await act(async () => current.setTheme('yellow'));
  expect(current!.colors.bg0).toBe('#0E0B08');
});
it('does not let delayed hydration overwrite a new selection', async () => {
  let resolve!: (s: string) => void;
  const storage = {
    getItem: () =>
      new Promise<string>((r) => {
        resolve = r;
      }),
    setItem: async () => {},
  };
  await act(async () => {
    tree = create(
      <ThemeProvider storage={storage}>
        <Probe />
      </ThemeProvider>,
    );
  });
  await act(async () => current.setTheme('yellow'));
  await act(async () => resolve('dark'));
  expect(current!.theme).toBe('yellow');
});
it('keeps text, action labels and Light nutrient text at AA contrast', () => {
  for (const palette of Object.values(themePalettes))
    for (const surface of [palette.bg0, palette.s1, palette.s2])
      for (const text of [palette.textHi, palette.textMid])
        expect(getContrastRatio(text, surface)).toBeGreaterThanOrEqual(4.5);
  for (const palette of Object.values(themePalettes))
    expect(getContrastRatio(palette.apricot, palette.onBrand)).toBeGreaterThanOrEqual(4.5);
  for (const color of Object.values(lightNutritionColors))
    expect(getContrastRatio(color, themePalettes.light.s1)).toBeGreaterThanOrEqual(4.5);
});
