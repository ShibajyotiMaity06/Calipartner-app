import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sensor = vi.hoisted(() => ({
  steps: null as ((steps: number) => void) | null,
  gps: null as
    | ((location: {
        coords: { latitude: number; longitude: number; accuracy: number };
        timestamp: number;
      }) => void)
    | null,
  status: 'granted',
  remove: vi.fn(),
  save: vi.fn(),
  haptic: vi.fn(),
  sound: vi.fn(),
  permission: vi.fn(),
  read: vi.fn(),
  request: vi.fn(),
  history: vi.fn(),
}));
vi.mock('expo-location', () => ({
  Accuracy: { High: 4 },
  requestForegroundPermissionsAsync: sensor.permission,
  watchPositionAsync: vi.fn(async (options, callback) => {
    sensor.gps = callback;
    return { remove: sensor.remove };
  }),
}));
vi.mock('expo-haptics', () => ({
  NotificationFeedbackType: { Success: 'success' },
  notificationAsync: sensor.haptic,
}));
vi.mock('./RouteMap', () => ({ RouteMap: 'RouteMap' }));
vi.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
vi.mock('react-native', () => ({
  Platform: { OS: 'android' },
  Animated: { Value: class {}, View: 'AnimatedView' },
  StyleSheet: { create: (value: unknown) => value, hairlineWidth: 1 },
  Modal: 'Modal',
  View: 'View',
  ScrollView: 'ScrollView',
}));
vi.mock('@calipartner/ui', async () => ({
  ...(await import('../../../../packages/ui/src/tokens')),
  Text: 'Text',
  useTheme: () => ({ colors: {}, reduceMotion: true }),
  SegmentedControl: (await import('@/test/SegmentedControlStub')).SegmentedControlStub,
  NavigationIcon: 'NavigationIcon',
  Button: (await import('@/test/ButtonStub')).ButtonStub,
  Chip: 'Chip',
}));
vi.mock('@/components/onboarding/PlanPrimitives', () => ({ NumberField: 'NumberField' }));
vi.mock('@/components/trackers', () => ({ ManualStepsModal: 'ManualStepsModal' }));
vi.mock('@/hooks/useCurrentLocalDate', () => ({
  useCurrentLocalDate: () => ({ localDate: '2026-11-18' }),
}));
vi.mock('@/hooks/useSteps', () => ({
  useSteps: () => ({ steps: 400, goalSteps: 8000, week: [], refresh: vi.fn() }),
}));
vi.mock('@/hooks/useTargets', () => ({
  useTargets: () => ({ currentGoalProfile: { current_weight_kg: 80 } }),
}));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'owner' },
    profile: { height_cm: 180, sex: 'male', timezone: 'UTC' },
  }),
}));
vi.mock('@/lib/sound', () => ({ playSuccessSound: sensor.sound }));
vi.mock('@/services/workoutSessionService', () => ({
  newWorkoutSessionRequest: sensor.request,
  saveNewWorkoutSession: sensor.save,
}));
vi.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ eq: () => ({ order: () => ({ limit: sensor.history }) }) }) }),
    }),
  }),
}));
vi.mock('@/services/stepIntegrationService', () => ({
  readDeviceSteps: sensor.read,
  watchWalkingSteps: vi.fn(async (callback: typeof sensor.steps) => {
    sensor.steps = callback;
    return { status: sensor.status, remove: sensor.remove };
  }),
}));
import { CardioTrackerModal } from './CardioTrackerModal';

let renderer: ReactTestRenderer;
const onClose = vi.fn();
beforeEach(async () => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  sensor.status = 'granted';
  sensor.steps = null;
  sensor.gps = null;
  sensor.permission.mockResolvedValue({ granted: true });
  sensor.haptic.mockResolvedValue(null);
  sensor.history.mockResolvedValue({ data: [], error: null });
  sensor.request.mockImplementation(() => ({}));
  sensor.save.mockResolvedValue(undefined);
  sensor.read.mockResolvedValue(null);
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  await act(async () => {
    renderer = create(<CardioTrackerModal visible onClose={onClose} selectedDate="2026-11-18" />);
  });
});
afterEach(async () => {
  await act(async () => renderer.unmount());
  vi.useRealTimers();
});
const control = (testID: string) => renderer.root.findAllByProps({ testID }).at(-1)!;
const press = async (testID: string) => {
  await act(async () => control(testID).props.onPress());
};
const wait = async () => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5000);
  });
};

describe('live cardio tracking', () => {
  it('keeps walking idle when the sensor is unavailable and writes no fabricated steps', async () => {
    sensor.status = 'unavailable';
    await press('btn-start-cardio');
    await wait();
    expect(control('cardio-error')).toBeTruthy();
    expect(renderer.root.findAllByProps({ testID: 'cardio-finish' })).toHaveLength(0);
    expect(sensor.save).not.toHaveBeenCalled();
    expect(sensor.permission).not.toHaveBeenCalled();
  });

  it('counts only active sensor steps and prefers the daily platform total without counting the walk twice', async () => {
    sensor.read.mockResolvedValue({ steps: 900, distance_m: 650, source: 'health_platform' });
    await press('btn-start-cardio');
    await act(async () => sensor.steps?.(25));
    const pausedCallback = sensor.steps;
    await press('cardio-pause-resume');
    expect(sensor.remove).toHaveBeenCalled();
    await act(async () => pausedCallback?.(100));
    await press('cardio-pause-resume');
    await act(async () => sensor.steps?.(10));
    await wait();
    await press('cardio-finish');
    expect(sensor.save).toHaveBeenCalledExactlyOnceWith(
      expect.anything(),
      expect.objectContaining({
        type: 'walk_run',
        cardioSession: expect.objectContaining({ step_count: 35, target: 3000 }),
        dailySteps: { steps: 900, distance_m: 650, source: 'health_platform' },
      }),
    );
    expect(sensor.permission).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('disables a sub-kilometre goal and runs GPS only after a valid selection', async () => {
    await press('tab-cardio-running');
    expect(control('btn-start-cardio').props.disabled).toBe(true);
    await press('cardio-custom-goal');
    await act(async () => control('cardio-distance-input').props.onChange(0.99));
    expect(control('btn-start-cardio').props.disabled).toBe(true);
    await press('cardio-goal-1');
    await press('btn-start-cardio');
    expect(sensor.permission).toHaveBeenCalledOnce();
    expect(sensor.gps).not.toBeNull();
  });

  it('celebrates once and saves the measured ride with the same request after a missing acknowledgement', async () => {
    sensor.save.mockRejectedValueOnce(new Error('offline'));
    await press('tab-cardio-cycling');
    await press('cardio-custom-goal');
    await act(async () => control('cardio-distance-input').props.onChange(1));
    await press('btn-start-cardio');
    await act(async () => {
      sensor.gps?.({ coords: { latitude: 0, longitude: 0, accuracy: 5 }, timestamp: 1000 });
      sensor.gps?.({ coords: { latitude: 0, longitude: 0.01, accuracy: 5 }, timestamp: 120000 });
    });
    expect(sensor.sound).toHaveBeenCalledOnce();
    expect(sensor.haptic).toHaveBeenCalledOnce();
    expect(control('cardio-goal-reached')).toBeTruthy();
    expect(control('cardio-finish').props.disabled).toBe(false);
    await wait();
    await press('cardio-finish');
    expect(control('cardio-error')).toBeTruthy();
    expect(renderer.root.findAllByProps({ testID: 'cardio-view-history' })).toHaveLength(0);
    const request = sensor.save.mock.calls[0]!;
    await press('cardio-finish');
    expect(sensor.save.mock.calls[1]?.[0]).toBe(request[0]);
    expect(sensor.save.mock.calls[1]?.[1]).toEqual(request[1]);
    expect(request[1]).toMatchObject({
      type: 'cardio',
      cardioSession: { mode: 'cycling', target: 1000, distance_m: 1111 },
    });
    await press('cardio-view-history');
    expect(sensor.history).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('removes the sensor when the modal closes and ignores delayed events', async () => {
    await press('btn-start-cardio');
    const callback = sensor.steps;
    await act(async () =>
      renderer.update(<CardioTrackerModal visible={false} onClose={onClose} />),
    );
    expect(sensor.remove).toHaveBeenCalled();
    await act(async () => callback?.(300));
    await wait();
    expect(sensor.save).not.toHaveBeenCalled();
  });
});
