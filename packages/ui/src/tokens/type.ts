/**
 * CaliPartner Typography Scale — Apple Design & Plus Jakarta Sans
 * Source of truth: docs/ui/03-type.md & docs/ui/appendix-b-tokens.md
 */

export interface TextStyleToken {
  readonly fontFamily: string;
  readonly fontSize: number;
  readonly lineHeight: number;
  readonly fontVariant?: readonly ['tabular-nums'];
}

export const type = {
  numeralXL: {
    fontFamily: 'PlusJakartaSans_700',
    fontSize: 42,
    lineHeight: 48,
    fontVariant: ['tabular-nums'] as const,
  },
  numeralL: {
    fontFamily: 'PlusJakartaSans_700',
    fontSize: 30,
    lineHeight: 36,
    fontVariant: ['tabular-nums'] as const,
  },
  numeralM: {
    fontFamily: 'PlusJakartaSans_600',
    fontSize: 19,
    lineHeight: 24,
    fontVariant: ['tabular-nums'] as const,
  },
  title1: {
    fontFamily: 'PlusJakartaSans_700',
    fontSize: 24,
    lineHeight: 30,
  },
  title2: {
    fontFamily: 'PlusJakartaSans_600',
    fontSize: 19,
    lineHeight: 26,
  },
  heading: {
    fontFamily: 'PlusJakartaSans_600',
    fontSize: 16,
    lineHeight: 24,
  },
  body: {
    fontFamily: 'PlusJakartaSans_400',
    fontSize: 15,
    lineHeight: 24,
  },
  bodyS: {
    fontFamily: 'PlusJakartaSans_400',
    fontSize: 14,
    lineHeight: 20,
  },
  label: {
    fontFamily: 'PlusJakartaSans_500',
    fontSize: 13,
    lineHeight: 18,
  },
  micro: {
    fontFamily: 'PlusJakartaSans_500',
    fontSize: 11,
    lineHeight: 14,
  },
  button: {
    fontFamily: 'PlusJakartaSans_600',
    fontSize: 15,
    lineHeight: 20,
  },
} as const;

export type TypeVariant = keyof typeof type;

/**
 * Hindi (Devanagari) Typography Scale.
 * Numerals stay Latin digits in Plus Jakarta Sans with tabular-nums.
 * Interface text uses Anek Devanagari with line height scaled x1.15 to avoid clipping matras.
 */
export const typeHindi: Record<TypeVariant, TextStyleToken> = {
  numeralXL: {
    fontFamily: 'PlusJakartaSans_700',
    fontSize: 42,
    lineHeight: Math.round(48 * 1.15),
    fontVariant: ['tabular-nums'],
  },
  numeralL: {
    fontFamily: 'PlusJakartaSans_700',
    fontSize: 30,
    lineHeight: Math.round(36 * 1.15),
    fontVariant: ['tabular-nums'],
  },
  numeralM: {
    fontFamily: 'PlusJakartaSans_600',
    fontSize: 19,
    lineHeight: Math.round(24 * 1.15),
    fontVariant: ['tabular-nums'],
  },
  title1: {
    fontFamily: 'AnekDevanagari_600',
    fontSize: 24,
    lineHeight: Math.round(30 * 1.15),
  },
  title2: {
    fontFamily: 'AnekDevanagari_600',
    fontSize: 19,
    lineHeight: Math.round(26 * 1.15),
  },
  heading: {
    fontFamily: 'AnekDevanagari_600',
    fontSize: 16,
    lineHeight: Math.round(24 * 1.15),
  },
  body: {
    fontFamily: 'AnekDevanagari_400',
    fontSize: 15,
    lineHeight: Math.round(24 * 1.15),
  },
  bodyS: {
    fontFamily: 'AnekDevanagari_400',
    fontSize: 14,
    lineHeight: Math.round(20 * 1.15),
  },
  label: {
    fontFamily: 'AnekDevanagari_500',
    fontSize: 13,
    lineHeight: Math.round(18 * 1.15),
  },
  micro: {
    fontFamily: 'AnekDevanagari_500',
    fontSize: 11,
    lineHeight: Math.round(14 * 1.15),
  },
  button: {
    fontFamily: 'AnekDevanagari_600',
    fontSize: 15,
    lineHeight: Math.round(20 * 1.15),
  },
};

export function getTypeStyle(variant: TypeVariant, isHindi = false): TextStyleToken {
  return isHindi ? typeHindi[variant] : type[variant];
}

export const latinFonts = {
  regular: 'PlusJakartaSans_400',
  medium: 'PlusJakartaSans_500',
  semibold: 'PlusJakartaSans_600',
  bold: 'PlusJakartaSans_700',
  extrabold: 'PlusJakartaSans_800',
} as const;
