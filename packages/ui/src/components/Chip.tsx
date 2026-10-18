import React from 'react';
import {
  Pressable,
  View,
  StyleSheet,
  type GestureResponderEvent,
  type ViewStyle,
} from 'react-native';
import { dark } from '../tokens/colors';
import { radius } from '../tokens/radius';
import { space } from '../tokens/space';
import { Text } from './Text';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: (event: GestureResponderEvent) => void;
  icon?: React.ReactNode;
  disabled?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  style?: ViewStyle;
}

const APRICOT_16_PCT = 'rgba(244, 182, 125, 0.16)';

export function Chip({
  label,
  selected = false,
  onPress,
  icon,
  disabled = false,
  accessibilityLabel,
  testID,
  style,
}: ChipProps): React.JSX.Element {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={accessibilityLabel ?? label}
      testID={testID}
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }} // Ensures 44px hit area with 36px height
      style={({ pressed }) => [
        styles.chip,
        selected
          ? {
              backgroundColor: pressed ? 'rgba(244, 182, 125, 0.24)' : APRICOT_16_PCT,
              borderColor: dark.apricot,
            }
          : {
              backgroundColor: pressed ? dark.s2 : 'transparent',
              borderColor: dark.hairlineLit,
            },
        disabled && styles.disabled,
        style,
      ]}
    >
      <View style={styles.inner}>
        {icon ? <View style={styles.iconWrap}>{icon}</View> : null}
        <Text
          variant="label"
          color={disabled ? dark.textOff : selected ? dark.apricot : dark.textMid}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 36,
    minHeight: 36,
    paddingHorizontal: space[3], // 12
    borderRadius: radius.control, // 12
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1], // 4
  },
  iconWrap: {
    marginRight: space[1],
  },
  disabled: {
    opacity: 0.5,
    borderColor: dark.hairline,
  },
});
