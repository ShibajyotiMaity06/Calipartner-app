/**
 * Theme tokens compatibility layer.
 * Maps legacy theme tokens to the new CaliPartner Design System ("Apricot on Espresso").
 * Source of truth: docs/ui/02-colour.md, docs/ui/03-type.md, docs/ui/appendix-b-tokens.md
 *
 * @deprecated Prefer importing tokens directly from `@calipartner/ui` or `@calipartner/ui/tokens`.
 */
import {
  dark,
  space,
  radius as radiusTokens,
  type as typeTokens,
} from '@calipartner/ui';

export interface ThemeColors {
  /** @deprecated Use colors.bg0 instead */
  background: string;
  /** @deprecated Use colors.s1 instead */
  surface: string;
  /** @deprecated Use colors.s2 instead */
  surfaceAlt: string;
  /** @deprecated Use colors.hairline instead */
  border: string;
  /** @deprecated Use colors.textHi instead */
  text: string;
  /** @deprecated Use colors.textMid instead */
  textMuted: string;
  /** @deprecated Use colors.apricot instead */
  accent: string;
  /** @deprecated Use colors.onBrand instead (#1C1109, never white) */
  onAccent: string;
  /** @deprecated Use colors.danger instead */
  danger: string;
  /** @deprecated Use colors.apricot instead */
  primary: string;
  /** @deprecated Use colors.apricot or colors.copper */
  macroCalories: string;
  /** @deprecated Use colors.iris */
  macroProtein: string;
  /** @deprecated Use colors.teal */
  macroCarbs: string;
  /** @deprecated Use colors.rose */
  macroFat: string;
  /** @deprecated Use colors.mint */
  macroFiber: string;
  /** @deprecated Use colors.mint */
  syncSynced: string;
  /** @deprecated Use colors.apricot */
  syncPending: string;
  /** @deprecated Use colors.danger */
  syncFailed: string;
  /** @deprecated Use colors.s2 instead */
  cardHighlight: string;

  // Modern CaliPartner Design System Tokens:
  bg0: string;
  s1: string;
  s2: string;
  s3: string;
  hairline: string;
  hairlineLit: string;
  textHi: string;
  textMid: string;
  textLo: string;
  textOff: string;
  apricot: string;
  apricotPressed: string;
  copper: string;
  onBrand: string;
  iris: string;
  teal: string;
  rose: string;
  mint: string;
  sky: string;
  orchid: string;
  cream: string;
}

const modernDarkColors: ThemeColors = {
  // Legacy mappings:
  background: dark.bg0,
  surface: dark.s1,
  surfaceAlt: dark.s2,
  border: dark.hairline,
  text: dark.textHi,
  textMuted: dark.textMid,
  accent: dark.apricot,
  onAccent: dark.onBrand, // #1C1109 - dark text on apricot
  danger: dark.danger,
  primary: dark.apricot,
  macroCalories: dark.apricot,
  macroProtein: dark.iris,
  macroCarbs: dark.teal,
  macroFat: dark.rose,
  macroFiber: dark.mint,
  syncSynced: dark.mint,
  syncPending: dark.apricot,
  syncFailed: dark.danger,
  cardHighlight: dark.s2,

  // New design system tokens:
  bg0: dark.bg0,
  s1: dark.s1,
  s2: dark.s2,
  s3: dark.s3,
  hairline: dark.hairline,
  hairlineLit: dark.hairlineLit,
  textHi: dark.textHi,
  textMid: dark.textMid,
  textLo: dark.textLo,
  textOff: dark.textOff,
  apricot: dark.apricot,
  apricotPressed: dark.apricotPressed,
  copper: dark.copper,
  onBrand: dark.onBrand,
  iris: dark.iris,
  teal: dark.teal,
  rose: dark.rose,
  mint: dark.mint,
  sky: dark.sky,
  orchid: dark.orchid,
  cream: dark.cream,
};

/**
 * @deprecated Light theme is a stub that falls back to dark for now.
 */
export const lightColors: ThemeColors = modernDarkColors;

/**
 * @deprecated CaliPartner uses the Apricot on Espresso palette.
 */
export const darkColors: ThemeColors = modernDarkColors;

/**
 * @deprecated Use `space` from `@calipartner/ui` instead.
 */
export const spacing = {
  xs: space[1], // 4
  sm: space[2], // 8
  md: space[4], // 16
  lg: space[6], // 24
  xl: space[7], // 32
} as const;

/**
 * @deprecated Use `radius` from `@calipartner/ui` instead.
 */
export const radius = {
  sm: 8,
  md: radiusTokens.button, // 16
  lg: radiusTokens.card, // 20
  pill: radiusTokens.full, // 999
  control: radiusTokens.control, // 12
  button: radiusTokens.button, // 16
  card: radiusTokens.card, // 20
  sheet: radiusTokens.sheet, // 28
  full: radiusTokens.full, // 999
} as const;

/**
 * @deprecated Use `type` from `@calipartner/ui` instead.
 */
export const fontSize = {
  xs: typeTokens.micro.fontSize, // 11
  sm: typeTokens.label.fontSize, // 13
  md: typeTokens.body.fontSize, // 16
  lg: typeTokens.title2.fontSize, // 20
  xl: 28,
  xxl: typeTokens.numeralL.fontSize, // 34
} as const;

export type ColorScheme = 'light' | 'dark';

export function colorsFor(_scheme: ColorScheme): ThemeColors {
  return modernDarkColors;
}

export { dark, light, allowedPairs, space, motion, typeTokens as type } from '@calipartner/ui';
