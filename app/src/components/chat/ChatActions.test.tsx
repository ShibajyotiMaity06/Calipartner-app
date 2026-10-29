import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ copy: vi.fn() }));
vi.mock('react-native', () => ({
  Modal: 'Modal',
  Pressable: 'Pressable',
  Text: 'Text',
  View: 'View',
  TextInput: 'TextInput',
  ActivityIndicator: 'ActivityIndicator',
  StyleSheet: { create: (v: unknown) => v },
}));
vi.mock('@/theme/tokens', () => ({ fontSize: {}, radius: {}, spacing: {} }));
vi.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
vi.mock('expo-clipboard', () => ({ setStringAsync: mocks.copy }));
vi.mock('@/theme/useTheme', () => ({
  useTheme: () => ({ colors: { text: 'text', danger: 'danger' } }),
}));
import { ChatMessageMenuModal } from './ChatMessageMenuModal';
import { ChatTermsModal } from './ChatTermsModal';
import { ChatReportModal } from './ChatReportModal';
import type { ChatMessage } from '@/types/chat';
const message: ChatMessage = {
  id: 'one',
  client_id: 'one',
  attachments: [],
  room_id: 'room',
  sender_id: 'me',
  message_type: 'user',
  system_event_type: null,
  deleted_at: null,
  text: 'Copy this',
  created_at: '2026-10-29T00:00:00Z',
};
let tree: ReactTestRenderer;
beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});
describe('chat actions keep failed requests visible', () => {
  it('failed deletion stays open and a successful retry closes it', async () => {
    const remove = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined),
      close = vi.fn();
    await act(async () => {
      tree = create(
        <ChatMessageMenuModal
          visible
          message={message}
          isMine
          onClose={close}
          onDeleteMessage={remove}
          onReportMessage={vi.fn()}
          onMuteMember={vi.fn()}
        />,
      );
    });
    await act(async () => tree.root.findByProps({ testID: 'btn-delete-message' }).props.onPress());
    await act(async () => tree.root.findByProps({ testID: 'btn-delete-confirm' }).props.onPress());
    expect(close).not.toHaveBeenCalled();
    expect(tree.root.findAllByProps({ accessibilityRole: 'alert' })).toHaveLength(1);
    await act(async () => tree.root.findByProps({ testID: 'btn-delete-confirm' }).props.onPress());
    expect(close).toHaveBeenCalledOnce();
  });
  it('copies text through the native clipboard API', async () => {
    mocks.copy.mockResolvedValue(undefined);
    const close = vi.fn();
    await act(async () => {
      tree = create(
        <ChatMessageMenuModal
          visible
          message={message}
          isMine
          onClose={close}
          onDeleteMessage={vi.fn()}
          onReportMessage={vi.fn()}
          onMuteMember={vi.fn()}
        />,
      );
    });
    await act(async () => tree.root.findByProps({ testID: 'btn-copy-text' }).props.onPress());
    expect(mocks.copy).toHaveBeenCalledWith('Copy this');
    expect(close).toHaveBeenCalledOnce();
  });
  it('failed consent does not close or claim acceptance', async () => {
    const close = vi.fn();
    await act(async () => {
      tree = create(
        <ChatTermsModal
          visible
          onClose={close}
          onAccept={vi.fn().mockRejectedValue(new Error('offline'))}
        />,
      );
    });
    await act(async () =>
      tree.root.findByProps({ testID: 'btn-accept-chat-terms' }).props.onPress(),
    );
    expect(close).not.toHaveBeenCalled();
    expect(tree.root.findAllByProps({ accessibilityRole: 'alert' })).toHaveLength(1);
  });
  it('failed report shows an error without a success toast', async () => {
    await act(async () => {
      tree = create(
        <ChatReportModal
          visible
          messageId="peer-message"
          onClose={vi.fn()}
          onSubmitReport={vi.fn().mockRejectedValue(new Error('offline'))}
        />,
      );
    });
    await act(async () => tree.root.findByProps({ testID: 'btn-submit-report' }).props.onPress());
    expect(tree.root.findAllByProps({ accessibilityRole: 'alert' })).toHaveLength(1);
    expect(tree.root.findAllByProps({ testID: 'toast-report-submitted' })).toHaveLength(0);
  });
});
