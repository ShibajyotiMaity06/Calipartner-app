import React from 'react';
import {
  Pressable,
  ActivityIndicator,
  View,
  StyleSheet,
  type GestureResponderEvent,
  type ViewStyle,
} from 'react-native';
import { dark } from '../tokens/colors';
import { radius } from '../tokens/radius';
import { space } from '../tokens/space';
import { Text } from './Text';

export type ButtonVariant =
  'primary' | 'secondary' | 'tertiary' | 'destructive' | 'destructiveFill';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  fontSet?: 'app' | 'onboarding';
  /** Visual variant */
  variant?: ButtonVariant;
  /** Size variant: sm (36h / 44 hit area), md (44h), lg (56h) */
  size?: ButtonSize;
  /** Button text label (verb names the object: e.g. "Add to lunch") */
  label: string;
  /** Optional icon component or render function */
  icon?: React.ReactNode;
  /** Optional trailing icon */
  trailingIcon?: React.ReactNode;
  /** When true, button stretches to fill parent width */
  fullWidth?: boolean;
  /** Loading state: keeps label visible and shows 16px spinner */
  loading?: boolean;
  /** Disabled state: displays s2 background and textOff label */
  disabled?: boolean;
  /** On press handler */
  onPress?: (event: GestureResponderEvent) => void;
  /** Accessibility label for screen readers */
  accessibilityLabel?: string;
  /** Accessibility hint */
  accessibilityHint?: string;
  /** Test identifier */
  testID?: string;
  /** Custom container style override */
  style?: ViewStyle;
}

export function Button({
  fontSet = 'app',
  variant = 'primary',
  size = 'lg',
  label,
  icon,
  trailingIcon,
  fullWidth = true,
  loading = false,
  disabled = false,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  testID,
  style,
}: ButtonProps): React.JSX.Element {
  const isDisabled = disabled || loading;

  const getHeight = (): number => {
    switch (size) {
      case 'sm':
        return 36;
      case 'md':
        return 44;
      case 'lg':
      default:
        return 56;
    }
  };

  const getPaddingHorizontal = (): number => {
    switch (size) {
      case 'sm':
        return space[3]; // 12
      case 'md':
        return space[4]; // 16
      case 'lg':
      default:
        return space[6]; // 24
    }
  };

  return (
    <Pressable
      onPress={isDisabled ? undefined : onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      testID={testID}
      hitSlop={size === 'sm' ? { top: 4, bottom: 4, left: 4, right: 4 } : undefined}
      style={({ pressed }) => {
        const h = getHeight();
        const baseStyle: ViewStyle = {
          height: fontSet === 'onboarding' ? undefined : h,
          minHeight: fontSet === 'onboarding' ? h : 44,
          paddingVertical: fontSet === 'onboarding' ? space[3] : undefined,
          minWidth: 44,
          paddingHorizontal: getPaddingHorizontal(),
          borderRadius: radius.button,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          width: fullWidth ? '100%' : undefined,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        };

        if (isDisabled) {
          if (variant === 'tertiary') {
            return [baseStyle, { backgroundColor: 'transparent' }, style];
          }
          return [baseStyle, { backgroundColor: dark.s2, borderWidth: 0 }, style];
        }

        switch (variant) {
          case 'primary':
            return [
              baseStyle,
              {
                backgroundColor: pressed ? dark.apricotPressed : dark.apricot,
              },
              style,
            ];
          case 'secondary':
            return [
              baseStyle,
              {
                backgroundColor: pressed ? dark.s3 : 'transparent',
                borderWidth: 1,
                borderColor: dark.hairlineLit,
              },
              style,
            ];
          case 'tertiary':
            return [
              baseStyle,
              {
                backgroundColor: pressed ? dark.s3 : 'transparent',
              },
              style,
            ];
          case 'destructive':
            return [
              baseStyle,
              {
                backgroundColor: pressed ? dark.s3 : 'transparent',
              },
              style,
            ];
          case 'destructiveFill':
            return [
              baseStyle,
              {
                backgroundColor: dark.danger,
                opacity: pressed ? 0.85 : 1,
              },
              style,
            ];
          default:
            return [baseStyle, style];
        }
      }}
    >
      <View
        style={[
          styles.contentRow,
          fontSet === 'onboarding' ? { width: '100%', flexShrink: 1 } : undefined,
        ]}
      >
        {loading ? (
          <ActivityIndicator
            size="small"
            color={
              variant === 'primary'
                ? dark.onBrand
                : variant === 'destructive' || variant === 'destructiveFill'
                  ? dark.textHi
                  : dark.apricot
            }
            style={styles.spinner}
          />
        ) : icon ? (
          <View style={styles.iconWrap}>{icon}</View>
        ) : null}

        <Text
          fontSet={fontSet}
          variant={size === 'sm' ? 'label' : 'button'}
          color={
            isDisabled
              ? dark.textOff
              : variant === 'primary'
                ? dark.onBrand // Rule U2: On apricot always onBrand (#1C1109), never white
                : variant === 'secondary'
                  ? dark.textHi
                  : variant === 'tertiary'
                    ? dark.apricot
                    : variant === 'destructive'
                      ? dark.danger
                      : dark.textHi
          }
          style={[styles.label, fontSet === 'onboarding' ? { flexShrink: 1 } : undefined]}
        >
          {label}
        </Text>

        {!loading && trailingIcon ? (
          <View style={styles.trailingIconWrap}>{trailingIcon}</View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2], // 8
  },
  spinner: {
    width: 16,
    height: 16,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  trailingIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    textAlign: 'center',
  },
});
