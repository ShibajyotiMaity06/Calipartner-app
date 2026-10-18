import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { dark } from '../tokens/colors';
import { radius } from '../tokens/radius';
import { space } from '../tokens/space';
import { Text } from './Text';
import { Button } from './Button';

export type BannerVariant = 'neutral' | 'brand' | 'warning' | 'danger';

export interface BannerProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  variant?: BannerVariant;
  accessibilityLabel?: string;
  testID?: string;
  style?: ViewStyle;
}

export function Banner({
  title,
  subtitle,
  icon,
  actionLabel,
  onAction,
  variant = 'neutral',
  accessibilityLabel,
  testID,
  style,
}: BannerProps): React.JSX.Element {
  const getBorderColor = (): string => {
    switch (variant) {
      case 'brand':
        return dark.apricot;
      case 'danger':
        return dark.danger;
      case 'warning':
        return dark.copper;
      case 'neutral':
      default:
        return dark.hairlineLit;
    }
  };

  return (
    <View
      style={[
        styles.banner,
        {
          borderColor: getBorderColor(),
          backgroundColor: dark.s1,
        },
        style,
      ]}
      accessibilityRole="summary"
      accessibilityLabel={accessibilityLabel ?? title}
      testID={testID}
    >
      <View style={styles.topRow}>
        {icon ? <View style={styles.iconWrap}>{icon}</View> : null}
        <View style={styles.textWrap}>
          <Text variant="heading" color={dark.textHi}>
            {title}
          </Text>
          {subtitle ? (
            <Text variant="bodyS" color={dark.textMid} style={styles.subtitle}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      {actionLabel && onAction ? (
        <View style={styles.actionWrap}>
          <Button
            size="sm"
            variant={variant === 'brand' ? 'primary' : 'secondary'}
            label={actionLabel}
            onPress={onAction}
            testID={testID ? `${testID}-action` : undefined}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: radius.card, // 20
    borderWidth: 1,
    padding: space[4], // 16
    width: '100%',
    gap: space[3], // 12
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[3], // 12
  },
  iconWrap: {
    paddingTop: 2,
  },
  textWrap: {
    flex: 1,
  },
  subtitle: {
    marginTop: space[1], // 4
  },
  actionWrap: {
    alignSelf: 'flex-start',
  },
});
