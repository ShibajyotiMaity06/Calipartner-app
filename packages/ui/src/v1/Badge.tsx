/**
 * CaliPartner Design System v1 — Badges
 * Single source of truth: docs/ui/DESIGN_SYSTEM_V1.md (Section 6.8)
 */
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from './Text';
import { borders, colors, fonts } from './theme';

export type BadgeVariant = 'pro' | 'new' | 'bestValue' | 'invertedPro' | 'outlinePro' | 'current';

export interface BadgeProps {
  label?: string;
  variant?: BadgeVariant;
  mini?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

const DEFAULT_LABELS: Record<BadgeVariant, string> = {
  pro: 'PRO',
  new: 'NEW',
  bestValue: 'BEST VALUE',
  invertedPro: 'PRO',
  outlinePro: 'PRO',
  current: 'CURRENT',
};

export function Badge({
  label,
  variant = 'pro',
  mini = false,
  testID,
  style,
}: BadgeProps): React.JSX.Element {
  const displayLabel = label ?? DEFAULT_LABELS[variant];

  const isInverted = variant === 'invertedPro';
  const isOutline = variant === 'outlinePro';
  const isCurrent = variant === 'current';

  const backgroundColor = isInverted
    ? colors.onBrand
    : isOutline
      ? 'transparent'
      : isCurrent
        ? colors.s3
        : colors.apricot;

  const textColor =
    isInverted || isOutline ? colors.apricot : isCurrent ? colors.textMid : colors.onBrand;

  const fontSize = mini ? 9 : 11;
  const lineHeight = mini ? 11 : 14;

  return (
    <View
      testID={testID}
      style={[
        styles.badge,
        {
          paddingVertical: mini ? 2 : 3,
          paddingHorizontal: mini ? 5 : 9,
          backgroundColor,
          borderWidth: isOutline ? borders.width : 0,
          borderColor: isOutline ? colors.hairlineLit : undefined,
        },
        style,
      ]}
    >
      <Text
        allowFontScaling={false}
        style={{
          fontFamily: fonts.extrabold,
          fontSize,
          lineHeight,
          letterSpacing: Math.round(fontSize * 0.04 * 10) / 10,
          color: textColor,
        }}
      >
        {displayLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 10,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
