import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { dark } from '../tokens/colors';
import { radius } from '../tokens/radius';
import { space } from '../tokens/space';
import { Text } from './Text';

export type SyncState = 'synced' | 'pending' | 'syncing' | 'failed' | 'offline';

export interface SyncPillProps {
  status: SyncState;
  customText?: string;
  testID?: string;
  style?: ViewStyle;
}

export function SyncPill({ status, customText, testID, style }: SyncPillProps): React.JSX.Element {
  const getDotColor = (): string => {
    switch (status) {
      case 'synced':
        return dark.mint;
      case 'syncing':
      case 'pending':
        return dark.apricot;
      case 'failed':
        return dark.danger;
      case 'offline':
      default:
        return dark.copper;
    }
  };

  const getDefaultText = (): string => {
    switch (status) {
      case 'synced':
        return 'Synced';
      case 'syncing':
        return 'Syncing...';
      case 'pending':
      case 'offline':
        return 'Saved on this phone. Will sync.';
      case 'failed':
        return 'Sync error';
    }
  };

  return (
    <View
      style={[styles.pill, style]}
      accessibilityRole="text"
      accessibilityLabel={customText ?? getDefaultText()}
      testID={testID}
    >
      <View style={[styles.dot, { backgroundColor: getDotColor() }]} />
      <Text variant="micro" color={dark.textMid} numberOfLines={1}>
        {customText ?? getDefaultText()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    height: 28,
    borderRadius: radius.full,
    backgroundColor: dark.s2,
    borderWidth: 1,
    borderColor: dark.hairline,
    paddingHorizontal: space[3], // 12
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2], // 8
    alignSelf: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
  },
});
