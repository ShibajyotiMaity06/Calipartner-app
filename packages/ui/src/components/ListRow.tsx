import React from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  type GestureResponderEvent,
  type ViewStyle,
} from 'react-native';
import { dark } from '../tokens/colors';
import { space } from '../tokens/space';
import { Text } from './Text';

export interface ListRowProps {
  title: string;
  subtitle?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  onPress?: (event: GestureResponderEvent) => void;
  showDivider?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  style?: ViewStyle;
}

export function ListRow({
  title,
  subtitle,
  leading,
  trailing,
  onPress,
  showDivider = true,
  accessibilityLabel,
  testID,
  style,
}: ListRowProps): React.JSX.Element {
  const isPressable = Boolean(onPress);

  const content = (
    <View style={styles.row}>
      {leading ? <View style={styles.leading}>{leading}</View> : null}

      <View style={styles.center}>
        <Text variant="heading" color={dark.textHi} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="bodyS" color={dark.textMid} numberOfLines={1} style={styles.subtitle}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
  );

  return (
    <View style={[styles.container, style]}>
      {isPressable ? (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel ?? (typeof title === 'string' ? title : undefined)}
          testID={testID}
          style={({ pressed }) => [styles.pressable, pressed && { backgroundColor: dark.s2 }]}
        >
          {content}
        </Pressable>
      ) : (
        <View style={styles.pressable} testID={testID}>
          {content}
        </View>
      )}

      {showDivider ? <View style={styles.divider} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: 'transparent',
  },
  pressable: {
    minHeight: 56,
    paddingHorizontal: space[4], // 16
    paddingVertical: space[3], // 12
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  leading: {
    marginRight: space[3], // 12
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
  },
  subtitle: {
    marginTop: 2,
  },
  trailing: {
    marginLeft: space[3], // 12
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: dark.hairline,
    marginLeft: space[4] + 40 + space[3], // 16 + 40 + 12 inset
  },
});
