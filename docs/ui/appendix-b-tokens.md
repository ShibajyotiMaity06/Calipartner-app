## Appendix B — Tokens (TypeScript starting point)

```ts
// packages/ui/tokens.ts
export const dark = {
  bg0: '#0E0B08', s1: '#1A1511', s2: '#241E18', s3: '#2F2821',
  hairline: '#3A3228', hairlineLit: '#85755F',
  textHi: '#F7F0E7', textMid: '#C9BCAC', textLo: '#9A8E7F', textOff: '#6F6558',
  apricot: '#F4B67D', apricotPressed: '#E19A5C', copper: '#BB8661', onBrand: '#1C1109',
  iris: '#B49AFC', teal: '#1FBDB6', rose: '#F885B5', mint: '#2EC083', sky: '#5EAFFE', orchid: '#E48ADD',
  danger: '#F65C58', cream: '#F7F0E7',
} as const;

export const light = {
  bg0: '#FBF6EF', s1: '#FFFFFF', s2: '#F3EBE0', s3: '#EADFD0',
  hairline: '#E6DCCD', hairlineLit: '#9A8B78',
  textHi: '#2A2118', textMid: '#5E5246', textLo: '#7A6D60', textOff: '#A89A8A',
  apricot: '#F4B67D', apricotPressed: '#E19A5C', brandInk: '#8F4A0C', onBrand: '#1C1109',
  iris: '#7B56C8', teal: '#217874', rose: '#BA3C78', mint: '#167B52', sky: '#016EBE', orchid: '#A745A1',
  danger: '#C23A36', cream: '#2A2118',
} as const; // s3, hairline, textOff, danger, cream for light are proposals: measure before use

// Colour-blind-safe pairs only (min ΔE >= 8 across normal, deuteranopia, protanopia, tritanopia)
export const allowedPairs = [
  ['iris', 'teal'], ['iris', 'rose'], ['iris', 'mint'], ['sky', 'rose'], ['mint', 'orchid'],
] as const;

export const space = [0, 4, 8, 12, 16, 20, 24, 32, 48, 64] as const;
export const radius = { control: 12, button: 16, card: 20, sheet: 28, full: 999 } as const;
export const motion = {
  fast: { duration: 120, easing: [0.2, 0, 0, 1] },
  base: { duration: 220, easing: [0.2, 0, 0, 1] },
  ring: { duration: 680, easing: [0.32, 0, 0.1, 1] },
  seam: { duration: 900, easing: [0.4, 0, 0.2, 1] },
} as const;

export const type = {
  numeralXL: { fontFamily: 'Bricolage_700', fontSize: 48, lineHeight: 52, fontVariant: ['tabular-nums'] },
  numeralL:  { fontFamily: 'Bricolage_600', fontSize: 34, lineHeight: 38, fontVariant: ['tabular-nums'] },
  numeralM:  { fontFamily: 'Bricolage_600', fontSize: 20, lineHeight: 24, fontVariant: ['tabular-nums'] },
  title1:    { fontFamily: 'Bricolage_600', fontSize: 26, lineHeight: 32 },
  title2:    { fontFamily: 'Bricolage_600', fontSize: 20, lineHeight: 26 },
  heading:   { fontFamily: 'Figtree_600',   fontSize: 17, lineHeight: 24 },
  body:      { fontFamily: 'Figtree_400',   fontSize: 16, lineHeight: 24 },
  bodyS:     { fontFamily: 'Figtree_400',   fontSize: 14, lineHeight: 20 },
  label:     { fontFamily: 'Figtree_500',   fontSize: 13, lineHeight: 18 },
  micro:     { fontFamily: 'Figtree_500',   fontSize: 11, lineHeight: 14 },
  button:    { fontFamily: 'Figtree_600',   fontSize: 16, lineHeight: 20 },
} as const; // Hindi: same sizes, Anek Devanagari, lineHeight x 1.15
```
