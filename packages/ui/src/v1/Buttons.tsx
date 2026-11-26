/**
 * CaliPartner Design System v1 — Button Primitives
 * Single source of truth: docs/ui/DESIGN_SYSTEM_V1.md (Section 6.1, 7 & 9)
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../theme/useTheme';
import { ArrowRightIcon, PauseIcon, PlayIcon, PlusIcon } from './Icons';
import { triggerHaptic } from './haptics';
import { usePressScale } from './motion';
import { Text } from './Text';
import { colors, elevation, fonts, radius, space } from './theme';

export interface PrimaryButtonProps {
  title: string;
  onPress?: (event: GestureResponderEvent) => void;
  disabled?: boolean;
  loading?: boolean;
  /** Compact height (40 to 54, default 46; full height is 56) */
  compact?: boolean;
  /** Compact explicit height override within 40..54 */
  compactHeight?: number;
  /** Optional 18 pt trailing arrow or custom icon */
  icon?: React.ReactNode;
  showArrow?: boolean;
  fullWidth?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export function PrimaryButton({
  title,
  onPress,
  disabled = false,
  loading = false,
  compact = false,
  compactHeight = 46,
  icon,
  showArrow = false,
  fullWidth = true,
  accessibilityLabel,
  accessibilityHint,
  testID,
  style,
}: PrimaryButtonProps): React.JSX.Element {
  const { reduceMotion } = useTheme();
  const { scale, onPressIn, onPressOut } = usePressScale(reduceMotion);
  const isDisabled = disabled || loading;

  const resolvedCompactH = Math.min(54, Math.max(40, compactHeight));
  const height = compact ? resolvedCompactH : 56;
  const borderRadius = compact ? Math.round(height / 2) : radius.button;
  const trailing =
    icon ??
    (showArrow ? (
      <ArrowRightIcon size={18} color={isDisabled ? colors.textOff : colors.onBrand} />
    ) : null);

  return (
    <Animated.View
      style={[
        fullWidth && !compact ? styles.stretch : styles.selfStart,
        { transform: [{ scale }] },
        style,
      ]}
    >
      <Pressable
        onPress={isDisabled ? undefined : onPress}
        onPressIn={isDisabled ? undefined : onPressIn}
        onPressOut={isDisabled ? undefined : onPressOut}
        disabled={isDisabled}
        hitSlop={height < 44 ? { top: 4, bottom: 4, left: 4, right: 4 } : undefined}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? title}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        testID={testID}
        style={({ pressed }) => [
          styles.baseButton,
          {
            height,
            borderRadius,
            paddingHorizontal: compact ? space.xl : space.xxl,
            backgroundColor: isDisabled
              ? colors.s3
              : pressed
                ? colors.apricotPressed
                : colors.apricot,
          },
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={isDisabled ? colors.textOff : colors.onBrand} />
        ) : null}
        <Text
          variant={compact ? 'buttonS' : 'buttonL'}
          color={isDisabled ? 'textOff' : 'onBrand'}
          style={
            compact
              ? {
                  fontFamily: fonts.bold,
                  fontSize: 14,
                  color: isDisabled ? colors.textOff : colors.onBrand,
                }
              : undefined
          }
        >
          {title}
        </Text>
        {!loading && trailing ? trailing : null}
      </Pressable>
    </Animated.View>
  );
}

export interface SecondaryButtonProps {
  title: string;
  onPress?: (event: GestureResponderEvent) => void;
  disabled?: boolean;
  size?: 'default' | 'compact52' | 'compact48';
  icon?: React.ReactNode;
  fullWidth?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export function SecondaryButton({
  title,
  onPress,
  disabled = false,
  size = 'default',
  icon,
  fullWidth = true,
  accessibilityLabel,
  testID,
  style,
}: SecondaryButtonProps): React.JSX.Element {
  const { reduceMotion } = useTheme();
  const { scale, onPressIn, onPressOut } = usePressScale(reduceMotion);
  const height = size === 'compact48' ? 48 : size === 'compact52' ? 52 : 56;

  return (
    <Animated.View
      style={[fullWidth ? styles.stretch : styles.selfStart, { transform: [{ scale }] }, style]}
    >
      <Pressable
        onPress={disabled ? undefined : onPress}
        onPressIn={disabled ? undefined : onPressIn}
        onPressOut={disabled ? undefined : onPressOut}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? title}
        accessibilityState={{ disabled }}
        testID={testID}
        style={({ pressed }) => [
          styles.baseButton,
          {
            height,
            borderRadius: radius.button,
            paddingHorizontal: space.xxl,
            borderWidth: 1,
            borderColor: colors.hairline,
            backgroundColor: pressed && !disabled ? colors.s2 : colors.s1,
          },
        ]}
      >
        {icon}
        <Text variant="buttonM" color={disabled ? 'textOff' : 'textHi'}>
          {title}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export interface LinkButtonProps {
  title: string;
  onPress?: (event: GestureResponderEvent) => void;
  variant?: 'default' | 'accent' | 'danger';
  disabled?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export function LinkButton({
  title,
  onPress,
  variant = 'default',
  disabled = false,
  accessibilityLabel,
  testID,
  style,
}: LinkButtonProps): React.JSX.Element {
  const [pressed, setPressed] = useState(false);
  const textColor = disabled
    ? colors.textOff
    : variant === 'danger'
      ? colors.danger
      : variant === 'accent'
        ? pressed
          ? colors.apricotPressed
          : colors.apricot
        : pressed
          ? colors.textMid
          : colors.textLo;

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={disabled}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled }}
      testID={testID}
      style={[styles.linkButton, style]}
    >
      <Text
        variant="buttonS"
        style={{
          fontFamily: variant === 'accent' ? fonts.bold : fonts.semibold,
          fontSize: 14,
          color: textColor,
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}

export interface IconButtonProps {
  icon: React.ReactNode;
  onPress?: (event: GestureResponderEvent) => void;
  size?: 44 | 40 | 36;
  inSheet?: boolean;
  variant?: 'default' | 'glass';
  disabled?: boolean;
  accessibilityLabel: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export function IconButton({
  icon,
  onPress,
  size = 44,
  inSheet = false,
  variant = 'default',
  disabled = false,
  accessibilityLabel,
  testID,
  style,
}: IconButtonProps): React.JSX.Element {
  const { reduceMotion } = useTheme();
  const { scale, onPressIn, onPressOut } = usePressScale(reduceMotion);
  const pad = size < 44 ? Math.ceil((44 - size) / 2) : 0;
  const idleBg = variant === 'glass' ? colors.glass : inSheet ? colors.s2 : colors.s1;

  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius: radius.full,
          overflow: 'hidden',
          transform: [{ scale }],
        },
        style,
      ]}
    >
      <Pressable
        onPress={disabled ? undefined : onPress}
        onPressIn={disabled ? undefined : onPressIn}
        onPressOut={disabled ? undefined : onPressOut}
        disabled={disabled}
        hitSlop={pad > 0 ? { top: pad, bottom: pad, left: pad, right: pad } : undefined}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled }}
        testID={testID}
        style={({ pressed }) => [
          styles.roundCenter,
          {
            width: size,
            height: size,
            borderRadius: radius.full,
            borderWidth: 1,
            borderColor: colors.hairline,
            backgroundColor: pressed && !disabled ? colors.s2 : idleBg,
            opacity: disabled ? 0.5 : 1,
          },
        ]}
      >
        {icon}
      </Pressable>
    </Animated.View>
  );
}

export interface AddButtonProps {
  onPress?: (event: GestureResponderEvent) => void;
  size?: 36 | 30;
  filled?: boolean;
  disabled?: boolean;
  accessibilityLabel: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export function AddButton({
  onPress,
  size = 36,
  filled = false,
  disabled = false,
  accessibilityLabel,
  testID,
  style,
}: AddButtonProps): React.JSX.Element {
  const { reduceMotion } = useTheme();
  const { scale, onPressIn, onPressOut } = usePressScale(reduceMotion);
  const pad = Math.ceil((44 - size) / 2);

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        onPress={disabled ? undefined : onPress}
        onPressIn={disabled ? undefined : onPressIn}
        onPressOut={disabled ? undefined : onPressOut}
        disabled={disabled}
        hitSlop={{ top: pad, bottom: pad, left: pad, right: pad }}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled }}
        testID={testID}
        style={({ pressed }) => [
          styles.roundCenter,
          {
            width: size,
            height: size,
            borderRadius: radius.full,
            backgroundColor: filled
              ? pressed && !disabled
                ? colors.apricotPressed
                : colors.apricot
              : pressed && !disabled
                ? colors.s2
                : colors.s3,
            opacity: disabled ? 0.5 : 1,
          },
        ]}
      >
        <PlusIcon size={size === 30 ? 16 : 18} color={filled ? colors.onBrand : colors.apricot} />
      </Pressable>
    </Animated.View>
  );
}

export interface QuantityButtonProps {
  glyph: string;
  onPress?: (event: GestureResponderEvent) => void;
  size?: 44 | 56 | 40 | 36;
  disabled?: boolean;
  accessibilityLabel: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export function QuantityButton({
  glyph,
  onPress,
  size = 44,
  disabled = false,
  accessibilityLabel,
  testID,
  style,
}: QuantityButtonProps): React.JSX.Element {
  const { reduceMotion } = useTheme();
  const { scale, onPressIn, onPressOut } = usePressScale(reduceMotion);
  const pad = size < 44 ? Math.ceil((44 - size) / 2) : 0;

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        onPress={disabled ? undefined : onPress}
        onPressIn={disabled ? undefined : onPressIn}
        onPressOut={disabled ? undefined : onPressOut}
        disabled={disabled}
        hitSlop={pad > 0 ? { top: pad, bottom: pad, left: pad, right: pad } : undefined}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled }}
        testID={testID}
        style={({ pressed }) => [
          styles.roundCenter,
          {
            width: size,
            height: size,
            borderRadius: radius.full,
            borderWidth: 1,
            borderColor: colors.hairlineLit,
            backgroundColor: pressed && !disabled ? colors.s2 : 'transparent',
            opacity: disabled ? 0.5 : 1,
          },
        ]}
      >
        <Text
          style={{
            fontFamily: fonts.medium,
            fontSize: size === 56 ? 15 : 22,
            lineHeight: size === 56 ? 18 : 24,
            color: colors.textHi,
          }}
        >
          {glyph}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export interface SocialButtonProps {
  provider: 'apple' | 'google';
  title: string;
  icon: React.ReactNode;
  onPress?: (event: GestureResponderEvent) => void;
  loading?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export function SocialButton({
  provider,
  title,
  icon,
  onPress,
  loading = false,
  disabled = false,
  accessibilityLabel,
  testID,
  style,
}: SocialButtonProps): React.JSX.Element {
  const { reduceMotion } = useTheme();
  const { scale, onPressIn, onPressOut } = usePressScale(reduceMotion);
  const isApple = provider === 'apple';
  const isDisabled = disabled || loading;

  return (
    <Animated.View style={[styles.stretch, { transform: [{ scale }] }, style]}>
      <Pressable
        onPress={isDisabled ? undefined : onPress}
        onPressIn={isDisabled ? undefined : onPressIn}
        onPressOut={isDisabled ? undefined : onPressOut}
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? title}
        accessibilityState={{ busy: loading, disabled: isDisabled }}
        testID={testID}
        style={({ pressed }) => [
          styles.baseButton,
          {
            height: 56,
            borderRadius: radius.button,
            paddingHorizontal: space.xxl,
            borderWidth: isApple ? 0 : 1,
            borderColor: isApple ? undefined : colors.hairline,
            backgroundColor: isApple ? colors.textHi : pressed ? colors.s2 : colors.s1,
            opacity: isDisabled ? 0.6 : isApple && pressed ? 0.9 : 1,
          },
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={isApple ? colors.onBrand : colors.textHi} />
        ) : (
          icon
        )}
        <Text
          variant="buttonM"
          style={{
            fontFamily: fonts.bold,
            fontSize: 15,
            color: isApple ? colors.onBrand : colors.textHi,
          }}
        >
          {title}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export interface StartButtonProps {
  title?: string;
  onPress?: (event: GestureResponderEvent) => void;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/** Live cardio Start button: 112 pt apricot circle with 10 pt (12%) & 22 pt (6%) soft rings. */
export function StartButton({
  title = 'Start',
  onPress,
  accessibilityLabel = 'Start session',
  testID,
  style,
}: StartButtonProps): React.JSX.Element {
  const { reduceMotion } = useTheme();
  const { scale, onPressIn, onPressOut } = usePressScale(reduceMotion);
  const haloAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      haloAnim.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(haloAnim, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(haloAnim, { toValue: 0, duration: 1400, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, haloAnim]);

  const outerScale = haloAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });

  return (
    <View style={[styles.startWrap, style]}>
      <Animated.View
        pointerEvents="none"
        style={[styles.startHaloOuter, { transform: [{ scale: outerScale }] }]}
      />
      <View pointerEvents="none" style={styles.startHaloInner} />
      <Animated.View style={{ transform: [{ scale }] }}>
        <Pressable
          onPress={(e) => {
            triggerHaptic('medium');
            onPress?.(e);
          }}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          testID={testID}
          style={({ pressed }) => [
            styles.roundCenter,
            {
              width: 112,
              height: 112,
              borderRadius: radius.full,
              backgroundColor: pressed ? colors.apricotPressed : colors.apricot,
            },
          ]}
        >
          <Text
            style={{
              fontFamily: fonts.extrabold,
              fontSize: 18,
              lineHeight: 22,
              color: colors.onBrand,
            }}
          >
            {title}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

export interface PauseButtonProps {
  paused?: boolean;
  onPress?: (event: GestureResponderEvent) => void;
  size?: number;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export function PauseButton({
  paused = false,
  onPress,
  size = 80,
  accessibilityLabel,
  testID,
  style,
}: PauseButtonProps): React.JSX.Element {
  const { reduceMotion } = useTheme();
  const { scale, onPressIn, onPressOut } = usePressScale(reduceMotion);
  const clamped = Math.min(88, Math.max(76, size));

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? (paused ? 'Resume' : 'Pause')}
        testID={testID}
        style={({ pressed }) => [
          styles.roundCenter,
          {
            width: clamped,
            height: clamped,
            borderRadius: radius.full,
            backgroundColor: pressed ? colors.apricotPressed : colors.apricot,
          },
        ]}
      >
        {paused ? (
          <PlayIcon size={32} color={colors.onBrand} />
        ) : (
          <PauseIcon size={32} color={colors.onBrand} />
        )}
      </Pressable>
    </Animated.View>
  );
}

export interface LogFabButtonProps {
  onPress?: (event: GestureResponderEvent) => void;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export function LogFabButton({
  onPress,
  accessibilityLabel = 'Log activity',
  testID,
  style,
}: LogFabButtonProps): React.JSX.Element {
  const { reduceMotion } = useTheme();
  const { scale, onPressIn, onPressOut } = usePressScale(reduceMotion);

  return (
    <Animated.View
      style={[styles.logFabCircle, { transform: [{ scale }] }, elevation.logButton, style]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        testID={testID}
        style={({ pressed }) => [
          styles.roundCenter,
          styles.logFabPress,
          {
            backgroundColor: pressed ? colors.apricotPressed : colors.apricot,
          },
        ]}
      >
        <PlusIcon size={28} strokeWidth={2.6} color={colors.onBrand} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stretch: {
    width: '100%',
  },
  selfStart: {
    alignSelf: 'flex-start',
  },
  baseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  linkButton: {
    minHeight: 44,
    padding: space.sm,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    alignItems: 'center',
  },
  roundCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logFabCircle: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: colors.apricot,
  },
  logFabPress: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
  },
  startWrap: {
    width: 156,
    height: 156,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startHaloOuter: {
    position: 'absolute',
    width: 156,
    height: 156,
    borderRadius: radius.full,
    backgroundColor: colors.apricotGlowSoft,
  },
  startHaloInner: {
    position: 'absolute',
    width: 132,
    height: 132,
    borderRadius: radius.full,
    backgroundColor: colors.apricotGlowLow,
  },
});
