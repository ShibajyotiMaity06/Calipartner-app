import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  sdk: vi.fn(),
  navigate: vi.fn(),
  os: { OS: 'web' },
}));
vi.mock('react-native', () => ({ Platform: mocks.os }));
vi.mock('@/lib/supabase', () => ({ getSupabase: () => ({ functions: { invoke: mocks.invoke } }) }));
vi.mock('./webBillingService', () => ({ loadRazorpay: mocks.sdk }));
vi.mock('./dodoService', () => ({ navigateToCheckout: mocks.navigate }));
import { fetchCCWebCatalog, startCCWebCheckout } from './ccWebService';
const pack = { id: 'cc_100', cc: 100, amount: 199, currency: 'USD' as const };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.os.OS = 'web';
});
it('loads real minor-unit prices without substituting the native target prices', async () => {
  mocks.invoke.mockResolvedValue({ data: { provider: 'dodo', products: [pack] }, error: null });
  expect((await fetchCCWebCatalog()).products[0]?.amount).toBe(199);
});
it('falls back to Dodo before reserving an order when the Razorpay SDK is unavailable', async () => {
  mocks.sdk.mockRejectedValue(new Error('blocked script'));
  mocks.invoke.mockResolvedValue({
    data: { provider: 'dodo', checkout_url: 'https://checkout.dodopayments.com/test' },
    error: null,
  });
  expect(await startCCWebCheckout(pack, 'razorpay', 'retry-id')).toBe('redirected');
  expect(mocks.invoke).toHaveBeenCalledWith('cc-checkout', {
    body: {
      action: 'checkout',
      request_id: 'retry-id',
      pack_id: 'cc_100',
      amount: 199,
      currency: 'USD',
      dodo_fallback: true,
    },
  });
});
it('preserves caller retry identity after a lost acknowledgement and rejects unsafe redirects', async () => {
  mocks.invoke
    .mockResolvedValueOnce({ error: new Error('offline') })
    .mockResolvedValueOnce({ data: { provider: 'dodo', checkout_url: 'https://evil.example' } });
  await expect(startCCWebCheckout(pack, 'dodo', 'stable-id')).rejects.toThrow();
  await expect(startCCWebCheckout(pack, 'dodo', 'stable-id')).rejects.toThrow();
  expect(mocks.invoke.mock.calls.map((c) => c[1].body.request_id)).toEqual([
    'stable-id',
    'stable-id',
  ]);
  expect(mocks.navigate).not.toHaveBeenCalled();
});
it('never invokes web CC billing on native platforms', async () => {
  mocks.os.OS = 'ios';
  await expect(fetchCCWebCatalog()).rejects.toThrow();
  expect(mocks.invoke).not.toHaveBeenCalled();
});
