import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Hook to detect whether the user has requested reduced transparency in system settings.
 * When enabled, blur/glass falls back to opaque s2 surface.
 */
export function useReduceTransparency(): boolean {
  const [reduceTransparency, setReduceTransparency] = useState(false);

  useEffect(() => {
    let mounted = true;

    if (AccessibilityInfo?.isReduceTransparencyEnabled) {
      AccessibilityInfo.isReduceTransparencyEnabled()
        .then((enabled) => {
          if (mounted) setReduceTransparency(Boolean(enabled));
        })
        .catch(() => {});
    }

    const subscription = AccessibilityInfo?.addEventListener?.(
      'reduceTransparencyChanged',
      (enabled: boolean) => {
        if (mounted) setReduceTransparency(Boolean(enabled));
      },
    );

    return () => {
      mounted = false;
      subscription?.remove?.();
    };
  }, []);

  return reduceTransparency;
}
