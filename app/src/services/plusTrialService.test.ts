import { beforeEach, expect, it, vi } from 'vitest';
const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase', () => ({ getSupabase: () => ({ rpc }) }));
vi.mock('./deviceService', () => ({ getOrGenerateDeviceHash: async () => 'device-one' }));
import { claimPlusTrial, fetchPlusTrialOffer, plusTrialEvents } from './plusTrialService';
const offer = {
  eligible: false,
  active: true,
  expired: false,
  claim_id: 'request',
  started_at: '2026-11-05T00:00:00Z',
  ends_at: '2026-11-12T00:00:00Z',
  server_now: '2026-11-05T00:00:00Z',
};
beforeEach(() => {
  rpc.mockReset();
});
it('activates only through an acknowledged authenticated trial RPC and broadcasts the saved offer', async () => {
  rpc.mockResolvedValue({ data: offer, error: null });
  const notify = vi.fn();
  const unsubscribe = plusTrialEvents.subscribe(notify);
  expect(await claimPlusTrial('request')).toEqual(offer);
  expect(rpc).toHaveBeenCalledWith('claim_plus_trial', {
    p_client_id: 'request',
    p_device_hash: 'device-one',
  });
  expect(notify).toHaveBeenCalledOnce();
  unsubscribe();
});
it('never confirms a failed, malformed or expired grant', async () => {
  const notify = vi.fn();
  const unsubscribe = plusTrialEvents.subscribe(notify);
  for (const result of [
    { data: null, error: new Error('offline') },
    { data: { ...offer, active: false }, error: null },
    { data: { ...offer, ends_at: 'invalid' }, error: null },
  ]) {
    rpc.mockResolvedValueOnce(result);
    await expect(claimPlusTrial('same-request')).rejects.toBeDefined();
  }
  expect(notify).not.toHaveBeenCalled();
  unsubscribe();
});
it('reads a server-clock offer without sending country or payment details', async () => {
  rpc.mockResolvedValue({ data: offer, error: null });
  await fetchPlusTrialOffer();
  expect(rpc).toHaveBeenCalledWith('get_plus_trial_offer', { p_device_hash: 'device-one' });
});
