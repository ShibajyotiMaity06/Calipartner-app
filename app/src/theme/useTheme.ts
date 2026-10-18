import { useTheme as useUITheme } from '@calipartner/ui';
import { colorsFor, type ColorScheme, type ThemeColors } from './tokens';

/**
 * Hook to access the active theme and colors.
 * Automatically wraps legacy theme callers with the Apricot on Espresso palette.
 */
export function useTheme(): {
  scheme: ColorScheme;
  theme: ColorScheme;
  colors: ThemeColors;
  isDark: boolean;
  reduceMotion: boolean;
  reduceTransparency: boolean;
  setTheme: (theme: ColorScheme) => void;
} {
  const uiTheme = useUITheme();
  return {
    scheme: 'dark',
    theme: uiTheme.theme,
    colors: colorsFor('dark'),
    isDark: true,
    reduceMotion: uiTheme.reduceMotion,
    reduceTransparency: uiTheme.reduceTransparency,
    setTheme: uiTheme.setTheme,
  };
}

export { useReducedMotion, useReduceTransparency } from '@calipartner/ui';
