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
} as const;
