import { useColorScheme } from 'react-native';
import { colorsFor, type ColorScheme, type ThemeColors } from '@/theme/tokens';

/** Follows the system light/dark setting. */
export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const scheme: ColorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return { scheme, colors: colorsFor(scheme) };
}
