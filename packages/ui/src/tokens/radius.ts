/**
 * CaliPartner Radius Tokens
 * Source of truth: docs/ui/04-layout-motion.md & docs/ui/appendix-b-tokens.md
 */

export const radius = {
  control: 12,
  button: 16,
  card: 20,
  sheet: 28,
  full: 999,
} as const;

export type RadiusToken = typeof radius;
