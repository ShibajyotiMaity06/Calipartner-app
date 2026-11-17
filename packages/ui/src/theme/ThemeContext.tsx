import { createContext } from 'react';
import { themePalettes } from '../tokens/colors';
import type { ThemeContextValue, ColorScheme } from './types';

export const defaultThemeContextValue: ThemeContextValue = {
  theme: 'yellow',
  scheme: 'yellow',
  colors: themePalettes.yellow,
  isDark: true,
  reduceMotion: false,
  reduceTransparency: false,
  setTheme: (_theme: ColorScheme) => {},
};

export const ThemeContext = createContext<ThemeContextValue>(defaultThemeContextValue);
