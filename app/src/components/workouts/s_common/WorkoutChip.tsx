import React from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { workoutTokens, workoutRadius } from '@calipartner/ui';

interface WorkoutChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  count?: number;
}

export function WorkoutChip({
  label,
  selected = false,
  onPress,
  style,
  testID = 'workout-chip',
  count,
}: WorkoutChipProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label}${count !== undefined ? ` (${count})` : ''}`}
      onPress={onPress}
      disabled={!onPress}
      style={[styles.chip, selected ? styles.chipSelected : styles.chipUnselected, style]}
    >
      <Text style={[styles.label, selected ? styles.labelSelected : styles.labelUnselected]}>
        {label}
        {count !== undefined ? ` ${count}` : ''}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: workoutRadius.chip,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  chipUnselected: {
    backgroundColor: workoutTokens.card,
    borderColor: workoutTokens.border,
  },
  chipSelected: {
    backgroundColor: workoutTokens.selected,
    borderColor: workoutTokens.borderStrong,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
  },
  labelUnselected: {
    color: workoutTokens.dim,
  },
  labelSelected: {
    color: workoutTokens.text,
  },
});
