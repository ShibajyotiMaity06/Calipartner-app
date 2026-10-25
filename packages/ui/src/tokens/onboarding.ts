import { type as baseType, type TextStyleToken, type TypeVariant } from './type';

/** The onboarding redesign uses the fonts required by the UI specification. */
export const onboardingType = Object.fromEntries(
  Object.entries(baseType).map(([name, token]) => [
    name,
    {
      ...token,
      fontFamily:
        name.startsWith('numeral') || name.startsWith('title')
          ? 'Bricolage_700'
          : name === 'heading' || name === 'button'
            ? 'Figtree_600'
            : name === 'label' || name === 'micro'
              ? 'Figtree_500'
              : 'Figtree_400',
    },
  ]),
) as Record<TypeVariant, TextStyleToken>;

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
