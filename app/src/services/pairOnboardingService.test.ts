import { beforeEach, expect, it, vi } from 'vitest';
const fake = vi.hoisted(() => ({
  store: new Map<string, string>(),
  rpc: vi.fn(),
  getUser: vi.fn(),
}));
vi.mock('@/lib/secureStore', () => ({
  secureStoreAdapter: {
    getItem: async (k: string) => fake.store.get(k) ?? null,
    setItem: async (k: string, v: string) => fake.store.set(k, v),
    removeItem: async (k: string) => fake.store.delete(k),
  },
}));
vi.mock('@/lib/supabase', () => ({
  getSupabase: () => ({ auth: { getUser: fake.getUser }, rpc: fake.rpc }),
}));
import {
  afterSetupDestination,
  rememberPairInvite,
  requirePairPrompt,
  finishPairPrompt,
  preparePairInvite,
  acceptPairInvite,
} from './pairOnboardingService';
const token = 'aa280000-0000-4000-8000-000000000001';
beforeEach(() => {
  fake.store.clear();
  fake.rpc.mockReset();
  fake.getUser.mockResolvedValue({ data: { user: { id: 'a' } } });
});
it('shows the pair prompt immediately after setup without affecting another account', async () => {
  await requirePairPrompt('a');
  expect(await afterSetupDestination('a')).toBe('/pair-start');
  expect(await afterSetupDestination('b')).toBe('/today');
  await finishPairPrompt('a');
  expect(await afterSetupDestination('a')).toBe('/today');
});
it('preserves a valid invite through signup and onboarding until explicit acceptance', async () => {
  await rememberPairInvite(token);
  await requirePairPrompt('a');
  expect(await afterSetupDestination('a')).toBe(`/invite/${token}`);
  fake.rpc.mockResolvedValue({ data: { room_id: 'room' } });
  expect(await acceptPairInvite(token)).toBe('room');
  expect(await afterSetupDestination('a')).toBe('/today');
});
it('reuses request IDs, validates bearer tokens and binds sharing to the signed-in account', async () => {
  fake.rpc.mockResolvedValue({ data: { token, expires_at: 'tomorrow' } });
  await preparePairInvite('a', 'Room');
  await preparePairInvite('a', 'Room');
  expect(fake.rpc.mock.calls[0]?.[1].p_client_id).toBe(fake.rpc.mock.calls[1]?.[1].p_client_id);
  await expect(preparePairInvite('b', 'Room')).rejects.toThrow('NOT_AUTHORIZED');
  await expect(rememberPairInvite('not-a-token')).rejects.toThrow('INVALID_INVITE');
});

it('creates a fresh invitation request after the earlier one was accepted, then keeps retries stable', async () => {
  fake.rpc.mockResolvedValueOnce({ data: { token, expires_at: 'tomorrow' }, error: null });
  await preparePairInvite('a', 'Room');
  const previous = fake.rpc.mock.calls[0]![1].p_client_id;
  fake.rpc
    .mockResolvedValueOnce({ data: null, error: { message: 'INVITE_ALREADY_USED' } })
    .mockResolvedValue({ data: { token, expires_at: 'tomorrow' }, error: null });
  await preparePairInvite('a', 'Room');
  const next = fake.rpc.mock.calls[2]![1].p_client_id;
  expect(next).not.toBe(previous);
  await preparePairInvite('a', 'Room');
  expect(fake.rpc.mock.calls[3]![1].p_client_id).toBe(next);
});
