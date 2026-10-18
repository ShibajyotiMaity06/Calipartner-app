/**
 * Allowed Identity Colour Pairs (Colour-Blind Safe)
 * Source of truth: docs/ui/02-colour.md & docs/ui/appendix-b-tokens.md
 * Only pairs with min delta-E >= 8 across normal, deuteranopia, protanopia, and tritanopia are permitted.
 */

export const allowedPairs = [
  ['iris', 'teal'],
  ['iris', 'rose'],
  ['iris', 'mint'],
  ['sky', 'rose'],
  ['mint', 'orchid'],
] as const;

export type AllowedPair = (typeof allowedPairs)[number];

export const identityHues = ['iris', 'teal', 'rose', 'mint', 'sky', 'orchid'] as const;
export type IdentityHue = (typeof identityHues)[number];

export function isPairAllowed(colorA: string, colorB: string): boolean {
  const normA = colorA.toLowerCase();
  const normB = colorB.toLowerCase();
  return allowedPairs.some(
    ([a, b]) => (a === normA && b === normB) || (a === normB && b === normA),
  );
}

export function getAllowedPairs(): readonly (readonly [string, string])[] {
  return allowedPairs;
}

/**
 * Returns all 15 possible combinations of identity hues and whether they are allowed in CaliPartner.
 */
export function getSelectablePairsData(): Array<{
  pair: [IdentityHue, IdentityHue];
  allowed: boolean;
  isDefault: boolean;
}> {
  const result: Array<{
    pair: [IdentityHue, IdentityHue];
    allowed: boolean;
    isDefault: boolean;
  }> = [];

  for (let i = 0; i < identityHues.length; i++) {
    for (let j = i + 1; j < identityHues.length; j++) {
      const a = identityHues[i]!;
      const b = identityHues[j]!;
      const allowed = isPairAllowed(a, b);
      const isDefault = (a === 'iris' && b === 'teal') || (a === 'teal' && b === 'iris');
      result.push({ pair: [a, b], allowed, isDefault });
    }
  }

  return result;
}
