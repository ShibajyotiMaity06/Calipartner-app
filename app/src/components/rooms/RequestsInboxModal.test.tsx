import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import type { RoomRequestWithDetails } from '@/types/rooms';

vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Modal: 'Modal',
  ScrollView: 'ScrollView',
  Pressable: 'Pressable',
  Text: 'Text',
  View: 'View',
  FlatList: (props: {
    data: unknown[];
    renderItem: (info: { item: unknown }) => React.ReactNode;
  }) =>
    React.createElement(
      'View',
      {},
      props.data.map((item, index) =>
        React.createElement(React.Fragment, { key: index }, props.renderItem({ item })),
      ),
    ),
  StyleSheet: { create: (value: unknown) => value },
}));
vi.mock('@/components/friends/FriendRequests', () => ({ FriendRequests: 'FriendRequests' }));
vi.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
vi.mock('@/theme/tokens', () => ({ fontSize: {}, radius: {}, spacing: {} }));
vi.mock('@/theme/useTheme', () => ({ useTheme: () => ({ colors: {} }) }));
import { RequestsInboxModal } from './RequestsInboxModal';

describe('free room invitations', () => {
  it('accepts an invitation without opening a subscription screen', async () => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    const respond = vi.fn(async () => {});
    const paywall = vi.fn();
    let renderer!: ReactTestRenderer;
    const invitation: RoomRequestWithDetails = {
      id: 'invite',
      room_id: 'room',
      sender_id: 'host',
      recipient_id: 'free',
      type: 'invitation',
      status: 'pending',
      expires_at: '2099-01-01',
      created_at: '2026-10-24',
    };
    await act(async () => {
      renderer = create(
        <RequestsInboxModal
          visible
          incoming={[invitation]}
          outgoing={[]}
          onClose={vi.fn()}
          onRespond={respond}
          onCancel={vi.fn()}
          onOpenPaywall={paywall}
        />,
      );
    });
    await act(async () => {
      await renderer.root.findByProps({ testID: 'btn-accept-req-invite' }).props.onPress();
    });
    expect(respond).toHaveBeenCalledWith('invite', true);
    expect(paywall).not.toHaveBeenCalled();
    await act(async () => renderer.unmount());
  });
});
