import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ paid: true, rpc: vi.fn(), seen: vi.fn(), signed: vi.fn() }));
vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  FlatList: 'FlatList',
  KeyboardAvoidingView: 'KeyboardAvoidingView',
  Platform: { OS: 'web' },
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  View: 'View',
  StyleSheet: { create: (value: unknown) => value },
}));
vi.mock('@calipartner/ui', async () => ({
  ...(await import('../../../../packages/ui/src/tokens')),
  Text: 'Text',
}));
vi.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
vi.mock('@/theme/useTheme', () => ({ useTheme: () => ({ colors: {} }) }));
vi.mock('@/hooks/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isOnline: true }) }));
vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => ({
    hasActiveAccess: state.paid,
    currentTier: state.paid ? 'plus' : 'free',
  }),
}));
vi.mock('@/hooks/useRoomChat', () => ({
  useRoomChat: () => ({
    messages: [],
    loading: false,
    loadingMore: false,
    hasMore: false,
    unreadCount: 0,
    isLocked: false,
    isDormant: false,
    termsAccepted: true,
    error: null,
    refresh: vi.fn(),
  }),
}));
vi.mock('@/hooks/useChatTyping', () => ({
  useChatTyping: () => ({ typingPeople: [], notifyTyping: vi.fn() }),
}));
vi.mock('@/lib/supabase', () => ({ getSupabase: () => ({ rpc: state.rpc }) }));
vi.mock('@/services/squadService', () => ({ markSquadMentionSeen: state.seen }));
vi.mock('@/services/foodService', () => ({ generateClientUuid: () => 'client' }));
vi.mock('@/services/chatImageService', () => ({
  getSignedImageUrl: state.signed,
  requestUploadPresignedUrl: vi.fn(),
  uploadImageToR2: vi.fn(),
}));
vi.mock('@/db', () => ({ getDb: vi.fn() }));
vi.mock('./ChatComposer', () => ({ ChatComposer: 'ChatComposer' }));
vi.mock('./ChatMessageBubble', () => ({ ChatMessageBubble: 'ChatMessageBubble' }));
vi.mock('./ChatImageViewerModal', () => ({ ChatImageViewerModal: 'ChatImageViewerModal' }));
vi.mock('./ChatMessageMenuModal', () => ({ ChatMessageMenuModal: 'ChatMessageMenuModal' }));
vi.mock('./ChatReportModal', () => ({ ChatReportModal: 'ChatReportModal' }));
vi.mock('./ChatTermsModal', () => ({ ChatTermsModal: 'ChatTermsModal' }));
import { ChatView } from './ChatView';
let tree: ReactTestRenderer;
const message = {
  id: 'old',
  client_id: 'old',
  room_id: 'room',
  sender_id: 'peer',
  text: '@viewer tomorrow?',
  message_type: 'user',
  created_at: '2026-11-02T00:00:00Z',
  attachments: [],
};
beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  state.paid = true;
  state.rpc.mockResolvedValue({ data: [message], error: null });
  state.seen.mockResolvedValue(undefined);
  state.signed.mockResolvedValue('https://signed.example/image');
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
});
it('opens the exact old tag, acknowledges its recipient receipt, and preserves signed attachment viewing', async () => {
  await act(async () => {
    tree = create(<ChatView roomId="room" focusedMentionId="old" options={{ userId: 'viewer' }} />);
  });
  expect(state.rpc).toHaveBeenCalledWith('get_squad_mention_context', {
    p_room_id: 'room',
    p_message_id: 'old',
  });
  expect(state.seen).toHaveBeenCalledWith('room', 'old');
  const bubble = tree.root.findByProps({ testID: 'focused-mention-old' });
  await act(async () => bubble.props.onPressImage({ storage_key: 'private/image.jpg' }));
  expect(state.signed).toHaveBeenCalledWith(expect.anything(), 'room', 'private/image.jpg');
  expect(
    tree.root.findByType('ChatImageViewerModal' as React.ElementType).props.attachment.signed_url,
  ).toBe('https://signed.example/image');
});
it('retains an actionable error when marking seen fails and retries without changing the message', async () => {
  state.seen.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
  await act(async () => {
    tree = create(<ChatView roomId="room" focusedMentionId="old" options={{ userId: 'viewer' }} />);
  });
  expect(tree.root.findByProps({ testID: 'focused-mention-old' })).toBeDefined();
  await act(async () => tree.root.findByProps({ testID: 'retry-focused-mention' }).props.onPress());
  expect(state.seen).toHaveBeenCalledTimes(2);
  expect(tree.root.findAllByProps({ testID: 'retry-focused-mention' })).toHaveLength(0);
});
it('opens chat mentions and enables text sending for a Free member without unlocking media uploads', async () => {
  state.paid = false;
  await act(async () => {
    tree = create(<ChatView roomId="room" focusedMentionId="old" options={{ userId: 'viewer' }} />);
  });
  expect(state.rpc).toHaveBeenCalled();
  expect(state.seen).toHaveBeenCalledWith('room', 'old');
  expect(tree.root.findAllByProps({ testID: 'focused-mention-old' })).toHaveLength(1);
  const composer = tree.root.findByType('ChatComposer' as React.ElementType);
  expect(composer.props.disabled).toBe(false);
  expect(composer.props.allowMedia).toBe(false);
});
