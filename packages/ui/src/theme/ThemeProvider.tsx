import React, { useMemo, type ReactNode } from 'react';
import { themePalettes } from '../tokens/colors';
import { ThemeContext } from './ThemeContext';
import { useReducedMotion } from './useReducedMotion';
import { useReduceTransparency } from './useReduceTransparency';
import type { ColorScheme, ThemeContextValue } from './types';

export interface ThemeProviderProps {
  children: ReactNode;
  initialTheme?: ColorScheme;
  storage?: {
    getItem: (key: string) => Promise<string | null>;
    setItem: (key: string, value: string) => Promise<void>;
  };
}

export function ThemeProvider({ children }: ThemeProviderProps): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  const reduceTransparency = useReduceTransparency();
  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: 'yellow',
      scheme: 'yellow',
      colors: themePalettes.yellow,
      isDark: true,
      reduceMotion,
      reduceTransparency,
      setTheme: () => {},
    }),
    [reduceMotion, reduceTransparency],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
