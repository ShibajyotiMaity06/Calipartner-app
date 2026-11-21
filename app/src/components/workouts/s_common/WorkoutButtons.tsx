import React from 'react';
import { StyleSheet, Text, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { workoutTokens, workoutRadius } from '@calipartner/ui';

interface ButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
  compact?: boolean;
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  style,
  testID = 'workout-primary-button',
  accessibilityLabel,
  compact = false,
}: ButtonProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.primaryBase,
        compact ? styles.primaryCompact : styles.primaryNormal,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text style={styles.primaryText}>{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  onPress,
  disabled,
  style,
  testID = 'workout-secondary-button',
  accessibilityLabel,
  compact = false,
}: ButtonProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.secondaryBase,
        compact ? styles.secondaryCompact : styles.secondaryNormal,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text style={styles.secondaryText}>{label}</Text>
    </Pressable>
  );
}

export function DangerButton({
  label,
  onPress,
  disabled,
  style,
  testID = 'workout-danger-button',
  accessibilityLabel,
}: ButtonProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.dangerBase, disabled && styles.disabled, style]}
    >
      <Text style={styles.dangerText}>{label}</Text>
    </Pressable>
  );
}

export function TextButton({
  label,
  onPress,
  disabled,
  testID = 'workout-text-button',
  accessibilityLabel,
}: ButtonProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={12}
      style={styles.textButton}
    >
      <Text style={styles.textButtonLabel}>{label}</Text>
    </Pressable>
  );
}

interface StickyCtaBarProps {
  children: React.ReactNode;
  testID?: string;
}

export function StickyCtaBar({ children, testID = 'workout-sticky-cta' }: StickyCtaBarProps) {
  return (
    <View style={styles.stickyBar} testID={testID}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  primaryBase: {
    backgroundColor: workoutTokens.accent,
    borderRadius: workoutRadius.button,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  primaryNormal: {
    height: 56,
    paddingHorizontal: 20,
  },
  primaryCompact: {
    height: 48,
    paddingHorizontal: 16,
  },
  primaryText: {
    color: workoutTokens.onAccent,
    fontSize: 17,
    fontWeight: '800',
  },
  secondaryBase: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: workoutTokens.borderStrong,
    borderRadius: workoutRadius.button,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  secondaryNormal: {
    height: 56,
    paddingHorizontal: 20,
  },
  secondaryCompact: {
    height: 48,
    paddingHorizontal: 16,
  },
  secondaryText: {
    color: workoutTokens.text,
    fontSize: 17,
    fontWeight: '700',
  },
  dangerBase: {
    backgroundColor: workoutTokens.danger,
    borderRadius: workoutRadius.button,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    height: 52,
    paddingHorizontal: 20,
  },
  dangerText: {
    color: workoutTokens.background,
    fontSize: 16,
    fontWeight: '800',
  },
  textButton: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  textButtonLabel: {
    color: workoutTokens.accent,
    fontSize: 15,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.45,
  },
  stickyBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: workoutTokens.background,
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 26,
    borderTopWidth: 1,
    borderTopColor: workoutTokens.border,
  },
});
