import { type as baseType, type TextStyleToken, type TypeVariant } from './type';

/** The onboarding redesign uses the fonts required by the UI specification. */
export const onboardingType: Record<TypeVariant, TextStyleToken> = baseType;

/** Layout and chart geometry shared by the onboarding views. */
export const onboardingLayout = {
  contentWidth: 640,
  touch: 48,
  logo: 112,
  ring: 164,
  ringStroke: 12,
  icon: 24,
  border: 1,
  entryWidth: 420,
  entryLogo: 64,
  chartHeight: 132,
  chartStroke: 2,
  chartDot: 5,
  chartActiveDot: 8,
  previewBar: 6,
  previewAvatar: 32,
} as const;
