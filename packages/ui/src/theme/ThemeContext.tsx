import { createContext } from 'react';
import { wellsLight } from '../tokens/colors';
import type { ThemeContextValue, ColorScheme } from './types';

export const defaultThemeContextValue: ThemeContextValue = {
  theme: 'light',
  scheme: 'light',
  colors: wellsLight,
  isDark: false,
  reduceMotion: false,
  reduceTransparency: false,
  setTheme: (_theme: ColorScheme) => {},
};

export const ThemeContext = createContext<ThemeContextValue>(defaultThemeContextValue);
