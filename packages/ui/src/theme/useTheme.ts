import { useContext } from 'react';
import { ThemeContext } from './ThemeContext';
import type { ThemeContextValue } from './types';

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
