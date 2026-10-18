/**
 * CaliPartner Typography Scale
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
    fontFamily: 'Bricolage_700',
    fontSize: 48,
    lineHeight: 52,
    fontVariant: ['tabular-nums'] as const,
  },
  numeralL: {
    fontFamily: 'Bricolage_600',
    fontSize: 34,
    lineHeight: 38,
    fontVariant: ['tabular-nums'] as const,
  },
  numeralM: {
    fontFamily: 'Bricolage_600',
    fontSize: 20,
    lineHeight: 24,
    fontVariant: ['tabular-nums'] as const,
  },
  title1: {
    fontFamily: 'Bricolage_600',
    fontSize: 26,
    lineHeight: 32,
  },
  title2: {
    fontFamily: 'Bricolage_600',
    fontSize: 20,
    lineHeight: 26,
  },
  heading: {
    fontFamily: 'Figtree_600',
    fontSize: 17,
    lineHeight: 24,
  },
  body: {
    fontFamily: 'Figtree_400',
    fontSize: 16,
    lineHeight: 24,
  },
  bodyS: {
    fontFamily: 'Figtree_400',
    fontSize: 14,
    lineHeight: 20,
  },
  label: {
    fontFamily: 'Figtree_500',
    fontSize: 13,
    lineHeight: 18,
  },
  micro: {
    fontFamily: 'Figtree_500',
    fontSize: 11,
    lineHeight: 14,
  },
  button: {
    fontFamily: 'Figtree_600',
    fontSize: 16,
    lineHeight: 20,
  },
} as const;

export type TypeVariant = keyof typeof type;

/**
 * Hindi (Devanagari) Typography Scale.
 * Numerals stay Latin digits in Bricolage.
 * Interface text uses Anek Devanagari with line height scaled x1.15 to avoid clipping matras.
 */
export const typeHindi: Record<TypeVariant, TextStyleToken> = {
  numeralXL: {
    fontFamily: 'Bricolage_700',
    fontSize: 48,
    lineHeight: Math.round(52 * 1.15),
    fontVariant: ['tabular-nums'],
  },
  numeralL: {
    fontFamily: 'Bricolage_600',
    fontSize: 34,
    lineHeight: Math.round(38 * 1.15),
    fontVariant: ['tabular-nums'],
  },
  numeralM: {
    fontFamily: 'Bricolage_600',
    fontSize: 20,
    lineHeight: Math.round(24 * 1.15),
    fontVariant: ['tabular-nums'],
  },
  title1: {
    fontFamily: 'AnekDevanagari_600',
    fontSize: 26,
    lineHeight: Math.round(32 * 1.15),
  },
  title2: {
    fontFamily: 'AnekDevanagari_600',
    fontSize: 20,
    lineHeight: Math.round(26 * 1.15),
  },
  heading: {
    fontFamily: 'AnekDevanagari_600',
    fontSize: 17,
    lineHeight: Math.round(24 * 1.15),
  },
  body: {
    fontFamily: 'AnekDevanagari_400',
    fontSize: 16,
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
    fontSize: 16,
    lineHeight: Math.round(20 * 1.15),
  },
};

export function getTypeStyle(variant: TypeVariant, isHindi = false): TextStyleToken {
  return isHindi ? typeHindi[variant] : type[variant];
}
