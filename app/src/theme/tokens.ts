/**
 * Theme tokens.
 * Vibrant, modern fitness & nutrition brand colors for personal tracking.
 * Neutral between people in room comparisons (no red/green "winning/losing" semantics).
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
  // Brand & Nutrition tokens:
  primary: string;
  macroCalories: string;
  macroProtein: string;
  macroCarbs: string;
  macroFat: string;
  macroFiber: string;
  syncSynced: string;
  syncPending: string;
  syncFailed: string;
  cardHighlight: string;
}

export const lightColors: ThemeColors = {
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceAlt: '#F1F5F9',
  border: '#E2E8F0',
  text: '#0F172A',
  textMuted: '#64748B',
  accent: '#2563EB', // Electric royal sapphire
  onAccent: '#FFFFFF',
  danger: '#EF4444',
  primary: '#0284C7', // Sky cyan
  macroCalories: '#F97316', // Vibrant energetic orange
  macroProtein: '#2563EB', // Sapphire blue
  macroCarbs: '#EAB308', // Warm golden amber
  macroFat: '#EC4899', // Vibrant rose magenta
  macroFiber: '#10B981', // Crisp emerald
  syncSynced: '#10B981',
  syncPending: '#F59E0B',
  syncFailed: '#EF4444',
  cardHighlight: '#EFF6FF',
};

export const darkColors: ThemeColors = {
  background: '#0B0F19', // Deep dark obsidian
  surface: '#131B2E', // Midnight slate navy
  surfaceAlt: '#1E293B',
  border: '#2A364F',
  text: '#F8FAFC',
  textMuted: '#94A3B8',
  accent: '#38BDF8', // Vivid electric cyan
  onAccent: '#0B0F19',
  danger: '#F87171',
  primary: '#60A5FA', // Energetic indigo-blue
  macroCalories: '#FB923C', // Energetic coral flame
  macroProtein: '#60A5FA', // Electric blue
  macroCarbs: '#FBBF24', // Warm golden glow
  macroFat: '#F472B6', // Bright punchy pink
  macroFiber: '#34D399', // Mint emerald
  syncSynced: '#34D399',
  syncPending: '#FBBF24',
  syncFailed: '#F87171',
  cardHighlight: '#1E2945',
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radius = { sm: 8, md: 14, lg: 22, pill: 999 } as const;
export const fontSize = { xs: 11, sm: 13, md: 16, lg: 20, xl: 28, xxl: 34 } as const;

export type ColorScheme = 'light' | 'dark';

export function colorsFor(scheme: ColorScheme): ThemeColors {
  return scheme === 'dark' ? darkColors : lightColors;
}
