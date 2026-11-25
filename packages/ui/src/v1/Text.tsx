/**
 * CaliPartner Design System v1 — Typography Primitives
 * Single source of truth: docs/ui/DESIGN_SYSTEM_V1.md (Section 3 & Section 8)
 */
import React from 'react';
import {
  StyleSheet,
  Text as RNText,
  View,
  type StyleProp,
  type TextProps as RNTextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { colors, fonts, space, type DSColorToken, type DSTypeVariant, type } from './theme';

export interface TextProps extends RNTextProps {
  /** Design System v1 typographic variant */
  variant?: DSTypeVariant;
  /** Core color token key or color string */
  color?: DSColorToken | (string & {});
  /** Enforce Fraunces italic accent font */
  italic?: boolean;
  /** Explicitly enforce or disable tabular figures */
  tabular?: boolean;
}

export function resolveColor(
  color: DSColorToken | (string & {}) | undefined,
  fallback: string,
): string {
  if (!color) return fallback;
  if (color in colors) return colors[color as DSColorToken];
  return color;
}

/**
 * Design System v1 Text component.
 * Uses static Fraunces and Manrope family names without fontWeight,
 * caps display numbers at 1.2x font scaling, and supports tabular-nums.
 */
export function Text({
  variant = 'body',
  color,
  italic = false,
  tabular,
  allowFontScaling = true,
  maxFontSizeMultiplier,
  style,
  children,
  ...rest
}: TextProps): React.JSX.Element {
  const spec = type[variant];
  const specVariant = 'fontVariant' in spec ? spec.fontVariant : undefined;
  const specTextTransform = 'textTransform' in spec ? spec.textTransform : undefined;
  const isDisplay = 'isDisplay' in spec ? Boolean(spec.isDisplay) : false;

  const resolvedColor = resolveColor(color, spec.color);
  const effectiveMaxMultiplier = maxFontSizeMultiplier ?? (isDisplay ? 1.2 : 2);
  const useTabular = tabular ?? Boolean(specVariant?.includes('tabular-nums'));
  const fontFamily = italic && isDisplay ? fonts.displayItalic : spec.fontFamily;

  const flatStyle = StyleSheet.flatten(style) as TextStyle | undefined;
  const baseStyle: TextStyle = {
    fontFamily,
    fontSize: spec.fontSize,
    lineHeight:
      flatStyle?.fontSize && flatStyle.lineHeight == null
        ? Math.round((flatStyle.fontSize * spec.lineHeight) / spec.fontSize)
        : spec.lineHeight,
    letterSpacing: spec.letterSpacing,
    color: resolvedColor,
    ...(specTextTransform ? { textTransform: specTextTransform } : {}),
    ...(useTabular ? { fontVariant: ['tabular-nums'] } : {}),
  };

  return (
    <RNText
      allowFontScaling={allowFontScaling}
      maxFontSizeMultiplier={effectiveMaxMultiplier}
      style={[baseStyle, style, { fontFamily: flatStyle?.fontFamily ?? fontFamily }]}
      {...rest}
    >
      {children}
    </RNText>
  );
}

export interface NumberWithUnitProps {
  /** Formatted number string or numeric value */
  value: string | number;
  /** Unit label shown beside the number in Manrope textLo at ~45% size (e.g. 'kg', 'kcal', 'ml') */
  unit: string;
  /** Numeric Fraunces variant */
  variant?: 'displayXL' | 'numXL' | 'numL' | 'numM' | 'numS';
  color?: DSColorToken | (string & {});
  tabular?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Renders a big Fraunces display number paired with a Manrope textLo unit
 * scaled at ~45% of the value's font size (Section 3 rule).
 */
export function NumberWithUnit({
  value,
  unit,
  variant = 'numL',
  color = 'textHi',
  tabular = true,
  style,
  testID,
}: NumberWithUnitProps): React.JSX.Element {
  const numberSize = type[variant].fontSize;
  const unitSize = Math.max(12, Math.round(numberSize * 0.45));
  const unitLineHeight = Math.round(unitSize * 1.15);

  return (
    <View style={[styles.unitRow, style]} testID={testID}>
      <Text variant={variant} color={color} tabular={tabular}>
        {value}
      </Text>
      <Text
        variant="meta"
        color="textLo"
        maxFontSizeMultiplier={1.2}
        style={{
          fontFamily: fonts.medium,
          fontSize: unitSize,
          lineHeight: unitLineHeight,
          marginLeft: space.sm,
        }}
      >
        {unit}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  unitRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
});
