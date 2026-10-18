import React from 'react';
import {
  View,
  StyleSheet,
  type ViewStyle,
  type StyleProp,
  type DimensionValue,
} from 'react-native';
import { dark } from '../tokens/colors';
import { radius } from '../tokens/radius';
import { space } from '../tokens/space';

export interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  variant?: 'rect' | 'circle' | 'text' | 'card';
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export function Skeleton({
  width = '100%',
  height,
  borderRadius,
  variant = 'rect',
  testID,
  style,
}: SkeletonProps): React.JSX.Element {
  const getDefaultHeight = (): DimensionValue => {
    switch (variant) {
      case 'circle':
        return typeof width === 'number' ? width : 40;
      case 'text':
        return 16;
      case 'card':
        return 120;
      case 'rect':
      default:
        return height ?? 44;
    }
  };

  const getDefaultRadius = (): number => {
    if (borderRadius !== undefined) return borderRadius;
    switch (variant) {
      case 'circle':
        return radius.full;
      case 'text':
        return radius.control - 4; // 8
      case 'card':
        return radius.card; // 20
      case 'rect':
      default:
        return radius.control; // 12
    }
  };

  const effectiveHeight = height ?? getDefaultHeight();
  const effectiveWidth = variant === 'circle' ? effectiveHeight : width;

  return (
    <View
      style={[
        styles.skeleton,
        {
          width: effectiveWidth,
          height: effectiveHeight,
          borderRadius: getDefaultRadius(),
        },
        style,
      ]}
      accessibilityRole="none"
      accessibilityLabel="Loading placeholder"
      testID={testID}
    />
  );
}

// Composite skeleton layouts
Skeleton.Card = ({ style }: { style?: StyleProp<ViewStyle> }) => (
  <View style={[styles.cardSkeleton, style]}>
    <Skeleton variant="text" width="40%" height={18} />
    <Skeleton variant="text" width="70%" height={14} style={{ marginTop: space[2] }} />
    <Skeleton variant="rect" width="100%" height={64} style={{ marginTop: space[3] }} />
  </View>
);

Skeleton.ListRow = ({ style }: { style?: StyleProp<ViewStyle> }) => (
  <View style={[styles.rowSkeleton, style]}>
    <Skeleton variant="circle" width={40} height={40} />
    <View style={styles.rowText}>
      <Skeleton variant="text" width="60%" height={16} />
      <Skeleton variant="text" width="40%" height={12} style={{ marginTop: space[1] }} />
    </View>
  </View>
);

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: dark.s2, // No shimmer sweep per spec
  },
  cardSkeleton: {
    backgroundColor: dark.s1,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: dark.hairline,
    padding: space[4],
  },
  rowSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space[3],
    paddingHorizontal: space[4],
    gap: space[3],
  },
  rowText: {
    flex: 1,
  },
});
