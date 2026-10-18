import type { dark } from '../tokens/colors';

export type ColorScheme = 'dark' | 'light';

export type ThemeColors = typeof dark;

export interface ThemeContextValue {
  theme: ColorScheme;
  scheme: ColorScheme;
  colors: ThemeColors;
  isDark: boolean;
  reduceMotion: boolean;
  reduceTransparency: boolean;
  setTheme: (theme: ColorScheme) => void;
}
