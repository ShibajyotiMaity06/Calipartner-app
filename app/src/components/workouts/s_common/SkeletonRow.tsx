import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { workoutTokens, workoutRadius } from '@calipartner/ui';

interface SkeletonRowProps {
  height?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function SkeletonRow({ height = 64, style, testID = 'skeleton-row' }: SkeletonRowProps) {
  return (
    <View
      style={[styles.skeleton, { height }, style]}
      testID={testID}
      accessibilityLabel="Loading content"
    />
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: workoutTokens.card,
    borderRadius: workoutRadius.row,
    borderWidth: 1,
    borderColor: workoutTokens.border,
    marginVertical: 6,
    opacity: 0.6,
  },
});
