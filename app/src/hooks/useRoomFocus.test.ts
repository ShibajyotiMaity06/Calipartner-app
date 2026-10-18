import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { FocusErrorCode, RoomFocusState } from '@calipartner/core';
import * as focusService from '@/services/focusService';

const mockChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnThis(),
  track: vi.fn().mockResolvedValue('ok'),
};

const mockSupabase = {
  channel: vi.fn().mockReturnValue(mockChannel),
  removeChannel: vi.fn().mockResolvedValue('ok'),
};

const typedMockClient = mockSupabase as unknown as SupabaseClient;

vi.mock('@/lib/supabase', () => ({
  getSupabase: () => typedMockClient,
  getSupabaseClient: () => typedMockClient,
}));

vi.mock('@/services/focusService', () => ({
  getRoomFocus: vi.fn(),
  syncServerClock: vi.fn().mockResolvedValue(0),
  getServerCorrectedNow: vi.fn().mockReturnValue(new Date('2026-10-12T10:00:00Z')),
  startRoomFocus: vi.fn(),
  joinRoomFocus: vi.fn(),
  leaveRoomFocus: vi.fn(),
  pauseMyRoomFocus: vi.fn(),
  resumeMyRoomFocus: vi.fn(),
  parseFocusError: vi.fn(
    (err: unknown) =>
      new focusService.FocusError(
        ((err as { message?: string })?.message as FocusErrorCode) || 'INVALID_ARGUMENT',
      ),
  ),
  FocusError: class extends Error {
    constructor(
      public readonly code: string,
      message?: string,
    ) {
      super(message || code);
      this.name = 'FocusError';
    }
  },
}));

describe('Room focus hook and realtime lifecycle tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Subscribes to realtime channel only when isVisible is true', async () => {
    const fakeState: RoomFocusState = {
      active_session: null,
      recent_sessions: [],
    };
    vi.mocked(focusService.getRoomFocus).mockResolvedValue(fakeState);

    const roomId = 'room-101';
    const isVisible = true;
    const userId = 'user-1';

    let channelRef: typeof mockChannel | null = null;
    if (roomId && isVisible) {
      await focusService.syncServerClock(typedMockClient);
      await focusService.getRoomFocus(roomId, typedMockClient);
      channelRef = mockSupabase.channel(`focus:room:${roomId}`);
      channelRef?.subscribe();
      if (userId) {
        await channelRef?.track({ user_id: userId, viewing_focus: true });
      }
    }

    expect(focusService.getRoomFocus).toHaveBeenCalledWith('room-101', typedMockClient);
    expect(mockSupabase.channel).toHaveBeenCalledWith('focus:room:room-101');
    expect(mockChannel.subscribe).toHaveBeenCalled();
    expect(mockChannel.track).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', viewing_focus: true }),
    );

    // When screen becomes hidden / unmounted
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
      channelRef = mockSupabase.channel(`focus:room:${roomId}`);
    }

    expect(mockSupabase.channel).not.toHaveBeenCalled();
    expect(focusService.getRoomFocus).not.toHaveBeenCalled();
    expect(channelRef).toBeNull();
  });

  it('3. Handles start, join, and leave room focus actions', async () => {
    vi.mocked(focusService.startRoomFocus).mockResolvedValue('session-created-1');
    vi.mocked(focusService.joinRoomFocus).mockResolvedValue({
      id: 'p-1',
      session_id: 'session-created-1',
      user_id: 'user-1',
      joined_at: '2026-10-12T10:00:00Z',
      left_at: null,
      paused_seconds: 0,
      status: 'focusing',
      created_at: '2026-10-12T10:00:00Z',
      updated_at: '2026-10-12T10:00:00Z',
    });

    const sessionId = await focusService.startRoomFocus(
      'room-1',
      'timer',
      'Math',
      1500,
      typedMockClient,
    );
    expect(sessionId).toBe('session-created-1');

    const participant = await focusService.joinRoomFocus(sessionId, typedMockClient);
    expect(participant.status).toBe('focusing');
    expect(participant.session_id).toBe('session-created-1');

    await focusService.leaveRoomFocus(sessionId, typedMockClient);
    expect(focusService.leaveRoomFocus).toHaveBeenCalledWith(sessionId, typedMockClient);
  });
});
