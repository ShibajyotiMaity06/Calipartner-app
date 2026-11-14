import { beforeEach, describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
const mocked = vi.hoisted(() => ({ offline: false, rpc: vi.fn() }));
vi.mock('./networkService', () => ({ isDeviceOffline: async () => mocked.offline }));
vi.mock('./offlineReadService', () => ({
  cachedRead: (_client: unknown, _key: string, read: () => Promise<unknown>) => read(),
}));
import { saveAvatar, purchaseAvatarProduct, claimAvatarDrop } from './avatarService';
const client = { rpc: mocked.rpc } as unknown as SupabaseClient;
beforeEach(() => {
  mocked.offline = false;
  mocked.rpc.mockReset();
});
describe('avatar acknowledged saves', () => {
  it('does not confirm a failed or missing acknowledgement and retries the same UUID', async () => {
    mocked.rpc
      .mockResolvedValueOnce({ error: { message: 'network' }, data: null })
      .mockResolvedValueOnce({ error: null, data: { enabled: true } });
    const save = () =>
      saveAvatar(client, 'stable-id', 'f', 'skin_2', {
        slots: { top: 'top_tank' },
        tints: { top: 'garment_5' },
      });
    await expect(save()).rejects.toThrow('network');
    await expect(save()).resolves.toEqual({ enabled: true });
    expect(mocked.rpc.mock.calls.map(([, args]) => args.p_request_id)).toEqual([
      'stable-id',
      'stable-id',
    ]);
    mocked.rpc.mockResolvedValueOnce({ error: null, data: null });
    await expect(save()).rejects.toThrow('MISSING_ACKNOWLEDGEMENT');
  });
  it('blocks offline writes without creating a local upload or granting CC', async () => {
    mocked.offline = true;
    await expect(purchaseAvatarProduct(client, 'id', 45, 'hair_fade', null)).rejects.toThrow(
      'NETWORK_UNAVAILABLE',
    );
    await expect(claimAvatarDrop(client)).rejects.toThrow('NETWORK_UNAVAILABLE');
    expect(mocked.rpc).not.toHaveBeenCalled();
  });
  it('passes the reviewed price and request id to the atomic purchase RPC', async () => {
    mocked.rpc.mockResolvedValue({ data: { balances: { earned: 0, purchased: 70 } }, error: null });
    await purchaseAvatarProduct(client, 'purchase-id', 90, null, 'gym_basics');
    expect(mocked.rpc).toHaveBeenCalledWith('avatar_purchase', {
      p_request_id: 'purchase-id',
      p_expected_price: 90,
      p_product_id: null,
      p_collection_id: 'gym_basics',
    });
  });
});
