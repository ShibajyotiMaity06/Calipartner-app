import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Hook to detect whether the user has requested reduced motion in system settings.
 * Respects Reduce Motion across iOS and Android.
 */
export function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    let mounted = true;

    if (AccessibilityInfo?.isReduceMotionEnabled) {
      AccessibilityInfo.isReduceMotionEnabled()
        .then((enabled) => {
          if (mounted) setReducedMotion(Boolean(enabled));
        })
        .catch(() => {});
    }

    const subscription = AccessibilityInfo?.addEventListener?.(
      'reduceMotionChanged',
      (enabled: boolean) => {
        if (mounted) setReducedMotion(Boolean(enabled));
      },
    );

    return () => {
      mounted = false;
      subscription?.remove?.();
    };
  }, []);

  return reducedMotion;
}
