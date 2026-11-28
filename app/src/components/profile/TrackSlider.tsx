import React, { useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import { borders, colors, radius } from '@calipartner/ui/v1';

export interface TrackSliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  fillColor?: string;
  onChange: (nextValue: number) => void;
  accessibilityLabel: string;
  testID?: string;
  disabled?: boolean;
}

function clampAndStep(raw: number, min: number, max: number, step: number): number {
  const clamped = Math.max(min, Math.min(max, raw));
  if (step <= 0) return clamped;
  const stepped = Math.round((clamped - min) / step) * step + min;
  return Math.max(min, Math.min(max, Math.round(stepped * 1000) / 1000));
}

/**
 * Interactive horizontal slider styled strictly with Design System v1 tokens.
 * Supports tap-to-jump and drag gestures with >=44 pt vertical touch target.
 */
export function TrackSlider({
  value,
  min,
  max,
  step = 1,
  fillColor = colors.apricot,
  onChange,
  accessibilityLabel,
  testID,
  disabled = false,
}: TrackSliderProps): React.JSX.Element {
  const [width, setWidth] = useState(240);
  const startRatioRef = useRef(0);
  const widthRef = useRef(width);
  widthRef.current = width;

  const span = Math.max(0.0001, max - min);
  const ratio = Math.max(0, Math.min(1, (value - min) / span));
  const ratioRef = useRef(ratio);
  ratioRef.current = ratio;

  const emitRatio = (nextRatio: number) => {
    const r = Math.max(0, Math.min(1, nextRatio));
    onChange(clampAndStep(min + r * span, min, max, step));
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled,
        onMoveShouldSetPanResponder: () => !disabled,
        onPanResponderGrant: (evt: GestureResponderEvent) => {
          const trackW = Math.max(1, widthRef.current);
          const locX = evt.nativeEvent.locationX;
          if (typeof locX === 'number' && Number.isFinite(locX)) {
            const jumped = Math.max(0, Math.min(1, locX / trackW));
            startRatioRef.current = jumped;
            emitRatio(jumped);
          } else {
            startRatioRef.current = ratioRef.current;
          }
        },
        onPanResponderMove: (_evt, gesture) => {
          const trackW = Math.max(1, widthRef.current);
          const next = startRatioRef.current + gesture.dx / trackW;
          emitRatio(next);
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [disabled, min, max, step],
  );

  const handleLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setWidth(w);
  };

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min, max, now: value }}
      style={styles.touchArea}
      onLayout={handleLayout}
      {...panResponder.panHandlers}
    >
      <View style={styles.trackBg}>
        <View
          style={[
            styles.trackFill,
            {
              width: `${ratio * 100}%`,
              backgroundColor: fillColor,
            },
          ]}
        />
      </View>
      <View
        pointerEvents="none"
        style={[
          styles.thumb,
          {
            backgroundColor: fillColor,
            left: Math.max(0, Math.min(width - 18, ratio * width - 9)),
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  touchArea: {
    height: 44,
    justifyContent: 'center',
    position: 'relative',
  },
  trackBg: {
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.s3,
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    borderRadius: radius.full,
  },
  thumb: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: radius.full,
    borderWidth: borders.width * 2,
    borderColor: colors.bg0,
  },
});
