import React from 'react';
import {
  Pressable,
  View,
  StyleSheet,
  type GestureResponderEvent,
  type ViewStyle,
  type StyleProp,
} from 'react-native';
import { dark } from '../tokens/colors';
import { radius } from '../tokens/radius';
import { space } from '../tokens/space';

export interface CardProps {
  children: React.ReactNode;
  /** Elevation layer: s1 (standard card) or s2 (raised surface) */
  elevation?: 's1' | 's2' | 's3';
  /** Tappable press handler */
  onPress?: (event: GestureResponderEvent) => void;
  /** Prominent hairline border (uses hairlineLit instead of hairline) */
  lit?: boolean;
  /** Custom inner padding (defaults to space[4] = 16) */
  padding?: number;
  /** Custom card border radius (defaults to radius.card = 20) */
  borderRadius?: number;
  accessibilityRole?: 'button' | 'summary' | 'none';
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export function Card({
  children,
  elevation = 's1',
  onPress,
  lit = false,
  padding = space[4], // 16
  borderRadius = radius.card, // 20
  accessibilityRole,
  accessibilityLabel,
  testID,
  style,
}: CardProps): React.JSX.Element {
  const isPressable = Boolean(onPress);

  const getBgColor = (pressed = false): string => {
    if (pressed) {
      return elevation === 's1' ? dark.s2 : dark.s3;
    }
    return elevation === 's2' ? dark.s2 : elevation === 's3' ? dark.s3 : dark.s1;
  };

  const getBorderColor = (): string => {
    return lit ? dark.hairlineLit : dark.hairline;
  };

  if (!isPressable) {
    return (
      <View
        accessibilityRole={accessibilityRole ?? 'none'}
        accessibilityLabel={accessibilityLabel}
        testID={testID}
        style={[
          styles.card,
          {
            backgroundColor: getBgColor(false),
            borderColor: getBorderColor(),
            padding,
            borderRadius,
          },
          style,
        ]}
      >
        <View style={styles.topHighlight} />
        {children}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={accessibilityRole ?? 'button'}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: getBgColor(pressed),
          borderColor: getBorderColor(),
          padding,
          borderRadius,
        },
        style,
      ]}
    >
      <View style={styles.topHighlight} />
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
});
