import { createContext } from 'react';
import { dark } from '../tokens/colors';
import type { ThemeContextValue, ColorScheme } from './types';

export const defaultThemeContextValue: ThemeContextValue = {
  theme: 'dark',
  scheme: 'dark',
  colors: dark,
  isDark: true,
  reduceMotion: false,
  reduceTransparency: false,
  setTheme: (_theme: ColorScheme) => {},
};

export const ThemeContext = createContext<ThemeContextValue>(defaultThemeContextValue);
