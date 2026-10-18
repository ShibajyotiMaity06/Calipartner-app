/**
 * CaliPartner Spacing Scale (Base unit: 4)
 * Source of truth: docs/ui/04-layout-motion.md & docs/ui/appendix-b-tokens.md
 */

export const space = [0, 4, 8, 12, 16, 20, 24, 32, 48, 64] as const;

export type SpaceToken = (typeof space)[number];
