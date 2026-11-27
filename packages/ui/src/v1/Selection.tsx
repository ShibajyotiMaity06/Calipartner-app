/**
 * CaliPartner Design System v1 — Selection Controls
 * Single source of truth: docs/ui/DESIGN_SYSTEM_V1.md (Section 6.3 & 7)
 */
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../theme/useTheme';
import { CheckIcon } from './Icons';
import { triggerHaptic } from './haptics';
import { motion, usePressScale } from './motion';
import { Text } from './Text';
import { borders, colors, radius, space } from './theme';

export interface SwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  accessibilityLabel: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/** 50 x 30 switch, radius 15, knob 24 with 3 inset (Section 6.3). */
export function Switch({
  value,
  onValueChange,
  disabled = false,
  accessibilityLabel,
  testID,
  style,
}: SwitchProps): React.JSX.Element {
  const { reduceMotion } = useTheme();
  const knobOffset = useRef(new Animated.Value(value ? 20 : 0)).current;

  useEffect(() => {
    const toValue = value ? 20 : 0;
    if (reduceMotion) {
      knobOffset.setValue(toValue);
      return;
    }
    Animated.timing(knobOffset, {
      toValue,
      duration: motion.press.duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [value, reduceMotion, knobOffset]);

  return (
    <Pressable
      onPress={() => {
        if (disabled) return;
        triggerHaptic('light');
        onValueChange(!value);
      }}
      disabled={disabled}
      hitSlop={{ top: 7, bottom: 7, left: 4, right: 4 }}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      testID={testID}
      style={[
        styles.switchTrack,
        {
          backgroundColor: value ? colors.apricot : colors.s3,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.switchKnob,
          {
            backgroundColor: value ? colors.onBrand : colors.textLo,
            transform: [{ translateX: knobOffset }],
          },
        ]}
      />
    </Pressable>
  );
}

export interface CheckboxProps {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  round?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/** 24 pt checkbox, radius 8 (or 12 round), 1.5 hairlineLit when unchecked. */
export function Checkbox({
  checked,
  onChange,
  round = false,
  disabled = false,
  accessibilityLabel,
  testID,
  style,
}: CheckboxProps): React.JSX.Element {
  const boxRadius = round ? 12 : radius.checkbox;

  const box = (
    <View
      style={[
        styles.checkbox,
        {
          borderRadius: boxRadius,
          borderWidth: checked ? 0 : borders.selectedWidth,
          borderColor: colors.hairlineLit,
          backgroundColor: checked ? colors.apricot : 'transparent',
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {checked ? <CheckIcon size={14} strokeWidth={2.4} color={colors.onBrand} /> : null}
    </View>
  );

  if (!onChange) return box;

  return (
    <Pressable
      onPress={() => {
        if (disabled) return;
        triggerHaptic('light');
        onChange(!checked);
      }}
      disabled={disabled}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked, disabled }}
      testID={testID}
    >
      {box}
    </Pressable>
  );
}

export interface RadioProps {
  selected: boolean;
  onSelect?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/** 22 pt radio, 1.5 hairlineLit -> selected 6 pt apricot ring around onBrand center. */
export function Radio({
  selected,
  onSelect,
  disabled = false,
  accessibilityLabel,
  testID,
  style,
}: RadioProps): React.JSX.Element {
  const circle = (
    <View
      style={[
        styles.radio,
        {
          borderWidth: selected ? 6 : borders.selectedWidth,
          borderColor: selected ? colors.apricot : colors.hairlineLit,
          backgroundColor: selected ? colors.onBrand : 'transparent',
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    />
  );

  if (!onSelect) return circle;

  return (
    <Pressable
      onPress={() => {
        if (disabled) return;
        triggerHaptic('light');
        onSelect();
      }}
      disabled={disabled}
      hitSlop={{ top: 11, bottom: 11, left: 11, right: 11 }}
      accessibilityRole="radio"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected, disabled }}
      testID={testID}
    >
      {circle}
    </Pressable>
  );
}

export interface OptionCardProps {
  title: string;
  subtitle?: string;
  selected?: boolean;
  compact?: boolean;
  disabled?: boolean;
  /** Icon rendered inside the 44..48 pt icon tile; use renderIcon for color-reactive icons */
  icon?: React.ReactNode | ((selected: boolean) => React.ReactNode);
  trailing?: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export function OptionCard({
  title,
  subtitle,
  selected = false,
  compact = false,
  disabled = false,
  icon,
  trailing,
  onPress,
  accessibilityLabel,
  testID,
  style,
}: OptionCardProps): React.JSX.Element {
  const { reduceMotion } = useTheme();
  const { scale, onPressIn, onPressOut } = usePressScale(reduceMotion);
  const resolvedIcon = typeof icon === 'function' ? icon(selected) : icon;

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        onPress={
          disabled
            ? undefined
            : () => {
                triggerHaptic('light');
                onPress?.();
              }
        }
        onPressIn={disabled ? undefined : onPressIn}
        onPressOut={disabled ? undefined : onPressOut}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? title}
        accessibilityState={{ selected, disabled }}
        testID={testID}
        style={({ pressed }) => [
          styles.optionCard,
          {
            paddingVertical: compact ? space.optical14 : space.lg,
            paddingHorizontal: compact ? space.lg : space.optical18,
            backgroundColor: selected ? colors.s2 : pressed && !disabled ? colors.s2 : colors.s1,
            borderWidth: selected ? borders.selectedWidth : borders.width,
            borderColor: selected ? colors.apricot : colors.hairline,
            opacity: disabled ? 0.5 : 1,
          },
        ]}
      >
        {resolvedIcon ? (
          <View
            style={[
              styles.iconTile,
              {
                width: compact ? 44 : 48,
                height: compact ? 44 : 48,
                borderRadius: compact ? radius.iconTile : 15,
                backgroundColor: selected ? colors.s3 : colors.s2,
              },
            ]}
          >
            {resolvedIcon}
          </View>
        ) : null}

        <View style={styles.cardBody}>
          <Text variant="rowTitle" color="textHi">
            {title}
          </Text>
          {subtitle ? (
            <Text variant="meta" color="textMid" style={styles.subtitle}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      </Pressable>
    </Animated.View>
  );
}

export interface OptionTileProps {
  title: string;
  meta?: string;
  selected?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode | ((selected: boolean) => React.ReactNode);
  onPress?: () => void;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/** 2-column grid option tile (112 pt height, icon top-left, check top-right, title + meta at bottom). */
export function OptionTile({
  title,
  meta,
  selected = false,
  disabled = false,
  icon,
  onPress,
  accessibilityLabel,
  testID,
  style,
}: OptionTileProps): React.JSX.Element {
  const { reduceMotion } = useTheme();
  const { scale, onPressIn, onPressOut } = usePressScale(reduceMotion);
  const resolvedIcon = typeof icon === 'function' ? icon(selected) : icon;

  return (
    <Animated.View style={[styles.tileFlex, { transform: [{ scale }] }, style]}>
      <Pressable
        onPress={
          disabled
            ? undefined
            : () => {
                triggerHaptic('light');
                onPress?.();
              }
        }
        onPressIn={disabled ? undefined : onPressIn}
        onPressOut={disabled ? undefined : onPressOut}
        disabled={disabled}
        accessibilityRole="checkbox"
        accessibilityLabel={accessibilityLabel ?? title}
        accessibilityState={{ checked: selected, disabled }}
        testID={testID}
        style={({ pressed }) => [
          styles.tileCard,
          {
            backgroundColor: selected ? colors.s2 : pressed && !disabled ? colors.s2 : colors.s1,
            borderWidth: selected ? borders.selectedWidth : borders.width,
            borderColor: selected ? colors.apricot : colors.hairline,
            opacity: disabled ? 0.5 : 1,
          },
        ]}
      >
        <View style={styles.tileTop}>
          <View style={styles.tileIconWrap}>{resolvedIcon}</View>
          <Checkbox checked={selected} round />
        </View>
        <View style={styles.tileTextWrap}>
          <Text variant="rowTitle" color="textHi" style={styles.tileTitle}>
            {title}
          </Text>
          {meta ? (
            <Text variant="meta" color="textLo">
              {meta}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  switchTrack: {
    width: 50,
    height: 30,
    borderRadius: 15,
    padding: 3,
    justifyContent: 'center',
  },
  switchKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  optionCard: {
    minHeight: 68,
    borderRadius: radius.optionCard,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.optical14,
  },
  iconTile: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
    gap: 2,
  },
  subtitle: {
    lineHeight: 18,
  },
  trailing: {
    marginLeft: space.sm,
  },
  tileFlex: {
    flex: 1,
  },
  tileCard: {
    minHeight: 112,
    borderRadius: radius.optionCard,
    padding: space.lg,
    justifyContent: 'space-between',
    gap: space.md,
  },
  tileTextWrap: {
    gap: 2,
  },
  tileTitle: {
    fontSize: 15,
    lineHeight: 20,
  },
  tileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tileIconWrap: {
    width: 28,
    height: 28,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
});
