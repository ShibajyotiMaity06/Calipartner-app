import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  gesture: undefined as
    undefined | Record<string, (event: unknown, gesture: { dx: number; dy: number }) => unknown>,
}));
vi.mock('react-native', () => ({
  View: 'View',
  Pressable: 'Pressable',
  Image: 'Image',
  ActivityIndicator: 'ActivityIndicator',
  Animated: {
    Value: class {
      setValue() {}
    },
    View: 'AnimatedView',
  },
  PanResponder: {
    create: (gesture: typeof state.gesture) => {
      state.gesture = gesture;
      return { panHandlers: {} };
    },
  },
  StyleSheet: { create: (value: unknown) => value },
}));
vi.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
vi.mock('@calipartner/ui', async () => ({
  ...(await import('../../../../packages/ui/src/tokens')),
  Text: 'Text',
}));
vi.mock('@/theme/useTheme', () => ({ useTheme: () => ({ colors: {} }) }));
vi.mock('./ChatAttachmentPreview', () => ({ ChatAttachmentPreview: 'Attachment' }));
vi.mock('./MentionText', () => ({ MentionText: 'Mention' }));
import { ChatMessageBubble } from './ChatMessageBubble';
import type { ChatMessage } from '@/types/chat';
const message: ChatMessage = {
  id: 'message',
  client_id: 'client',
  room_id: 'room',
  sender_id: 'peer',
  message_type: 'user',
  system_event_type: null,
  text: 'Hello',
  attachments: [],
  deleted_at: null,
  created_at: '2026-11-05T12:00:00Z',
};
let tree: ReactTestRenderer;
beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});
it('lets vertical scrolling pass and replies after a deliberate horizontal drag', async () => {
  const reply = vi.fn();
  await act(async () => {
    tree = create(<ChatMessageBubble message={message} isMine={false} onReply={reply} />);
  });
  expect(state.gesture!.onMoveShouldSetPanResponder!(null, { dx: 15, dy: 60 })).toBe(false);
  expect(state.gesture!.onMoveShouldSetPanResponder!(null, { dx: 60, dy: 4 })).toBe(true);
  await act(async () => {
    state.gesture!.onPanResponderRelease!(null, { dx: 60, dy: 4 });
  });
  expect(reply).toHaveBeenCalledWith(message);
});
it('does not allow a reply to a deleted message and exposes an accessible reply action otherwise', async () => {
  const reply = vi.fn();
  await act(async () => {
    tree = create(<ChatMessageBubble message={message} isMine={false} onReply={reply} />);
  });
  const bubble = tree.root.findByProps({ testID: 'bubble-content-message' });
  expect(
    bubble.props.accessibilityActions.some((action: { name: string }) => action.name === 'reply'),
  ).toBe(true);
  await act(async () =>
    bubble.props.onAccessibilityAction({ nativeEvent: { actionName: 'reply' } }),
  );
  expect(reply).toHaveBeenCalledOnce();
  await act(async () =>
    tree.update(
      <ChatMessageBubble
        message={{ ...message, deleted_at: '2026-11-05T13:00:00Z' }}
        isMine={false}
        onReply={reply}
      />,
    ),
  );
  expect(state.gesture!.onMoveShouldSetPanResponder!(null, { dx: 60, dy: 0 })).toBe(false);
});
