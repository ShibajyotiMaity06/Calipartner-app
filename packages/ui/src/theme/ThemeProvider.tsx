import React, { useState, useMemo, type ReactNode } from 'react';
import { dark } from '../tokens/colors';
import { ThemeContext } from './ThemeContext';
import { useReducedMotion } from './useReducedMotion';
import { useReduceTransparency } from './useReduceTransparency';
import type { ColorScheme, ThemeContextValue } from './types';

export interface ThemeProviderProps {
  children: ReactNode;
  initialTheme?: ColorScheme;
}

export function ThemeProvider({
  children,
  initialTheme = 'dark',
}: ThemeProviderProps): React.JSX.Element {
  const [theme, setTheme] = useState<ColorScheme>(initialTheme);
  const reduceMotion = useReducedMotion();
  const reduceTransparency = useReduceTransparency();

  const value = useMemo<ThemeContextValue>(() => {
    // Light theme is a stub that falls back to dark for now
    const activeColors = dark;
    return {
      theme,
      scheme: 'dark', // Always dark during UI-1 through UI-13
      colors: activeColors,
      isDark: true,
      reduceMotion,
      reduceTransparency,
      setTheme,
    };
  }, [theme, reduceMotion, reduceTransparency]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
