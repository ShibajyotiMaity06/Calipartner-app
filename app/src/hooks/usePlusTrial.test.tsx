import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({
  fetch: vi.fn(),
  claim: vi.fn(),
  user: { id: 'one' },
  uuid: vi.fn(() => 'stable-id'),
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: api.user }) }));
vi.mock('react-native', () => ({ AppState: { addEventListener: () => ({ remove: vi.fn() }) } }));
vi.mock('@/services/foodService', () => ({ generateClientUuid: api.uuid }));
vi.mock('@/services/plusTrialService', () => ({
  fetchPlusTrialOffer: api.fetch,
  claimPlusTrial: api.claim,
  plusTrialEvents: { subscribe: () => () => {} },
}));
import { usePlusTrial } from './usePlusTrial';
const offer = {
  eligible: true,
  active: false,
  expired: false,
  claim_id: null,
  started_at: null,
  ends_at: null,
  server_now: '2026-11-05T00:00:00Z',
};
let state!: ReturnType<typeof usePlusTrial>, tree: ReactTestRenderer;
function Harness() {
  state = usePlusTrial();
  return null;
}
beforeEach(async () => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  vi.clearAllMocks();
  api.user = { id: 'one' };
  api.fetch.mockResolvedValue(offer);
  await act(async () => {
    tree = create(<Harness />);
  });
});
afterEach(async () => {
  await act(async () => tree.unmount());
  vi.useRealTimers();
});
it('retries an unknown outcome using the same id and shows no access before acknowledgement', async () => {
  api.claim.mockRejectedValueOnce(new Error('response lost')).mockResolvedValueOnce({
    ...offer,
    active: true,
    eligible: false,
    ends_at: '2026-11-12T00:00:00Z',
  });
  await act(async () => {
    expect(await state.start()).toBe(false);
  });
  expect(state.offer?.active).toBe(false);
  expect(state.error).toBe(true);
  await act(async () => {
    expect(await state.start()).toBe(true);
  });
  expect(state.offer?.active).toBe(true);
  expect(api.claim.mock.calls).toEqual([['stable-id'], ['stable-id']]);
  expect(api.uuid).toHaveBeenCalledOnce();
});
it('refreshes at the server deadline and exposes expiry for the paywall', async () => {
  api.fetch
    .mockResolvedValueOnce({
      ...offer,
      active: true,
      eligible: false,
      ends_at: '2026-11-05T00:00:01Z',
    })
    .mockResolvedValueOnce({ ...offer, expired: true, eligible: false });
  await act(async () => {
    await state.refresh();
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
  expect(state.offer?.expired).toBe(true);
  expect(state.offer?.active).toBe(false);
});
it('does not apply a previous account response to the next account', async () => {
  let resolve!: (value: unknown) => void;
  api.claim.mockReturnValueOnce(
    new Promise((r) => {
      resolve = r;
    }),
  );
  let pending!: Promise<boolean>;
  await act(async () => {
    pending = state.start();
  });
  api.user = { id: 'two' };
  await act(async () => tree.update(<Harness />));
  await act(async () => {
    resolve({ ...offer, active: true });
    expect(await pending).toBe(false);
  });
  expect(state.offer?.active).toBe(false);
});
