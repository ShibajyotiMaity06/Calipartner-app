/**
 * CaliPartner Design System v1 — Progress & Data Primitives
 * Single source of truth: docs/ui/DESIGN_SYSTEM_V1.md (Section 6.5 & 7)
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../theme/useTheme';
import { motion } from './motion';
import { Text } from './Text';
import { colors, fonts, heatmapScale, radius } from './theme';

export interface ProgressBarProps {
  /** Normalized progress between 0 and 1 */
  progress: number;
  height?: number;
  trackColor?: string;
  fillColor?: string;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/** Progress bar: h 4, radius 2, s3 track, apricot fill (Section 6.5). */
export function ProgressBar({
  progress,
  height = 4,
  trackColor = colors.s3,
  fillColor = colors.apricot,
  accessibilityLabel,
  testID,
  style,
}: ProgressBarProps): React.JSX.Element {
  const clamped = Math.max(0, Math.min(1, progress));
  const barRadius = Math.round(height / 2);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      testID={testID}
      style={[
        styles.barTrack,
        { height, borderRadius: barRadius, backgroundColor: trackColor },
        style,
      ]}
    >
      <View
        style={{
          width: `${Math.round(clamped * 1000) / 10}%`,
          height: '100%',
          borderRadius: barRadius,
          backgroundColor: fillColor,
        }}
      />
    </View>
  );
}

export interface SegmentedProgressProps {
  total: number;
  completed: number;
  barHeight?: number;
  gap?: number;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/** Equal 4..8 pt bars with 4..6 pt gaps, filled segments apricot (Section 6.5). */
export function SegmentedProgress({
  total,
  completed,
  barHeight = 6,
  gap = 4,
  accessibilityLabel,
  testID,
  style,
}: SegmentedProgressProps): React.JSX.Element {
  const safeTotal = Math.max(1, Math.round(total));
  const safeCompleted = Math.max(0, Math.min(safeTotal, completed));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel ?? `${safeCompleted} of ${safeTotal}`}
      accessibilityValue={{ min: 0, max: safeTotal, now: safeCompleted }}
      testID={testID}
      style={[styles.segmentedRow, { gap }, style]}
    >
      {Array.from({ length: safeTotal }).map((_, idx) => (
        <View
          key={idx}
          style={[
            styles.segmentBar,
            {
              height: barHeight,
              borderRadius: radius.bar,
              backgroundColor: idx < safeCompleted ? colors.apricot : colors.s3,
            },
          ]}
        />
      ))}
    </View>
  );
}

export interface RingProps {
  /** Progress ratio 0..1 */
  progress: number;
  /** Ring outer diameter (pt) */
  size?: number;
  /** Optional stroke override; defaults per Section 6.5 (12-14 for 140-232, 9 for 96, 4 for 44-56) */
  strokeWidth?: number;
  /** Progress stroke color; defaults to apricot */
  color?: string;
  /** Track color; defaults to s2 for large rings and s3 for <=56 pt rings */
  trackColor?: string;
  /** Optional center children */
  children?: React.ReactNode;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

function defaultRingStroke(size: number): number {
  if (size <= 56) return 4;
  if (size <= 112) return 9;
  return 13;
}

/**
 * SVG circular Ring: round caps, starts at 12 o'clock,
 * animates over 700ms ease-out (or snaps when Reduce Motion is enabled).
 */
export function Ring({
  progress,
  size = 160,
  strokeWidth,
  color = colors.apricot,
  trackColor,
  children,
  accessibilityLabel,
  testID,
  style,
}: RingProps): React.JSX.Element {
  const { reduceMotion } = useTheme();
  const target = Math.max(0, Math.min(1, progress));
  const stroke = strokeWidth ?? defaultRingStroke(size);
  const track = trackColor ?? (size <= 56 ? colors.s3 : colors.s2);

  const anim = useRef(new Animated.Value(target)).current;
  const [rendered, setRendered] = useState(target);

  useEffect(() => {
    const subId = anim.addListener?.(({ value }) => setRendered(value));
    return () => {
      if (subId) anim.removeListener?.(subId);
    };
  }, [anim]);

  useEffect(() => {
    if (reduceMotion) {
      anim.setValue(target);
      setRendered(target);
      return;
    }
    Animated.timing(anim, {
      toValue: target,
      duration: motion.ringFill.duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [target, reduceMotion, anim]);

  const center = size / 2;
  const r = Math.max(1, center - stroke / 2);
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - Math.max(0, Math.min(1, rendered)));

  return (
    <View
      style={[styles.ringContainer, { width: size, height: size }, style]}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(target * 100) }}
      testID={testID}
    >
      <Svg width={size} height={size}>
        <Circle cx={center} cy={center} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        {rendered > 0 ? (
          <Circle
            cx={center}
            cy={center}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
            fill="none"
            transform={`rotate(-90 ${center} ${center})`}
          />
        ) : null}
      </Svg>
      {children ? <View style={styles.ringCenter}>{children}</View> : null}
    </View>
  );
}

export interface AvatarRingProps {
  /** Member display name or initial */
  initial: string;
  /** Completion ratio 0..1 */
  progress: number;
  /** Ring & circle color (defaults to apricot) */
  color?: string;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/** 48 pt ring around a 34 pt colored circle with the initial (13 / 800 onBrand). */
export function AvatarRing({
  initial,
  progress,
  color = colors.apricot,
  accessibilityLabel,
  testID,
  style,
}: AvatarRingProps): React.JSX.Element {
  const cleanInitial = (initial.trim().slice(0, 1) || '?').toUpperCase();

  return (
    <Ring
      progress={progress}
      size={48}
      strokeWidth={4}
      color={color}
      trackColor={colors.s3}
      accessibilityLabel={accessibilityLabel ?? `${cleanInitial}, ${Math.round(progress * 100)}%`}
      testID={testID}
      style={style}
    >
      <View style={[styles.avatarCircle, { backgroundColor: color }]}>
        <Text
          style={{
            fontFamily: fonts.extrabold,
            fontSize: 13,
            lineHeight: 16,
            color: colors.onBrand,
          }}
        >
          {cleanInitial}
        </Text>
      </View>
    </Ring>
  );
}

export type HeatmapLevel = 0 | 1 | 2 | 3;

export interface HeatmapProps {
  /** Matrix of weeks -> days (levels 0..3) */
  columns: readonly (readonly HeatmapLevel[])[];
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/** 10 pt cells, 3 pt gaps, radius 3, steps s3 / heat1 / heat2 / apricot (Section 6.5). */
export function Heatmap({
  columns,
  accessibilityLabel = 'Activity heatmap',
  testID,
  style,
}: HeatmapProps): React.JSX.Element {
  return (
    <View
      style={[styles.heatmapRow, style]}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      {columns.map((col, cIdx) => (
        <View key={cIdx} style={styles.heatmapCol}>
          {col.map((level, rIdx) => (
            <View
              key={rIdx}
              style={[styles.heatmapCell, { backgroundColor: heatmapScale[level] ?? colors.s3 }]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  barTrack: {
    width: '100%',
    overflow: 'hidden',
  },
  segmentedRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  segmentBar: {
    flex: 1,
  },
  ringContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  ringCenter: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCircle: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heatmapRow: {
    flexDirection: 'row',
    gap: 3,
  },
  heatmapCol: {
    gap: 3,
  },
  heatmapCell: {
    width: 10,
    height: 10,
    borderRadius: radius.heatmap,
  },
});
