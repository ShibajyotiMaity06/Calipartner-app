import React from 'react';
import { View } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '@/types/chat';
import type { RoomSummary } from '@/types/rooms';
import { wellsLight } from '@calipartner/ui';

vi.mock('react-native', () => ({
  View: 'View',
  Pressable: 'Pressable',
  Image: 'Image',
  ScrollView: 'ScrollView',
  ActivityIndicator: 'ActivityIndicator',
  Animated: {
    Value: class {
      setValue() {}
    },
    View: 'AnimatedView',
  },
  PanResponder: {
    create: () => ({ panHandlers: {} }),
  },
  StyleSheet: { create: (value: unknown) => value },
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: (props: { name: string; testID?: string; color?: string; size?: number }) => (
    <View {...(props as object)} testID={props.testID} />
  ),
}));

vi.mock('expo-clipboard', () => ({ setStringAsync: vi.fn() }));

vi.mock('@calipartner/ui', async () => ({
  ...(await import('../../../../packages/ui/src/tokens')),
  Text: 'Text',
  Button: 'Button',
  SegmentedControl: 'SegmentedControl',
  Avatar: 'Avatar',
  Field: 'Field',
  Sheet: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
    visible ? <>{children}</> : null,
}));

vi.mock('@/theme/useTheme', () => ({
  useTheme: () => ({
    colors: {
      textMuted: '#999999',
      surface: '#222222',
      surfaceAlt: '#333333',
      cardHighlight: '#444444',
      accent: '#FF8800',
      danger: '#FF0000',
    },
  }),
}));

vi.mock('./ChatAttachmentPreview', () => ({ ChatAttachmentPreview: 'Attachment' }));
vi.mock('./MentionText', () => ({ MentionText: 'Mention' }));
vi.mock('../rooms/EditSquadName', () => ({ EditSquadName: 'EditSquadName' }));
vi.mock('../rooms/SquadViews', () => ({ squadStyles: {}, useSquadStyles: () => ({}) }));
vi.mock('@/hooks/useBrowserModalBack', () => ({
  useBrowserModalBack: vi.fn(),
  closeBrowserModalsThen: (fn: () => void) => fn(),
}));

import { ChatMessageBubble } from './ChatMessageBubble';
import { RoomHeader } from '../rooms/RoomHeader';

describe('ChatMessageBubble WhatsApp double ticks', () => {
  const baseMessage: ChatMessage = {
    id: 'msg-1',
    client_id: 'c-1',
    room_id: 'r-1',
    sender_id: 'user-1',
    message_type: 'user',
    system_event_type: null,
    text: 'Hello squad!',
    created_at: '2026-11-09T10:00:00Z',
    deleted_at: null,
    attachments: [],
    delivery_status: 'sent',
  };

  let tree: ReactTestRenderer | undefined;

  beforeEach(() => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
  });

  afterEach(async () => {
    if (tree) {
      await act(async () => {
        tree?.unmount();
      });
      tree = undefined;
    }
  });

  it('renders single tick when message is sent but not yet seen by all', async () => {
    await act(async () => {
      tree = create(<ChatMessageBubble message={baseMessage} isMine={true} isSeenByAll={false} />);
    });
    const singleTick = tree!.root.findByProps({ testID: 'tick-sent-msg-1' });
    expect(singleTick.props.name).toBe('checkmark');
    expect(singleTick.props.color).toBe('#999999');
    expect(tree!.root.findAllByProps({ testID: 'tick-seen-msg-1' })).toHaveLength(0);
  });

  it('renders WhatsApp-style double blue ticks when seen by all in group', async () => {
    await act(async () => {
      tree = create(<ChatMessageBubble message={baseMessage} isMine={true} isSeenByAll={true} />);
    });
    const doubleTick = tree!.root.findByProps({ testID: 'tick-seen-msg-1' });
    expect(doubleTick.props.name).toBe('checkmark-done');
    expect(doubleTick.props.color).toBe(wellsLight.sky);
    expect(tree!.root.findAllByProps({ testID: 'tick-sent-msg-1' })).toHaveLength(0);
  });
});

describe('RoomHeader layout & chat screen code visibility', () => {
  const testRoom: RoomSummary = {
    id: 'room-1',
    name: "Let's do",
    code: 'FBEK7Y',
    role: 'host',
    state: 'active',
    member_count: 3,
    member_cap: 20,
    who_can_invite: 'any_member',
    created_at: '2026-11-09T00:00:00Z',
  };

  let tree: ReactTestRenderer | undefined;

  afterEach(async () => {
    if (tree) {
      await act(async () => {
        tree?.unmount();
      });
      tree = undefined;
    }
  });

  it('hides room code on the chat segment', async () => {
    await act(async () => {
      tree = create(
        <RoomHeader
          currentRoom={testRoom}
          allRooms={[testRoom]}
          pendingRequestsCount={0}
          activeSegment="chat"
          onSelectSegment={vi.fn()}
          onOpenInbox={vi.fn()}
          onOpenSettings={vi.fn()}
          onOpenPrivacy={vi.fn()}
        />,
      );
    });
    expect(tree!.root.findAllByProps({ testID: 'btn-copy-room-code' })).toHaveLength(0);
    expect(tree!.root.findAllByProps({ testID: 'btn-room-title-switcher' })).toHaveLength(0);
    expect(tree!.root.findAllByType('EditSquadName' as React.ElementType)).toHaveLength(0);
    expect(tree!.root.findByProps({ testID: 'btn-room-settings' })).toBeDefined();
  });

  it('shows room code on overview / today segment', async () => {
    await act(async () => {
      tree = create(
        <RoomHeader
          currentRoom={testRoom}
          allRooms={[testRoom]}
          pendingRequestsCount={0}
          activeSegment="today"
          onSelectSegment={vi.fn()}
          onOpenInbox={vi.fn()}
          onOpenSettings={vi.fn()}
          onOpenPrivacy={vi.fn()}
        />,
      );
    });
    expect(tree!.root.findAllByProps({ testID: 'btn-copy-room-code' })).toHaveLength(1);
  });
});
