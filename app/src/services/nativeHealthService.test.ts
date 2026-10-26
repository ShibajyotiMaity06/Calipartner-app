import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  os: 'android',
  store: new Map<string, string>(),
  granted: true,
  aggregate: vi.fn(),
  stats: vi.fn(),
  request: vi.fn(),
}));
vi.mock('react-native', () => ({
  Platform: {
    get OS() {
      return state.os;
    },
  },
  Linking: { openSettings: vi.fn() },
}));
vi.mock('expo-secure-store', () => ({
  getItemAsync: async (key: string) => state.store.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    state.store.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    state.store.delete(key);
  },
}));
vi.mock('react-native-health-connect', () => ({
  initialize: async () => true,
  getGrantedPermissions: async () =>
    state.granted ? [{ accessType: 'read', recordType: 'Steps' }] : [],
  requestPermission: async (...args: unknown[]) => {
    state.request(...args);
    return state.granted ? [{ accessType: 'read', recordType: 'Steps' }] : [];
  },
  aggregateRecord: state.aggregate,
}));
vi.mock('@kingstinct/react-native-healthkit', () => ({
  isHealthDataAvailable: () => true,
  requestAuthorization: async (...args: unknown[]) => {
    state.request(...args);
    return true;
  },
  queryStatisticsForQuantity: state.stats,
}));
import {
  disconnectNativeHealth,
  getNativeHealthPermission,
  readNativeHealthSteps,
  requestNativeHealthPermission,
} from './nativeHealthService';
beforeEach(() => {
  vi.clearAllMocks();
  state.os = 'android';
  state.granted = true;
  state.store.clear();
  state.aggregate.mockImplementation(async ({ recordType }: { recordType: string }) =>
    recordType === 'Steps'
      ? { COUNT_TOTAL: 6099, dataOrigins: ['phone-and-watch-deduplicated'] }
      : { DISTANCE: { inMeters: 4567 } },
  );
  state.stats.mockImplementation(async (type: string) => ({
    sumQuantity: { quantity: type.includes('StepCount') ? 6099 : 4567 },
  }));
});
describe('native daily health history', () => {
  it('reads the Android platform aggregate without filtering or adding phone/watch sources', async () => {
    expect(await readNativeHealthSteps('2026-10-25', 'Asia/Kolkata')).toEqual({
      steps: 6099,
      distance_m: 4567,
      source: 'health_platform',
    });
    expect(state.aggregate.mock.calls[0]![0]).toEqual({
      recordType: 'Steps',
      timeRangeFilter: {
        operator: 'between',
        startTime: '2026-10-24T18:30:00.000Z',
        endTime: '2026-10-25T18:30:00.000Z',
      },
    });
    expect(state.request).not.toHaveBeenCalled();
  });
  it('does not query or invent Android totals after denial', async () => {
    state.granted = false;
    expect(await requestNativeHealthPermission()).toBe('denied');
    expect(await readNativeHealthSteps('2026-10-25', 'UTC')).toBeNull();
    expect(state.aggregate).not.toHaveBeenCalled();
  });
  it('does not replace recorded steps with an empty Health Connect database', async () => {
    state.aggregate.mockResolvedValue({ COUNT_TOTAL: 0, dataOrigins: [] });
    expect(await readNativeHealthSteps('2026-10-25', 'UTC')).toBeNull();
  });
  it('uses iPhone health history after one authorization request', async () => {
    state.os = 'ios';
    expect(await getNativeHealthPermission()).toBe('not_requested');
    expect(await requestNativeHealthPermission()).toBe('granted');
    expect((await readNativeHealthSteps('2026-10-25', 'UTC'))?.steps).toBe(6099);
    await readNativeHealthSteps('2026-10-24', 'UTC');
    expect(state.request).toHaveBeenCalledTimes(1);
    expect(state.stats.mock.calls[0]![1]).toEqual(['cumulativeSum']);
  });
  it('keeps empty iPhone readings unknown instead of presenting zero as granted data', async () => {
    state.os = 'ios';
    await requestNativeHealthPermission();
    state.stats.mockResolvedValue({});
    expect(await readNativeHealthSteps('2026-10-25', 'UTC')).toBeNull();
  });
  it('stops platform access after disconnect', async () => {
    await disconnectNativeHealth();
    expect(await readNativeHealthSteps('2026-10-25', 'UTC')).toBeNull();
    expect(state.aggregate).not.toHaveBeenCalled();
  });
  it('does not request native permissions in Chrome or an installed web app', async () => {
    state.os = 'web';
    expect(await requestNativeHealthPermission()).toBe('unavailable');
    expect(await readNativeHealthSteps('2026-10-25', 'UTC')).toBeNull();
    expect(state.request).not.toHaveBeenCalled();
  });
});
