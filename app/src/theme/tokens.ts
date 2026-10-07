/**
 * Theme tokens. Neutral palette on purpose: no red/green "winning/losing" semantics
 * between people. Accent is a calm slate-blue used for interactive elements only.
 */
export interface ThemeColors {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  onAccent: string;
  danger: string;
}

export const lightColors: ThemeColors = {
  background: '#F7F7F8',
  surface: '#FFFFFF',
  surfaceAlt: '#EFEFF1',
  border: '#D9D9DE',
  text: '#16161A', // contrast on background ~16:1
  textMuted: '#55555E', // ~7:1 on background (AA)
  accent: '#3B4A7A', // ~8:1 against white
  onAccent: '#FFFFFF',
  danger: '#9A2B2B',
};

export const darkColors: ThemeColors = {
  background: '#0F0F12',
  surface: '#18181D',
  surfaceAlt: '#222229',
  border: '#33333C',
  text: '#F2F2F5', // ~16:1
  textMuted: '#A9A9B4', // ~7.5:1
  accent: '#A9B7F0', // ~9:1 on surface
  onAccent: '#0F0F12',
  danger: '#F0A0A0',
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radius = { sm: 8, md: 14, lg: 22, pill: 999 } as const;
export const fontSize = { sm: 13, md: 16, lg: 20, xl: 28 } as const;

export type ColorScheme = 'light' | 'dark';

export function colorsFor(scheme: ColorScheme): ThemeColors {
  return scheme === 'dark' ? darkColors : lightColors;
}
