import assert from 'node:assert/strict';
import { handleWebBilling } from './index.ts';
Deno.test(
  'The authenticated saved country selects the web provider; client country is ignored',
  async () => {
    for (const country of ['IN', 'US', 'GB', null]) {
      const calls: string[] = [];
      const admin = {
        auth: { getUser: async () => ({ data: { user: { id: 'owner' } }, error: null }) },
        from: (table: string) => ({
          select() {
            return this;
          },
          eq(key: string, value: string) {
            if (table === 'profiles') {
              assert.equal(key, 'id');
              assert.equal(value, 'owner');
            }
            if (key === 'user_id') assert.equal(value, 'owner');
            return this;
          },
          maybeSingle: async () => ({
            data: table === 'profiles' ? { country } : null,
            error: null,
          }),
        }),
      };
      const response = await handleWebBilling(
        new Request('https://example/web-billing', {
          method: 'POST',
          headers: { Authorization: 'Bearer fixture' },
          body: '{"country":"IN","action":"catalog"}',
        }),
        {
          admin: admin as unknown as NonNullable<Parameters<typeof handleWebBilling>[1]>['admin'],
          razorpay: async () => {
            calls.push('razorpay');
            return Response.json({ products: [] });
          },
          dodo: async () => {
            calls.push('dodo');
            return Response.json({ products: [] });
          },
        },
      );
      if (country) {
        assert.equal(response.status, 200);
        assert.deepEqual(calls, [country === 'IN' ? 'razorpay' : 'dodo']);
      } else {
        assert.equal(response.status, 503);
        assert.equal((await response.json()).error, 'BILLING_COUNTRY_REQUIRED');
        assert.deepEqual(calls, []);
      }
    }
  },
);
Deno.test('Unauthenticated web requests never reach a provider', async () => {
  assert.equal(
    (await handleWebBilling(new Request('https://example/web-billing', { method: 'POST' }))).status,
    401,
  );
});
