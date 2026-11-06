import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Modal: 'Modal',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  TextInput: 'TextInput',
  View: 'View',
  Platform: { OS: 'web' },
  StyleSheet: { create: (value: unknown) => value, absoluteFill: {} },
}));
vi.mock('@calipartner/ui', async () => ({
  ...(await import('../../../../packages/ui/src/tokens')),
  Text: 'Text',
}));
vi.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
vi.mock('@/theme/useTheme', () => ({ useTheme: () => ({ colors: {} }) }));
vi.mock('@/hooks/useSteps', () => ({
  useSteps: () => ({
    steps: 1000,
    activity: null,
    week: [],
    error: null,
    distanceKm: 0.7,
    walkingCalories: 30,
    source: 'health_platform',
    goalSteps: 8000,
    progressPercent: 12.5,
    permissionStatus: 'granted',
    loading: false,
    updateStepGoal: vi.fn(),
    requestPermission: vi.fn(),
    logManualSteps: vi.fn(),
    syncFromPlatform: vi.fn(),
  }),
}));
vi.mock('./HealthPermissionModal', () => ({ HealthPermissionModal: 'HealthPermissionModal' }));
import { Platform } from 'react-native';
import { StepsCard } from './StepsCard';
import { ManualStepsModal } from './ManualStepsModal';
import { FixStepCountingModal } from './FixStepCountingModal';
let tree: ReactTestRenderer;
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});

it.each(['android', 'ios', 'web'] as const)(
  'limits all manual-step surfaces to web (%s)',
  async (platform) => {
    Object.assign(Platform, { OS: platform });
    await act(async () => {
      tree = create(<StepsCard />);
    });
    expect(tree.root.findAllByProps({ testID: 'btn-steps-manual' })).toHaveLength(
      platform === 'web' ? 1 : 0,
    );
    expect(tree.root.findByProps({ testID: 'btn-steps-sync' })).toBeDefined();
    await act(async () => {
      tree.update(<ManualStepsModal visible onClose={vi.fn()} onSave={vi.fn()} />);
    });
    expect(tree.root.findAllByProps({ testID: 'modal-manual-steps' })).toHaveLength(
      platform === 'web' ? 1 : 0,
    );
    await act(async () => {
      tree.update(
        <FixStepCountingModal visible currentSource="health_platform" onClose={vi.fn()} />,
      );
    });
    expect(tree.root.findAllByProps({ testID: 'source-option-manual' })).toHaveLength(
      platform === 'web' ? 1 : 0,
    );
  },
);
