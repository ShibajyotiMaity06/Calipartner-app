import React from 'react';
import { View, Pressable, ScrollView, StyleSheet, type ViewStyle } from 'react-native';
import { dark } from '../tokens/colors';
import { radius } from '../tokens/radius';
import { space } from '../tokens/space';
import { Text } from './Text';

export interface SegmentOption<T extends string = string> {
  value: T;
  label: string;
  badge?: number | string;
}

export interface SegmentedControlProps<T extends string = string> {
  options: readonly SegmentOption<T>[] | SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  fullWidth?: boolean;
  testID?: string;
  style?: ViewStyle;
}

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  fullWidth = true,
  testID,
  style,
}: SegmentedControlProps<T>): React.JSX.Element {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.container, fullWidth && styles.fullWidth, style]}
      testID={testID}
    >
      <View style={[styles.innerRow, fullWidth && styles.innerRowFull]}>
        {options.map((option) => {
          const isSelected = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={option.label}
              testID={testID ? `${testID}-${option.value}` : undefined}
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
                color={isSelected ? dark.apricot : dark.textMid}
                style={styles.label}
              >
                {option.label}
              </Text>
              {option.badge !== undefined ? (
                <View style={styles.badge}>
                  <Text variant="micro" color={dark.onBrand}>
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

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
  },
  fullWidth: {
    width: '100%',
  },
  innerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    backgroundColor: dark.s2,
    borderRadius: radius.control, // 12
    padding: space[1], // 4
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  innerRowFull: {
    width: '100%',
  },
  segment: {
    minHeight: 32,
    minWidth: 44,
    paddingHorizontal: space[3], // 12
    borderRadius: radius.control - 3, // 9
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: space[1], // 4
  },
  segmentFlex: {
    flex: 1,
  },
  segmentSelected: {
    backgroundColor: dark.s3,
    borderWidth: 1,
    borderColor: dark.hairlineLit,
  },
  segmentPressed: {
    backgroundColor: dark.s3,
    opacity: 0.7,
  },
  label: {
    textAlign: 'center',
  },
  badge: {
    backgroundColor: dark.apricot,
    borderRadius: radius.full,
    paddingHorizontal: space[1] + 1,
    paddingVertical: 1,
    minWidth: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
