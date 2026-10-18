import React from 'react';
import {
  View,
  Image,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { dark } from '../tokens/colors';
import { radius } from '../tokens/radius';
import { Text } from './Text';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg';

export interface AvatarProps {
  /** Size tier: xs (24), sm (36), md (40), lg (72) */
  size?: AvatarSize;
  /** Image URL */
  uri?: string | null;
  /** Name or nickname to derive fallback initials from */
  name?: string;
  /** Identity ring hue key (e.g. 'iris', 'teal', 'rose') or color string */
  identityHue?: keyof typeof dark | string;
  /** Whether to show active presence dot (rendered in identity hue, never green) */
  presence?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  style?: ViewStyle;
}

export function Avatar({
  size = 'md',
  uri,
  name,
  identityHue,
  presence = false,
  accessibilityLabel,
  testID,
  style,
}: AvatarProps): React.JSX.Element {
  const getDimension = (): number => {
    switch (size) {
      case 'xs':
        return 24;
      case 'sm':
        return 36;
      case 'lg':
        return 72;
      case 'md':
      default:
        return 40;
    }
  };

  const dim = getDimension();

  const getInitials = (): string => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
  };

  const resolvedIdentityColor = identityHue
    ? identityHue in dark
      ? dark[identityHue as keyof typeof dark]
      : identityHue
    : null;

  return (
    <View
      style={[
        styles.container,
        {
          width: dim,
          height: dim,
          borderRadius: radius.full,
          ...(resolvedIdentityColor
            ? {
                borderWidth: 2,
                borderColor: resolvedIdentityColor,
                padding: 1,
              }
            : {}),
        },
        style,
      ]}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel ?? name ?? 'Avatar'}
      testID={testID}
    >
      <View
        style={[
          styles.innerCircle,
          {
            width: '100%',
            height: '100%',
            borderRadius: radius.full,
            backgroundColor: dark.s3,
          },
        ]}
      >
        {uri ? (
          <Image
            source={{ uri }}
            style={[styles.image, { borderRadius: radius.full }]}
          />
        ) : (
          <Text
            variant={size === 'xs' ? 'micro' : size === 'lg' ? 'title2' : 'label'}
            color={resolvedIdentityColor ?? dark.textHi}
          >
            {getInitials()}
          </Text>
        )}
      </View>

      {presence ? (
        <View
          style={[
            styles.presenceDot,
            {
              backgroundColor: resolvedIdentityColor ?? dark.teal, // Never green, always identity hue
            },
          ]}
          testID={testID ? `${testID}-presence` : undefined}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerCircle: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  presenceDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 8,
    height: 8,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: dark.bg0,
  },
});
