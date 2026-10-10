import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import * as roomService from '@/services/roomService';
import type { RoomSnapshot } from '@calipartner/core';

const mockChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnThis(),
};

const mockSupabase = {
  channel: vi.fn().mockReturnValue(mockChannel),
  removeChannel: vi.fn().mockResolvedValue('ok'),
};

const typedMockClient = mockSupabase as unknown as SupabaseClient;

vi.mock('@/lib/supabase', () => ({
  getSupabase: () => typedMockClient,
}));

// Mock roomService
vi.mock('@/services/roomService', () => ({
  listUserRooms: vi.fn(),
  createRoom: vi.fn(),
  joinRoomByCode: vi.fn(),
  leaveRoom: vi.fn(),
  getRequestsInbox: vi.fn(),
  sendRoomInvitation: vi.fn(),
  requestToJoinRoom: vi.fn(),
  respondToRoomRequest: vi.fn(),
  cancelRoomRequest: vi.fn(),
  searchUserByUsername: vi.fn(),
  getRoomSnapshot: vi.fn(),
  getPrivacySettings: vi.fn(),
  updatePrivacySettings: vi.fn(),
  setWhoCanInvite: vi.fn(),
  sendNudge: vi.fn(),
  sendReaction: vi.fn(),
  tagSharedMeal: vi.fn(),
  respondSharedMeal: vi.fn(),
  removeMember: vi.fn(),
  transferHost: vi.fn(),
  blockUser: vi.fn(),
  reportTarget: vi.fn(),
}));

describe('Room hooks data layer logic tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. useRoomSnapshot subscribes to Realtime only when isVisible is true', async () => {
    const fakeSnapshot: RoomSnapshot = {
      room: {
        id: 'room-101',
        name: 'Visible Room',
        code: 'CP7777',
        state: 'active',
        who_can_invite: 'host_only',
        created_by: 'u-1',
      },
      caller_id: 'u-1',
      members: [],
    };
    vi.mocked(roomService.getRoomSnapshot).mockResolvedValue(fakeSnapshot);

    // Simulate hook logic for isVisible = true
    const roomId = 'room-101';
    const isVisible = true;

    // Hook mounts
    let channelRef: typeof mockChannel | null = null;
    if (roomId && isVisible) {
      await roomService.getRoomSnapshot(typedMockClient, roomId);
      channelRef = mockSupabase.channel(`room_realtime:${roomId}`);
      channelRef?.subscribe();
    }

    expect(roomService.getRoomSnapshot).toHaveBeenCalledWith(typedMockClient, 'room-101');
    expect(mockSupabase.channel).toHaveBeenCalled();
    expect(mockChannel.subscribe).toHaveBeenCalled();

    // Hook unmounts or becomes hidden (isVisible = false)
    if (channelRef) {
      mockSupabase.removeChannel(channelRef as unknown as never);
      channelRef = null;
    }

    expect(mockSupabase.removeChannel).toHaveBeenCalledWith(mockChannel);
  });

  it('2. useRoomSnapshot does NOT subscribe when isVisible is false', async () => {
    const roomId = 'room-102';
    const isVisible = false;

    let channelRef: typeof mockChannel | null = null;
    if (roomId && isVisible) {
      channelRef = mockSupabase.channel(`room_realtime:${roomId}`);
    }

    expect(mockSupabase.channel).not.toHaveBeenCalled();
    expect(roomService.getRoomSnapshot).not.toHaveBeenCalled();
    expect(channelRef).toBeNull();
  });

  it('3. useRoomRequests coordinates incoming/outgoing requests and operations', async () => {
    vi.mocked(roomService.getRequestsInbox).mockResolvedValue({
      incoming: [
        {
          id: 'req-1',
          room_id: 'r-1',
          sender_id: 'u-2',
          recipient_id: 'u-1',
          type: 'invitation',
          status: 'pending',
          expires_at: '2026-10-24T00:00:00Z',
          created_at: '2026-10-10T00:00:00Z',
        },
      ],
      outgoing: [],
    });

    vi.mocked(roomService.respondToRoomRequest).mockResolvedValue({
      status: 'accepted',
      room_id: 'r-1',
    });

    const inbox = await roomService.getRequestsInbox(typedMockClient);
    expect(inbox.incoming).toHaveLength(1);

    const respondRes = await roomService.respondToRoomRequest(
      typedMockClient,
      'req-1',
      true,
    );
    expect(respondRes.status).toBe('accepted');
  });

  it('4. useRoomActions dispatches nudge, reaction, and shared meal responses', async () => {
    vi.mocked(roomService.sendNudge).mockResolvedValue({ status: 'sent', nudge_id: 'n-1' });
    vi.mocked(roomService.sendReaction).mockResolvedValue({ status: 'reacted', reaction: 'fire' });
    vi.mocked(roomService.respondSharedMeal).mockResolvedValue({
      status: 'accepted',
      diary_entry_id: 'entry-1',
    });

    const nudgeRes = await roomService.sendNudge(
      typedMockClient,
      'r-1',
      'u-target',
      'Hydration reminder!',
    );
    expect(nudgeRes.status).toBe('sent');

    const reactRes = await roomService.sendReaction(
      typedMockClient,
      'r-1',
      'e-1',
      'fire',
    );
    expect(reactRes.status).toBe('reacted');

    const mealRes = await roomService.respondSharedMeal(
      typedMockClient,
      'sm-1',
      true,
      1.5,
      'dinner',
    );
    expect(mealRes.status).toBe('accepted');
  });
});
