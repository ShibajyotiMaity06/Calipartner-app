/** Owner supplied launch artwork and picker geometry. */
export const entryLayout = {
  logoMax: 380,
  logoViewport: 0.72,
  titleSize: 28,
  titleLine: 36,
  taglineSize: 16,
  taglineLine: 24,
  taglineOpacity: 0.85,
  wheelRow: 48,
  wheelRows: 3,
  rulerTick: 12,
  rulerHeight: 88,
  rulerShort: 16,
  rulerLong: 32,
  guide: 2,
  chartWidth: 400,
  chartHeight: 340,
  pressScale: 0.985,
  pressDuration: 120,
} as const;

export const entryFonts = {
  display: 'Bricolage_700',
  button: 'Figtree_600',
} as const;
