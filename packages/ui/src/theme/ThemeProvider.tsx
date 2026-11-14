import React, { useState, useMemo, useEffect, useRef, useCallback, type ReactNode } from 'react';
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

export function ThemeProvider({
  children,
  initialTheme = 'light',
  storage,
}: ThemeProviderProps): React.JSX.Element {
  const [theme, updateTheme] = useState<ColorScheme>(initialTheme);
  const revision = useRef(0);
  useEffect(() => {
    let active = true;
    const version = revision.current;
    void storage
      ?.getItem('calipartner.appearance')
      .then((saved) => {
        if (
          active &&
          revision.current === version &&
          (saved === 'light' || saved === 'dark' || saved === 'yellow')
        )
          updateTheme(saved);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [storage]);
  const setTheme = useCallback(
    (next: ColorScheme) => {
      revision.current++;
      updateTheme(next);
      void storage?.setItem('calipartner.appearance', next).catch(() => undefined);
    },
    [storage],
  );
  const reduceMotion = useReducedMotion();
  const reduceTransparency = useReduceTransparency();

  const value = useMemo<ThemeContextValue>(() => {
    const activeColors = themePalettes[theme];
    return {
      theme,
      scheme: theme,
      colors: activeColors,
      isDark: theme !== 'light',
      reduceMotion,
      reduceTransparency,
      setTheme,
    };
  }, [theme, reduceMotion, reduceTransparency, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
