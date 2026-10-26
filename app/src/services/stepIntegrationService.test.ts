import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('./nativeHealthService', () => ({
  getNativeHealthPermission: async () => 'unavailable',
  requestNativeHealthPermission: async () => 'unavailable',
  readNativeHealthSteps: async () => null,
}));
const hardware = vi.hoisted(() => ({
  os: 'android',
  available: true,
  granted: true,
  callback: null as ((event: { steps: number }) => void) | null,
  remove: vi.fn(),
}));
vi.mock('react-native', () => ({
  Platform: {
    get OS() {
      return hardware.os;
    },
  },
}));
vi.mock('expo-secure-store', () => ({ getItemAsync: vi.fn(), setItemAsync: vi.fn() }));
vi.mock('expo-sensors', () => ({
  Pedometer: {
    isAvailableAsync: vi.fn(async () => hardware.available),
    requestPermissionsAsync: vi.fn(async () => ({ granted: hardware.granted })),
    getPermissionsAsync: vi.fn(async () => ({ granted: hardware.granted })),
    watchStepCount: vi.fn((callback: typeof hardware.callback) => {
      hardware.callback = callback;
      return { remove: hardware.remove };
    }),
    getStepCountAsync: vi.fn(async () => ({ steps: 1234 })),
  },
}));
import { Pedometer } from 'expo-sensors';
import { readDeviceSteps, watchWalkingSteps } from './stepIntegrationService';

beforeEach(() => {
  hardware.os = 'android';
  hardware.available = true;
  hardware.granted = true;
  hardware.callback = null;
  vi.clearAllMocks();
});
afterEach(() => vi.useRealTimers());

describe('measured walking steps', () => {
  it.each(['web', 'unavailable', 'denied'])('never invents steps when %s', async (mode) => {
    vi.useFakeTimers();
    hardware.os = mode === 'web' ? 'web' : 'android';
    hardware.available = mode !== 'unavailable';
    hardware.granted = mode !== 'denied';
    const onSteps = vi.fn();
    const watcher = await watchWalkingSteps(onSteps);
    await vi.advanceTimersByTimeAsync(600_000);
    expect(onSteps).not.toHaveBeenCalled();
    expect(watcher.status).not.toBe('granted');
    expect(Pedometer.watchStepCount).not.toHaveBeenCalled();
  });

  it('includes the first real hardware event and ignores invalid readings', async () => {
    const onSteps = vi.fn();
    const watcher = await watchWalkingSteps(onSteps);
    hardware.callback?.({ steps: 12 });
    hardware.callback?.({ steps: 200 });
    hardware.callback?.({ steps: Number.NaN });
    hardware.callback?.({ steps: -1 });
    expect(onSteps.mock.calls).toEqual([[12], [200]]);
    watcher.remove();
    expect(hardware.remove).toHaveBeenCalledOnce();
  });

  it('does not use unsupported historical queries on Android', async () => {
    expect(await readDeviceSteps('2026-10-23')).toBeNull();
    expect(Pedometer.getStepCountAsync).not.toHaveBeenCalled();
    hardware.os = 'ios';
    expect((await readDeviceSteps('2026-10-23'))?.steps).toBe(1234);
  });
});
