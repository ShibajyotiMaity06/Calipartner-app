import React, { useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({
  inbox: vi.fn(),
  respond: vi.fn(),
  cancel: vi.fn(),
  user: { id: 'owner' },
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: api.user }) }));
vi.mock('expo-router', () => ({
  useFocusEffect: (effect: () => (() => void) | undefined) => useEffect(effect, [effect]),
}));
vi.mock('@/lib/supabase', () => ({ getSupabase: () => ({}) }));
vi.mock('@/services/roomService', () => ({
  getRequestsInbox: api.inbox,
  respondToRoomRequest: api.respond,
  cancelRoomRequest: api.cancel,
  sendRoomInvitation: vi.fn(),
  requestToJoinRoom: vi.fn(),
  searchUserByUsername: vi.fn(),
}));
import { useRoomRequests } from './useRoomRequests';
let hooks: ReturnType<typeof useRoomRequests>[] = [];
let trees: ReactTestRenderer[] = [];
const request = { id: 'request' };
function Probe({ index = 0 }: { index?: number }) {
  hooks[index] = useRoomRequests();
  return null;
}
beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  vi.useFakeTimers();
  hooks = [];
  trees = [];
  api.inbox.mockResolvedValue({ incoming: [request], outgoing: [] });
});
afterEach(async () => {
  await act(async () => {
    for (const tree of trees) tree.unmount();
  });
  vi.useRealTimers();
});
async function mount(index = 0) {
  await act(async () => {
    trees.push(create(<Probe index={index} />));
  });
}
it('removes an accepted row after acknowledgement even when the subsequent refresh fails, and refreshes another inbox', async () => {
  await mount();
  await mount(1);
  let acknowledge!: (result: unknown) => void;
  api.respond.mockImplementation(
    () =>
      new Promise((resolve) => {
        acknowledge = resolve;
      }),
  );
  let result!: Promise<unknown>;
  await act(async () => {
    result = hooks[0]!.respondToRequest('request', true);
  });
  expect(hooks[0]!.incoming).toHaveLength(1);
  api.inbox.mockRejectedValue(new Error('offline'));
  await act(async () => {
    acknowledge({ status: 'accepted' });
    await result;
  });
  expect(hooks[0]!.incoming).toEqual([]);
  expect(api.inbox.mock.calls.length).toBeGreaterThan(3);
});
it('keeps a failed action visible and allows an explicit retry', async () => {
  await mount();
  api.respond.mockRejectedValue(new Error('offline'));
  await act(async () => {
    await expect(hooks[0]!.respondToRequest('request', true)).rejects.toThrow('offline');
  });
  expect(hooks[0]!.incoming).toHaveLength(1);
  api.respond.mockResolvedValue({ status: 'accepted' });
  api.inbox.mockResolvedValue({ incoming: [], outgoing: [] });
  await act(async () => {
    await hooks[0]!.respondToRequest('request', true);
  });
  expect(hooks[0]!.incoming).toEqual([]);
});
it('clears a stale request resolved on another device without surfacing REQUEST_NOT_FOUND', async () => {
  await mount();
  api.respond.mockRejectedValue(new Error('REQUEST_NOT_FOUND'));
  api.inbox.mockResolvedValue({ incoming: [], outgoing: [] });
  await act(async () => {
    await hooks[0]!.respondToRequest('request', false);
  });
  expect(hooks[0]!.incoming).toEqual([]);
  expect(hooks[0]!.error).toBeNull();
});
it('refreshes outgoing requests resolved by the recipient and prevents duplicate submissions', async () => {
  api.inbox.mockResolvedValue({ incoming: [], outgoing: [request] });
  await mount();
  api.inbox.mockResolvedValue({ incoming: [], outgoing: [] });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5000);
  });
  expect(hooks[0]!.outgoing).toEqual([]);
  let resolve!: (value: unknown) => void;
  api.cancel.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  let result!: Promise<unknown>;
  await act(async () => {
    result = hooks[0]!.cancelRequest('request');
    await hooks[0]!.cancelRequest('request');
  });
  expect(api.cancel).toHaveBeenCalledOnce();
  await act(async () => {
    resolve({ status: 'cancelled' });
    await result;
  });
});
