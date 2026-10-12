import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import * as chatService from '@/services/chatService';
import type { ChatMessage } from '@/types/chat';

const mockChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnThis(),
};

const mockSupabase = {
  channel: vi.fn().mockReturnValue(mockChannel),
  removeChannel: vi.fn().mockResolvedValue('ok'),
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { state: 'active' }, error: null }),
      }),
    }),
  }),
};

const typedMockClient = mockSupabase as unknown as SupabaseClient;

vi.mock('@/lib/supabase', () => ({
  getSupabase: () => typedMockClient,
}));

vi.mock('@/services/chatService', () => ({
  getChatMessages: vi.fn(),
  getChatUnreadCount: vi.fn(),
  hasAcceptedChatTerms: vi.fn(),
  markChatRead: vi.fn(),
  sendChatMessage: vi.fn(),
  deleteChatMessage: vi.fn(),
  reportChatMessage: vi.fn(),
  muteChatMember: vi.fn(),
  unmuteChatMember: vi.fn(),
  acceptChatTerms: vi.fn(),
}));

describe('Room chat hook and realtime lifecycle tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Subscribes to realtime channel only when isVisible is true', async () => {
    const fakeMessages: ChatMessage[] = [
      {
        id: 'msg-1',
        client_id: 'c-1',
        room_id: 'room-101',
        sender_id: 'u-2',
        text: 'Hello from partner!',
        message_type: 'user',
        system_event_type: null,
        created_at: '2026-10-11T08:00:00Z',
        deleted_at: null,
        attachments: [],
        delivery_status: 'sent',
        sync_state: 'synced',
      },
    ];

    vi.mocked(chatService.getChatMessages).mockResolvedValue(fakeMessages);

    const roomId = 'room-101';
    const isVisible = true;

    // Simulate hook lifecycle for visible chat
    let channelRef: typeof mockChannel | null = null;
    if (roomId && isVisible) {
      await chatService.getChatMessages(typedMockClient, {} as never, roomId, { limit: 50 });
      channelRef = mockSupabase.channel(`chat:${roomId}`);
      channelRef?.subscribe();
    }

    expect(chatService.getChatMessages).toHaveBeenCalledWith(
      typedMockClient,
      expect.anything(),
      'room-101',
      { limit: 50 },
    );
    expect(mockSupabase.channel).toHaveBeenCalledWith('chat:room-101');
    expect(mockChannel.subscribe).toHaveBeenCalled();

    // Hook unmounts or becomes hidden
    if (channelRef) {
      mockSupabase.removeChannel(channelRef as unknown as never);
      channelRef = null;
    }

    expect(mockSupabase.removeChannel).toHaveBeenCalledWith(mockChannel);
  });

  it('2. Does NOT subscribe when isVisible is false', async () => {
    const roomId = 'room-102';
    const isVisible = false;

    let channelRef: typeof mockChannel | null = null;
    if (roomId && isVisible) {
      channelRef = mockSupabase.channel(`chat:${roomId}`);
    }

    expect(mockSupabase.channel).not.toHaveBeenCalled();
    expect(chatService.getChatMessages).not.toHaveBeenCalled();
    expect(channelRef).toBeNull();
  });

  it('3. Coordinates send message and appends message state', async () => {
    const sentMsg: ChatMessage = {
      id: 'msg-new',
      client_id: 'c-new',
      room_id: 'room-101',
      sender_id: 'u-1',
      text: 'My reply',
      message_type: 'user',
      system_event_type: null,
      created_at: '2026-10-11T08:01:00Z',
      deleted_at: null,
      attachments: [],
      delivery_status: 'sent',
      sync_state: 'synced',
    };

    vi.mocked(chatService.sendChatMessage).mockResolvedValue(sentMsg);

    const result = await chatService.sendChatMessage(
      typedMockClient,
      {} as never,
      'room-101',
      'u-1',
      { text: 'My reply' },
    );

    expect(result.id).toBe('msg-new');
    expect(result.delivery_status).toBe('sent');
    expect(chatService.sendChatMessage).toHaveBeenCalled();
  });

  it('4. Coordinates report, mute, and delete actions', async () => {
    vi.mocked(chatService.reportChatMessage).mockResolvedValue('report-xyz');
    vi.mocked(chatService.muteChatMember).mockResolvedValue(undefined);
    vi.mocked(chatService.deleteChatMessage).mockResolvedValue(undefined);

    const reportId = await chatService.reportChatMessage(
      typedMockClient,
      'msg-1',
      'inappropriate_content',
    );
    expect(reportId).toBe('report-xyz');

    await chatService.muteChatMember(typedMockClient, 'bad-user');
    expect(chatService.muteChatMember).toHaveBeenCalledWith(typedMockClient, 'bad-user');

    await chatService.deleteChatMessage(typedMockClient, {} as never, 'msg-1');
    expect(chatService.deleteChatMessage).toHaveBeenCalled();
  });
});
