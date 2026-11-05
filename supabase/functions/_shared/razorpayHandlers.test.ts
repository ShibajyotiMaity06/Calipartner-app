import assert from 'node:assert/strict';
import { handleRazorpayCheckout, handleRazorpayWebhook } from './razorpayHandlers.ts';
import { razorpayConfig, signatureMatches } from './razorpay.ts';
const checkoutId = 'fa110000-0000-4000-8000-000000000001';
const secret = 'fixture-webhook-secret';
const now = Math.floor(Date.now() / 1000);
const plans = {
  plus_monthly: 'plan_PlusMonthly',
  plus_annual: 'plan_PlusAnnual',
  pro_monthly: 'plan_ProMonthly',
  pro_annual: 'plan_ProAnnual',
};
async function sign(raw: string, key = secret) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return Array.from(
    new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(raw))),
    (byte) => byte.toString(16).padStart(2, '0'),
  ).join('');
}
function setup(
  options: {
    country?: string;
    lostAck?: boolean;
    existing?: boolean;
    wrongPrice?: boolean;
    wrongOwner?: boolean;
  } = {},
) {
  const rows = new Map<string, Record<string, unknown>>();
  const calls: Array<{ path: string; body?: unknown }> = [];
  const events: Array<Record<string, unknown>> = [];
  let reserveCount = 0;
  let subscription: Record<string, unknown> = {
    id: 'sub_Fixture',
    plan_id: plans.plus_monthly,
    status: 'active',
    paid_count: 1,
    notes: { checkout_id: checkoutId },
    start_at: now + 7 * 86400,
  };
  const payment: Record<string, unknown> = {
    id: 'pay_Fixture',
    invoice_id: 'inv_Fixture',
    status: 'captured',
    currency: 'INR',
    amount: 24900,
    amount_refunded: 0,
  };
  const invoice: Record<string, unknown> = {
    id: 'inv_Fixture',
    payment_id: 'pay_Fixture',
    subscription_id: 'sub_Fixture',
    status: 'paid',
    currency: 'INR',
    amount_paid: 24900,
    billing_end: now + 30 * 86400,
  };
  if (options.existing)
    rows.set(checkoutId, {
      id: checkoutId,
      user_id: 'owner',
      provider: 'razorpay',
      product_id: plans.plus_monthly,
      subscription_id: 'sub_Fixture',
      trial_end: new Date((now + 7 * 86400) * 1000).toISOString(),
      state: 'ready',
    });
  const config = {
    keyId: 'rzp_live_Fixture',
    keySecret: 'fixture-key-secret',
    webhookSecret: secret,
    plans,
    origin: 'https://app.example',
    admin: {
      auth: {
        getUser: async () => ({
          data: { user: { id: 'owner', email: 'fixture@example.invalid' } },
          error: null,
        }),
      },
      rpc: async (name: string, args: Record<string, unknown>) => {
        if (name === 'check_rate_limit') return { data: true, error: null };
        if (name === 'apply_razorpay_event') {
          events.push(args);
          return { data: { status: 'processed' }, error: null };
        }
        assert.equal(name, 'reserve_web_checkout');
        assert.equal(args.p_user_id, 'owner');
        reserveCount++;
        const previous = rows.get(String(args.p_id));
        if (previous) return { data: { ...previous, cached: true }, error: null };
        const row = {
          id: args.p_id,
          user_id: 'owner',
          provider: 'razorpay',
          product_id: args.p_product_id,
          state: 'reserved',
          trial_end: null,
        };
        rows.set(String(args.p_id), row);
        return { data: { ...row, cached: false }, error: null };
      },
      from: (table: string) => {
        const filters: Record<string, unknown> = {};
        let update: Record<string, unknown> | undefined;
        const result = () => {
          if (table === 'profiles')
            return { data: { country: options.country ?? 'IN' }, error: null };
          if (table === 'entitlements')
            return { data: { original_transaction_id: 'sub_Fixture' }, error: null };
          const row = rows.get(String(filters.id ?? checkoutId));
          if (!row || (filters.user_id && (options.wrongOwner || filters.user_id !== row.user_id)))
            return { data: null, error: null };
          if (update) Object.assign(row, update);
          return { data: row, error: null };
        };
        return {
          select() {
            return this;
          },
          eq(key: string, value: unknown) {
            filters[key] = value;
            return this;
          },
          update(value: Record<string, unknown>) {
            update = value;
            return this;
          },
          maybeSingle: async () => result(),
          then(resolve: (value: unknown) => void) {
            resolve(result());
          },
        };
      },
    },
    api: async (path: string, body?: unknown) => {
      calls.push({ path, body });
      if (path.startsWith('/plans/')) {
        const key = Object.entries(plans).find(([, value]) => path.endsWith(value))![0];
        return {
          id: plans[key as keyof typeof plans],
          period: key.endsWith('annual') ? 'yearly' : 'monthly',
          interval: 1,
          item: {
            currency: 'INR',
            amount: options.wrongPrice
              ? 1
              : key === 'plus_monthly'
                ? 24900
                : key === 'plus_annual'
                  ? 149900
                  : key === 'pro_monthly'
                    ? 49900
                    : 249900,
          },
        };
      }
      if (path === '/subscriptions') {
        if (options.lostAck) throw new Error('network lost after provider create');
        const input = body as Record<string, unknown>;
        subscription = {
          ...subscription,
          plan_id: input.plan_id,
          status: 'created',
          start_at: input.start_at ?? now,
        };
        return subscription;
      }
      if (path.endsWith('/cancel')) {
        subscription.status = 'cancelled';
        return subscription;
      }
      if (path.startsWith('/subscriptions/')) return subscription;
      if (path.startsWith('/payments/')) return payment;
      if (path.startsWith('/invoices/')) return invoice;
      throw new Error('unexpected path');
    },
  } as unknown as ReturnType<typeof razorpayConfig>;
  return {
    config,
    calls,
    events,
    rows,
    payment,
    invoice,
    subscription: () => subscription,
    reserveCount: () => reserveCount,
  };
}
function request(body: unknown, origin = 'https://app.example', auth = true) {
  return new Request('https://example/razorpay-checkout', {
    method: 'POST',
    headers: { Origin: origin, ...(auth ? { Authorization: 'Bearer fixture' } : {}) },
    body: JSON.stringify(body),
  });
}
async function webhook(event: Record<string, unknown>, valid = true) {
  const raw = JSON.stringify({ created_at: now, ...event });
  return new Request('https://example/razorpay-webhook', {
    method: 'POST',
    headers: {
      'x-razorpay-event-id': 'event-fixture',
      'x-razorpay-signature': await sign(valid ? raw : raw + 'changed'),
    },
    body: raw,
  });
}

Deno.test(
  'Checkout authenticates and requires the configured web origin and Indian saved country',
  async () => {
    const state = setup();
    assert.equal(
      (await handleRazorpayCheckout(request({}, undefined, false), () => state.config)).status,
      401,
    );
    assert.equal(
      (await handleRazorpayCheckout(request({}, 'https://evil.example'), () => state.config))
        .status,
      403,
    );
    const international = setup({ country: 'US' });
    assert.equal(
      (await handleRazorpayCheckout(request({ action: 'catalog' }), () => international.config))
        .status,
      403,
    );
    assert.equal(state.calls.length, 0);
  },
);
Deno.test(
  'Catalog validates every actual INR plan; wrong prices never reserve a checkout',
  async () => {
    const state = setup();
    const result = await handleRazorpayCheckout(request({ action: 'catalog' }), () => state.config);
    assert.equal(result.status, 200);
    assert.equal((await result.json()).products.length, 4);
    const bad = setup({ wrongPrice: true });
    assert.equal(
      (
        await handleRazorpayCheckout(
          request({ tier: 'plus', duration: 'monthly', request_id: checkoutId }),
          () => bad.config,
        )
      ).status,
      503,
    );
    assert.equal(bad.reserveCount(), 0);
  },
);
Deno.test(
  'Account-bound reservations reuse one subscription, without a new provider trial or client-granted entitlements',
  async () => {
    for (const tier of ['plus', 'pro']) {
      const state = setup();
      const body = {
        tier,
        duration: 'monthly',
        request_id: checkoutId,
        user_id: 'attacker',
        amount: 1,
      };
      assert.equal((await handleRazorpayCheckout(request(body), () => state.config)).status, 200);
      assert.equal((await handleRazorpayCheckout(request(body), () => state.config)).status, 200);
      const creates = state.calls.filter((call) => call.path === '/subscriptions');
      assert.equal(creates.length, 1);
      assert.equal(Boolean((creates[0].body as Record<string, unknown>).start_at), false);
      assert.equal(state.events.length, 0);
    }
  },
);
Deno.test(
  'Unknown creation outcome stays reserved; a retry never creates another subscription',
  async () => {
    const state = setup({ lostAck: true });
    const body = { tier: 'plus', duration: 'monthly', request_id: checkoutId };
    assert.equal((await handleRazorpayCheckout(request(body), () => state.config)).status, 503);
    assert.equal((await handleRazorpayCheckout(request(body), () => state.config)).status, 409);
    assert.equal(state.calls.filter((call) => call.path === '/subscriptions').length, 1);
  },
);
Deno.test(
  'Receipt verification binds the saved owner and subscription and never grants access',
  async () => {
    const state = setup({ existing: true });
    const body = {
      action: 'verify',
      request_id: checkoutId,
      razorpay_subscription_id: 'sub_Fixture',
      razorpay_payment_id: 'pay_Fixture',
      razorpay_signature: await sign('pay_Fixture|sub_Fixture', 'fixture-key-secret'),
    };
    assert.equal((await handleRazorpayCheckout(request(body), () => state.config)).status, 200);
    assert.equal(
      (
        await handleRazorpayCheckout(
          request({ ...body, razorpay_subscription_id: 'sub_Attacker' }),
          () => state.config,
        )
      ).status,
      401,
    );
    const other = setup({ existing: true, wrongOwner: true });
    assert.equal((await handleRazorpayCheckout(request(body), () => other.config)).status, 401);
    assert.equal(state.events.length, 0);
  },
);
Deno.test(
  'Cancellation is owner-bound, acknowledged and idempotent; it does not revoke current paid access',
  async () => {
    const state = setup({ existing: true });
    const body = { action: 'cancel', request_id: checkoutId };
    assert.equal((await handleRazorpayCheckout(request(body), () => state.config)).status, 200);
    assert.equal((await handleRazorpayCheckout(request(body), () => state.config)).status, 200);
    assert.equal(state.calls.filter((call) => call.path.endsWith('/cancel')).length, 1);
    assert.equal(state.events.length, 0);
    const other = setup({ existing: true, wrongOwner: true });
    assert.equal((await handleRazorpayCheckout(request(body), () => other.config)).status, 403);
  },
);
Deno.test(
  'Webhook verifies the untouched raw body before provider reads or entitlement writes',
  async () => {
    const state = setup({ existing: true });
    assert.equal(
      (
        await handleRazorpayWebhook(
          await webhook({ event: 'subscription.charged' }, false),
          () => state.config,
        )
      ).status,
      401,
    );
    assert.equal(state.calls.length, 0);
    assert.equal(state.events.length, 0);
    assert.equal(await signatureMatches(secret, 'payload', 'invalid'), false);
  },
);
Deno.test(
  'Captured recurring invoices grant only their verified paid billing period; authorizations do not',
  async () => {
    for (const captured of [true, false]) {
      const state = setup({ existing: true });
      state.payment.status = captured ? 'captured' : 'authorized';
      const result = await handleRazorpayWebhook(
        await webhook({
          event: 'subscription.charged',
          payload: {
            subscription: { entity: { id: 'sub_Fixture' } },
            payment: { entity: { id: 'pay_Fixture' } },
          },
        }),
        () => state.config,
      );
      assert.equal(result.status, 200);
      assert.equal(state.events[0].p_kind, captured ? 'paid' : 'retain');
      if (captured)
        assert.equal(
          state.events[0].p_period_end,
          new Date((now + 30 * 86400) * 1000).toISOString(),
        );
    }
  },
);
Deno.test(
  'A mandate-authenticated Plus trial has its exact reserved end and no paid flag',
  async () => {
    const state = setup({ existing: true });
    state.subscription().status = 'authenticated';
    state.subscription().paid_count = 0;
    assert.equal(
      (
        await handleRazorpayWebhook(
          await webhook({
            event: 'subscription.authenticated',
            payload: { subscription: { entity: { id: 'sub_Fixture' } } },
          }),
          () => state.config,
        )
      ).status,
      200,
    );
    assert.equal(state.events[0].p_kind, 'trial');
  },
);
Deno.test(
  'Full refunds revoke their invoice period, partial refunds preserve access and mismatched invoices fail closed',
  async () => {
    for (const full of [true, false]) {
      const state = setup({ existing: true });
      state.payment.status = full ? 'refunded' : 'captured';
      state.payment.amount_refunded = full ? 24900 : 100;
      assert.equal(
        (
          await handleRazorpayWebhook(
            await webhook({
              event: 'refund.processed',
              payload: { refund: { entity: { payment_id: 'pay_Fixture' } } },
            }),
            () => state.config,
          )
        ).status,
        200,
      );
      assert.equal(state.events.length, full ? 1 : 0);
      if (full) assert.equal(state.events[0].p_kind, 'revoke');
    }
    const state = setup({ existing: true });
    state.invoice.subscription_id = 'sub_Attacker';
    assert.equal(
      (
        await handleRazorpayWebhook(
          await webhook({
            event: 'subscription.charged',
            payload: {
              subscription: { entity: { id: 'sub_Fixture' } },
              payment: { entity: { id: 'pay_Fixture' } },
            },
          }),
          () => state.config,
        )
      ).status,
      400,
    );
    assert.equal(state.events.length, 0);
  },
);

Deno.test(
  'Mandate-only payments activate an eligible trial without a paid invoice; their refunds never revoke it',
  async () => {
    const state = setup({ existing: true });
    state.subscription().status = 'authenticated';
    state.subscription().paid_count = 0;
    state.payment.invoice_id = null;
    state.payment.amount = 100;
    const event = {
      event: 'subscription.authenticated',
      payload: {
        subscription: { entity: { id: 'sub_Fixture' } },
        payment: { entity: { id: 'pay_Fixture' } },
      },
    };
    assert.equal(
      (await handleRazorpayWebhook(await webhook(event), () => state.config)).status,
      200,
    );
    assert.equal(state.events[0].p_kind, 'trial');
    const refund = {
      event: 'refund.processed',
      payload: { refund: { entity: { payment_id: 'pay_Fixture' } } },
    };
    assert.equal(
      (await handleRazorpayWebhook(await webhook(refund), () => state.config)).status,
      200,
    );
    assert.equal(state.events.length, 1);
  },
);
Deno.test(
  'A dismissed, unapproved checkout is cancelled before another plan can be started',
  async () => {
    const state = setup({ existing: true });
    state.subscription().status = 'created';
    state.subscription().paid_count = 0;
    const response = await handleRazorpayCheckout(
      request({ action: 'dismiss', request_id: checkoutId }),
      () => state.config,
    );
    assert.equal(response.status, 200);
    assert.equal((await response.json()).status, 'checkout_cancelled');
    assert.equal(state.rows.get(checkoutId)?.state, 'closed');
    const paid = setup({ existing: true });
    const pending = await handleRazorpayCheckout(
      request({ action: 'dismiss', request_id: checkoutId }),
      () => paid.config,
    );
    assert.equal((await pending.json()).status, 'awaiting_webhook');
    assert.equal(
      paid.calls.some((call) => call.path.endsWith('/cancel')),
      false,
    );
  },
);
Deno.test(
  'Production rejects test credentials by default; isolated test mode must be explicit',
  () => {
    const keys = [
      'RAZORPAY_KEY_ID',
      'RAZORPAY_KEY_SECRET',
      'RAZORPAY_WEBHOOK_SECRET',
      'RAZORPAY_APP_URL',
      'RAZORPAY_PLANS_JSON',
      'RAZORPAY_ENVIRONMENT',
      'RAZORPAY_ALLOW_TEST_MODE',
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
    ];
    const previous = keys.map((key) => Deno.env.get(key));
    try {
      const values = [
        'rzp_test_Fixture',
        'fixture-secret',
        secret,
        'https://app.example',
        JSON.stringify(plans),
        'live',
        'false',
        'https://example.supabase.co',
        'fixture-service-key',
      ];
      keys.forEach((key, index) => Deno.env.set(key, values[index]));
      assert.throws(() => razorpayConfig(), /RAZORPAY_NOT_CONFIGURED/);
      Deno.env.set('RAZORPAY_ENVIRONMENT', 'test');
      assert.throws(() => razorpayConfig(), /RAZORPAY_NOT_CONFIGURED/);
      Deno.env.set('RAZORPAY_ALLOW_TEST_MODE', 'true');
      assert.equal(razorpayConfig().keyId, 'rzp_test_Fixture');
    } finally {
      keys.forEach((key, index) =>
        previous[index] === undefined ? Deno.env.delete(key) : Deno.env.set(key, previous[index]!),
      );
    }
  },
);
