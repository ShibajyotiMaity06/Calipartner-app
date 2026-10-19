import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, type AccessibilityProps } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { dark } from '../tokens/colors';
import { motion } from '../tokens/motion';
import { useReducedMotion } from '../theme/useReducedMotion';
import { Text } from './Text';

export interface TargetRevealRingProps extends AccessibilityProps {
  /** Target daily calories to display in the center */
  targetKcal: number;
  /** Ring diameter (Spec A10: 184). Default 184 */
  size?: number;
  /** Ring stroke width. Default 16 */
  strokeWidth?: number;
  /** Sub-caption under calories. Default "kcal a day" */
  caption?: string;
  /** Callback fired when the 1.2s fill animation completes */
  onAnimationComplete?: () => void;
  /** Custom test ID */
  testID?: string;
}

export function TargetRevealRing({
  targetKcal,
  size = 184,
  strokeWidth = 16,
  caption = 'kcal a day',
  onAnimationComplete,
  testID = 'target-reveal-ring',
  accessibilityLabel,
  ...rest
}: TargetRevealRingProps): React.JSX.Element {
  const reduceMotion = useReducedMotion();

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Single fill progress from 0% to 100%
  const anim = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const [progress, setProgress] = React.useState(reduceMotion ? 1 : 0);

  useEffect(() => {
    const id = anim.addListener(({ value }) => setProgress(value));
    return () => anim.removeListener(id);
  }, [anim]);

  useEffect(() => {
    if (reduceMotion) {
      setProgress(1);
      onAnimationComplete?.();
      return;
    }

    Animated.timing(anim, {
      toValue: 1,
      duration: motion.ring.duration, // 1200ms
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        onAnimationComplete?.();
      }
    });
  }, [anim, reduceMotion, onAnimationComplete]);

  // Dashoffset: at 0 progress it is circumference, at 1 progress it is 0
  const strokeDashoffset = circumference * (1 - progress);

  const formattedKcal = targetKcal.toLocaleString();
  const defaultA11yLabel = `${formattedKcal} ${caption}`;

  return (
    <View
      style={[styles.container, { width: size, height: size }]}
      testID={testID}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel || defaultA11yLabel}
      {...rest}
    >
      <Svg width={size} height={size}>
        <Defs>
          {/* Spec Part 2.3 & A10: Iris -> Apricot -> Teal gradient */}
          <LinearGradient id="targetRevealGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={dark.iris} />
            <Stop offset="50%" stopColor={dark.apricot} />
            <Stop offset="100%" stopColor={dark.teal} />
          </LinearGradient>
        </Defs>

        {/* Background Track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={dark.s2}
          strokeWidth={strokeWidth}
          fill="none"
        />

        {/* Animated Gradient Ring */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#targetRevealGrad)"
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="none"
          // Rotate -90 deg so it fills clockwise from the 12 o'clock top position
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>

      {/* Center Target Numerals */}
      <View style={styles.centerContent} pointerEvents="none">
        <Text
          variant="numeralXL"
          color={dark.textHi}
          style={styles.kcalText}
          testID="target-reveal-calories"
        >
          {formattedKcal}
        </Text>
        <Text
          variant="bodyS"
          color={dark.textMid}
          style={styles.captionText}
          testID="target-reveal-caption"
        >
          {caption}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  centerContent: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kcalText: {
    lineHeight: 44,
    textAlign: 'center',
  },
  captionText: {
    marginTop: 2,
    textAlign: 'center',
  },
});
