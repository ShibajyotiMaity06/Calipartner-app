import React from 'react';
import { Pressable, Switch, View, StyleSheet, type ViewStyle } from 'react-native';
import { dark } from '../tokens/colors';
import { space } from '../tokens/space';
import { Text } from './Text';

export interface SwitchRowProps {
  title: string;
  consequence?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  style?: ViewStyle;
}

export function SwitchRow({
  title,
  consequence,
  value,
  onValueChange,
  disabled = false,
  accessibilityLabel,
  testID,
  style,
}: SwitchRowProps): React.JSX.Element {
  return (
    <Pressable
      onPress={disabled ? undefined : () => onValueChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel ?? title}
      testID={testID}
      style={({ pressed }) => [
        styles.row,
        pressed && !disabled && { backgroundColor: dark.s2 },
        disabled && styles.disabled,
        style,
      ]}
    >
      <View style={styles.textWrap}>
        <Text variant="heading" color={dark.textHi}>
          {title}
        </Text>
        {consequence ? (
          <Text variant="bodyS" color={dark.textMid} style={styles.consequence}>
            {consequence}
          </Text>
        ) : null}
      </View>

      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{
          false: dark.s3,
          true: dark.apricot,
        }}
        thumbColor={value ? dark.onBrand : dark.textLo}
        ios_backgroundColor={dark.s3}
        style={styles.switch}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56, // Rule U9: >= 44
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space[3], // 12
    paddingHorizontal: space[4], // 16
    gap: space[3], // 12
  },
  textWrap: {
    flex: 1,
  },
  consequence: {
    marginTop: 2,
  },
  switch: {
    transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }],
  },
  disabled: {
    opacity: 0.5,
  },
});
