import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { Button, Text, entryLayout as layout, radius, space, useTheme } from '@calipartner/ui';
import { t } from '@/i18n';

/** A bounded picker: canonical unit conversion belongs to the caller, never the scroll view. */
export function StatsPicker({
  value,
  min,
  max,
  step = 1,
  label,
  format,
  horizontal = false,
  testID,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  label: string;
  format: (value: number) => string;
  horizontal?: boolean;
  testID: string;
  onChange: (value: number) => void;
}) {
  const { colors, reduceMotion } = useTheme();
  const { fontScale } = useWindowDimensions();
  const row = layout.wheelRow * Math.min(2, Math.max(1, fontScale));
  const interval = horizontal ? layout.rulerTick : row;
  const count = Math.round((max - min) / step) + 1;
  const clamp = (index: number) => Math.max(0, Math.min(count - 1, index));
  const index = clamp(Math.round((value - min) / step) || 0);
  const selected = useRef(index);
  const vertical = useRef<ScrollView>(null);
  const ruler = useRef<FlatList<number>>(null);
  const dragging = useRef(false);
  const touching = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [width, setWidth] = useState(0);
  const toValue = (i: number) => Math.round((min + i * step) * 100) / 100;
  const scrollTo = (i: number, animated: boolean) =>
    horizontal
      ? ruler.current?.scrollToOffset({ offset: i * interval, animated })
      : vertical.current?.scrollTo({ y: i * interval, animated });
  useEffect(() => {
    if (dragging.current) return;
    selected.current = index;
    scrollTo(index, false);
    // Re-align after a unit, layout or external value change, never during a gesture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, interval, width, horizontal]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const choose = (i: number, scroll = true) => {
    const next = clamp(i);
    if (selected.current !== next) void Haptics.selectionAsync().catch(() => {});
    selected.current = next;
    onChange(toValue(next));
    if (scroll) scrollTo(next, !reduceMotion);
  };
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offset = horizontal
      ? event.nativeEvent.contentOffset.x
      : event.nativeEvent.contentOffset.y;
    const next = clamp(Math.round(offset / interval));
    if (!dragging.current) return;
    if (next !== selected.current) choose(next, false);
    if (timer.current) clearTimeout(timer.current);
    // Also settles mouse-wheel and keyboard scrolling on web, where momentum events differ.
    timer.current = setTimeout(() => {
      if (touching.current) return;
      dragging.current = false;
      scrollTo(next, !reduceMotion);
    }, 160);
  };
  const renderItem = (i: number) =>
    horizontal ? (
      <View
        key={i}
        style={{
          width: interval,
          alignItems: 'center',
          justifyContent: 'flex-end',
          height: layout.rulerHeight,
        }}
      >
        <View
          style={{
            width: layout.guide,
            height: i % 10 === 0 ? layout.rulerLong : layout.rulerShort,
            backgroundColor: i === index ? colors.apricot : colors.textLo,
          }}
        />
        {i % 10 === 0 ? (
          <Text variant="micro" tabular style={styles.tickLabel}>
            {toValue(i)}
          </Text>
        ) : (
          <View style={styles.tickLabel} />
        )}
      </View>
    ) : (
      <View key={i} style={{ height: row, justifyContent: 'center', alignItems: 'center' }}>
        <Text
          variant={i === index ? 'numeralM' : 'body'}
          color={i === index ? colors.textHi : colors.textLo}
          tabular
        >
          {format(toValue(i))}
        </Text>
      </View>
    );
  return (
    <View style={styles.section} testID={testID}>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min, max, now: toValue(index), text: format(toValue(index)) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) =>
          choose(selected.current + (event.nativeEvent.actionName === 'increment' ? 1 : -1))
        }
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        style={[
          styles.viewport,
          {
            backgroundColor: colors.s1,
            height: horizontal ? layout.rulerHeight : row * layout.wheelRows,
          },
        ]}
      >
        {horizontal ? (
          <FlatList
            ref={ruler}
            horizontal
            data={Array.from({ length: count }, (_, i) => i)}
            keyExtractor={(i) => String(i)}
            renderItem={({ item }) => renderItem(item)}
            extraData={index}
            getItemLayout={(_, i) => ({ length: interval, offset: interval * i, index: i })}
            contentContainerStyle={{ paddingHorizontal: Math.max(0, (width - interval) / 2) }}
            initialScrollIndex={index}
            initialNumToRender={40}
            windowSize={5}
            showsHorizontalScrollIndicator={false}
            snapToInterval={interval}
            decelerationRate="fast"
            onScrollBeginDrag={() => {
              dragging.current = true;
            }}
            onTouchStart={() => {
              touching.current = true;
              dragging.current = true;
            }}
            onTouchEnd={() => {
              touching.current = false;
            }}
            onScroll={onScroll}
            scrollEventThrottle={16}
            testID={`${testID}-scroll`}
            {...{
              onWheel: () => {
                dragging.current = true;
              },
            }}
          />
        ) : (
          <ScrollView
            ref={vertical}
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingVertical: row }}
            snapToInterval={interval}
            decelerationRate="fast"
            onScrollBeginDrag={() => {
              dragging.current = true;
            }}
            onTouchStart={() => {
              touching.current = true;
              dragging.current = true;
            }}
            onTouchEnd={() => {
              touching.current = false;
            }}
            onScroll={onScroll}
            scrollEventThrottle={16}
            testID={`${testID}-scroll`}
            {...{
              onWheel: () => {
                dragging.current = true;
              },
            }}
          >
            {Array.from({ length: count }, (_, i) => renderItem(i))}
          </ScrollView>
        )}
        <View
          pointerEvents="none"
          style={
            horizontal
              ? [styles.rulerGuide, { borderColor: colors.apricot }]
              : [styles.guides, { top: row, height: row, borderColor: colors.hairlineLit }]
          }
        />
        {!horizontal ? (
          <Svg pointerEvents="none" width="100%" height="100%" style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id={`wheelShade-${testID}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.s1} />
                <Stop offset="0.33" stopColor={colors.s1} stopOpacity={0} />
                <Stop offset="0.67" stopColor={colors.s1} stopOpacity={0} />
                <Stop offset="1" stopColor={colors.s1} />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill={`url(#wheelShade-${testID})`} />
          </Svg>
        ) : null}
      </View>
      <View style={styles.adjustments}>
        <Button
          variant="secondary"
          fullWidth={false}
          label="−"
          accessibilityLabel={t('entryPolish.decrease', { label })}
          disabled={index === 0}
          onPress={() => choose(index - 1)}
          testID={`${testID}-decrease`}
        />
        <Button
          variant="tertiary"
          fullWidth={false}
          label={format(toValue(index))}
          accessibilityLabel={format(toValue(index))}
          onPress={() => choose(index)}
          testID={`${testID}-select`}
        />
        <Button
          variant="secondary"
          fullWidth={false}
          label="+"
          accessibilityLabel={t('entryPolish.increase', { label })}
          disabled={index === count - 1}
          onPress={() => choose(index + 1)}
          testID={`${testID}-increase`}
        />
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  section: { gap: space[2], minWidth: 0, flexShrink: 1 },
  viewport: { overflow: 'hidden', borderRadius: radius.control },
  adjustments: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[1],
  },
  guides: {
    position: 'absolute',
    left: space[2],
    right: space[2],
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  rulerGuide: {
    position: 'absolute',
    left: '50%',
    top: space[2],
    bottom: space[5],
    borderLeftWidth: layout.guide,
  },
  tickLabel: { width: layout.rulerLong, height: space[5], textAlign: 'center' },
});
