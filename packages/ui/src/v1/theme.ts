/**
 * CaliPartner Design System v1 — Tokens & Theme
 * Single source of truth: docs/ui/DESIGN_SYSTEM_V1.md
 * Sizes are in points (pt) on a 390 pt wide design.
 */

export const colors = {
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
  onBrand: '#1C1109',
  danger: '#F65C58',
  onDanger: '#1C1109',
  scrim: 'rgba(14,11,8,0.80)',
  glass: 'rgba(26,21,17,0.85)',
  glassMin: 'rgba(26,21,17,0.78)',
  glassMax: 'rgba(26,21,17,0.88)',
  apricotGlow: 'rgba(244,182,125,0.16)',
  apricotGlowLow: 'rgba(244,182,125,0.12)',
  apricotGlowHigh: 'rgba(244,182,125,0.28)',
  apricotGlowSoft: 'rgba(244,182,125,0.06)',
  apricotHalo: 'rgba(244,182,125,0.20)',
  heat1: 'rgba(244,182,125,0.35)',
  heat2: 'rgba(244,182,125,0.65)',
  shadow: 'rgba(0,0,0,0.50)',
  shadowMin: 'rgba(0,0,0,0.45)',
  shadowMax: 'rgba(0,0,0,0.55)',
} as const;

export type DSColorToken = keyof typeof colors;

/** Fixed Design System v1 macro mapping (Section 2). */
export const macroColors = {
  protein: colors.apricot,
  carbs: colors.apricotPressed,
  fat: colors.hairlineLit,
} as const;

/** Workout heatmap step ramp from 0 (rest/empty) to 3 (peak). */
export const heatmapScale = [colors.s3, colors.heat1, colors.heat2, colors.apricot] as const;

/** Static React Native font family names (Section 3 & 9). Never mix fontWeight with these. */
export const fonts = {
  display: 'Fraunces_500Medium',
  displayItalic: 'Fraunces_500Medium_Italic',
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
} as const;

export interface DSTextStyleSpec {
  readonly fontFamily: string;
  readonly fontSize: number;
  readonly lineHeight: number;
  readonly letterSpacing: number;
  readonly color: string;
  readonly textTransform?: 'uppercase';
  readonly fontVariant?: readonly ['tabular-nums'];
  readonly isDisplay?: boolean;
}

/** Typography styles from Design System v1 Section 3 & Section 9. */
export const type = {
  displayXL: {
    fontFamily: fonts.display,
    fontSize: 104,
    lineHeight: 104,
    letterSpacing: -4.2,
    color: colors.textHi,
    isDisplay: true,
  },
  displayL: {
    fontFamily: fonts.display,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -0.8,
    color: colors.textHi,
    isDisplay: true,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -0.7,
    color: colors.textHi,
    isDisplay: true,
  },
  titleM: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 31,
    letterSpacing: -0.6,
    color: colors.textHi,
    isDisplay: true,
  },
  titleS: {
    fontFamily: fonts.display,
    fontSize: 25,
    lineHeight: 29,
    letterSpacing: -0.5,
    color: colors.textHi,
    isDisplay: true,
  },
  numXL: {
    fontFamily: fonts.display,
    fontSize: 60,
    lineHeight: 60,
    letterSpacing: -1.8,
    color: colors.textHi,
    fontVariant: ['tabular-nums'] as const,
    isDisplay: true,
  },
  numL: {
    fontFamily: fonts.display,
    fontSize: 44,
    lineHeight: 44,
    letterSpacing: -1.3,
    color: colors.textHi,
    fontVariant: ['tabular-nums'] as const,
    isDisplay: true,
  },
  numM: {
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 30,
    letterSpacing: -0.9,
    color: colors.textHi,
    fontVariant: ['tabular-nums'] as const,
    isDisplay: true,
  },
  numS: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 22,
    letterSpacing: -0.7,
    color: colors.textHi,
    fontVariant: ['tabular-nums'] as const,
    isDisplay: true,
  },
  bodyL: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0,
    color: colors.textMid,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: 0,
    color: colors.textMid,
  },
  rowTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: 0,
    color: colors.textHi,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0,
    color: colors.textHi,
  },
  meta: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0,
    color: colors.textLo,
  },
  micro: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 0,
    color: colors.textLo,
  },
  eyebrow: {
    fontFamily: fonts.bold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.7,
    textTransform: 'uppercase' as const,
    color: colors.textLo,
  },
  buttonL: {
    fontFamily: fonts.bold,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 0,
    color: colors.onBrand,
  },
  buttonM: {
    fontFamily: fonts.bold,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: 0,
    color: colors.textHi,
  },
  buttonS: {
    fontFamily: fonts.bold,
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: 0,
    color: colors.textHi,
  },
  tabLabel: {
    fontFamily: fonts.bold,
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: 0,
    color: colors.textHi,
  },
} as const satisfies Record<string, DSTextStyleSpec>;

export type DSTypeVariant = keyof typeof type;

/** Spacing scale (4pt grid + optical steps 10, 14, 18, 22). */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 28,
  max: 32,
  optical10: 10,
  optical14: 14,
  optical18: 18,
  optical22: 22,
} as const;

/** Layout metrics on a 390 pt wide design canvas (Section 4). */
export const layout = {
  designWidth: 390,
  screenPaddingX: 24,
  sheetPaddingX: 20,
  floatingEdge: 20,
  floatingBottomOffset: 10,
  topContentOffset: 12,
  ctaBottomMin: 34,
  navRowHeight: 44,
  navToTitle: 28,
  eyebrowToTitle: 10,
  titleToSubtitle: 10,
  subtitleToControl: 24,
  sectionGap: 20,
  sectionLabelToContent: 12,
  listGap: 12,
  cardPadding: 16,
  heroCardPadding: 20,
  tabBarClearance: 150,
  minTouchTarget: 44,
} as const;

/** Radius tokens (Section 4 & 9). */
export const radius = {
  tick: 3,
  bar: 3,
  heatmap: 3,
  checkbox: 8,
  control: 12,
  iconTile: 14,
  chip: 16,
  input: 18,
  banner: 18,
  optionCard: 20,
  segmented: 22,
  card: 22,
  heroCard: 24,
  bento: 24,
  hero: 28,
  button: 28,
  sheet: 32,
  tabBar: 32,
  full: 999,
} as const;

export const borders = {
  width: 1,
  selectedWidth: 1.5,
  defaultColor: colors.hairline,
  activeColor: colors.hairlineLit,
  selectedColor: colors.apricot,
  dividerColor: colors.s2,
} as const;

/** Shadows reserved strictly for floating elements (Section 4). */
export const elevation = {
  none: {},
  sheet: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.5,
    shadowRadius: 32,
    elevation: 16,
  },
  floatingBar: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.55,
    shadowRadius: 32,
    elevation: 14,
  },
  logButton: {
    shadowColor: colors.apricot,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 0,
  },
  notificationPreview: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 28,
    elevation: 12,
  },
} as const;

export const iconTokens = {
  grid: 24,
  stroke: 1.8,
  emphasisStroke: 2.6,
  heavyStroke: 3,
  sizes: {
    xxs: 14,
    xs: 16,
    sm: 18,
    md: 20,
    lg: 22,
    xl: 24,
    xxl: 26,
    hero: 30,
  },
} as const;

export const theme = {
  colors,
  macroColors,
  heatmapScale,
  fonts,
  type,
  space,
  layout,
  radius,
  borders,
  elevation,
  iconTokens,
} as const;
