import React from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { dark } from '../tokens/colors';
import { radius } from '../tokens/radius';
import { space } from '../tokens/space';
import { Text } from './Text';

export interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  accessibilityLabel?: string;
  testID?: string;
  style?: ViewStyle;
}

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 9999,
  step = 1,
  unit,
  accessibilityLabel = 'Quantity stepper',
  testID,
  style,
}: StepperProps): React.JSX.Element {
  const canDecrement = value - step >= min;
  const canIncrement = value + step <= max;

  const handleDecrement = () => {
    if (canDecrement) onChange(Math.max(min, value - step));
  };

  const handleIncrement = () => {
    if (canIncrement) onChange(Math.min(max, value + step));
  };

  return (
    <View
      style={[styles.container, style]}
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min, max, now: value }}
      testID={testID}
    >
      <Pressable
        onPress={handleDecrement}
        disabled={!canDecrement}
        accessibilityRole="button"
        accessibilityLabel="Decrease value"
        testID={testID ? `${testID}-minus` : undefined}
        style={({ pressed }) => [
          styles.button,
          pressed && canDecrement && styles.buttonPressed,
          !canDecrement && styles.buttonDisabled,
        ]}
      >
        <Text variant="heading" color={canDecrement ? dark.textHi : dark.textOff}>
          −
        </Text>
      </Pressable>

      <View style={styles.valueWrap}>
        <Text variant="numeralM" color={dark.textHi} tabular>
          {String(value)}
        </Text>
        {unit ? (
          <Text variant="label" color={dark.textMid} style={styles.unitText}>
            {unit}
          </Text>
        ) : null}
      </View>

      <Pressable
        onPress={handleIncrement}
        disabled={!canIncrement}
        accessibilityRole="button"
        accessibilityLabel="Increase value"
        testID={testID ? `${testID}-plus` : undefined}
        style={({ pressed }) => [
          styles.button,
          pressed && canIncrement && styles.buttonPressed,
          !canIncrement && styles.buttonDisabled,
        ]}
      >
        <Text variant="heading" color={canIncrement ? dark.textHi : dark.textOff}>
          +
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: dark.s2,
    borderRadius: radius.control, // 12
    borderWidth: 1,
    borderColor: dark.hairline,
    padding: space[1], // 4
    minHeight: 48,
  },
  button: {
    width: 48,
    height: 48,
    borderRadius: radius.control - 4, // 8
    backgroundColor: dark.s3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    backgroundColor: dark.hairlineLit,
  },
  buttonDisabled: {
    opacity: 0.35,
  },
  valueWrap: {
    minWidth: 56,
    paddingHorizontal: space[3], // 12
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitText: {
    marginTop: 2,
  },
});
