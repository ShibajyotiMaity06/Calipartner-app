import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { workoutTokens, workoutRadius } from '@calipartner/ui';

interface StepperRowProps {
  label: string;
  value: number | string;
  onIncrement: () => void;
  onDecrement: () => void;
  minDisabled?: boolean;
  maxDisabled?: boolean;
  unit?: string;
  testID?: string;
}

export function StepperRow({
  label,
  value,
  onIncrement,
  onDecrement,
  minDisabled,
  maxDisabled,
  unit,
  testID = 'stepper-row',
}: StepperRowProps) {
  return (
    <View style={styles.container} testID={testID}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.controlsRow}>
        <Pressable
          testID={`${testID}-decrement`}
          onPress={onDecrement}
          disabled={minDisabled}
          style={[styles.stepperButton, minDisabled && styles.disabled]}
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label}`}
        >
          <Ionicons name="remove" size={20} color={workoutTokens.text} />
        </Pressable>
        <View style={styles.valueContainer}>
          <Text style={styles.valueText}>
            {value}
            {unit ? ` ${unit}` : ''}
          </Text>
        </View>
        <Pressable
          testID={`${testID}-increment`}
          onPress={onIncrement}
          disabled={maxDisabled}
          style={[styles.stepperButton, maxDisabled && styles.disabled]}
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label}`}
        >
          <Ionicons name="add" size={20} color={workoutTokens.text} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: workoutTokens.border,
  },
  label: {
    color: workoutTokens.text,
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepperButton: {
    width: 44,
    height: 44,
    borderRadius: workoutRadius.control,
    backgroundColor: workoutTokens.inset,
    borderWidth: 1,
    borderColor: workoutTokens.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.4,
  },
  valueContainer: {
    minWidth: 54,
    alignItems: 'center',
  },
  valueText: {
    color: workoutTokens.text,
    fontSize: 20,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
});
