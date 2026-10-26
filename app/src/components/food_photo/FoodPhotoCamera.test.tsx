import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const camera = vi.hoisted(() => ({ request: vi.fn(), pick: vi.fn(), prepare: vi.fn() }));
vi.mock('react-native', () => ({
  Platform: { OS: 'web' },
  ActivityIndicator: 'Spinner',
  Image: 'Image',
  Modal: 'Modal',
  Pressable: 'Pressable',
  Text: 'Text',
  View: 'View',
  StyleSheet: { create: (s: unknown) => s, absoluteFill: {} },
}));
vi.mock('expo-camera', () => ({
  CameraView: 'CameraView',
  useCameraPermissions: () => [{ granted: false, status: 'denied' }, camera.request],
}));
vi.mock('expo-image-picker', () => ({ launchImageLibraryAsync: camera.pick }));
vi.mock('expo-image-manipulator', () => ({
  manipulateAsync: camera.prepare,
  SaveFormat: { JPEG: 'jpeg' },
}));
vi.mock('@/theme/useTheme', () => ({ useTheme: () => ({ colors: {} }) }));
import { FoodPhotoCameraModal } from './FoodPhotoCameraModal';
let renderer: ReactTestRenderer;
beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  camera.pick.mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'photo.png', width: 3000, height: 2000 }],
  });
  camera.prepare.mockResolvedValue({ base64: 'prepared-jpeg', uri: 'prepared.jpg' });
});
afterEach(async () => {
  await act(async () => renderer.unmount());
});
describe('camera and gallery permissions', () => {
  it('previews an uploaded photo even if camera permission was denied and sends the actual JPEG', async () => {
    const captured = vi.fn();
    await act(async () => {
      renderer = create(
        <FoodPhotoCameraModal visible onClose={vi.fn()} onPhotoCaptured={captured} />,
      );
    });
    await act(async () =>
      renderer.root.findByProps({ testID: 'btn-choose-from-gallery' }).props.onPress(),
    );
    expect(renderer.root.findByProps({ testID: 'view-photo-preview' })).toBeDefined();
    expect(camera.prepare).toHaveBeenCalledWith('photo.png', [{ resize: { width: 1600 } }], {
      compress: 0.8,
      format: 'jpeg',
      base64: true,
    });
    await act(async () => renderer.root.findByProps({ testID: 'btn-use-photo' }).props.onPress());
    expect(captured).toHaveBeenCalledWith({ base64: 'prepared-jpeg', mimeType: 'image/jpeg' });
    expect(camera.request).not.toHaveBeenCalled();
  });
  it('reports unreadable images without submitting a fake capture', async () => {
    camera.prepare.mockRejectedValue(new Error('Unreadable'));
    const captured = vi.fn();
    await act(async () => {
      renderer = create(
        <FoodPhotoCameraModal visible onClose={vi.fn()} onPhotoCaptured={captured} />,
      );
    });
    await act(async () =>
      renderer.root.findByProps({ testID: 'btn-choose-from-gallery' }).props.onPress(),
    );
    expect(renderer.root.findByProps({ testID: 'food-camera-error' })).toBeDefined();
    expect(captured).not.toHaveBeenCalled();
  });
});
