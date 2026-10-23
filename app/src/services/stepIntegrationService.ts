import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Pedometer } from 'expo-sensors';
import type { ActivitySource } from '@calipartner/core';
import { createLogger } from '@/lib/logger';

const log = createLogger('stepIntegrationService');

export type StepPermissionStatus = 'granted' | 'denied' | 'not_requested' | 'unavailable';

export interface StepReading {
  steps: number;
  distance_m: number | null;
  source: ActivitySource;
}

const PERMISSION_STORE_KEY = 'calipartner_step_permission_status';

/**
 * Returns the persisted user permission status for health/step integrations.
 */
export async function getStepPermissionStatus(): Promise<StepPermissionStatus> {
  if (Platform.OS === 'web') {
    return 'unavailable';
  }

  try {
    const isAvail = await Pedometer.isAvailableAsync().catch(() => false);
    if (!isAvail) {
      return 'unavailable';
    }

    const perm = await Pedometer.getPermissionsAsync().catch(() => null);
    if (perm) {
      if (perm.granted) {
        await SecureStore.setItemAsync(PERMISSION_STORE_KEY, 'granted').catch(() => {});
        return 'granted';
      } else if (!perm.canAskAgain) {
        return 'denied';
      }
    }

    const saved = await SecureStore.getItemAsync(PERMISSION_STORE_KEY);
    if (saved === 'granted' || saved === 'denied' || saved === 'unavailable') {
      return saved as StepPermissionStatus;
    }
    return 'not_requested';
  } catch (e) {
    log.warn(`Failed to read step permission status: ${e}`);
    return 'not_requested';
  }
}

/**
 * Requests permissions for health platforms (Health Connect on Android, HealthKit on iOS)
 * or device step sensors.
 */
export async function requestStepPermissions(): Promise<{
  granted: boolean;
  status: StepPermissionStatus;
}> {
  if (Platform.OS === 'web') {
    return { granted: false, status: 'unavailable' };
  }

  try {
    const isAvail = await Pedometer.isAvailableAsync().catch(() => false);
    if (!isAvail) {
      await SecureStore.setItemAsync(PERMISSION_STORE_KEY, 'unavailable').catch(() => {});
      return { granted: false, status: 'unavailable' };
    }

    const res = await Pedometer.requestPermissionsAsync().catch(() => ({ granted: false }));
    const status: StepPermissionStatus = res.granted ? 'granted' : 'denied';
    await SecureStore.setItemAsync(PERMISSION_STORE_KEY, status).catch(() => {});
    log.info(`Step platform permission status: ${status}`);
    return { granted: res.granted, status };
  } catch (e) {
    log.warn(`Permission request failed or denied: ${e}`);
    await SecureStore.setItemAsync(PERMISSION_STORE_KEY, 'denied').catch(() => {});
    return { granted: false, status: 'denied' };
  }
}

/**
 * Marks step permission as explicitly denied by the user.
 */
export async function setStepPermissionDenied(): Promise<void> {
  try {
    await SecureStore.setItemAsync(PERMISSION_STORE_KEY, 'denied');
  } catch (e) {
    log.warn(`Failed to save denied status: ${e}`);
  }
}

/**
 * Reads daily steps from available hardware/platform sensors:
 * Priority 1: Built-in hardware pedometer date range query (iOS CMPedometer / Android Step Counter)
 * Priority 2: Return null if unavailable so user's manual/logged session steps are preserved
 */
export async function readDeviceSteps(localDate: string): Promise<StepReading | null> {
  if (Platform.OS === 'web') {
    return null;
  }

  try {
    const isAvail = await Pedometer.isAvailableAsync().catch(() => false);
    if (!isAvail) {
      return null;
    }

    const perm = await Pedometer.getPermissionsAsync().catch(() => null);
    if (!perm?.granted) {
      return null;
    }

    const [year, month, day] = localDate.split('-').map(Number);
    if (!year || !month || !day) return null;

    const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
    const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);
    const now = new Date();
    const endTime = now < endOfDay ? now : endOfDay;

    const result = await Pedometer.getStepCountAsync(startOfDay, endTime).catch(() => null);
    if (result && typeof result.steps === 'number') {
      return {
        steps: result.steps,
        distance_m: null,
        source: 'pedometer',
      };
    }
    return null;
  } catch (err) {
    log.warn(`Failed reading device steps via pedometer: ${err}`);
    return null;
  }
}
