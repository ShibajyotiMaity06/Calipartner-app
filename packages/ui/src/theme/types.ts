import type { ColorPalette } from '../tokens/colors';

export type ColorScheme = 'dark' | 'light' | 'yellow';

export type ThemeColors = ColorPalette;

export interface ThemeContextValue {
  theme: ColorScheme;
  scheme: ColorScheme;
  colors: ThemeColors;
  isDark: boolean;
  reduceMotion: boolean;
  reduceTransparency: boolean;
  setTheme: (theme: ColorScheme) => void;
}
