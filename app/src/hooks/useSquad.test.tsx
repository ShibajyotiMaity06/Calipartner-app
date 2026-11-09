import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  user: 'viewer',
  read: vi.fn(),
  details: vi.fn(),
  mentions: vi.fn(),
  unread: vi.fn(),
  removeChannel: vi.fn(),
}));
vi.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    channel: () => {
      const channel = { on: vi.fn(() => channel), subscribe: vi.fn(() => channel) };
      return channel;
    },
    removeChannel: state.removeChannel,
  }),
}));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: state.user ? { id: state.user } : null }),
}));
vi.mock('./useCurrentLocalDate', () => ({
  useCurrentLocalDate: () => ({ localDate: '2026-11-02' }),
}));
vi.mock('@/services/squadService', () => ({
  getSquadToday: state.read,
  getSquadMemberDetails: state.details,
  getSquadMentions: state.mentions,
  getSquadUnreadCount: state.unread,
}));
import { useSquadToday, useSquadDetails, useSquadUnread } from './useSquad';
let tree: ReactTestRenderer;
let current: ReturnType<typeof useSquadToday>;
function Probe({ room = 'one', visible = true }: { room?: string; visible?: boolean }) {
  current = useSquadToday(room, visible);
  return null;
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  state.user = 'viewer';
  state.read.mockResolvedValue({ room_id: 'one', members: [] });
  state.details.mockResolvedValue({ meals: [], workouts: [] });
  state.unread.mockResolvedValue(140);
});
it('refreshes unread counts only while visible and clears them across room/account changes', async () => {
  let unread: ReturnType<typeof useSquadUnread>;
  function UnreadProbe({ room = 'one', visible = true }) {
    unread = useSquadUnread(room, visible);
    return null;
  }
  await act(async () => {
    tree = create(<UnreadProbe />);
  });
  expect(unread!.data).toBe(140);
  state.unread.mockResolvedValue(0);
  await act(async () => {
    vi.advanceTimersByTime(10000);
  });
  expect(unread!.data).toBe(0);
  await act(async () => tree.update(<UnreadProbe visible={false} />));
  expect(unread!.data).toBeNull();
  await act(async () => {
    vi.advanceTimersByTime(30000);
  });
  expect(state.unread).toHaveBeenCalledTimes(2);
  expect(state.removeChannel).toHaveBeenCalledOnce();
  state.user = 'other';
  await act(async () => tree.update(<UnreadProbe room="two" />));
  expect(state.unread).toHaveBeenLastCalledWith('two');
  expect(unread!.data).toBe(0);
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
  vi.useRealTimers();
});
it('refreshes visible squad progress for other members while preserving idle content', async () => {
  await act(async () => {
    tree = create(<Probe />);
  });
  expect(state.read).toHaveBeenCalledTimes(1);
  expect(current.data?.room_id).toBe('one');
  await act(async () => {
    vi.advanceTimersByTime(30000);
  });
  expect(state.read).toHaveBeenCalledTimes(3);
  await act(async () => tree.update(<Probe visible={false} />));
  expect(current.data).toBeNull();
  await act(async () => {
    vi.advanceTimersByTime(60000);
  });
  expect(state.read).toHaveBeenCalledTimes(3);
});
it('cannot publish an earlier room response after switching squads', async () => {
  let resolve!: (value: unknown) => void;
  state.read
    .mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    )
    .mockResolvedValue({ room_id: 'two', members: [] });
  await act(async () => {
    tree = create(<Probe />);
  });
  await act(async () => tree.update(<Probe room="two" />));
  await act(async () => resolve({ room_id: 'one', members: [{ user_id: 'private-old-peer' }] }));
  expect(current.data?.room_id).toBe('two');
  expect(current.data?.members).toEqual([]);
});
it('clears old data when access is revoked and exposes an actionable retry', async () => {
  await act(async () => {
    tree = create(<Probe />);
  });
  state.read.mockRejectedValueOnce(new Error('NOT_ROOM_MEMBER'));
  await act(async () => current.refresh());
  expect(current.data).toBeNull();
  expect(current.error).toBe(true);
  await act(async () => current.refresh());
  expect(current.error).toBe(false);
});
it('never retains one signed-in viewer’s response for a different account', async () => {
  let resolve!: (value: unknown) => void;
  state.read
    .mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    )
    .mockResolvedValue({ room_id: 'one', members: [] });
  await act(async () => {
    tree = create(<Probe />);
  });
  state.user = 'other';
  await act(async () => tree.update(<Probe />));
  await act(async () => resolve({ room_id: 'one', members: [{ user_id: 'old-account-peer' }] }));
  expect(current.data?.members).toEqual([]);
});
it('does not request premium meal or workout payloads while the viewer is Free', async () => {
  function DetailsProbe({ paid }: { paid: boolean }) {
    useSquadDetails('one', 'peer', paid);
    return null;
  }
  await act(async () => {
    tree = create(<DetailsProbe paid={false} />);
  });
  expect(state.details).not.toHaveBeenCalled();
  await act(async () => tree.update(<DetailsProbe paid />));
  expect(state.details).toHaveBeenCalledWith('one', 'peer');
  await act(async () => tree.update(<DetailsProbe paid={false} />));
  await act(async () => {
    vi.advanceTimersByTime(30000);
  });
  expect(state.details).toHaveBeenCalledTimes(1);
});
