import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { workoutTokens, workoutRadius } from '@calipartner/ui';

interface WorkoutToggleProps {
  value: boolean;
  onValueChange: (val: boolean) => void;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel?: string;
}

export function WorkoutToggle({
  value,
  onValueChange,
  disabled,
  testID = 'workout-toggle',
  accessibilityLabel = 'Toggle setting',
}: WorkoutToggleProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: !!disabled }}
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      style={[styles.track, value ? styles.trackOn : styles.trackOff, disabled && styles.disabled]}
    >
      <View style={[styles.knob, value ? styles.knobOn : styles.knobOff]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: 50,
    height: 30,
    borderRadius: workoutRadius.full,
    padding: 3,
    justifyContent: 'center',
  },
  trackOn: {
    backgroundColor: workoutTokens.accent,
  },
  trackOff: {
    backgroundColor: workoutTokens.card,
    borderWidth: 1.5,
    borderColor: workoutTokens.border,
  },
  knob: {
    width: 24,
    height: 24,
    borderRadius: workoutRadius.control,
  },
  knobOn: {
    backgroundColor: workoutTokens.onAccent,
    alignSelf: 'flex-end',
  },
  knobOff: {
    backgroundColor: workoutTokens.muted,
    alignSelf: 'flex-start',
  },
  disabled: {
    opacity: 0.5,
  },
});
