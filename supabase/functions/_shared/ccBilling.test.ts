import assert from 'node:assert/strict';
import { applyDodoCC, applyRazorpayCC } from './ccBilling.ts';
import { dodoConfig } from './dodo.ts';
import { razorpayConfig } from './razorpay.ts';
import { handleCCCheckout } from '../cc-checkout/index.ts';
const checkout = {
  id: 'cc150001-0000-4000-8000-000000000001',
  user_id: 'owner',
  pack_id: 'cc_100',
  cc: 100,
  provider: 'dodo',
  product_id: 'pdt_pack',
  currency: 'USD',
  amount: 99,
  provider_ref: 'session_1',
  state: 'ready',
};
function setup() {
  const writes: unknown[] = [];
  const payment = {
    payment_id: 'pay_1',
    metadata: { cc_checkout_id: checkout.id },
    checkout_session_id: 'session_1',
    currency: 'USD',
    total_amount: 99,
    status: 'succeeded',
    product_cart: [{ product_id: 'pdt_pack', quantity: 1 }],
  };
  const row = { ...checkout };
  const query = {
    select() {
      return this;
    },
    eq() {
      return this;
    },
    single: async () => ({ data: row, error: null }),
    maybeSingle: async () => ({ data: row, error: null }),
  };
  const admin = {
    from: () => query,
    rpc: async (_name: string, args: unknown) => {
      writes.push(args);
      return { error: null, data: true };
    },
    auth: {
      getUser: async () => ({
        data: { user: { id: 'owner', email: 'owner@example.invalid' } },
        error: null,
      }),
    },
  };
  const config = {
    origin: 'https://app.example',
    admin,
    dodo: { payments: { retrieve: async () => payment } },
  } as unknown as ReturnType<typeof dodoConfig>;
  return { config, writes, payment, row, admin };
}
Deno.test(
  'CC Dodo binds the signed payment to the reserved cart, session, amount and currency',
  async () => {
    const s = setup();
    assert.equal(await applyDodoCC('pay_1', false, s.config), true);
    assert.equal(s.writes.length, 1);
    s.payment.product_cart[0].quantity = 2;
    await assert.rejects(applyDodoCC('pay_1', false, s.config), /INVALID_CC_PAYMENT/);
    s.payment.product_cart[0].quantity = 1;
    s.payment.total_amount = 1;
    await assert.rejects(applyDodoCC('pay_1', false, s.config), /INVALID_CC_PAYMENT/);
    assert.equal(s.writes.length, 1);
  },
);
Deno.test(
  'CC Razorpay requires captured payment and forwards a verified refund without granting',
  async () => {
    const s = setup();
    s.row.provider = 'razorpay';
    const config = { admin: s.admin } as unknown as ReturnType<typeof razorpayConfig>;
    const payment = {
      id: 'pay_1',
      order_id: 'order_1',
      currency: 'USD',
      amount: 99,
      status: 'authorized',
      captured: false,
    };
    await assert.rejects(applyRazorpayCC(payment, false, config), /INVALID_CC_PAYMENT/);
    payment.status = 'captured';
    payment.captured = true;
    assert.equal(await applyRazorpayCC(payment, false, config), true);
    assert.equal(await applyRazorpayCC(payment, true, config), true);
    assert.equal((s.writes[1] as { p_refund: boolean }).p_refund, true);
  },
);
Deno.test(
  'CC checkout rejects untrusted origins and forged quotes before reservation',
  async () => {
    const s = setup();
    s.config.admin.from = (() => ({
      select() {
        return this;
      },
      eq() {
        return this;
      },
      maybeSingle: async () => ({ data: null, error: null }),
    })) as unknown as typeof s.config.admin.from;
    const deps = {
      config: () => s.config,
      detectCountry: async () => 'US',
      catalog: async () => [
        { id: 'cc_100', cc: 100, currency: 'USD' as const, amount: 99, productId: 'pdt_pack' },
      ],
    };
    const req = (origin: string, amount: number) =>
      new Request('https://edge.example', {
        method: 'POST',
        headers: { origin, authorization: 'Bearer fixture' },
        body: JSON.stringify({
          action: 'checkout',
          request_id: checkout.id,
          pack_id: 'cc_100',
          amount,
          currency: 'USD',
        }),
      });
    assert.equal((await handleCCCheckout(req('https://evil.example', 99), deps)).status, 403);
    assert.equal((await handleCCCheckout(req('https://app.example', 1), deps)).status, 409);
    // Only the rate-limit RPC ran. No reserve or credit RPC.
    assert.equal(s.writes.length, 1);
  },
);
Deno.test('CC checkout rejects another account retrying a known checkout id', async () => {
  const s = setup();
  s.row.user_id = 'another-owner';
  const res = await handleCCCheckout(
    new Request('https://edge.example', {
      method: 'POST',
      headers: { origin: 'https://app.example', authorization: 'Bearer fixture' },
      body: JSON.stringify({ action: 'checkout', request_id: checkout.id, pack_id: 'cc_100' }),
    }),
    { config: () => s.config },
  );
  assert.equal(res.status, 409);
});

Deno.test(
  'India uses Dodo when Razorpay order creation fails before checkout exposure',
  async () => {
    const s = setup();
    const calls: string[] = [];
    s.config.admin.from = (() => ({
      select() {
        return this;
      },
      eq() {
        return this;
      },
      maybeSingle: async () => ({ data: null, error: null }),
    })) as unknown as typeof s.config.admin.from;
    s.config.admin.rpc = (async (name: string, args: Record<string, unknown>) => {
      calls.push(name);
      if (name === 'check_rate_limit') {
        assert.equal(args.p_max_requests, 30);
        return { data: true, error: null };
      }
      return {
        data: {
          fresh: true,
          checkout: {
            ...checkout,
            provider: 'razorpay',
            currency: 'INR',
            provider_ref: null,
            state: 'pending',
          },
        },
        error: null,
      };
    }) as unknown as typeof s.config.admin.rpc;
    const deps = {
      config: () => s.config,
      detectCountry: async () => 'IN',
      razorConfig: () => ({}) as ReturnType<typeof razorpayConfig>,
      catalog: async () => [
        { id: 'cc_100', cc: 100, currency: 'INR' as const, amount: 99, productId: 'pdt_pack' },
      ],
      razorpay: async () => {
        calls.push('razorpay');
        throw new Error('outage');
      },
      createDodo: async () => {
        calls.push('dodo');
        return new Response(JSON.stringify({ provider: 'dodo' }));
      },
    };
    const response = await handleCCCheckout(
      new Request('https://edge.example', {
        method: 'POST',
        headers: { origin: 'https://app.example', authorization: 'Bearer fixture' },
        body: JSON.stringify({
          action: 'checkout',
          request_id: checkout.id,
          pack_id: 'cc_100',
          amount: 99,
          currency: 'INR',
        }),
      }),
      deps,
    );
    assert.equal(response.status, 200);
    assert.deepEqual(calls, ['check_rate_limit', 'reserve_cc_web_checkout', 'razorpay', 'dodo']);
  },
);
