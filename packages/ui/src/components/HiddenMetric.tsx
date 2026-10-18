import React from 'react';
import {
  View,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { dark } from '../tokens/colors';
import { radius } from '../tokens/radius';
import { space } from '../tokens/space';
import { Text } from './Text';

export interface HiddenMetricProps {
  label?: string;
  testID?: string;
  style?: ViewStyle;
}

export function HiddenMetric({
  label = 'Not shared',
  testID,
  style,
}: HiddenMetricProps): React.JSX.Element {
  return (
    <View
      style={[styles.container, style]}
      accessibilityRole="text"
      accessibilityLabel={`Metric hidden: ${label}`}
      testID={testID}
    >
      <View style={styles.lockGlyph}>
        {/* Minimalist 12px neutral lock shackle & body */}
        <View style={styles.shackle} />
        <View style={styles.body} />
      </View>
      <Text variant="label" color={dark.textLo} style={styles.label}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1] + 2, // 6
    paddingVertical: space[1], // 4
    paddingHorizontal: space[2], // 8
    backgroundColor: dark.s2,
    borderRadius: radius.control - 4, // 8
    borderWidth: 1,
    borderColor: dark.hairline,
    alignSelf: 'flex-start',
  },
  lockGlyph: {
    width: 12,
    height: 14,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  shackle: {
    width: 8,
    height: 6,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    borderWidth: 1.25,
    borderBottomWidth: 0,
    borderColor: dark.textLo,
    marginBottom: -1,
  },
  body: {
    width: 11,
    height: 8,
    borderRadius: 2,
    backgroundColor: dark.textLo,
  },
  label: {
    fontStyle: 'italic',
  },
});
