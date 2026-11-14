import assert from 'node:assert/strict';
import { handleRevenueCatWebhook } from './index.ts';

Deno.test(
  'CC webhook verifies auth, ignores sandbox, and maps native receipts/refunds without subscription grants',
  async () => {
    const names = [
      'REVENUECAT_WEBHOOK_SECRET',
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'REVENUECAT_ALLOW_SANDBOX',
    ];
    const previous = names.map((k) => Deno.env.get(k));
    Deno.env.set(names[0], 'avatar-webhook-fixture-secret');
    Deno.env.set(names[1], 'https://fixture.invalid');
    Deno.env.set(names[2], 'fixture-service-value');
    Deno.env.delete(names[3]);
    const calls: { name: string; args: Record<string, unknown> }[] = [];
    const client = {
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: { id: 'cc_100' }, error: null }) }),
        }),
      }),
      rpc: async (name: string, args: Record<string, unknown>) => {
        calls.push({ name, args });
        return { data: { earned: 0, purchased: 100 }, error: null };
      },
    };
    const makeClient = (() => client) as unknown as NonNullable<
      Parameters<typeof handleRevenueCatWebhook>[1]
    >;
    const request = (
      type: string,
      overrides: Record<string, unknown> = {},
      auth = 'avatar-webhook-fixture-secret',
    ) =>
      new Request('https://fixture.invalid/webhook', {
        method: 'POST',
        headers: { Authorization: auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: {
            id: 'evt-1',
            type,
            app_user_id: 'a8130000-0000-4000-8000-000000000001',
            product_id: 'cc_100',
            store: 'APP_STORE',
            environment: 'PRODUCTION',
            event_timestamp_ms: Date.now(),
            transaction_id: 'txn-123',
            ...overrides,
          },
        }),
      });
    try {
      assert.equal(
        (await handleRevenueCatWebhook(request('NON_RENEWING_PURCHASE', {}, 'wrong'), makeClient))
          .status,
        401,
      );
      assert.equal(calls.length, 0);
      assert.equal(
        (
          await handleRevenueCatWebhook(
            request('NON_RENEWING_PURCHASE', { environment: 'SANDBOX' }),
            makeClient,
          )
        ).status,
        200,
      );
      assert.equal(calls.length, 0);
      assert.equal(
        (await handleRevenueCatWebhook(request('NON_RENEWING_PURCHASE'), makeClient)).status,
        200,
      );
      assert.equal(calls[0].name, 'avatar_apply_store_event');
      assert.equal(calls[0].args.p_transaction_id, 'APP_STORE:txn-123');
      assert.equal(calls[0].args.p_refund, false);
      assert.equal(
        (await handleRevenueCatWebhook(request('CANCELLATION'), makeClient)).status,
        200,
      );
      assert.equal(calls[1].args.p_refund, true);
      assert.equal(
        (
          await handleRevenueCatWebhook(
            request('NON_RENEWING_PURCHASE', { transaction_id: null }),
            makeClient,
          )
        ).status,
        400,
      );
      assert.equal(
        (
          await handleRevenueCatWebhook(
            request('NON_RENEWING_PURCHASE', { store: 'STRIPE' }),
            makeClient,
          )
        ).status,
        400,
      );
      assert.equal(calls.length, 2);
    } finally {
      for (const [i, k] of names.entries()) {
        if (previous[i] === undefined) Deno.env.delete(k);
        else Deno.env.set(k, previous[i]!);
      }
    }
  },
);
