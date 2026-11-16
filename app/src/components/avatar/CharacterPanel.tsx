import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { avatarLayout, motion, radius, space, useReducedMotion, useTheme } from '@calipartner/ui';
import { t } from '@/i18n';

/** Only the handle owns the gesture, so item and colour lists retain native scrolling. */
export function CharacterPanel({
  character,
  children,
  footer,
}: {
  character: (height: number) => React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const [height, setHeight] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [position, setPosition] = useState(0);
  const offset = useRef(new Animated.Value(0)).current;
  const current = useRef(0);
  const start = useRef(0);
  const suppressTapUntil = useRef(0);
  const handle = useRef<View>(null);
  React.useEffect(() => {
    const listener = offset.addListener(({ value }) => {
      current.current = value;
      setPosition(value);
    });
    return () => offset.removeListener(listener);
  }, [offset]);
  const travel = Math.max(0, height * avatarLayout.panelFraction - avatarLayout.panelHandleHeight);
  const settle = useCallback(
    (closed: boolean) => {
      setCollapsed(closed);
      Animated.timing(offset, {
        toValue: closed ? 1 : 0,
        duration: reduced ? 0 : motion.base.duration,
        useNativeDriver: false,
      }).start();
    },
    [offset, reduced],
  );
  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, g) =>
          Math.abs(g.dy) > avatarLayout.dragThreshold && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderGrant: () => {
          offset.stopAnimation();
          start.current = current.current;
        },
        onPanResponderMove: (_, g) =>
          offset.setValue(Math.max(0, Math.min(1, start.current + g.dy / Math.max(1, travel)))),
        onPanResponderRelease: (_, g) => {
          suppressTapUntil.current = Date.now() + motion.base.duration;
          settle(g.vy > 0.5 || (g.vy >= -0.5 && current.current > 0.5));
        },
        onPanResponderTerminate: () => settle(current.current > 0.5),
      }),
    [travel, settle, offset],
  );
  // Browser pointer capture keeps a mouse or touch drag active outside the narrow handle.
  React.useEffect(() => {
    if (Platform.OS !== 'web') return;
    type PointerInput = {
      isPrimary: boolean;
      button: number;
      pointerId: number;
      clientY: number;
      preventDefault: () => void;
    };
    const node = handle.current as unknown as {
      style: { touchAction: string };
      setPointerCapture: (id: number) => void;
      addEventListener: (name: string, callback: (event: PointerInput) => void) => void;
      removeEventListener: (name: string, callback: (event: PointerInput) => void) => void;
    } | null;
    if (!node) return;
    let pointer: number | null = null;
    let origin = 0;
    let moved = false;
    const down = (event: PointerInput) => {
      if (!event.isPrimary || event.button !== 0) return;
      pointer = event.pointerId;
      origin = event.clientY;
      moved = false;
      offset.stopAnimation();
      start.current = current.current;
      node.setPointerCapture(pointer);
    };
    const move = (event: PointerInput) => {
      if (event.pointerId !== pointer) return;
      const delta = event.clientY - origin;
      if (!moved && Math.abs(delta) > avatarLayout.dragThreshold) {
        moved = true;
      }
      if (!moved) return;
      event.preventDefault();
      offset.setValue(Math.max(0, Math.min(1, start.current + delta / Math.max(1, travel))));
    };
    const up = (event: PointerInput) => {
      if (event.pointerId !== pointer) return;
      pointer = null;
      if (moved) {
        suppressTapUntil.current = Date.now() + motion.base.duration;
        settle(current.current > 0.5);
      }
    };
    node.style.touchAction = 'none';
    node.addEventListener('pointerdown', down);
    node.addEventListener('pointermove', move);
    node.addEventListener('pointerup', up);
    node.addEventListener('pointercancel', up);
    return () => {
      node.removeEventListener('pointerdown', down);
      node.removeEventListener('pointermove', move);
      node.removeEventListener('pointerup', up);
      node.removeEventListener('pointercancel', up);
    };
  }, [offset, settle, travel]);
  const panelHeight = avatarLayout.panelHandleHeight + travel * (1 - position);
  return (
    <View
      style={styles.root}
      onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
      testID="character-stage"
    >
      <View style={styles.character}>{character(Math.max(0, height - panelHeight))}</View>
      <View
        style={[
          styles.panel,
          { height: panelHeight, backgroundColor: colors.s1, borderColor: colors.hairline },
        ]}
        testID="character-panel"
      >
        <View {...(Platform.OS === 'web' ? {} : responder.panHandlers)}>
          <Pressable
            ref={handle}
            onPress={() => {
              if (Date.now() >= suppressTapUntil.current) settle(!collapsed);
            }}
            accessibilityRole="button"
            accessibilityLabel={t(collapsed ? 'avatar.showItems' : 'avatar.hideItems')}
            accessibilityState={{ expanded: !collapsed }}
            aria-expanded={!collapsed}
            testID="character-panel-handle"
            style={styles.handle}
          >
            <View style={[styles.grip, { backgroundColor: colors.textLo }]} />
          </Pressable>
        </View>
        {!collapsed || position < 1 ? (
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            testID="character-items-scroll"
          >
            {children}
          </ScrollView>
        ) : null}
        {!collapsed && footer ? (
          <View style={[styles.footer, { borderColor: colors.hairline }]}>{footer}</View>
        ) : null}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
  character: { flex: 1, justifyContent: 'center' },
  panel: {
    overflow: 'hidden',
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderWidth: avatarLayout.borderWidth,
  },
  handle: {
    height: avatarLayout.panelHandleHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grip: { width: space[8], height: space[1], borderRadius: radius.full },
  content: { paddingHorizontal: space[3], paddingBottom: space[6], gap: space[3] },
  footer: { padding: space[3], gap: space[2], borderTopWidth: avatarLayout.borderWidth },
});
