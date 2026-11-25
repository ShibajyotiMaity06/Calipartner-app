import React, { useEffect, useMemo, useRef } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Text, borders, colors, fonts, triggerHaptic } from '@calipartner/ui/v1';

const ROW_HEIGHT = 48;
const VISIBLE_ROWS = 5;
const WHEEL_HEIGHT = ROW_HEIGHT * VISIBLE_ROWS;

interface AgeWheelPickerProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  accessibilityLabel?: string;
  testID?: string;
}

export function AgeWheelPicker({
  value,
  min = 18,
  max = 90,
  onChange,
  accessibilityLabel,
  testID,
}: AgeWheelPickerProps) {
  const scrollRef = useRef<ScrollView>(null);
  const lastReported = useRef(value);
  const isDraggingRef = useRef(false);

  const values = useMemo(
    () => Array.from({ length: max - min + 1 }, (_, index) => min + index),
    [min, max],
  );

  const clampedValue = Math.max(min, Math.min(max, Math.round(value)));

  const scrollToAge = (age: number, animated: boolean) => {
    const offsetY = Math.max(0, (Math.max(min, Math.min(max, age)) - min) * ROW_HEIGHT);
    if (typeof scrollRef.current?.scrollTo === 'function') {
      scrollRef.current.scrollTo({ x: 0, y: offsetY, animated });
    }
  };

  useEffect(() => {
    if (isDraggingRef.current) return;
    if (clampedValue !== lastReported.current) {
      lastReported.current = clampedValue;
      scrollToAge(clampedValue, false);
    }
  });

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const nextAge = Math.max(min, Math.min(max, Math.round(min + offsetY / ROW_HEIGHT)));
    if (nextAge !== lastReported.current) {
      lastReported.current = nextAge;
      triggerHaptic('selection');
      onChange(nextAge);
    }
  };

  const selectItem = (age: number) => {
    if (age !== lastReported.current) {
      lastReported.current = age;
      triggerHaptic('selection');
      onChange(age);
    }
    scrollToAge(age, true);
  };

  const initialOffsetY = (clampedValue - min) * ROW_HEIGHT;

  return (
    <View
      style={styles.root}
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel ?? String(clampedValue)}
      accessibilityValue={{ min, max, now: clampedValue }}
      testID={testID}
    >
      <View pointerEvents="none" style={[styles.hairline, styles.hairlineTop]} />
      <View pointerEvents="none" style={[styles.hairline, styles.hairlineBottom]} />

      <ScrollView
        ref={scrollRef}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={ROW_HEIGHT}
        decelerationRate="fast"
        scrollEventThrottle={16}
        contentOffset={{ x: 0, y: initialOffsetY }}
        contentContainerStyle={styles.scrollContent}
        onLayout={() => scrollToAge(clampedValue, false)}
        onScrollBeginDrag={() => {
          isDraggingRef.current = true;
        }}
        onMomentumScrollEnd={() => {
          isDraggingRef.current = false;
        }}
        onScrollEndDrag={() => {
          isDraggingRef.current = false;
        }}
        onScroll={handleScroll}
      >
        {values.map((item) => {
          const distance = Math.abs(item - clampedValue);
          const itemStyle =
            distance === 0
              ? styles.rowTextSelected
              : distance === 1
                ? styles.rowTextNear
                : styles.rowTextFar;

          return (
            <Pressable
              key={item}
              onPress={() => selectItem(item)}
              accessibilityRole="button"
              accessibilityState={{ selected: distance === 0 }}
              style={styles.row}
              testID={testID ? `${testID}-option-${item}` : undefined}
            >
              <Text maxFontSizeMultiplier={1.2} tabular style={itemStyle}>
                {String(item)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    height: WHEEL_HEIGHT,
    position: 'relative',
    overflow: 'hidden',
  },
  hairline: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: borders.width,
    backgroundColor: colors.hairline,
    zIndex: 1,
  },
  hairlineTop: {
    top: ROW_HEIGHT * 2,
  },
  hairlineBottom: {
    top: ROW_HEIGHT * 3,
  },
  scrollContent: {
    paddingVertical: ROW_HEIGHT * 2,
  },
  row: {
    height: ROW_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTextSelected: {
    fontFamily: fonts.display,
    fontSize: 40,
    lineHeight: 44,
    color: colors.textHi,
  },
  rowTextNear: {
    fontFamily: fonts.display,
    fontSize: 24,
    lineHeight: 28,
    color: colors.textLo,
  },
  rowTextFar: {
    fontFamily: fonts.display,
    fontSize: 18,
    lineHeight: 22,
    color: colors.textOff,
  },
});
