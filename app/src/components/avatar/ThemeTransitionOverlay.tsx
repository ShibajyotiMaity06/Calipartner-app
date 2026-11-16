import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, StyleSheet, useWindowDimensions } from 'react-native';
import { motion, useTheme } from '@calipartner/ui';
import { registerThemeReveal, type ThemeReveal } from './themeTransition';

export function ThemeTransitionOverlay() {
  const [request, setRequest] = useState<ThemeReveal | null>(null);
  const pending = useRef<ThemeReveal | null>(null);
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const { width, height } = useWindowDimensions();
  const { reduceMotion } = useTheme();
  useEffect(() => {
    const unregister = registerThemeReveal((next) => {
      pending.current = next;
      scale.setValue(0);
      opacity.setValue(1);
      setRequest(next);
    });
    return () => {
      unregister();
      pending.current?.finish();
    };
  }, [opacity, scale]);
  useEffect(() => {
    if (!request) return;
    if (reduceMotion) {
      request.finish();
      pending.current = null;
      setRequest(null);
      return;
    }
    let frame: number | undefined;
    const expand = Animated.timing(scale, {
      toValue: 1,
      duration: motion.theme.duration - motion.base.duration,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    });
    const fade = Animated.timing(opacity, {
      toValue: 0,
      duration: motion.base.duration,
      useNativeDriver: true,
    });
    expand.start(({ finished }) => {
      if (!finished) return;
      request.finish();
      frame = requestAnimationFrame(() =>
        fade.start(({ finished: faded }) => {
          if (faded) {
            pending.current = null;
            setRequest(null);
          }
        }),
      );
    });
    return () => {
      expand.stop();
      fade.stop();
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, [request, scale, opacity, reduceMotion]);
  if (!request) return null;
  const radius = Math.hypot(
    Math.max(request.x, width - request.x),
    Math.max(request.y, height - request.y),
  );
  return (
    <Modal
      transparent
      visible
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      hardwareAccelerated
      onRequestClose={() => {}}
    >
      <Animated.View
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        testID="native-theme-reveal"
        style={[
          styles.circle,
          {
            left: request.x - radius,
            top: request.y - radius,
            width: radius * 2,
            height: radius * 2,
            borderRadius: radius,
            backgroundColor: request.color,
            opacity,
            transform: [{ scale }],
          },
        ]}
      />
    </Modal>
  );
}
const styles = StyleSheet.create({ circle: { position: 'absolute' } });
