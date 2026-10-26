import { Linking, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { getLocalDayBounds } from '@calipartner/core';
import type { StepPermissionStatus, StepReading } from './stepIntegrationService';

const REQUESTED = 'calipartner_health_steps_requested_v1';
const DISABLED = 'calipartner_health_steps_disabled_v1';
const readTypes = [
  'HKQuantityTypeIdentifierStepCount',
  'HKQuantityTypeIdentifierDistanceWalkingRunning',
] as const;

export async function getNativeHealthPermission(): Promise<StepPermissionStatus> {
  if (Platform.OS === 'web') return 'unavailable';
  if ((await SecureStore.getItemAsync(DISABLED)) === 'true') return 'not_requested';
  try {
    if (Platform.OS === 'android') {
      const health = await import('react-native-health-connect');
      if (!(await health.initialize())) return 'unavailable';
      const granted = await health.getGrantedPermissions();
      if (
        granted.some(
          (p) => 'recordType' in p && p.recordType === 'Steps' && p.accessType === 'read',
        )
      )
        return 'granted';
      return (await SecureStore.getItemAsync(REQUESTED)) ? 'denied' : 'not_requested';
    }
    const health = await import('@kingstinct/react-native-healthkit');
    if (!health.isHealthDataAvailable()) return 'unavailable';
    // Apple deliberately does not disclose whether read access was denied.
    return (await SecureStore.getItemAsync(REQUESTED)) ? 'granted' : 'not_requested';
  } catch {
    return 'unavailable';
  }
}

export async function requestNativeHealthPermission(): Promise<StepPermissionStatus> {
  if (Platform.OS === 'web') return 'unavailable';
  try {
    await SecureStore.deleteItemAsync(DISABLED);
    if (Platform.OS === 'android') {
      const health = await import('react-native-health-connect');
      if (!(await health.initialize())) return 'unavailable';
      await SecureStore.setItemAsync(REQUESTED, 'true');
      const granted = await health.requestPermission([
        { accessType: 'read', recordType: 'Steps' },
        { accessType: 'read', recordType: 'Distance' },
      ]);
      return granted.some(
        (p) => 'recordType' in p && p.recordType === 'Steps' && p.accessType === 'read',
      )
        ? 'granted'
        : 'denied';
    }
    const health = await import('@kingstinct/react-native-healthkit');
    if (!health.isHealthDataAvailable()) return 'unavailable';
    if (!(await health.requestAuthorization({ toRead: readTypes }))) return 'denied';
    await SecureStore.setItemAsync(REQUESTED, 'true');
    return 'granted';
  } catch {
    return 'unavailable';
  }
}

export async function disconnectNativeHealth(): Promise<void> {
  await SecureStore.setItemAsync(DISABLED, 'true');
}

export async function openNativeHealthSettings(): Promise<void> {
  if (Platform.OS === 'android') {
    const health = await import('react-native-health-connect');
    health.openHealthConnectSettings();
  } else await Linking.openSettings();
}

/** Read platform aggregates, including activity collected while our process was stopped. */
export async function readNativeHealthSteps(
  localDate: string,
  timeZone: string,
): Promise<StepReading | null> {
  if ((await getNativeHealthPermission()) !== 'granted') return null;
  const { start, end } = getLocalDayBounds(localDate, timeZone);
  const until = new Date(Math.min(end.getTime(), Date.now()));
  if (until <= start) return null;
  if (Platform.OS === 'android') {
    const health = await import('react-native-health-connect');
    const timeRangeFilter = {
      operator: 'between' as const,
      startTime: start.toISOString(),
      endTime: until.toISOString(),
    };
    // Aggregate without origin filters so Health Connect de-duplicates phone/watch sources.
    const steps = await health.aggregateRecord({ recordType: 'Steps', timeRangeFilter });
    if (!Number.isFinite(steps.COUNT_TOTAL) || steps.COUNT_TOTAL < 0 || !steps.dataOrigins?.length)
      return null;
    const distance = await health
      .aggregateRecord({ recordType: 'Distance', timeRangeFilter })
      .catch(() => null);
    return {
      steps: Math.round(steps.COUNT_TOTAL),
      distance_m: distance?.DISTANCE?.inMeters ?? null,
      source: 'health_platform',
    };
  }
  const health = await import('@kingstinct/react-native-healthkit');
  const filter = {
    date: { startDate: start, endDate: until, strictStartDate: true, strictEndDate: true },
  };
  const steps = await health.queryStatisticsForQuantity(readTypes[0], ['cumulativeSum'], {
    filter,
    unit: 'count',
  });
  const count = steps.sumQuantity?.quantity;
  if (count == null || !Number.isFinite(count) || count < 0) return null;
  const distance = await health
    .queryStatisticsForQuantity(readTypes[1], ['cumulativeSum'], { filter, unit: 'm' })
    .catch(() => null);
  return {
    steps: Math.round(count),
    distance_m: distance?.sumQuantity?.quantity ?? null,
    source: 'health_platform',
  };
}
