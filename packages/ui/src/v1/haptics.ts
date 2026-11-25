/**
 * CaliPartner Design System v1 — Safe Cross-Platform Haptics Helper
 * Single source of truth: docs/ui/DESIGN_SYSTEM_V1.md (Section 7)
 */
import type * as ExpoHaptics from 'expo-haptics';
import { Platform } from 'react-native';

export type HapticMoment = 'light' | 'medium' | 'selection' | 'success';

type HapticsModule = typeof ExpoHaptics;

let cachedModule: HapticsModule | null | undefined;

async function getHaptics(): Promise<HapticsModule | null> {
  if (Platform.OS === 'web') return null;
  if (cachedModule !== undefined) return cachedModule;
  try {
    cachedModule = await import('expo-haptics');
    return cachedModule;
  } catch {
    cachedModule = null;
    return null;
  }
}

/** Triggers a calm, non-blocking haptic response matching Section 7 of the spec. */
export function triggerHaptic(moment: HapticMoment): void {
  void getHaptics()
    .then((mod) => {
      if (!mod) return;
      switch (moment) {
        case 'light':
          return mod.impactAsync?.(mod.ImpactFeedbackStyle.Light);
        case 'medium':
          return mod.impactAsync?.(mod.ImpactFeedbackStyle.Medium);
        case 'selection':
          return mod.selectionAsync?.();
        case 'success':
          return mod.notificationAsync?.(mod.NotificationFeedbackType.Success);
      }
    })
    .catch(() => {});
}
