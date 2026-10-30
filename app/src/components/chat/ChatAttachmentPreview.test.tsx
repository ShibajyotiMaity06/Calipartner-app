import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatAttachment } from '@/types/chat';
const sign = vi.hoisted(() => vi.fn());
vi.mock('react-native', () => ({
  Image: 'Image',
  View: 'View',
  Pressable: 'Pressable',
  StyleSheet: { create: (value: unknown) => value },
}));
vi.mock('@calipartner/ui', () => ({
  Text: 'Text',
  Button: 'Button',
  space: [],
  radius: {},
  dark: {},
  onboardingLayout: { ring: 164 },
}));
vi.mock('@/services/chatImageService', () => ({ getSignedImageUrl: sign }));
vi.mock('@/lib/supabase', () => ({ getSupabase: () => ({}) }));
vi.mock('./ChatVideo', () => ({ ChatVideo: 'ChatVideo' }));
import { ChatAttachmentPreview } from './ChatAttachmentPreview';
const attachment = {
  id: 'media',
  storage_key: 'room/media',
  mime_type: 'image/jpeg',
} as ChatAttachment;
let tree: ReactTestRenderer;
beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  sign.mockReset().mockResolvedValue('https://signed.example/media');
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});
describe('private chat media previews', () => {
  it('signs photos before rendering thumbnails and passes a usable URL to the viewer', async () => {
    const open = vi.fn();
    await act(async () => {
      tree = create(<ChatAttachmentPreview roomId="room" attachment={attachment} onOpen={open} />);
    });
    expect(sign).toHaveBeenCalledWith({}, 'room', 'room/media');
    expect(tree.root.findByType('Image' as React.ElementType).props.source.uri).toBe(
      'https://signed.example/media',
    );
    act(() => tree.root.findByProps({ testID: 'att-image-media' }).props.onPress());
    expect(open).toHaveBeenCalledWith(
      expect.objectContaining({ signed_url: 'https://signed.example/media' }),
    );
  });
  it('renders an actual video player for videos', async () => {
    await act(async () => {
      tree = create(
        <ChatAttachmentPreview
          roomId="room"
          attachment={{ ...attachment, mime_type: 'video/mp4' }}
        />,
      );
    });
    expect(tree.root.findByType('ChatVideo' as React.ElementType).props.uri).toBe(
      'https://signed.example/media',
    );
  });
  it('shows a retry after failed or expired URLs and fetches a new signature', async () => {
    sign.mockRejectedValueOnce(new Error('expired'));
    await act(async () => {
      tree = create(<ChatAttachmentPreview roomId="room" attachment={attachment} />);
    });
    await act(async () =>
      tree.root.findByProps({ testID: 'reload-attachment-media' }).props.onPress(),
    );
    expect(sign).toHaveBeenCalledTimes(2);
    expect(tree.root.findByType('Image' as React.ElementType).props.source.uri).toBe(
      'https://signed.example/media',
    );
  });
});
