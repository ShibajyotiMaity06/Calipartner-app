/**
 * CaliPartner Design System v1 — Ruler Pickers (Horizontal & Vertical)
 * Single source of truth: docs/ui/DESIGN_SYSTEM_V1.md (Section 6.5 & 7)
 *
 * Horizontal default: 342 x 84, tick every 0.5 unit every 10 pt, major tick every 5 units,
 * labels 13 / 600 textLo, needle 3 x 48 apricot radius 1.5, edge fade over 22% each side.
 * Vertical height mode: descending top-to-bottom (higher values above), right-aligned ticks
 * with labels on the left and a right-anchored needle pointing left.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { triggerHaptic } from './haptics';
import { Text } from './Text';
import { colors, fonts, radius } from './theme';

const DEFAULT_STEP = 0.5;
const DEFAULT_TICK_GAP = 10;
const DEFAULT_MAJOR_STEP = 5;
const DEFAULT_MID_STEP = 1;
const HORIZONTAL_WIDTH = 342;
const HORIZONTAL_HEIGHT = 84;

export interface RulerPickerProps {
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  unit?: string;
  vertical?: boolean;
  /** Invert vertical axis so higher values sit at the top (e.g. height tape). Defaults to true when vertical. */
  inverted?: boolean;
  /** Tick & needle anchor edge in vertical mode. Defaults to 'right' to match Design System height screen. */
  align?: 'left' | 'right';
  step?: number;
  tickGap?: number;
  majorStep?: number;
  midStep?: number;
  formatLabel?: (value: number) => string;
  length?: number;
  breadth?: number;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

function isMultipleOf(val: number, divisor: number): boolean {
  if (divisor <= 0) return false;
  const rem = Math.abs(val % divisor);
  return rem < 0.001 || Math.abs(rem - divisor) < 0.001;
}

function snapValue(raw: number, min: number, max: number, step: number): number {
  const stepped = Math.round((raw - min) / step) * step + min;
  const clamped = Math.max(min, Math.min(max, stepped));
  return Math.round(clamped * 100) / 100;
}

export function RulerPicker({
  min,
  max,
  value,
  onChange,
  unit,
  vertical = false,
  inverted = vertical,
  align = 'right',
  step = DEFAULT_STEP,
  tickGap = DEFAULT_TICK_GAP,
  majorStep = DEFAULT_MAJOR_STEP,
  midStep = DEFAULT_MID_STEP,
  formatLabel,
  length = HORIZONTAL_WIDTH,
  breadth = HORIZONTAL_HEIGHT,
  accessibilityLabel,
  testID,
  style,
}: RulerPickerProps): React.JSX.Element {
  const scrollRef = useRef<ScrollView>(null);
  const lastReported = useRef(value);
  const latestValueRef = useRef(value);
  latestValueRef.current = value;
  const isDraggingRef = useRef(false);
  const totalSteps = Math.max(1, Math.round((max - min) / step));
  const halfLength = length / 2;

  const ticks = useMemo(() => {
    const items = Array.from({ length: totalSteps + 1 }).map((_, idx) => {
      const tickValue = Math.round((min + idx * step) * 100) / 100;
      const isMajor = isMultipleOf(tickValue, majorStep);
      const isMid = !isMajor && isMultipleOf(tickValue, midStep);
      return { tickValue, isMajor, isMid };
    });
    return vertical && inverted ? items.reverse() : items;
  }, [min, step, totalSteps, majorStep, midStep, vertical, inverted]);

  const computeOffset = (targetValue: number): number => {
    const clamped = Math.max(min, Math.min(max, targetValue));
    const stepIndex = vertical && inverted ? (max - clamped) / step : (clamped - min) / step;
    return Math.max(0, Math.round(stepIndex * tickGap));
  };

  const scrollToValue = (targetValue: number) => {
    const pos = computeOffset(targetValue);
    if (typeof scrollRef.current?.scrollTo === 'function') {
      scrollRef.current.scrollTo(
        vertical ? { x: 0, y: pos, animated: false } : { x: pos, y: 0, animated: false },
      );
    }
  };

  useEffect(() => {
    if (isDraggingRef.current) return;
    if (Math.abs(value - lastReported.current) >= step / 2) {
      lastReported.current = value;
      scrollToValue(value);
    }
  });

  useEffect(() => {
    lastReported.current = latestValueRef.current;
    const clamped = Math.max(min, Math.min(max, latestValueRef.current));
    const stepIndex = vertical && inverted ? (max - clamped) / step : (clamped - min) / step;
    const pos = Math.max(0, Math.round(stepIndex * tickGap));
    if (typeof scrollRef.current?.scrollTo === 'function') {
      scrollRef.current.scrollTo(
        vertical ? { x: 0, y: pos, animated: false } : { x: pos, y: 0, animated: false },
      );
    }
  }, [min, max, step, tickGap, vertical, inverted]);

  const initialOffset = computeOffset(value);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offset = vertical ? event.nativeEvent.contentOffset.y : event.nativeEvent.contentOffset.x;
    const raw =
      vertical && inverted ? max - (offset / tickGap) * step : min + (offset / tickGap) * step;
    const snapped = snapValue(raw, min, max, step);
    if (snapped !== lastReported.current) {
      lastReported.current = snapped;
      triggerHaptic('selection');
      onChange(snapped);
    }
  };

  if (vertical) {
    const isRightAligned = align === 'right';
    return (
      <View
        style={[styles.verticalRoot, { width: breadth, height: length }, style]}
        accessibilityRole="adjustable"
        accessibilityLabel={
          accessibilityLabel ?? `Height or measurement picker, ${value}${unit ? ` ${unit}` : ''}`
        }
        accessibilityValue={{ min, max, now: value }}
        testID={testID}
      >
        <ScrollView
          ref={scrollRef}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={tickGap}
          decelerationRate="fast"
          scrollEventThrottle={16}
          onScrollBeginDrag={() => {
            isDraggingRef.current = true;
          }}
          onMomentumScrollEnd={() => {
            isDraggingRef.current = false;
          }}
          onScrollEndDrag={() => {
            isDraggingRef.current = false;
          }}
          onLayout={() => scrollToValue(lastReported.current)}
          onScroll={handleScroll}
          contentOffset={{ x: 0, y: initialOffset }}
          contentContainerStyle={{
            paddingTop: halfLength,
            paddingBottom: halfLength,
          }}
        >
          {ticks.map(({ tickValue, isMajor, isMid }) => (
            <View
              key={tickValue}
              style={[
                styles.verticalTickRow,
                {
                  height: tickGap,
                  justifyContent: isRightAligned ? 'flex-end' : 'flex-start',
                },
              ]}
            >
              {isRightAligned && isMajor ? (
                <Text tabular style={styles.verticalLabelLeft}>
                  {formatLabel ? formatLabel(tickValue) : String(Math.round(tickValue))}
                </Text>
              ) : null}
              <View
                style={[
                  styles.tickHorizontalBar,
                  {
                    width: isMajor ? 28 : isMid ? 18 : 11,
                    backgroundColor: isMajor
                      ? colors.hairlineLit
                      : isMid
                        ? colors.textLo
                        : colors.textOff,
                  },
                ]}
              />
              {!isRightAligned && isMajor ? (
                <Text tabular style={styles.verticalLabelRight}>
                  {formatLabel ? formatLabel(tickValue) : String(Math.round(tickValue))}
                </Text>
              ) : null}
            </View>
          ))}
        </ScrollView>

        {/* Edge fade over 22% top and bottom */}
        <View pointerEvents="none" style={[styles.fadeTop, { height: Math.round(length * 0.22) }]}>
          <Svg width="100%" height="100%" preserveAspectRatio="none">
            <Defs>
              <LinearGradient id="vFadeTop" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.bg0} stopOpacity="1" />
                <Stop offset="1" stopColor={colors.bg0} stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#vFadeTop)" />
          </Svg>
        </View>
        <View
          pointerEvents="none"
          style={[styles.fadeBottom, { height: Math.round(length * 0.22) }]}
        >
          <Svg width="100%" height="100%" preserveAspectRatio="none">
            <Defs>
              <LinearGradient id="vFadeBot" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.bg0} stopOpacity="0" />
                <Stop offset="1" stopColor={colors.bg0} stopOpacity="1" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#vFadeBot)" />
          </Svg>
        </View>

        {/* Apricot needle pointing across the active tick */}
        <View
          pointerEvents="none"
          style={[
            styles.verticalNeedle,
            isRightAligned ? styles.verticalNeedleRight : styles.verticalNeedleLeft,
          ]}
        />
      </View>
    );
  }

  return (
    <View
      style={[styles.horizontalRoot, { width: length, height: breadth }, style]}
      accessibilityRole="adjustable"
      accessibilityLabel={
        accessibilityLabel ?? `Measurement picker, ${value}${unit ? ` ${unit}` : ''}`
      }
      accessibilityValue={{ min, max, now: value }}
      testID={testID}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={tickGap}
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScrollBeginDrag={() => {
          isDraggingRef.current = true;
        }}
        onMomentumScrollEnd={() => {
          isDraggingRef.current = false;
        }}
        onScrollEndDrag={() => {
          isDraggingRef.current = false;
        }}
        onLayout={() => scrollToValue(lastReported.current)}
        onScroll={handleScroll}
        contentOffset={{ x: initialOffset, y: 0 }}
        contentContainerStyle={{
          paddingLeft: halfLength,
          paddingRight: halfLength,
          alignItems: 'flex-start',
        }}
      >
        {ticks.map(({ tickValue, isMajor, isMid }) => (
          <View key={tickValue} style={[styles.tickCol, { width: tickGap }]}>
            <View
              style={[
                styles.tickBar,
                {
                  height: isMajor ? 28 : isMid ? 18 : 11,
                  backgroundColor: isMajor
                    ? colors.hairlineLit
                    : isMid
                      ? colors.textLo
                      : colors.textOff,
                },
              ]}
            />
            {isMajor ? (
              <View style={styles.horizontalLabelWrap}>
                <Text tabular numberOfLines={1} style={styles.horizontalLabel}>
                  {formatLabel ? formatLabel(tickValue) : String(Math.round(tickValue))}
                </Text>
              </View>
            ) : null}
          </View>
        ))}
      </ScrollView>

      {/* Edge fade over 22% each side */}
      <View pointerEvents="none" style={[styles.fadeLeft, { width: Math.round(length * 0.22) }]}>
        <Svg width="100%" height="100%" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="hFadeL" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={colors.bg0} stopOpacity="1" />
              <Stop offset="1" stopColor={colors.bg0} stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#hFadeL)" />
        </Svg>
      </View>
      <View pointerEvents="none" style={[styles.fadeRight, { width: Math.round(length * 0.22) }]}>
        <Svg width="100%" height="100%" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="hFadeR" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={colors.bg0} stopOpacity="0" />
              <Stop offset="1" stopColor={colors.bg0} stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#hFadeR)" />
        </Svg>
      </View>

      {/* Needle: 3 x 48 apricot, radius 1.5 */}
      <View pointerEvents="none" style={styles.horizontalNeedle} />
    </View>
  );
}

const styles = StyleSheet.create({
  horizontalRoot: {
    alignSelf: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  tickCol: {
    alignItems: 'center',
    overflow: 'visible',
  },
  tickBar: {
    width: 2,
    borderRadius: radius.tick,
  },
  horizontalLabelWrap: {
    width: 44,
    marginTop: 10,
    alignItems: 'center',
  },
  horizontalLabel: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 16,
    color: colors.textLo,
    textAlign: 'center',
  },
  horizontalNeedle: {
    position: 'absolute',
    top: 0,
    left: '50%',
    marginLeft: -1.5,
    width: 3,
    height: 48,
    borderRadius: 1.5,
    backgroundColor: colors.apricot,
  },
  fadeLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  fadeRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
  },
  verticalRoot: {
    position: 'relative',
    overflow: 'hidden',
  },
  verticalTickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'visible',
  },
  tickHorizontalBar: {
    height: 2,
    borderRadius: radius.tick,
  },
  verticalLabelLeft: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 16,
    color: colors.textLo,
    marginRight: 10,
    textAlign: 'right',
    minWidth: 36,
  },
  verticalLabelRight: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 16,
    color: colors.textLo,
    marginLeft: 8,
  },
  verticalNeedle: {
    position: 'absolute',
    top: '50%',
    marginTop: -1.5,
    width: 52,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.apricot,
  },
  verticalNeedleLeft: {
    left: 0,
  },
  verticalNeedleRight: {
    right: 0,
  },
  fadeTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  fadeBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
});
