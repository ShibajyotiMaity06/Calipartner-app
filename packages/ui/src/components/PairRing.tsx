import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, type AccessibilityProps } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { dark, type IdentityHue, getIdentityColor } from '../tokens/colors';
import { motion } from '../tokens/motion';
import { useReducedMotion } from '../theme/useReducedMotion';
import { Text, type TextProps } from './Text';

export type PairRingSize = 184 | 120 | 64;

export interface PairRingProps extends AccessibilityProps {
  /** Size diameter: 184 (Room hero), 120 (Today strip), 64 (compact list). Default 184 */
  size?: PairRingSize;
  /** Current user's goal completion percentage (e.g. 78 or 120 for over goal) */
  userPercent: number;
  /** Partner's goal completion percentage (e.g. 64) */
  partnerPercent?: number;
  /** Name of the partner (for accessibility and pill). Default "Partner" */
  partnerName?: string;
  /** User's identity color hue (default 'iris') */
  userHue?: IdentityHue;
  /** Partner's identity color hue (default 'teal') */
  partnerHue?: IdentityHue;
  /** Whether a partner is connected in this room. If false, shows dashed placeholder */
  hasPartner?: boolean;
  /** Calories left to hit target (optional for center text, e.g. "1,180") */
  remainingAmount?: string | number;
  /** Calories over target when > 100% (e.g. "320") */
  overAmount?: string | number;
  /** Localized label for non-calorie uses such as habit challenges. */
  centerLabel?: string;
  fontSet?: TextProps['fontSet'];
  /** Custom test ID */
  testID?: string;
}

// Module-level cache to ensure first paint animates once per app session (Spec 5.2)
let hasAnimatedPairRingInSession = false;

export function resetPairRingSessionAnimation(): void {
  hasAnimatedPairRingInSession = false;
}

export function PairRing({
  size = 184,
  userPercent,
  partnerPercent = 0,
  partnerName = 'Partner',
  userHue = 'iris',
  partnerHue = 'teal',
  hasPartner = true,
  remainingAmount,
  overAmount,
  centerLabel,
  fontSet,
  testID = 'pair-ring',
  accessibilityLabel,
  ...rest
}: PairRingProps): React.JSX.Element {
  const reduceMotion = useReducedMotion();

  // Animation values for smooth arc transitions
  const userAnim = useRef(
    new Animated.Value(hasAnimatedPairRingInSession ? userPercent : 0),
  ).current;
  const partnerAnim = useRef(
    new Animated.Value(hasAnimatedPairRingInSession ? partnerPercent : 0),
  ).current;

  const [renderedUserPct, setRenderedUserPct] = React.useState(
    hasAnimatedPairRingInSession ? userPercent : 0,
  );
  const [renderedPartnerPct, setRenderedPartnerPct] = React.useState(
    hasAnimatedPairRingInSession ? partnerPercent : 0,
  );

  useEffect(() => {
    const userListener = userAnim.addListener(({ value }) => {
      setRenderedUserPct(value);
    });
    const partnerListener = partnerAnim.addListener(({ value }) => {
      setRenderedPartnerPct(value);
    });

    return () => {
      userAnim.removeListener(userListener);
      partnerAnim.removeListener(partnerListener);
    };
  }, [userAnim, partnerAnim]);

  useEffect(() => {
    if (reduceMotion) {
      userAnim.setValue(userPercent);
      partnerAnim.setValue(partnerPercent);
      setRenderedUserPct(userPercent);
      setRenderedPartnerPct(partnerPercent);
      hasAnimatedPairRingInSession = true;
      return;
    }

    const duration = hasAnimatedPairRingInSession ? motion.base.duration : motion.ring.duration;
    hasAnimatedPairRingInSession = true;

    Animated.parallel([
      Animated.timing(userAnim, {
        toValue: userPercent,
        duration,
        useNativeDriver: false,
      }),
      Animated.timing(partnerAnim, {
        toValue: partnerPercent,
        duration,
        useNativeDriver: false,
      }),
    ]).start();
  }, [userPercent, partnerPercent, reduceMotion, userAnim, partnerAnim]);

  // Dimension scaling relative to base diameter 184
  const scale = size / 184;
  const center = size / 2;

  // Outer ring (You): 10px stroke at 184
  const strokeOuter = Math.max(3, Math.round(10 * scale * 10) / 10);
  // Inner ring (Partner): 7px stroke at 184
  const strokeInner = Math.max(2.5, Math.round(7 * scale * 10) / 10);
  // Gap between rings: 6px at 184
  const gap = Math.max(2, Math.round(6 * scale * 10) / 10);

  // Outer glow / padding margin
  const margin = Math.max(2, Math.round(3 * scale));
  const radiusOuter = center - strokeOuter / 2 - margin;
  const radiusInner = radiusOuter - strokeOuter / 2 - gap - strokeInner / 2;

  const circOuter = 2 * Math.PI * radiusOuter;
  const circInner = 2 * Math.PI * radiusInner;

  // User arc calculations
  const clampedUser = Math.max(0, renderedUserPct);
  const userLap1Pct = Math.min(100, clampedUser);
  const userLap2Pct = Math.min(100, Math.max(0, clampedUser - 100)); // Cream lap past 100% (max 200%)

  const userOffset1 = circOuter * (1 - userLap1Pct / 100);
  const userOffset2 = circOuter * (1 - userLap2Pct / 100);

  // Partner arc calculations
  const clampedPartner = Math.max(0, renderedPartnerPct);
  const partnerLap1Pct = Math.min(100, clampedPartner);
  const partnerLap2Pct = Math.min(100, Math.max(0, clampedPartner - 100));

  const partnerOffset1 = circInner * (1 - partnerLap1Pct / 100);
  const partnerOffset2 = circInner * (1 - partnerLap2Pct / 100);

  // Colors
  const userColor = getIdentityColor(userHue);
  const partnerColor = getIdentityColor(partnerHue);

  // Partner pill coordinate: end of the partner's arc
  // Starts at -90deg and sweeps clockwise by partnerLap1Pct
  const partnerAngleDeg = -90 + (Math.min(clampedPartner, 200) / 100) * 360;
  const partnerAngleRad = (partnerAngleDeg * Math.PI) / 180;
  const pillX = center + radiusInner * Math.cos(partnerAngleRad);
  const pillY = center + radiusInner * Math.sin(partnerAngleRad);

  // Spec a11y label
  const defaultA11y = hasPartner
    ? `Your goal, ${Math.round(userPercent)} percent complete. ${partnerName}'s goal, ${Math.round(partnerPercent)} percent complete.`
    : `Your goal, ${Math.round(userPercent)} percent complete. No partner connected.`;

  return (
    <View
      style={[styles.container, { width: size, height: size }]}
      testID={testID}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel || defaultA11y}
      {...rest}
    >
      <Svg width={size} height={size}>
        {/* Track circle for User (s2, 1px) */}
        <Circle
          cx={center}
          cy={center}
          r={radiusOuter}
          stroke={dark.s2}
          strokeWidth={1}
          fill="none"
        />

        {/* Track circle for Partner (s2, 1px, or dashed if no partner) */}
        <Circle
          cx={center}
          cy={center}
          r={radiusInner}
          stroke={hasPartner ? dark.s2 : dark.hairlineLit}
          strokeWidth={hasPartner ? 1 : 1.5}
          strokeDasharray={hasPartner ? undefined : '5, 5'}
          fill="none"
        />

        {/* Glow at 100% for User (18% opacity in user hue) */}
        {clampedUser >= 100 && (
          <Circle
            cx={center}
            cy={center}
            r={radiusOuter}
            stroke={userColor}
            strokeWidth={strokeOuter + 6}
            opacity={0.18}
            fill="none"
          />
        )}

        {/* Glow at 100% for Partner (18% opacity in partner hue) */}
        {hasPartner && clampedPartner >= 100 && (
          <Circle
            cx={center}
            cy={center}
            r={radiusInner}
            stroke={partnerColor}
            strokeWidth={strokeInner + 4}
            opacity={0.18}
            fill="none"
          />
        )}

        {/* User Arc — Lap 1 (Identity Hue) */}
        {userLap1Pct > 0 && (
          <Circle
            cx={center}
            cy={center}
            r={radiusOuter}
            stroke={userColor}
            strokeWidth={strokeOuter}
            strokeDasharray={`${circOuter} ${circOuter}`}
            strokeDashoffset={userOffset1}
            strokeLinecap="round"
            fill="none"
            transform={`rotate(-90 ${center} ${center})`}
          />
        )}

        {/* User Arc — Lap 2 past 100% (Cream) */}
        {userLap2Pct > 0 && (
          <Circle
            cx={center}
            cy={center}
            r={radiusOuter}
            stroke={dark.cream}
            strokeWidth={strokeOuter}
            strokeDasharray={`${circOuter} ${circOuter}`}
            strokeDashoffset={userOffset2}
            strokeLinecap="round"
            fill="none"
            transform={`rotate(-90 ${center} ${center})`}
          />
        )}

        {/* Partner Arc — Lap 1 (Identity Hue) */}
        {hasPartner && partnerLap1Pct > 0 && (
          <Circle
            cx={center}
            cy={center}
            r={radiusInner}
            stroke={partnerColor}
            strokeWidth={strokeInner}
            strokeDasharray={`${circInner} ${circInner}`}
            strokeDashoffset={partnerOffset1}
            strokeLinecap="round"
            fill="none"
            transform={`rotate(-90 ${center} ${center})`}
          />
        )}

        {/* Partner Arc — Lap 2 past 100% (Cream) */}
        {hasPartner && partnerLap2Pct > 0 && (
          <Circle
            cx={center}
            cy={center}
            r={radiusInner}
            stroke={dark.cream}
            strokeWidth={strokeInner}
            strokeDasharray={`${circInner} ${circInner}`}
            strokeDashoffset={partnerOffset2}
            strokeLinecap="round"
            fill="none"
            transform={`rotate(-90 ${center} ${center})`}
          />
        )}
      </Svg>

      {/* Partner Percent Pill: travels at the end of the partner's arc */}
      {hasPartner && size >= 120 && clampedPartner > 0 && (
        <View
          style={[
            styles.partnerPill,
            {
              left: pillX - 16,
              top: pillY - 10,
              borderColor: dark.hairlineLit,
            },
          ]}
        >
          <Text fontSet={fontSet} variant="micro" color={partnerColor} style={styles.pillText}>
            {`${Math.round(clampedPartner)}%`}
          </Text>
        </View>
      )}

      {/* Centre Content */}
      <View style={styles.centerContainer} pointerEvents="none">
        {size === 184 && (
          <>
            <Text fontSet={fontSet} variant="numeralXL" color={dark.textHi}>
              {`${Math.round(renderedUserPct)}%`}
            </Text>
            {clampedUser > 100 ? (
              <Text fontSet={fontSet} variant="label" color={dark.textMid}>
                {overAmount ? `${overAmount} over` : 'over goal'}
              </Text>
            ) : remainingAmount != null ? (
              <Text fontSet={fontSet} variant="label" color={dark.textMid}>
                {`${remainingAmount} left`}
              </Text>
            ) : (
              <Text fontSet={fontSet} variant="label" color={dark.textMid}>
                {centerLabel ?? 'of goal'}
              </Text>
            )}
          </>
        )}

        {size === 120 && (
          <>
            <Text fontSet={fontSet} variant="numeralM" color={dark.textHi}>
              {`${Math.round(renderedUserPct)}%`}
            </Text>
            {clampedUser > 100 ? (
              <Text fontSet={fontSet} variant="micro" color={dark.textMid}>
                {overAmount ? `${overAmount} over` : 'over'}
              </Text>
            ) : remainingAmount != null ? (
              <Text fontSet={fontSet} variant="micro" color={dark.textMid}>
                {`${remainingAmount} left`}
              </Text>
            ) : null}
          </>
        )}

        {size === 64 && (
          <Text fontSet={fontSet} variant="heading" color={dark.textHi}>
            {`${Math.round(renderedUserPct)}%`}
          </Text>
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
  centerContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  partnerPill: {
    position: 'absolute',
    width: 32,
    height: 20,
    borderRadius: 10,
    backgroundColor: dark.s3,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  pillText: {
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '700',
  },
});
