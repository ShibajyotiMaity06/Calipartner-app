import { useTheme as useAppearance } from '../theme/useTheme';
import React, { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  Animated,
  ActivityIndicator,
  View,
  StyleSheet,
  type GestureResponderEvent,
  type ViewStyle,
  type StyleProp,
  type PressableProps,
} from 'react-native';

import { controls } from '../tokens/controls';
import { radius } from '../tokens/radius';
import { space } from '../tokens/space';
import { Text } from './Text';
import { homeLayout } from '../tokens/home';
import { NavigationIcon } from './NavigationIcon';
import { AddIcon } from './AddIcon';
import { entryLayout } from '../tokens/entry';

export type ButtonVariant =
  'primary' | 'secondary' | 'tertiary' | 'destructive' | 'destructiveFill';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
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
  iconOnly?: boolean;
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
  style?: StyleProp<ViewStyle>;
}

export function Button({
  fontSet = 'app',
  variant = 'primary',
  size = 'md',
  label,
  labelColor,
  icon,
  trailingIcon,
  iconOnly = false,
  fullWidth = true,
  loading = false,
  disabled = false,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  testID,
  style,
  onPressIn,
  onPressOut,
  accessibilityState,
  ...rest
}: ButtonProps): React.JSX.Element {
  const { colors: dark, reduceMotion } = useAppearance();
  const [pressActive, setPressActive] = useState(false);
  const feedback = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.timing(feedback, {
      toValue: pressActive && !disabled && !loading ? 1 : 0,
      duration: reduceMotion ? 0 : entryLayout.pressDuration,
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [pressActive, disabled, loading, reduceMotion, feedback]);

  const isDisabled = disabled || loading;
  const addAction = /^add(?:\s|$)/i.test(label.trim());
  const suppliedIcon =
    icon && variant === 'primary' && React.isValidElement<{ color?: string }>(icon)
      ? React.cloneElement(icon, { color: dark.onBrand })
      : icon;
  const displayIcon =
    suppliedIcon ??
    (addAction ? <AddIcon color={variant === 'primary' ? dark.onBrand : dark.textHi} /> : null);
  const navigationAction = /^(?:\u2190\s*)?back$/i.test(label.trim())
    ? 'back'
    : /^close$/i.test(label.trim())
      ? 'close'
      : null;

  return (
    <Pressable
      {...rest}
      onPressIn={(event) => {
        setPressActive(true);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        setPressActive(false);
        onPressOut?.(event);
      }}
      onPress={isDisabled ? undefined : onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ ...accessibilityState, disabled: isDisabled, busy: loading }}
      testID={testID}
      hitSlop={size === 'sm' ? { top: 4, bottom: 4, left: 4, right: 4 } : undefined}
      style={() => {
        const pressed = pressActive && !isDisabled;
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
          width: navigationAction || iconOnly ? undefined : fullWidth ? '100%' : undefined,
          alignSelf:
            navigationAction || iconOnly ? 'flex-start' : fullWidth ? 'stretch' : 'flex-start',
          transform: [{ scale: pressed && !reduceMotion ? entryLayout.pressScale : 1 }],
        };

        // Layout overrides may not change the common shape, touch area or feedback.
        const layoutStyle = StyleSheet.flatten(style) ?? {};
        const {
          borderRadius: _radius,
          borderTopLeftRadius: _topLeft,
          borderTopRightRadius: _topRight,
          borderBottomLeftRadius: _bottomLeft,
          borderBottomRightRadius: _bottomRight,
          minHeight: _height,
          minWidth: _width,
          height: _fixedHeight,
          maxHeight: _maxHeight,
          backgroundColor: _background,
          transform: _transform,
          borderWidth: _border,
          borderColor: _borderColor,
          ...customStyle
        } = layoutStyle;
        if (navigationAction || iconOnly)
          return [
            baseStyle,
            customStyle,
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
            return [customStyle, baseStyle, { backgroundColor: 'transparent' }];
          }
          return [baseStyle, customStyle, { backgroundColor: dark.s2, borderWidth: 0 }];
        }

        switch (variant) {
          case 'primary':
            return [
              baseStyle,
              {
                backgroundColor: dark.apricot,
              },
              customStyle,
            ];
          case 'secondary':
            return [
              baseStyle,
              {
                backgroundColor: accessibilityState?.selected ? dark.s3 : 'transparent',
                borderWidth: 1,
                borderColor: accessibilityState?.selected ? dark.selection : dark.hairlineLit,
              },
              customStyle,
            ];
          case 'tertiary':
            return [
              baseStyle,
              {
                backgroundColor: 'transparent',
              },
              customStyle,
            ];
          case 'destructive':
            return [
              baseStyle,
              {
                backgroundColor: 'transparent',
              },
              customStyle,
            ];
          case 'destructiveFill':
            return [
              baseStyle,
              {
                backgroundColor: dark.danger,
                opacity: pressed ? 0.85 : 1,
              },
              customStyle,
            ];
          default:
            return [baseStyle, customStyle];
        }
      }}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: navigationAction || iconOnly ? radius.full : radius.button,
            backgroundColor:
              variant === 'primary'
                ? dark.apricotPressed
                : variant === 'destructiveFill'
                  ? dark.danger
                  : dark.s3,
            opacity: feedback,
          },
        ]}
      />
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

          {!iconOnly ? (
            <Text
              fontSet={fontSet}
              variant="button"
              color={
                isDisabled
                  ? dark.textOff
                  : variant === 'primary'
                    ? dark.onBrand // Rule U2: On apricot always onBrand (#1C1109), never white
                    : variant === 'secondary'
                      ? (labelColor ?? dark.textHi)
                      : variant === 'tertiary'
                        ? (labelColor ?? dark.actionInk)
                        : variant === 'destructive'
                          ? dark.danger
                          : dark.onDanger
              }
              style={[styles.label, { flexShrink: 1 }]}
            >
              {label}
            </Text>
          ) : null}

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
