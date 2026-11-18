import { useTheme } from '@calipartner/ui';
import React from 'react';
import { View } from 'react-native';

export function LaunchBackground() {
  const { colors } = useTheme();
  return <View style={{ flex: 1, backgroundColor: colors.splashBackground }} />;
}
