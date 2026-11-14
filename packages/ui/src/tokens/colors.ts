/**
 * CaliPartner Color Tokens
 * Source of truth: docs/ui/02-colour.md & docs/ui/appendix-b-tokens.md
 */

export const dark = {
  bg0: '#0E0B08',
  s1: '#1A1511',
  s2: '#241E18',
  s3: '#2F2821',
  hairline: '#3A3228',
  hairlineLit: '#85755F',
  textHi: '#F7F0E7',
  textMid: '#C9BCAC',
  textLo: '#9A8E7F',
  textOff: '#6F6558',
  apricot: '#F4B67D',
  apricotPressed: '#E19A5C',
  copper: '#BB8661',
  chocolate: '#9A6746',
  selection: '#BB8661',
  onBrand: '#1C1109',
  iris: '#B49AFC',
  teal: '#1FBDB6',
  rose: '#F885B5',
  mint: '#2EC083',
  sky: '#5EAFFE',
  orchid: '#E48ADD',
  danger: '#F65C58',
  cream: '#F7F0E7',
} as const;

export const light = {
  bg0: '#FBF6EF',
  s1: '#FFFFFF',
  s2: '#F3EBE0',
  s3: '#EADFD0',
  hairline: '#E6DCCD',
  hairlineLit: '#9A8B78',
  textHi: '#2A2118',
  textMid: '#5E5246',
  textLo: '#7A6D60',
  textOff: '#A89A8A',
  apricot: '#F4B67D',
  apricotPressed: '#E19A5C',
  brandInk: '#8F4A0C',
  chocolate: '#8A5638',
  selection: '#8A5638',
  onBrand: '#1C1109',
  iris: '#7B56C8',
  teal: '#217874',
  rose: '#BA3C78',
  mint: '#167B52',
  sky: '#016EBE',
  orchid: '#A745A1',
  danger: '#C23A36',
  cream: '#2A2118',
} as const;

export type DarkColors = typeof dark;
/** Fixed nutrient identities, never indicators of good/bad performance. */
export const squadIndicators = { unread: '#F69B96', transparent: 'transparent' } as const;
export const nutritionColors = {
  calories: '#F69B96',
  protein: dark.mint,
  carbs: '#FFFFFF',
  fat: '#F4D477',
} as const;
export type NutritionMetric = keyof typeof nutritionColors;
export type LightColors = typeof light;
export type ColorPalette = { [K in keyof DarkColors]: string };

/** The previous palette remains available as the owner's Yellow appearance. */
export const yellow: ColorPalette = dark;
export const wellsLight: ColorPalette = {
  ...dark,
  bg0: '#DDD5C7',
  s1: '#EAE3D6',
  s2: '#F4EFE6',
  s3: '#EDE7DC',
  hairline: '#CBC1B0',
  hairlineLit: '#BCB19F',
  textHi: '#151413',
  textMid: '#191816',
  textLo: '#6C665C',
  textOff: '#7A7468',
  apricot: '#191816',
  apricotPressed: '#322F2A',
  onBrand: '#F8F5EE',
  copper: '#6C665C',
  chocolate: '#7A7468',
  selection: '#191816',
  iris: light.iris,
  teal: light.teal,
  rose: light.rose,
  mint: light.mint,
  sky: light.sky,
  orchid: light.orchid,
  danger: light.danger,
  cream: '#191816',
};
export const wellsDark: ColorPalette = {
  ...dark,
  bg0: '#151413',
  s1: '#1E1C1A',
  s2: '#262320',
  s3: '#211E1B',
  hairline: '#2F2A25',
  hairlineLit: '#3D3730',
  textHi: '#FAF6EF',
  textMid: '#F2EDE4',
  textLo: '#B2A99C',
  textOff: '#9C9488',
  apricot: '#DFD5C6',
  apricotPressed: '#C8BEAE',
  onBrand: '#151413',
  copper: '#9C9488',
  chocolate: '#9C9488',
  selection: '#DFD5C6',
  cream: '#DFD5C6',
};
export const themePalettes = { light: wellsLight, dark: wellsDark, yellow };
export const themeDock = {
  light: 'rgba(221, 213, 199, 0.94)',
  dark: 'rgba(21, 20, 19, 0.94)',
  yellow: 'rgba(36, 30, 24, 0.88)',
};
export const lightNutritionColors = {
  calories: '#923D60',
  protein: '#32644E',
  carbs: '#191816',
  fat: '#805C18',
};

export type { IdentityHue } from './pairs';

export function getIdentityColor(hue: string, palette = dark): string {
  return (palette as Record<string, string>)[hue] || palette.iris;
}
