import React, { useEffect, useState } from 'react';
import { View, StyleSheet, type AccessibilityProps } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { dark } from '../tokens/colors';
import { Text } from './Text';

export interface TimerDisplayProps extends AccessibilityProps {
  /**
   * ISO UTC string or epoch ms timestamp when timer began.
   * Spec CMP-21: Time is always computed from stored UTC timestamps, NEVER an accumulating counter.
   */
  startedAtUtc: string | number;
  /**
   * ISO UTC string or epoch ms timestamp when timer is scheduled to end (for countdowns).
   * Or duration in minutes.
   */
  targetEndAtUtc?: string | number;
  durationMinutes?: number;
  /** Mode: 'countdown' (e.g. workout rest) or 'elapsed' (e.g. Fasting) */
  mode?: 'countdown' | 'elapsed';
  /** Whether the session is currently paused */
  isPaused?: boolean;
  /** If paused, the timestamp when pause occurred */
  pausedAtUtc?: string | number;
  /** Outer diameter of the timer circle. Default 200 */
  size?: number;
  /** Stroke width of progress ring. Spec CMP-21: 6px */
  strokeWidth?: number;
  /** Accent color for the progress ring. Default dark.apricot */
  accentColor?: string;
  /** Title label above or below (e.g. "Rest timer" or "Fasting") */
  title?: string;
  /** Subtitle (e.g. "Target: 45 min") */
  subtitle?: string;
  /** Custom test ID */
  testID?: string;
}

export function TimerDisplay({
  startedAtUtc,
  targetEndAtUtc,
  durationMinutes,
  mode = 'countdown',
  isPaused = false,
  pausedAtUtc,
  size = 200,
  strokeWidth = 6,
  accentColor = dark.apricot,
  title,
  subtitle,
  testID = 'timer-display',
  accessibilityLabel,
  ...rest
}: TimerDisplayProps): React.JSX.Element {
  const [now, setNow] = useState(Date.now());

  // Heartbeat to re-evaluate from UTC timestamp every second
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [isPaused]);

  // Compute times from stored UTC timestamps
  const startMs =
    typeof startedAtUtc === 'string' ? new Date(startedAtUtc).getTime() : startedAtUtc;

  let endMs = 0;
  if (targetEndAtUtc != null) {
    endMs =
      typeof targetEndAtUtc === 'string' ? new Date(targetEndAtUtc).getTime() : targetEndAtUtc;
  } else if (durationMinutes != null) {
    endMs = startMs + durationMinutes * 60 * 1000;
  }

  const effectiveNow =
    isPaused && pausedAtUtc != null
      ? typeof pausedAtUtc === 'string'
        ? new Date(pausedAtUtc).getTime()
        : pausedAtUtc
      : now;

  let displaySeconds = 0;
  let progressPct = 0;

  if (mode === 'countdown') {
    const totalDurationMs = Math.max(1000, endMs - startMs);
    const remainingMs = Math.max(0, endMs - effectiveNow);
    displaySeconds = Math.ceil(remainingMs / 1000);
    progressPct = Math.min(
      100,
      Math.max(0, ((totalDurationMs - remainingMs) / totalDurationMs) * 100),
    );
  } else {
    // Elapsed mode (e.g. fasting duration)
    const elapsedMs = Math.max(0, effectiveNow - startMs);
    displaySeconds = Math.floor(elapsedMs / 1000);
    if (endMs > startMs) {
      const totalDurationMs = endMs - startMs;
      progressPct = Math.min(100, (elapsedMs / totalDurationMs) * 100);
    } else {
      progressPct = (displaySeconds % 3600) / 36; // 0 to 100% per hour
    }
  }

  // Format HH:MM:SS or MM:SS
  const hours = Math.floor(displaySeconds / 3600);
  const minutes = Math.floor((displaySeconds % 3600) / 60);
  const seconds = displaySeconds % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');
  const formattedTime =
    hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;

  // SVG calculations for 6px ring
  const center = size / 2;
  const radius = center - strokeWidth / 2 - 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progressPct / 100);

  const a11y =
    accessibilityLabel ||
    `${title || 'Timer'}: ${hours > 0 ? `${hours} hours ` : ''}${minutes} minutes ${seconds} seconds ${
      mode === 'countdown' ? 'remaining' : 'elapsed'
    }${isPaused ? ', paused' : ''}`;

  return (
    <View
      style={[styles.container, { width: size, height: size }]}
      testID={testID}
      accessibilityRole="timer"
      accessibilityLabel={a11y}
      {...rest}
    >
      <Svg width={size} height={size}>
        {/* Track circle (s2, 6px) */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={dark.s2}
          strokeWidth={strokeWidth}
          fill="none"
        />

        {/* 6px thin progress ring */}
        {progressPct > 0 && (
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={accentColor}
            strokeWidth={strokeWidth}
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="none"
            transform={`rotate(-90 ${center} ${center})`}
          />
        )}
      </Svg>

      {/* Tabular numeral time in center */}
      <View style={styles.centerText} pointerEvents="none">
        {title && (
          <Text variant="micro" color={dark.textMid} style={styles.titleText}>
            {title}
          </Text>
        )}
        <Text variant="numeralXL" color={dark.textHi}>
          {formattedTime}
        </Text>
        {subtitle && (
          <Text variant="label" color={dark.textLo} style={styles.subtitleText}>
            {subtitle}
          </Text>
        )}
        {isPaused && (
          <View style={styles.pausedBadge}>
            <Text variant="micro" color={dark.onBrand} style={styles.pausedText}>
              PAUSED
            </Text>
          </View>
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
    gap: 4,
  },
  titleText: {
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  subtitleText: {
    marginTop: 2,
  },
  pausedBadge: {
    backgroundColor: dark.apricot,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 4,
  },
  pausedText: {
    fontWeight: '700',
    fontSize: 10,
  },
});
