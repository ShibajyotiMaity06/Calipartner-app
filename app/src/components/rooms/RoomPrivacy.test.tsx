import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  online: true,
  update: vi.fn(),
  optOut: vi.fn(),
  get: vi.fn(),
  save: vi.fn(),
}));
vi.mock('react-native', () => ({
  Modal: 'Modal',
  SafeAreaView: 'SafeAreaView',
  ScrollView: 'ScrollView',
  View: 'View',
  Pressable: 'Pressable',
  StyleSheet: { create: (v: unknown) => v },
}));
vi.mock('@calipartner/ui', () => ({
  Button: 'Button',
  Card: 'Card',
  SwitchRow: 'SwitchRow',
  Text: 'Text',
  dark: {},
  space: [],
  onboardingLayout: { touch: 48 },
}));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ profile: { discoverable: true }, updateProfile: state.update }),
}));
vi.mock('@/hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isOnline: state.online }),
}));
vi.mock('@/lib/supabase', () => ({ getSupabase: () => ({}) }));
vi.mock('@/services/leaderboardService', () => ({
  fetchLeaderboardOptOutStatus: async () => true,
  setLeaderboardOptOut: state.optOut,
}));
vi.mock('@/services/roomService', () => ({
  getPrivacySettings: state.get,
  updatePrivacySettings: state.save,
}));
vi.mock('@/components/profile/PreviewAsPartnerModal', () => ({
  PreviewAsPartnerModal: 'PreviewAsPartnerModal',
}));
import { PrivacySettingsModal } from './PrivacySettingsModal';
import { PerRoomVisibilityModal } from '../profile/PerRoomVisibilityModal';
beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  state.online = true;
  state.update.mockResolvedValue({ error: null });
  state.optOut.mockResolvedValue(undefined);
});
describe('real room privacy controls', () => {
  it('hydrates saved values and persists room and community switches through their real callbacks', async () => {
    const privacy = { share_steps: false, share_meals: 'never', share_calories_macros: false };
    const get = vi.fn().mockResolvedValue(privacy),
      save = vi.fn().mockResolvedValue({ ...privacy, share_steps: true });
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(
        <PrivacySettingsModal
          visible
          roomId="one"
          onClose={vi.fn()}
          onGetPrivacy={get}
          onUpdatePrivacy={save}
        />,
      );
    });
    expect(tree.root.findByProps({ testID: 'switch-share-steps' }).props.value).toBe(false);
    await act(async () =>
      tree.root.findByProps({ testID: 'switch-share-steps' }).props.onValueChange(true),
    );
    expect(save).toHaveBeenCalledWith({ share_steps: true });
    expect(tree.root.findByProps({ testID: 'switch-share-steps' }).props.value).toBe(true);
    await act(async () =>
      tree.root.findByProps({ testID: 'switch-discoverable' }).props.onValueChange(false),
    );
    expect(state.update).toHaveBeenCalledWith({ discoverable: false });
    await act(async () =>
      tree.root.findByProps({ testID: 'switch-appear-leaderboard' }).props.onValueChange(true),
    );
    expect(state.optOut).toHaveBeenCalledWith({}, false);
    await act(async () => tree.unmount());
  });
  it('failed saves retain the saved value, show an error, and offline changes are disabled', async () => {
    const get = vi.fn().mockResolvedValue({ share_steps: false }),
      save = vi.fn().mockRejectedValue(new Error('offline'));
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(
        <PrivacySettingsModal
          visible
          onClose={vi.fn()}
          onGetPrivacy={get}
          onUpdatePrivacy={save}
        />,
      );
    });
    await act(async () =>
      tree.root.findByProps({ testID: 'switch-share-steps' }).props.onValueChange(true),
    );
    expect(tree.root.findByProps({ testID: 'switch-share-steps' }).props.value).toBe(false);
    expect(JSON.stringify(tree.toJSON())).toContain('Could not save your privacy settings');
    state.online = false;
    await act(async () =>
      tree.update(
        <PrivacySettingsModal
          visible
          onClose={vi.fn()}
          onGetPrivacy={get}
          onUpdatePrivacy={save}
        />,
      ),
    );
    expect(tree.root.findByProps({ testID: 'switch-share-steps' }).props.disabled).toBe(true);
    await act(async () => tree.unmount());
  });
  it('Account room picker loads the chosen room instead of presenting a simulated save', async () => {
    state.get.mockResolvedValue({ share_steps: true });
    const rooms = [
      { id: 'one', name: 'First' },
      { id: 'two', name: 'Second' },
    ] as React.ComponentProps<typeof PerRoomVisibilityModal>['rooms'];
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(<PerRoomVisibilityModal visible rooms={rooms} onClose={vi.fn()} />);
    });
    await act(async () => tree.root.findByProps({ testID: 'room-option-two' }).props.onPress());
    expect(state.get).toHaveBeenCalledWith({}, 'two');
    expect(tree.root.findAllByProps({ testID: 'btn-save-per-room' })).toHaveLength(0);
    await act(async () => tree.unmount());
  });
});
