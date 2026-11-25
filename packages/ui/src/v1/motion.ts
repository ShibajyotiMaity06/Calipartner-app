/**
 * CaliPartner Design System v1 — Motion Tokens & Helpers
 * Single source of truth: docs/ui/DESIGN_SYSTEM_V1.md (Section 7)
 */
import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

export const motion = {
  press: {
    scale: 0.98,
    duration: 120,
  },
  sheetSpring: {
    damping: 20,
    stiffness: 220,
    mass: 1,
  },
  ringFill: {
    duration: 700,
  },
  numberTick: {
    duration: 450,
  },
  celebration: {
    scales: [0.8, 1.1, 1] as const,
    confettiDuration: 1200,
  },
  screenTransition: {
    duration: 250,
    slideDistance: 12,
  },
} as const;

/**
 * Shared animated scale hook for calm tactile press feedback (0.98 over 120ms),
 * honoring system Reduce Motion.
 */
export function usePressScale(reduceMotion: boolean) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (toValue: number) => {
    if (reduceMotion) {
      scale.setValue(1);
      return;
    }
    Animated.timing(scale, {
      toValue,
      duration: motion.press.duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  useEffect(() => {
    if (reduceMotion) {
      scale.setValue(1);
    }
  }, [reduceMotion, scale]);

  return {
    scale,
    onPressIn: () => animateTo(motion.press.scale),
    onPressOut: () => animateTo(1),
  };
}
