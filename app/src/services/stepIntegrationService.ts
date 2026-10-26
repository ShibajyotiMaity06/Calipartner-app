import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Pedometer } from 'expo-sensors';
import { getLocalDayBounds, type ActivitySource } from '@calipartner/core';
import {
  getNativeHealthPermission,
  readNativeHealthSteps,
  requestNativeHealthPermission,
} from './nativeHealthService';
import { createLogger } from '@/lib/logger';

const log = createLogger('stepIntegrationService');

export type StepPermissionStatus = 'granted' | 'denied' | 'not_requested' | 'unavailable';

export interface StepReading {
  steps: number;
  distance_m: number | null;
  source: ActivitySource;
}

/** Every update comes from hardware. Unsupported/denied sensors never synthesize steps. */
export async function watchWalkingSteps(
  onSteps: (steps: number) => void,
): Promise<{ status: StepPermissionStatus; remove: () => void }> {
  const unavailable = { status: 'unavailable' as const, remove: () => {} };
  if (Platform.OS === 'web') return unavailable;
  try {
    if (!(await Pedometer.isAvailableAsync())) return unavailable;
    const permission = await Pedometer.requestPermissionsAsync();
    if (!permission.granted) return { status: 'denied', remove: () => {} };
    const subscription = Pedometer.watchStepCount(({ steps }) => {
      if (Number.isInteger(steps) && steps >= 0) onSteps(steps);
    });
    return { status: 'granted', remove: () => subscription.remove() };
  } catch {
    return unavailable;
  }
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
    const healthStatus = await getNativeHealthPermission();
    if (healthStatus !== 'unavailable') return healthStatus;
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
      return perm.status === 'undetermined' ? 'not_requested' : 'denied';
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
    const healthStatus = await requestNativeHealthPermission();
    if (healthStatus !== 'unavailable')
      return { granted: healthStatus === 'granted', status: healthStatus };
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
 * iOS supports historical queries; Android requires live hardware updates or Health Connect.
 * Priority 2: Return null if unavailable so user's manual/logged session steps are preserved
 */
export async function readDeviceSteps(
  localDate: string,
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
): Promise<StepReading | null> {
  if (Platform.OS === 'web') return null;
  try {
    const health = await readNativeHealthSteps(localDate, timeZone);
    if (health) return health;
  } catch (error) {
    log.warn(
      'Health step history unavailable',
      error instanceof Error ? error.message : String(error),
    );
  }
  if (Platform.OS !== 'ios') {
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

    const { start: startOfDay, end: endOfDay } = getLocalDayBounds(localDate, timeZone);
    const now = new Date();
    const endTime = now < endOfDay ? now : endOfDay;
    if (endTime <= startOfDay) return null;

    const result = await Pedometer.getStepCountAsync(startOfDay, endTime).catch(() => null);
    if (result && Number.isInteger(result.steps) && result.steps >= 0) {
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
