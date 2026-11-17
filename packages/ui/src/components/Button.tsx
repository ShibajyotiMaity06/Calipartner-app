import { useTheme as useAppearance } from '../theme/useTheme';
import React from 'react';
import {
  Pressable,
  ActivityIndicator,
  View,
  StyleSheet,
  type GestureResponderEvent,
  type ViewStyle,
} from 'react-native';

import { controls } from '../tokens/controls';
import { radius } from '../tokens/radius';
import { space } from '../tokens/space';
import { Text } from './Text';
import { homeLayout } from '../tokens/home';
import { NavigationIcon } from './NavigationIcon';
import { AddIcon } from './AddIcon';

export type ButtonVariant =
  'primary' | 'secondary' | 'tertiary' | 'destructive' | 'destructiveFill';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  fontSet?: 'app' | 'onboarding';
  /** Visual variant */
  variant?: ButtonVariant;
  /** Legacy size hint; all standard actions share a 44px minimum touch target. */
  size?: ButtonSize;
  /** Button text label (verb names the object: e.g. "Add to lunch") */
  label: string;
  labelColor?: string;
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
  size = 'md',
  label,
  labelColor,
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
  const { colors: dark } = useAppearance();

  const isDisabled = disabled || loading;
  const addAction = /^add(?:\s|$)/i.test(label.trim());
  const displayIcon =
    icon ??
    (addAction ? <AddIcon color={variant === 'primary' ? dark.onBrand : dark.textHi} /> : null);
  const navigationAction = /^(?:\u2190\s*)?back$/i.test(label.trim())
    ? 'back'
    : /^close$/i.test(label.trim())
      ? 'close'
      : null;

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
        const h = controls.touch;
        const baseStyle: ViewStyle = {
          minHeight: Math.max(44, h),
          paddingVertical: space[2],
          minWidth: 44,
          paddingHorizontal: space[3],
          borderRadius: radius.button,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          width: navigationAction ? undefined : fullWidth ? '100%' : undefined,
          alignSelf: navigationAction ? 'flex-start' : fullWidth ? 'stretch' : 'flex-start',
        };

        if (navigationAction)
          return [
            baseStyle,
            style,
            {
              width: homeLayout.compactTouchSize,
              minHeight: homeLayout.compactTouchSize,
              minWidth: homeLayout.compactTouchSize,
              padding: space[0],
              paddingHorizontal: space[0],
              paddingVertical: space[0],
              backgroundColor: 'transparent',
              borderRadius: radius.full,
              alignSelf: 'flex-start',
            },
          ];

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
      {navigationAction ? (
        <NavigationIcon action={navigationAction} />
      ) : (
        <View style={[styles.contentRow, { width: '100%', flexShrink: 1 }]}>
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
          ) : displayIcon ? (
            <View style={styles.iconWrap}>{displayIcon}</View>
          ) : null}

          <Text
            fontSet={fontSet}
            variant={size === 'sm' ? 'label' : 'button'}
            color={
              isDisabled
                ? dark.textOff
                : (labelColor ??
                  (variant === 'primary'
                    ? dark.onBrand // Rule U2: On apricot always onBrand (#1C1109), never white
                    : variant === 'secondary'
                      ? dark.textHi
                      : variant === 'tertiary'
                        ? dark.apricot
                        : variant === 'destructive'
                          ? dark.danger
                          : dark.textHi))
            }
            style={[styles.label, { flexShrink: 1 }]}
          >
            {label}
          </Text>

          {!loading && trailingIcon ? (
            <View style={styles.trailingIconWrap}>{trailingIcon}</View>
          ) : null}
        </View>
      )}
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
