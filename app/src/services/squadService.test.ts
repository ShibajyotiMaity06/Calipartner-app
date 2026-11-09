import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ getSupabase: () => ({ rpc: state.rpc }) }));
import {
  getSquadToday,
  getSquadMemberDetails,
  getSquadMentions,
  markSquadMentionSeen,
  setSquadVisibility,
  getSquadUnreadCount,
} from './squadService';
beforeEach(() => vi.clearAllMocks());
it('scores the complete server projection with personal targets and the shared core formula', async () => {
  const targets = { calories: 2000, protein: 100, carbs: 250, fat: 60, steps: 8000 };
  state.rpc.mockResolvedValue({
    data: {
      room_id: 'room',
      members: [
        { user_id: 'a', calories: 3000, protein: 50, carbs: 125, fat: 30, steps: 8000, targets },
        { user_id: 'b', calories: 2000, protein: 100, carbs: 250, fat: 60, steps: 8000, targets },
      ],
    },
    error: null,
  });
  expect(
    (await getSquadToday('room')).members.map((member) => [member.user_id, member.score]),
  ).toEqual([
    ['b', 100],
    ['a', 70],
  ]);
  expect(state.rpc).toHaveBeenCalledWith('get_squad_today', { p_room_id: 'room' });
});
it('reads only the server unread count and never acknowledges Home as read', async () => {
  state.rpc.mockResolvedValueOnce({ data: 140, error: null });
  expect(await getSquadUnreadCount('room')).toBe(140);
  expect(state.rpc).toHaveBeenCalledExactlyOnceWith('get_chat_unread_count', { p_room_id: 'room' });
  state.rpc.mockResolvedValueOnce({ data: null, error: new Error('offline') });
  await expect(getSquadUnreadCount('room')).rejects.toThrow('offline');
  state.rpc.mockResolvedValueOnce({ data: null, error: null });
  await expect(getSquadUnreadCount('room')).rejects.toThrow('UNREAD_UNAVAILABLE');
});
it('does not substitute an empty squad or premium details when the server rejects a request', async () => {
  state.rpc.mockResolvedValue({ data: null, error: new Error('PLUS_REQUIRED') });
  await expect(getSquadMemberDetails('room', 'peer')).rejects.toThrow('PLUS_REQUIRED');
  state.rpc.mockResolvedValue({ data: { room_id: 'wrong', members: [] }, error: null });
  await expect(getSquadToday('room')).rejects.toThrow('SQUAD_UNAVAILABLE');
});
it('uses both cursor fields so same-timestamp unread tags do not skip messages', async () => {
  state.rpc.mockResolvedValue({
    data: { count: 35, mentions: [], has_more: true, locked: false },
    error: null,
  });
  await getSquadMentions('room', { created_at: '2026-11-02T00:00:00Z', message_id: 'message' });
  expect(state.rpc).toHaveBeenCalledWith('get_squad_mentions', {
    p_room_id: 'room',
    p_before_created_at: '2026-11-02T00:00:00Z',
    p_before_id: 'message',
  });
});
it('waits for acknowledgement of visibility and seen state and surfaces request errors', async () => {
  state.rpc.mockResolvedValueOnce({ data: null, error: new Error('offline') });
  await expect(markSquadMentionSeen('room', 'message')).rejects.toThrow('offline');
  state.rpc.mockResolvedValueOnce({
    data: { share_weight: true, share_height: false },
    error: null,
  });
  expect(await setSquadVisibility('room', { share_weight: true, share_height: false })).toEqual({
    share_weight: true,
    share_height: false,
  });
  expect(state.rpc).toHaveBeenLastCalledWith('set_squad_visibility', {
    p_room_id: 'room',
    p_share_weight: true,
    p_share_height: false,
  });
});
