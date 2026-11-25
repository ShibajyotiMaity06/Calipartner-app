/**
 * CaliPartner Design System v1 — Chips, Segmented Controls, Page Dots
 * Single source of truth: docs/ui/DESIGN_SYSTEM_V1.md (Section 6.2 & 7)
 */
import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LockIcon } from './Icons';
import { triggerHaptic } from './haptics';
import { Text } from './Text';
import { colors, fonts, radius, space } from './theme';

export interface ChipProps {
  label: string;
  selected?: boolean;
  small?: boolean;
  locked?: boolean;
  disabled?: boolean;
  onPress?: (event: GestureResponderEvent) => void;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export function Chip({
  label,
  selected = false,
  small = false,
  locked = false,
  disabled = false,
  onPress,
  accessibilityLabel,
  testID,
  style,
}: ChipProps): React.JSX.Element {
  return (
    <Pressable
      onPress={
        disabled
          ? undefined
          : (e) => {
              triggerHaptic('light');
              onPress?.(e);
            }
      }
      disabled={disabled}
      hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (locked ? `${label}, locked` : label)}
      accessibilityState={{ selected, disabled }}
      testID={testID}
      style={({ pressed }) => [
        styles.chip,
        {
          paddingVertical: small ? 5 : space.sm,
          paddingHorizontal: small ? space.md : space.optical14,
          borderRadius: radius.chip,
          borderColor: selected ? colors.hairlineLit : colors.hairline,
          backgroundColor: selected ? colors.s3 : pressed && !disabled ? colors.s2 : 'transparent',
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      <Text
        style={{
          fontFamily: fonts.semibold,
          fontSize: 13,
          lineHeight: 16,
          color: disabled ? colors.textOff : selected ? colors.textHi : colors.textMid,
        }}
      >
        {label}
      </Text>
      {locked ? <LockIcon size={12} color={selected ? colors.textHi : colors.textLo} /> : null}
    </Pressable>
  );
}

export interface SegmentedOption<T extends string = string> {
  value: T;
  label: string;
  testID?: string;
}

export interface SegmentedProps<T extends string = string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  compact?: boolean;
  fullWidth?: boolean;
  disabled?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export function Segmented<T extends string = string>({
  options,
  value,
  onChange,
  compact = false,
  fullWidth = true,
  disabled = false,
  testID,
  style,
}: SegmentedProps<T>): React.JSX.Element {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scrollWrap}
      contentContainerStyle={[styles.scrollContent, fullWidth && styles.fullWidth]}
      testID={testID}
    >
      <View
        accessibilityRole="tablist"
        style={[
          styles.segmentedContainer,
          { padding: compact ? 3 : space.xs },
          fullWidth && styles.fullWidth,
          style,
        ]}
      >
        {options.map((opt) => {
          const isSelected = opt.value === value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => {
                if (disabled) return;
                if (!isSelected) triggerHaptic('light');
                onChange(opt.value);
              }}
              disabled={disabled}
              hitSlop={{ top: compact ? 7 : 4, bottom: compact ? 7 : 4 }}
              accessibilityRole="tab"
              accessibilityLabel={opt.label}
              accessibilityState={{ selected: isSelected, disabled }}
              testID={opt.testID ?? (testID ? `${testID}-${opt.value}` : undefined)}
              style={({ pressed }) => [
                styles.segmentItem,
                compact && styles.segmentItemCompact,
                fullWidth && styles.segmentFlex,
                {
                  height: compact ? 30 : 36,
                  borderRadius: compact ? radius.full : radius.input,
                  backgroundColor: isSelected
                    ? colors.s3
                    : pressed && !disabled
                      ? colors.s2
                      : 'transparent',
                },
              ]}
            >
              <Text
                style={{
                  fontFamily: fonts.bold,
                  fontSize: compact ? 13 : 14,
                  lineHeight: 18,
                  color: disabled ? colors.textOff : isSelected ? colors.textHi : colors.textLo,
                }}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

export interface PageDotsProps {
  count: number;
  activeIndex: number;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export function PageDots({
  count,
  activeIndex,
  accessibilityLabel,
  testID,
  style,
}: PageDotsProps): React.JSX.Element {
  return (
    <View
      style={[styles.dotsRow, style]}
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? `Step ${activeIndex + 1} of ${count}`}
      testID={testID}
    >
      {Array.from({ length: count }).map((_, index) => {
        const active = index === activeIndex;
        return (
          <View
            key={index}
            style={[
              styles.dot,
              active
                ? { width: 22, backgroundColor: colors.apricot }
                : { width: 6, backgroundColor: colors.hairline },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    gap: space.xs + 2,
  },
  scrollWrap: {
    flexGrow: 0,
    flexShrink: 0,
  },
  scrollContent: {
    flexDirection: 'row',
  },
  fullWidth: {
    flexGrow: 1,
    width: '100%',
  },
  segmentedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.segmented,
    backgroundColor: colors.s1,
    borderWidth: 1,
    borderColor: colors.hairline,
    gap: 2,
  },
  segmentItem: {
    minWidth: 72,
    borderRadius: radius.input,
    paddingHorizontal: space.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentItemCompact: {
    minWidth: 52,
    paddingHorizontal: space.md,
  },
  segmentFlex: {
    flex: 1,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  dot: {
    height: 6,
    borderRadius: radius.full,
  },
});
