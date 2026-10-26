import assert from 'node:assert/strict';
import DodoPayments from 'npm:dodopayments@2.40.0';
import { Webhook } from 'npm:standardwebhooks@1.1.1';
import { handleDodoCheckout, handleDodoWebhook } from './dodoHandlers.ts';
import { dodoConfig } from './dodo.ts';

const secret = 'whsec_' + btoa('a-test-only-webhook-secret-123456');
const subscription = {
  subscription_id: 'sub_test',
  product_id: 'pdt_test',
  customer: { customer_id: 'cus_test' },
  status: 'active',
  next_billing_date: '2099-01-01',
  metadata: { checkout_id: 'fa000000-0000-4000-8000-000000000002' },
};
function setup() {
  let writes = 0;
  let creates = 0;
  const sdk = new DodoPayments({ bearerToken: 'not-a-real-key', webhookKey: secret });
  const config = {
    origin: 'https://app.example',
    products: { pro_annual: 'pdt_test' },
    dodo: {
      webhooks: sdk.webhooks,
      subscriptions: { retrieve: async () => subscription },
      checkoutSessions: {
        create: async () => {
          creates++;
          return {
            checkout_url: 'https://checkout.dodopayments.com/session',
            session_id: 'cks_test',
          };
        },
      },
    },
    admin: {
      auth: {
        getUser: async () => ({
          data: { user: { id: 'user-a', email: 'a@example.com' } },
          error: null,
        }),
      },
      rpc: async (name: string) => {
        if (name === 'check_rate_limit') return { data: true };
        writes++;
        return { error: null };
      },
      from: (table: string) => ({
        select() {
          return this;
        },
        eq() {
          return this;
        },
        maybeSingle: async () => ({
          data:
            table === 'dodo_checkouts'
              ? {
                  user_id: 'user-a',
                  product_key: 'pro_annual',
                  checkout_url: 'https://checkout.dodopayments.com/existing',
                }
              : null,
        }),
      }),
    },
  } as unknown as ReturnType<typeof dodoConfig>;
  return { config, writes: () => writes, creates: () => creates };
}
function signed(body: string, valid = true) {
  const timestamp = new Date();
  const id = 'event_test';
  const signature = new Webhook(secret).sign(id, timestamp, body);
  return new Request('https://functions.example/dodo-webhook', {
    method: 'POST',
    headers: {
      'webhook-id': id,
      'webhook-timestamp': String(Math.floor(timestamp.getTime() / 1000)),
      'webhook-signature': valid ? signature : 'v1,invalid',
    },
    body,
  });
}
Deno.test(
  'Dodo webhook rejects invalid and tampered signatures without granting access',
  async () => {
    Deno.env.set('DODO_PAYMENTS_WEBHOOK_KEY', secret);
    const state = setup();
    assert.equal((await handleDodoWebhook(signed('{}', false), () => state.config)).status, 401);
    assert.equal(state.writes(), 0);
  },
);
Deno.test(
  'A verified subscription event applies exactly the server-verified subscription',
  async () => {
    Deno.env.set('DODO_PAYMENTS_WEBHOOK_KEY', secret);
    const state = setup();
    const event = JSON.stringify({
      business_id: 'bus_test',
      type: 'subscription.active',
      timestamp: new Date().toISOString(),
      data: subscription,
    });
    assert.equal((await handleDodoWebhook(signed(event), () => state.config)).status, 200);
    assert.equal(state.writes(), 1);
  },
);
Deno.test(
  'Checkout requires authenticated account context before creating a payment session',
  async () => {
    const state = setup();
    const response = await handleDodoCheckout(
      new Request('https://functions.example/dodo-checkout', { method: 'POST', body: '{}' }),
      () => state.config,
    );
    assert.equal(response.status, 401);
    assert.equal(state.creates(), 0);
  },
);
Deno.test(
  'Retries reuse an account-bound checkout without creating a second provider session',
  async () => {
    const state = setup();
    const request = new Request('https://functions.example/dodo-checkout', {
      method: 'POST',
      headers: { Authorization: 'Bearer user-token' },
      body: JSON.stringify({
        tier: 'pro',
        duration: 'annual',
        request_id: subscription.metadata.checkout_id,
      }),
    });
    const response = await handleDodoCheckout(request, () => state.config);
    assert.equal(response.status, 200);
    assert.equal(
      (await response.json()).checkout_url,
      'https://checkout.dodopayments.com/existing',
    );
    assert.equal(state.creates(), 0);
  },
);
Deno.test(
  'A client cannot supply a product ID, price, or another account to buy an unsupported tier',
  async () => {
    const state = setup();
    const request = new Request('https://functions.example/dodo-checkout', {
      method: 'POST',
      headers: { Authorization: 'Bearer user-token' },
      body: JSON.stringify({
        tier: 'invented',
        duration: 'annual',
        user_id: 'other-user',
        price: 0,
        product_id: 'pdt_bad',
        request_id: subscription.metadata.checkout_id,
      }),
    });
    assert.equal((await handleDodoCheckout(request, () => state.config)).status, 400);
    assert.equal(state.creates(), 0);
  },
);
