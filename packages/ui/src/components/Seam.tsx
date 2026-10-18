import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, type AccessibilityProps } from 'react-native';
import Svg, { Line, Defs, LinearGradient, Stop, Circle } from 'react-native-svg';
import { dark, type IdentityHue, getIdentityColor } from '../tokens/colors';
import { motion } from '../tokens/motion';
import { useReducedMotion } from '../theme/useReducedMotion';
import { Text } from './Text';

export type SeamState = 'broken' | 'half-lit' | 'fused';
export type FinishedPerson = 'user' | 'partner';

export interface SeamProps extends AccessibilityProps {
  /** Seam state: broken, half-lit, or fused (Spec 5.3) */
  state: SeamState;
  /** When half-lit, which person has finished logging ('user' = left side, 'partner' = right side) */
  finishedPerson?: FinishedPerson;
  /** User's identity hue (default 'iris') */
  userHue?: IdentityHue;
  /** Partner's identity hue (default 'teal') */
  partnerHue?: IdentityHue;
  /** Partner's name for caption/announcements */
  partnerName?: string;
  /** Day streak number for fused caption: "Both of you logged today. Day N." */
  streakDays?: number;
  /** Total height (for vertical) or width (for horizontal). Default 220 */
  length?: number;
  /** Inset at top and bottom (or left/right in horizontal). Spec 24px */
  inset?: number;
  /** Orientation: vertical (standard side-by-side) or horizontal (stacked reflow) */
  orientation?: 'vertical' | 'horizontal';
  /** Trigger fuse animation manually (e.g. for demo or live transition) */
  triggerFuse?: boolean;
  /** Custom test ID */
  testID?: string;
}

export function Seam({
  state,
  finishedPerson = 'user',
  userHue = 'iris',
  partnerHue = 'teal',
  partnerName = 'Partner',
  streakDays = 1,
  length = 220,
  inset = 24,
  orientation = 'vertical',
  triggerFuse = false,
  testID = 'seam',
  accessibilityLabel,
  ...rest
}: SeamProps): React.JSX.Element {
  const reduceMotion = useReducedMotion();

  // Sweep animation progress: 0 to 1 (both ends meet at the center)
  const fuseAnim = useRef(new Animated.Value(state === 'fused' && !triggerFuse ? 1 : 0)).current;
  const [sweepVal, setSweepVal] = React.useState(state === 'fused' && !triggerFuse ? 1 : 0);

  // Caption fade-in
  const captionOpacity = useRef(new Animated.Value(state === 'fused' && !triggerFuse ? 1 : 0)).current;

  useEffect(() => {
    const id = fuseAnim.addListener(({ value }) => {
      setSweepVal(value);
    });
    return () => fuseAnim.removeListener(id);
  }, [fuseAnim]);

  useEffect(() => {
    if (state === 'fused' || triggerFuse) {
      if (reduceMotion) {
        fuseAnim.setValue(1);
        setSweepVal(1);
        Animated.timing(captionOpacity, {
          toValue: 1,
          duration: motion.fast.duration,
          useNativeDriver: false,
        }).start();
        return;
      }

      // Seam fuse orchestrated moment (Spec 4.3: 900ms, cubic-bezier(0.4, 0, 0.2, 1))
      fuseAnim.setValue(0);
      captionOpacity.setValue(0);

      Animated.sequence([
        Animated.timing(fuseAnim, {
          toValue: 1,
          duration: motion.seam.duration,
          useNativeDriver: false,
        }),
        Animated.timing(captionOpacity, {
          toValue: 1,
          duration: motion.base.duration,
          useNativeDriver: false,
        }),
      ]).start();
    } else {
      fuseAnim.setValue(0);
      captionOpacity.setValue(0);
      setSweepVal(0);
    }
  }, [state, triggerFuse, reduceMotion, fuseAnim, captionOpacity]);

  const userColor = getIdentityColor(userHue);
  const partnerColor = getIdentityColor(partnerHue);
  const finishedColor = finishedPerson === 'user' ? userColor : partnerColor;

  // Geometry
  const isVertical = orientation === 'vertical';
  const startPos = inset;
  const endPos = length - inset;
  const activeLength = endPos - startPos;
  const midPos = startPos + activeLength / 2;

  // Sweep calculations: ends advance toward center
  // topEnd = startPos + (midPos - startPos) * sweepVal
  // bottomStart = endPos - (endPos - midPos) * sweepVal
  const halfSpan = activeLength / 2;
  const topSweepEnd = startPos + halfSpan * sweepVal;
  const bottomSweepStart = endPos - halfSpan * sweepVal;

  // Accessibility text (Spec 5.3)
  let a11yText = 'Neither of you has finished logging today.';

  if (state === 'fused') {
    a11yText = `Both of you logged today. Day ${streakDays}.`;
  } else if (state === 'half-lit') {
    if (finishedPerson === 'user') {
      a11yText = `${partnerName} hasn't logged yet today.`;
    } else {
      a11yText = "You haven't logged yet today.";
    }
  }

  // Cross-axis dimensions: 1px line, dot is 5px, glow is 2px
  // In vertical: width is 24 to accommodate 5px dot on left or right of seam
  // In horizontal: height is 24
  const containerWidth = isVertical ? 24 : length;
  const containerHeight = isVertical ? length : 24;
  const lineCenter = 12;

  return (
    <View
      style={[styles.wrapper, isVertical ? { height: length, width: 24 } : { width: length, height: 24 }]}
      testID={testID}
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel || a11yText}
      {...rest}
    >
      <Svg width={containerWidth} height={containerHeight}>
        <Defs>
          {isVertical ? (
            <LinearGradient id="seamGlowGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={userColor} />
              <Stop offset="100%" stopColor={partnerColor} />
            </LinearGradient>
          ) : (
            <LinearGradient id="seamGlowGrad" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0%" stopColor={userColor} />
              <Stop offset="100%" stopColor={partnerColor} />
            </LinearGradient>
          )}
        </Defs>

        {isVertical ? (
          <>
            {/* 1. Broken State: 6px dashes in hairlineLit */}
            {state === 'broken' && (
              <Line
                x1={lineCenter}
                y1={startPos}
                x2={lineCenter}
                y2={endPos}
                stroke={dark.hairlineLit}
                strokeWidth={1}
                strokeDasharray="6, 6"
              />
            )}

            {/* 2. Half-lit State: top half solid in finished hue, bottom half dashed in hairlineLit */}
            {state === 'half-lit' && (
              <>
                {/* Finished person half (start to midpoint) */}
                <Line
                  x1={lineCenter}
                  y1={startPos}
                  x2={lineCenter}
                  y2={midPos}
                  stroke={finishedColor}
                  strokeWidth={1.5}
                />
                {/* 5px dot on finished person's side at midpoint (user = left, partner = right) */}
                <Circle
                  cx={finishedPerson === 'user' ? lineCenter - 6 : lineCenter + 6}
                  cy={midPos}
                  r={2.5}
                  fill={finishedColor}
                />
                {/* Unfinished half (midpoint to end) */}
                <Line
                  x1={lineCenter}
                  y1={midPos}
                  x2={lineCenter}
                  y2={endPos}
                  stroke={dark.hairlineLit}
                  strokeWidth={1}
                  strokeDasharray="6, 6"
                />
              </>
            )}

            {/* 3. Fused State: Gradient line sweeping in from both ends + 2px glow */}
            {state === 'fused' && (
              <>
                {/* Sweep lines meeting at center */}
                <Line
                  x1={lineCenter}
                  y1={startPos}
                  x2={lineCenter}
                  y2={topSweepEnd}
                  stroke="url(#seamGlowGrad)"
                  strokeWidth={2}
                  strokeLinecap="round"
                />
                <Line
                  x1={lineCenter}
                  y1={bottomSweepStart}
                  x2={lineCenter}
                  y2={endPos}
                  stroke="url(#seamGlowGrad)"
                  strokeWidth={2}
                  strokeLinecap="round"
                />
                {/* Once fused, full solid line with 2px glow */}
                {sweepVal >= 0.98 && (
                  <Line
                    x1={lineCenter}
                    y1={startPos}
                    x2={lineCenter}
                    y2={endPos}
                    stroke="url(#seamGlowGrad)"
                    strokeWidth={2}
                  />
                )}
              </>
            )}
          </>
        ) : (
          <>
            {/* Horizontal orientation (Reflow) */}
            {state === 'broken' && (
              <Line
                x1={startPos}
                y1={lineCenter}
                x2={endPos}
                y2={lineCenter}
                stroke={dark.hairlineLit}
                strokeWidth={1}
                strokeDasharray="6, 6"
              />
            )}

            {state === 'half-lit' && (
              <>
                <Line
                  x1={startPos}
                  y1={lineCenter}
                  x2={midPos}
                  y2={lineCenter}
                  stroke={finishedColor}
                  strokeWidth={1.5}
                />
                <Circle
                  cx={midPos}
                  cy={finishedPerson === 'user' ? lineCenter - 6 : lineCenter + 6}
                  r={2.5}
                  fill={finishedColor}
                />
                <Line
                  x1={midPos}
                  y1={lineCenter}
                  x2={endPos}
                  y2={lineCenter}
                  stroke={dark.hairlineLit}
                  strokeWidth={1}
                  strokeDasharray="6, 6"
                />
              </>
            )}

            {state === 'fused' && (
              <>
                <Line
                  x1={startPos}
                  y1={lineCenter}
                  x2={topSweepEnd}
                  y2={lineCenter}
                  stroke="url(#seamGlowGrad)"
                  strokeWidth={2}
                  strokeLinecap="round"
                />
                <Line
                  x1={bottomSweepStart}
                  y1={lineCenter}
                  x2={endPos}
                  y2={lineCenter}
                  stroke="url(#seamGlowGrad)"
                  strokeWidth={2}
                  strokeLinecap="round"
                />
                {sweepVal >= 0.98 && (
                  <Line
                    x1={startPos}
                    y1={lineCenter}
                    x2={endPos}
                    y2={lineCenter}
                    stroke="url(#seamGlowGrad)"
                    strokeWidth={2}
                  />
                )}
              </>
            )}
          </>
        )}
      </Svg>
    </View>
  );
}

/**
 * SeamCaption: 13sp caption under the card (Spec 5.3)
 */
export function SeamCaption({
  state,
  finishedPerson = 'user',
  partnerName = 'Partner',
  streakDays = 1,
  testID = 'seam-caption',
}: {
  state: SeamState;
  finishedPerson?: FinishedPerson;
  partnerName?: string;
  streakDays?: number;
  testID?: string;
}): React.JSX.Element {
  let caption = 'Neither of you has logged today.';
  if (state === 'fused') {
    caption = `Both of you logged today. Day ${streakDays}.`;
  } else if (state === 'half-lit') {
    caption = finishedPerson === 'user' ? `${partnerName} hasn't logged yet today.` : "You haven't logged yet today.";
  }

  return (
    <View style={styles.captionContainer} testID={testID}>
      <Text variant="label" color={dark.textMid} style={styles.captionText}>
        {caption}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  captionContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  captionText: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
});
