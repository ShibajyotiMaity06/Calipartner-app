import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { avatarLayout, radius, space, useTheme } from '@calipartner/ui';

export function ColorSwatch({
  color,
  selected,
  locked = false,
  label,
  testID,
  onPress,
}: {
  color: string;
  selected: boolean;
  locked?: boolean;
  label: string;
  testID: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      testID={testID}
      style={[styles.ring, { borderColor: selected ? colors.textHi : colors.s1 }]}
    >
      <View style={[styles.color, { backgroundColor: color, borderColor: colors.hairline }]}>
        {locked ? (
          <View style={[styles.lock, { backgroundColor: colors.s1 }]}>
            <Ionicons name="lock-closed-outline" size={space[4]} color={colors.textHi} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  ring: {
    width: avatarLayout.swatchSize,
    height: avatarLayout.swatchSize,
    borderRadius: radius.full,
    borderWidth: avatarLayout.selectedBorderWidth,
    padding: avatarLayout.swatchInset,
  },
  color: {
    flex: 1,
    borderRadius: radius.full,
    borderWidth: avatarLayout.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lock: { borderRadius: radius.full, padding: space[1] },
});
