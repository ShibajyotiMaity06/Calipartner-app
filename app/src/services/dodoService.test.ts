import { beforeEach, describe, expect, it, vi } from 'vitest';
const invoke = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase', () => ({ getSupabase: () => ({ functions: { invoke } }) }));
import { createDodoCheckout } from './dodoService';
beforeEach(() => vi.clearAllMocks());
describe('browser Dodo checkout', () => {
  it('sends only a supported plan and persistent request ID, never price or account metadata', async () => {
    invoke.mockResolvedValue({
      data: { checkout_url: 'https://checkout.dodopayments.com/session' },
    });
    expect(await createDodoCheckout('pro', 'annual', 'request-id')).toBe(
      'https://checkout.dodopayments.com/session',
    );
    expect(invoke).toHaveBeenCalledWith('dodo-checkout', {
      body: { tier: 'pro', duration: 'annual', request_id: 'request-id' },
    });
  });
  it('does not simulate payment when Dodo is not configured', async () => {
    invoke.mockResolvedValue({ data: null, error: new Error('not configured') });
    await expect(createDodoCheckout('pro', 'annual', 'request-id')).rejects.toThrow();
  });
  it('rejects checkout URLs outside the payment provider', async () => {
    invoke.mockResolvedValue({ data: { checkout_url: 'https://example.com/fake-checkout' } });
    await expect(createDodoCheckout('pro', 'annual', 'request-id')).rejects.toThrow();
  });
});
