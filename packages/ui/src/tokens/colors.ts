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
export type LightColors = typeof light;
export type ColorPalette = DarkColors;
