import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '@/types/chat';
const state = vi.hoisted(() => ({
  get: vi.fn(),
  mark: vi.fn(),
  unread: vi.fn(),
  rpc: vi.fn(),
  remove: vi.fn(),
}));
vi.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    rpc: state.rpc,
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: { state: 'active' } }) }) }),
    }),
    channel: () => ({
      on() {
        return this;
      },
      subscribe() {
        return this;
      },
    }),
    removeChannel: state.remove,
  }),
}));
vi.mock('@/db', () => ({ getDb: async () => ({ runAsync: vi.fn() }) }));
vi.mock('@/services/chatService', () => ({
  getChatMessages: state.get,
  markChatRead: state.mark,
  getChatUnreadCount: state.unread,
  hasAcceptedChatTerms: async () => true,
  acceptChatTerms: vi.fn(),
  blockChatMember: vi.fn(),
  deleteChatMessage: vi.fn(),
  muteChatMember: vi.fn(),
  reportChatMessage: vi.fn(),
  sendChatMessage: vi.fn(),
}));
import { useRoomChat } from './useRoomChat';
let result: ReturnType<typeof useRoomChat>;
function Probe({ room, mark = true }: { room: string; mark?: boolean }) {
  result = useRoomChat(room, true, { userId: 'viewer', markRead: mark });
  return null;
}
const message = (id: string, room = 'one'): ChatMessage => ({
  id,
  client_id: id,
  room_id: room,
  sender_id: 'peer',
  message_type: 'user',
  system_event_type: null,
  deleted_at: null,
  text: id,
  created_at: '2026-10-29T12:00:00Z',
  delivery_status: 'sent',
  sync_state: 'synced',
  attachments: [],
});
let tree: ReactTestRenderer | undefined;
beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  vi.clearAllMocks();
  state.rpc.mockResolvedValue({ data: [], error: null });
  state.mark.mockResolvedValue(undefined);
  state.unread.mockResolvedValue(7);
});
afterEach(async () => {
  if (tree) await act(async () => tree?.unmount());
  tree = undefined;
  vi.useRealTimers();
});
describe('room chat lifecycle with real hook effects', () => {
  it('a slow previous room never replaces the selected room messages', async () => {
    let resolveOld!: (m: ChatMessage[]) => void;
    state.get.mockImplementation((_c, _d, room) =>
      room === 'one'
        ? new Promise((r) => {
            resolveOld = r;
          })
        : Promise.resolve([message('new', 'two')]),
    );
    await act(async () => {
      tree = create(<Probe room="one" />);
    });
    await act(async () => {
      tree!.update(<Probe room="two" />);
    });
    expect(result.messages.map((m) => m.id)).toEqual(['new']);
    await act(async () => resolveOld([message('stale')]));
    expect(result.messages.map((m) => m.id)).toEqual(['new']);
    expect(state.mark.mock.calls.every((c) => c[2] === 'two')).toBe(true);
  });
  it('the Today header gets unread counts without acknowledging unseen chat', async () => {
    state.get.mockResolvedValue([message('one')]);
    await act(async () => {
      tree = create(<Probe room="one" mark={false} />);
    });
    expect(result.unreadCount).toBe(7);
    expect(state.mark).not.toHaveBeenCalled();
    expect(state.unread).toHaveBeenCalled();
  });
  it('pending media becomes viewable when approval arrives without a new message', async () => {
    const pending = {
      ...message('media'),
      attachments: [
        {
          id: 'attachment',
          message_id: 'media',
          storage_key: 'rooms/one/messages/media/0.jpg',
          mime_type: 'image/jpeg',
          size: 4,
          created_at: '2026-10-29T12:00:00Z',
          moderation_status: 'pending' as const,
        },
      ],
    };
    let approved = false;
    state.get.mockImplementation((_c, _d, _r, options) =>
      Promise.resolve(
        options.afterId
          ? []
          : [
              approved
                ? {
                    ...pending,
                    attachments: pending.attachments.map((a) => ({
                      ...a,
                      moderation_status: 'ok',
                    })),
                  }
                : pending,
            ],
      ),
    );
    await act(async () => {
      tree = create(<Probe room="one" />);
    });
    expect(result.messages[0]?.attachments[0]?.moderation_status).toBe('pending');
    approved = true;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    expect(result.messages[0]?.attachments[0]?.moderation_status).toBe('ok');
  });
  it('reconnect uses timestamp plus ID and merges same-timestamp messages once', async () => {
    state.get
      .mockResolvedValueOnce([message('a')])
      .mockResolvedValueOnce([message('b'), message('c')])
      .mockResolvedValue([]);
    await act(async () => {
      tree = create(<Probe room="one" />);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    expect(state.get).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.anything(),
      'one',
      expect.objectContaining({ afterCreatedAt: '2026-10-29T12:00:00Z', afterId: 'a' }),
    );
    expect(result.messages.map((m) => m.id)).toEqual(['a', 'b', 'c']);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    expect(result.messages).toHaveLength(3);
  });
});
