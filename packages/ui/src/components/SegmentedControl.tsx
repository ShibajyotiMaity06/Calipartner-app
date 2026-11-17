import { useTheme as useAppearance } from '../theme/useTheme';
import React from 'react';
import { View, Pressable, ScrollView, StyleSheet, type ViewStyle } from 'react-native';

import { controls } from '../tokens/controls';
import { radius } from '../tokens/radius';
import { space } from '../tokens/space';
import { Text } from './Text';

export interface SegmentOption<T extends string = string> {
  value: T;
  label: string;
  badge?: number | string;
  testID?: string;
}

export interface SegmentedControlProps<T extends string = string> {
  options: readonly SegmentOption<T>[] | SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  fullWidth?: boolean;
  testID?: string;
  style?: ViewStyle;
  disabled?: boolean;
}

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  fullWidth = true,
  testID,
  style,
  disabled = false,
}: SegmentedControlProps<T>): React.JSX.Element {
  const { colors: dark } = useAppearance();
  const styles = createStyles(dark);

  return (
    <ScrollView
      horizontal
      style={{ flexGrow: 0, flexShrink: 0 }}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.container, fullWidth && styles.fullWidth, style]}
      testID={testID}
    >
      <View accessibilityRole="tablist" style={[styles.innerRow, fullWidth && styles.innerRowFull]}>
        {options.map((option) => {
          const isSelected = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              accessibilityRole="tab"
              disabled={disabled}
              accessibilityState={{ selected: isSelected, disabled }}
              accessibilityLabel={option.label}
              testID={option.testID ?? (testID ? `${testID}-${option.value}` : undefined)}
              hitSlop={{ top: 2, bottom: 2, left: 2, right: 2 }}
              style={({ pressed }) => [
                styles.segment,
                fullWidth && styles.segmentFlex,
                isSelected && styles.segmentSelected,
                pressed && !isSelected && styles.segmentPressed,
              ]}
            >
              <Text
                variant="label"
                color={isSelected ? dark.textHi : dark.textMid}
                style={styles.label}
              >
                {option.label}
              </Text>
              {option.badge !== undefined ? (
                <View style={styles.badge}>
                  <Text variant="micro" color={dark.textHi}>
                    {String(option.badge)}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const createStyles = (dark: ReturnType<typeof useAppearance>['colors']) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
    },
    fullWidth: {
      flexGrow: 1,
    },
    innerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: controls.touch,
      backgroundColor: dark.s2,
      borderRadius: radius.full,
      padding: space[1], // 4
      borderWidth: 1,
      borderColor: dark.hairline,
    },
    innerRowFull: {
      flexGrow: 1,
    },
    segment: {
      minHeight: controls.touch,
      minWidth: controls.touch,
      paddingHorizontal: space[3], // 12
      borderRadius: radius.full,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: space[1], // 4
    },
    segmentFlex: {
      flex: 1,
    },
    segmentSelected: {
      backgroundColor: dark.s1,
      borderWidth: 1,
      borderColor: dark.hairlineLit,
    },
    segmentPressed: {
      backgroundColor: dark.s3,
      opacity: 0.7,
    },
    label: {
      textAlign: 'center',
      flexShrink: 1,
    },
    badge: {
      backgroundColor: dark.s3,
      borderRadius: radius.full,
      paddingHorizontal: space[1] + 1,
      paddingVertical: 1,
      minWidth: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
