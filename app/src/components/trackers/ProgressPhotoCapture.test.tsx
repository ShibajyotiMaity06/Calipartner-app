import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  user: { id: 'owner' },
  loading: false,
  active: true,
  camera: vi.fn(),
  photos: vi.fn(),
  save: vi.fn(),
}));
vi.mock('react-native', () => ({
  ActivityIndicator: 'Spinner',
  Image: 'Image',
  Modal: 'Modal',
  ScrollView: 'ScrollView',
  SafeAreaView: 'SafeAreaView',
  TextInput: 'TextInput',
  View: 'View',
  Alert: { alert: vi.fn() },
  StyleSheet: { create: (v: unknown) => v },
}));
vi.mock('@calipartner/ui', async () => ({
  ...(await import('../../../../packages/ui/src/tokens')),
  Text: 'Text',
  Button: 'Button',
  Chip: 'Chip',
}));
vi.mock('@/components/subscription/PremiumFeatureModal', () => ({
  PremiumFeatureModal: 'Premium',
}));
vi.mock('@/components/LoadingState', () => ({ LoadingState: 'Loading' }));
vi.mock('expo-router', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: state.user }) }));
vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => ({
    currentTier: 'pro',
    hasActiveAccess: state.active,
    loading: state.loading,
    error: null,
    refresh: vi.fn(),
  }),
}));
vi.mock('@/hooks/useCurrentLocalDate', () => ({
  useCurrentLocalDate: () => ({ localDate: '2026-11-17' }),
}));
vi.mock('@/db', () => ({ getDb: async () => ({}) }));
vi.mock('@/services/foodService', () => ({ generateClientUuid: () => 'capture-id' }));
vi.mock('@/services/progressPhotoService', () => ({
  getProgressPhotos: state.photos,
  saveProgressPhoto: state.save,
  deleteProgressPhoto: vi.fn(),
}));
vi.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: async () => ({ granted: true }),
  launchCameraAsync: state.camera,
}));
import { ProgressPhotosView } from '@/components/progress/ProgressPhotosView';
let tree: ReactTestRenderer;
beforeEach(() => {
  vi.clearAllMocks();
  state.user = { id: 'owner' };
  state.loading = false;
  state.active = true;
  state.photos.mockResolvedValue([]);
  state.save.mockResolvedValue(undefined);
  state.camera.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///camera.jpg' }] });
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});
it('keeps the camera preview across token and foreground entitlement refresh, then saves it', async () => {
  await act(async () => {
    tree = create(<ProgressPhotosView />);
  });
  await act(async () => tree.root.findByProps({ testID: 'photos-camera' }).props.onPress());
  state.user = { id: 'owner' };
  state.loading = true;
  await act(async () => tree.update(<ProgressPhotosView />));
  expect(
    tree.root.findAll(
      (node) =>
        typeof node.type === 'string' &&
        String(node.type) === 'Image' &&
        node.props.source?.uri === 'file:///camera.jpg',
    ),
  ).toHaveLength(1);
  expect(state.photos).toHaveBeenCalledTimes(1);
  await act(async () => tree.root.findByProps({ testID: 'photos-save' }).props.onPress());
  expect(state.save).toHaveBeenCalledWith(
    {},
    expect.objectContaining({
      id: 'capture-id',
      user_id: 'owner',
      photo_uri: 'file:///camera.jpg',
      captured_date: '2026-11-17',
    }),
  );
});
it('discards a camera result if the account changes while the camera is open', async () => {
  let resolve!: (value: unknown) => void;
  state.camera.mockReturnValue(
    new Promise((r) => {
      resolve = r;
    }),
  );
  await act(async () => {
    tree = create(<ProgressPhotosView />);
  });
  await act(async () => tree.root.findByProps({ testID: 'photos-camera' }).props.onPress());
  state.user = { id: 'other' };
  await act(async () => tree.update(<ProgressPhotosView />));
  await act(async () => resolve({ canceled: false, assets: [{ uri: 'file:///private.jpg' }] }));
  expect(tree.root.findAllByProps({ testID: 'photos-save' })).toHaveLength(0);
  expect(state.save).not.toHaveBeenCalled();
});
it('still locks photos after access expires', async () => {
  await act(async () => {
    tree = create(<ProgressPhotosView />);
  });
  state.active = false;
  await act(async () => tree.update(<ProgressPhotosView />));
  expect(tree.root.findAllByProps({ testID: 'photos-camera' })).toHaveLength(0);
  expect(tree.root.findByProps({ testID: 'progress-photos-upgrade' })).toBeDefined();
});
