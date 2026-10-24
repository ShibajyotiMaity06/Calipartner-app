import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sensor = vi.hoisted(() => ({
  callback: null as ((steps: number) => void) | null,
  status: 'granted',
  remove: vi.fn(),
  save: vi.fn(),
  workout: vi.fn(),
}));
vi.mock('react-native', () => ({
  Platform: { OS: 'web' },
  StyleSheet: { create: (value: unknown) => value },
  Modal: 'Modal',
  View: 'View',
  SafeAreaView: 'SafeAreaView',
  TouchableOpacity: 'TouchableOpacity',
  ScrollView: 'ScrollView',
  TextInput: 'TextInput',
}));
vi.mock('@calipartner/ui', () => ({
  Text: 'Text',
  Button: 'Button',
  Card: 'Card',
  ChevronLeftIcon: 'ChevronLeftIcon',
  dark: {},
  space: {},
  radius: {},
}));
vi.mock('@/hooks/useSteps', () => ({
  useSteps: () => ({ steps: 400, logPedometerSession: sensor.save, refresh: vi.fn() }),
}));
vi.mock('@/hooks/useWorkouts', () => ({ useWorkouts: () => ({ create: sensor.workout }) }));
vi.mock('@/hooks/useTargets', () => ({
  useTargets: () => ({ currentGoalProfile: { current_weight_kg: 80 } }),
}));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ profile: { height_cm: 180, sex: 'male' } }),
}));
vi.mock('@/lib/sound', () => ({ playClickSound: vi.fn(), playSuccessSound: vi.fn() }));
vi.mock('@/services/stepIntegrationService', () => ({
  watchWalkingSteps: vi.fn(async (callback: typeof sensor.callback) => {
    sensor.callback = callback;
    return { status: sensor.status, remove: sensor.remove };
  }),
}));
import { CardioTrackerModal } from './CardioTrackerModal';

let renderer: ReactTestRenderer;
beforeEach(async () => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  sensor.status = 'granted';
  sensor.callback = null;
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  await act(async () => {
    renderer = create(<CardioTrackerModal visible onClose={vi.fn()} selectedDate="2026-10-23" />);
  });
});
afterEach(async () => {
  await act(async () => renderer.unmount());
  vi.useRealTimers();
});
const press = async (label: string) => {
  await act(async () => {
    await renderer.root.findByProps({ accessibilityLabel: label }).props.onPress();
  });
};
const start = async () => {
  await act(async () => {
    renderer.root.findByProps({ testID: 'btn-start-cardio' }).props.onPress();
  });
};

describe('walking session regressions', () => {
  it('staying still for ten minutes records no steps when the sensor is unavailable', async () => {
    sensor.status = 'unavailable';
    await start();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600_000);
    });
    await press('Finish session');
    expect(sensor.save).not.toHaveBeenCalled();
    expect(JSON.stringify(renderer.toJSON())).not.toContain('Cadence');
  });

  it('counts only active sensor updates, preserves paused totals and saves once', async () => {
    await start();
    await act(async () => {
      sensor.callback?.(25);
    });
    const pausedCallback = sensor.callback;
    await press('Pause session');
    expect(sensor.remove).toHaveBeenCalled();
    await act(async () => {
      pausedCallback?.(100);
      await vi.advanceTimersByTimeAsync(60_000);
    });
    await press('Resume session');
    await act(async () => {
      sensor.callback?.(10);
    });
    await press('Finish session');
    expect(sensor.save).toHaveBeenCalledExactlyOnceWith(400, 35);
  });

  it('removes the sensor when the modal closes and ignores delayed events', async () => {
    await start();
    const callback = sensor.callback;
    await act(async () => {
      renderer.update(<CardioTrackerModal visible={false} onClose={vi.fn()} />);
    });
    expect(sensor.remove).toHaveBeenCalled();
    await act(async () => {
      callback?.(300);
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(sensor.save).not.toHaveBeenCalled();
  });
});
