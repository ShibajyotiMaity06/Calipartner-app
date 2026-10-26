import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const invoke = vi.hoisted(() => vi.fn());
vi.mock('@/lib/supabase', () => ({ getSupabase: () => ({ functions: { invoke } }) }));
import { createDodoCheckout, fetchDodoCatalog, openDodoPortal } from './dodoService';
beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());
describe('browser Dodo checkout', () => {
  it('opens account management in the same tab after the asynchronous provider request', async () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { assign });
    invoke.mockResolvedValue({ data: { portal_url: 'https://customer.dodopayments.com/portal' } });
    await openDodoPortal();
    expect(assign).toHaveBeenCalledWith('https://customer.dodopayments.com/portal');
  });
  it('loads server-verified prices for every selectable plan', async () => {
    const products = ['plus_monthly', 'plus_annual', 'pro_monthly', 'pro_annual'].map((key) => ({
      key,
      currency: 'INR',
      amount: 249,
      trialDays: key.startsWith('plus') ? 7 : 0,
    }));
    invoke.mockResolvedValue({ data: { products } });
    expect(await fetchDodoCatalog()).toEqual(products);
    expect(invoke).toHaveBeenCalledWith('dodo-checkout', { body: { action: 'catalog' } });
  });
  it.each([[], [{ key: 'pro_annual', currency: 'INR', amount: 2499 }], null])(
    'rejects missing or incomplete provider pricing: %j',
    async (products) => {
      invoke.mockResolvedValue({ data: { products } });
      await expect(fetchDodoCatalog()).rejects.toThrow();
    },
  );
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
