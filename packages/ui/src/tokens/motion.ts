/**
 * CaliPartner Motion Tokens
 * Source of truth: docs/ui/04-layout-motion.md & docs/ui/appendix-b-tokens.md
 */

export const motion = {
  fast: { duration: 120, easing: [0.2, 0, 0, 1] as const },
  base: { duration: 220, easing: [0.2, 0, 0, 1] as const },
  ring: { duration: 680, easing: [0.32, 0, 0.1, 1] as const },
  seam: { duration: 900, easing: [0.4, 0, 0.2, 1] as const },
} as const;

export type MotionToken = typeof motion;
