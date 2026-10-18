import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, type AccessibilityProps } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { dark, type IdentityHue, getIdentityColor } from '../tokens/colors';
import { motion } from '../tokens/motion';
import { useReducedMotion } from '../theme/useReducedMotion';
import { Text } from './Text';

export interface CalorieRingProps extends AccessibilityProps {
  /** Calories logged/eaten so far today */
  eaten: number;
  /** Daily calorie target */
  target: number;
  /** Owner's identity hue (default 'iris') — apricot is never used here (Spec CMP-13) */
  identityHue?: IdentityHue;
  /** Display mode in center: remaining or eaten. Default 'remaining' */
  mode?: 'remaining' | 'eaten';
  /** Diameter of the ring. Default 160 */
  size?: number;
  /** Ring stroke width. Default 12 */
  strokeWidth?: number;
  /** Custom test ID */
  testID?: string;
}

export function CalorieRing({
  eaten,
  target,
  identityHue = 'iris',
  mode = 'remaining',
  size = 160,
  strokeWidth = 12,
  testID = 'calorie-ring',
  accessibilityLabel,
  ...rest
}: CalorieRingProps): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  const ownerColor = getIdentityColor(identityHue);

  const validTarget = target > 0 ? target : 2000;
  const rawPct = (eaten / validTarget) * 100;

  // Animation
  const anim = useRef(new Animated.Value(rawPct)).current;
  const [renderedPct, setRenderedPct] = React.useState(rawPct);

  useEffect(() => {
    const id = anim.addListener(({ value }) => setRenderedPct(value));
    return () => anim.removeListener(id);
  }, [anim]);

  useEffect(() => {
    if (reduceMotion) {
      anim.setValue(rawPct);
      setRenderedPct(rawPct);
      return;
    }
    Animated.timing(anim, {
      toValue: rawPct,
      duration: motion.ring.duration,
      useNativeDriver: false,
    }).start();
  }, [rawPct, reduceMotion, anim]);

  const center = size / 2;
  const radius = center - strokeWidth / 2 - 4;
  const circumference = 2 * Math.PI * radius;

  const clampedPct = Math.max(0, renderedPct);
  const lap1Pct = Math.min(100, clampedPct);
  const lap2Pct = Math.min(100, Math.max(0, clampedPct - 100)); // Cream lap past 100%

  const offset1 = circumference * (1 - lap1Pct / 100);
  const offset2 = circumference * (1 - lap2Pct / 100);

  const remaining = Math.max(0, validTarget - eaten);
  const isOver = eaten > validTarget;
  const overAmount = isOver ? eaten - validTarget : 0;

  const a11y =
    accessibilityLabel ||
    `${eaten} calories eaten of ${validTarget} target. ${
      isOver ? `${overAmount} calories over target.` : `${remaining} calories remaining.`
    }`;

  return (
    <View
      style={[styles.container, { width: size, height: size }]}
      testID={testID}
      accessibilityRole="image"
      accessibilityLabel={a11y}
      {...rest}
    >
      <Svg width={size} height={size}>
        {/* Track circle (s2, 1px) */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={dark.s2}
          strokeWidth={strokeWidth}
          fill="none"
        />

        {/* Glow at 100% (18% opacity) */}
        {clampedPct >= 100 && (
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={ownerColor}
            strokeWidth={strokeWidth + 8}
            opacity={0.18}
            fill="none"
          />
        )}

        {/* Lap 1 (Owner Identity Hue) */}
        {lap1Pct > 0 && (
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={ownerColor}
            strokeWidth={strokeWidth}
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={offset1}
            strokeLinecap="round"
            fill="none"
            transform={`rotate(-90 ${center} ${center})`}
          />
        )}

        {/* Lap 2 past 100% (Cream) */}
        {lap2Pct > 0 && (
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={dark.cream}
            strokeWidth={strokeWidth}
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={offset2}
            strokeLinecap="round"
            fill="none"
            transform={`rotate(-90 ${center} ${center})`}
          />
        )}
      </Svg>

      {/* Center text */}
      <View style={styles.centerText} pointerEvents="none">
        {isOver ? (
          <>
            <Text variant="numeralL" color={dark.cream}>
              {`${Math.round(overAmount)}`}
            </Text>
            <Text variant="label" color={dark.textMid}>
              kcal over
            </Text>
          </>
        ) : mode === 'remaining' ? (
          <>
            <Text variant="numeralL" color={dark.textHi}>
              {`${Math.round(remaining)}`}
            </Text>
            <Text variant="label" color={dark.textMid}>
              kcal left
            </Text>
          </>
        ) : (
          <>
            <Text variant="numeralL" color={dark.textHi}>
              {`${Math.round(eaten)}`}
            </Text>
            <Text variant="label" color={dark.textMid}>
              {`/ ${validTarget} kcal`}
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerText: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
