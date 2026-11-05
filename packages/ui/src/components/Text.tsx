import React from 'react';
import {
  StyleSheet,
  Text as RNText,
  type TextProps as RNTextProps,
  type TextStyle,
} from 'react-native';
import { dark, nutritionColors, type NutritionMetric } from '../tokens/colors';
import { onboardingType } from '../tokens/onboarding';
import {
  type as typeTokens,
  latinFonts,
  typeHindi,
  type TypeVariant,
  type TextStyleToken,
} from '../tokens/type';

export interface TextProps extends RNTextProps {
  fontSet?: 'app' | 'onboarding';
  /** Typographic scale variant */
  variant?: TypeVariant;
  /** Color token key (e.g. 'textHi', 'textMid', 'apricot', 'onBrand') or color hex string */
  color?: keyof typeof dark | string;
  nutrient?: NutritionMetric;
  /** When true, renders with Devanagari typography with 1.15x line height */
  isHindi?: boolean;
  /** Explicitly enforce or disable tabular numerals */
  tabular?: boolean;
}

/**
 * CaliPartner Text component.
 * Applies strict token typography, tabular figures on numeral variants,
 * supports system text scaling to 200%, with tabular figures where requested.
 */
export function Text({
  fontSet = 'app',
  variant = 'body',
  color,
  nutrient,
  isHindi = false,
  tabular,
  allowFontScaling = true,
  maxFontSizeMultiplier,
  style,
  children,
  ...rest
}: TextProps): React.JSX.Element {
  const tokenSpec: TextStyleToken = isHindi
    ? typeHindi[variant]
    : fontSet === 'onboarding'
      ? onboardingType[variant]
      : (typeTokens[variant] as TextStyleToken);

  // Resolve color
  let resolvedColor: string;
  if (!color) {
    if (variant.startsWith('numeral') || variant.startsWith('title') || variant === 'heading') {
      resolvedColor = dark.textHi;
    } else {
      resolvedColor = dark.textMid;
    }
  } else if (color in dark) {
    resolvedColor = dark[color as keyof typeof dark];
  } else {
    resolvedColor = color;
  }

  // Determine tabular numbers
  const hasTabular =
    tabular !== undefined ? tabular : Boolean(tokenSpec.fontVariant?.includes('tabular-nums'));

  const effectiveMaxMultiplier = maxFontSizeMultiplier ?? 2;

  const customStyle = StyleSheet.flatten(style);
  const weight = customStyle?.fontWeight;
  const weightedFont =
    weight === 'bold' || Number(weight) >= 700
      ? Number(weight) >= 800
        ? latinFonts.extrabold
        : latinFonts.bold
      : Number(weight) >= 600
        ? latinFonts.semibold
        : Number(weight) >= 500
          ? latinFonts.medium
          : undefined;
  const fontStyle: TextStyle = {
    fontFamily: !isHindi && weightedFont ? weightedFont : tokenSpec.fontFamily,
    fontSize: tokenSpec.fontSize,
    lineHeight:
      customStyle?.fontSize && customStyle.lineHeight == null
        ? Math.ceil((customStyle.fontSize * tokenSpec.lineHeight) / tokenSpec.fontSize)
        : tokenSpec.lineHeight,
    color: resolvedColor,
    ...(hasTabular ? { fontVariant: ['tabular-nums'] } : {}),
  };

  return (
    <RNText
      allowFontScaling={allowFontScaling}
      maxFontSizeMultiplier={effectiveMaxMultiplier}
      style={[
        fontStyle,
        style,
        nutrient &&
        resolvedColor !== dark.onBrand &&
        customStyle?.color !== dark.onBrand &&
        rest.accessibilityRole !== 'alert'
          ? { color: nutritionColors[nutrient] }
          : null,
        !isHindi ? { fontFamily: fontStyle.fontFamily, fontWeight: 'normal' } : null,
      ]}
      {...rest}
    >
      {children}
    </RNText>
  );
}

// Convenience sub-components
Text.NumeralXL = (props: Omit<TextProps, 'variant'>) => <Text variant="numeralXL" {...props} />;
Text.NumeralL = (props: Omit<TextProps, 'variant'>) => <Text variant="numeralL" {...props} />;
Text.NumeralM = (props: Omit<TextProps, 'variant'>) => <Text variant="numeralM" {...props} />;
Text.Title1 = (props: Omit<TextProps, 'variant'>) => <Text variant="title1" {...props} />;
Text.Title2 = (props: Omit<TextProps, 'variant'>) => <Text variant="title2" {...props} />;
Text.Heading = (props: Omit<TextProps, 'variant'>) => <Text variant="heading" {...props} />;
Text.Body = (props: Omit<TextProps, 'variant'>) => <Text variant="body" {...props} />;
Text.BodyS = (props: Omit<TextProps, 'variant'>) => <Text variant="bodyS" {...props} />;
Text.Label = (props: Omit<TextProps, 'variant'>) => <Text variant="label" {...props} />;
Text.Micro = (props: Omit<TextProps, 'variant'>) => <Text variant="micro" {...props} />;
Text.Button = (props: Omit<TextProps, 'variant'>) => <Text variant="button" {...props} />;
