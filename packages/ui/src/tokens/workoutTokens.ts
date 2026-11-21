/**
 * CaliPartner Workout Redesign Tokens
 * Source of truth: Workout Redesign Specification & PDF (S00 to S32)
 */

export const workoutColors = {
  background: '#14110F',
  card: '#1D1916',
  inset: '#26211E',
  selected: '#2F2924',
  border: '#342E2A',
  borderStrong: '#4A423C',
  text: '#F5EFE9',
  muted: '#A89F96',
  dim: '#948B83',
  accent: '#F4B684',
  accentSoft: 'rgba(244, 182, 132, 0.14)',
  onAccent: '#1B130C',
  success: '#86D3A0',
  danger: '#F28B82',
  scrim: 'rgba(8, 6, 5, 0.68)',
} as const;

export const workoutTokens = workoutColors;

export const workoutRadius = {
  none: 0,
  dot: 2,
  bar: 3,
  indicator: 4,
  badge: 11,
  control: 12,
  input: 14,
  row: 16,
  circleSmall: 17,
  chip: 18,
  card: 20,
  circleMedium: 22,
  cardLg: 24,
  button: 16,
  sheet: 28,
  circleLarge: 32,
  full: 999,
} as const;
