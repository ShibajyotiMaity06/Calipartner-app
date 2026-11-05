import assert from 'node:assert/strict';
import { handleWebBilling } from './index.ts';
import { detectBillingCountry } from './country.ts';
Deno.test(
  'The authenticated saved country selects the web provider; client country is ignored',
  async () => {
    for (const country of ['IN', 'US', 'GB']) {
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

Deno.test('Detected country cannot be used until the profile save is acknowledged', async () => {
  const previous = Deno.env.get('DODO_APP_URL');
  Deno.env.set('DODO_APP_URL', 'https://calipartner.app');
  try {
    const admin = {
      auth: { getUser: async () => ({ data: { user: { id: 'owner' } }, error: null }) },
      from: () => ({
        select() {
          return this;
        },
        eq() {
          return this;
        },
        update() {
          return this;
        },
        maybeSingle: async () => ({ data: { country: null }, error: null }),
        single: async () => ({ data: { country: 'US' }, error: null }),
      }),
    };
    let called = false;
    const response = await handleWebBilling(
      new Request('https://example/web-billing', {
        method: 'POST',
        headers: { Authorization: 'Bearer fixture', Origin: 'https://calipartner.app' },
        body: '{"action":"catalog"}',
      }),
      {
        admin: admin as unknown as NonNullable<Parameters<typeof handleWebBilling>[1]>['admin'],
        detectCountry: async () => 'IN',
        razorpay: async () => {
          called = true;
          return Response.json({});
        },
      },
    );
    assert.equal(response.status, 503);
    assert.equal(called, false);
  } finally {
    if (previous === undefined) Deno.env.delete('DODO_APP_URL');
    else Deno.env.set('DODO_APP_URL', previous);
  }
});

Deno.test(
  'IP detection accepts valid countries and fails closed on malformed, failed or missing lookups',
  async () => {
    const request = (ip?: string) =>
      new Request('https://example/web-billing', { headers: ip ? { 'x-forwarded-for': ip } : {} });
    for (const country of ['IN', 'US', 'GB']) {
      const fetcher = (async (url: string | URL | Request) => {
        assert.equal(url, 'https://api.country.is/8.8.8.8');
        return Response.json({ country });
      }) as typeof fetch;
      assert.equal(await detectBillingCountry(request('8.8.8.8, 10.0.0.1'), fetcher), country);
    }
    for (const response of [
      Response.json({ country: 'ZZ' }),
      Response.json({}),
      new Response('', { status: 429 }),
    ])
      await assert.rejects(() =>
        detectBillingCountry(request('8.8.8.8'), (async () => response) as typeof fetch),
      );
    for (const ip of [undefined, 'evil.example/path', 'not-an-ip']) {
      let called = false;
      await assert.rejects(() =>
        detectBillingCountry(request(ip), (async () => {
          called = true;
          return Response.json({ country: 'IN' });
        }) as typeof fetch),
      );
      assert.equal(called, false);
    }
    await assert.rejects(() =>
      detectBillingCountry(request('8.8.8.8'), (async () => {
        throw new Error('offline');
      }) as typeof fetch),
    );
  },
);

Deno.test(
  'Routing persists only the detected country and waits for acknowledgement; failed detection never reaches checkout',
  async () => {
    const previous = Deno.env.get('DODO_APP_URL');
    Deno.env.set('DODO_APP_URL', 'https://calipartner.app');
    try {
      for (const country of ['IN', 'US', null]) {
        let saved: unknown = null;
        let providerCalled = false;
        const admin = {
          auth: { getUser: async () => ({ data: { user: { id: 'owner' } }, error: null }) },
          from: () => ({
            select() {
              return this;
            },
            eq() {
              return this;
            },
            update(value: unknown) {
              saved = value;
              return this;
            },
            maybeSingle: async () => ({ data: { country: null }, error: null }),
            single: async () => ({ data: { country }, error: null }),
          }),
        };
        const response = await handleWebBilling(
          new Request('https://example/web-billing', {
            method: 'POST',
            headers: { Authorization: 'Bearer fixture', Origin: 'https://calipartner.app' },
            body: JSON.stringify({ action: 'routing', country: country === 'IN' ? 'US' : 'IN' }),
          }),
          {
            admin: admin as unknown as NonNullable<Parameters<typeof handleWebBilling>[1]>['admin'],
            detectCountry: async () => {
              if (!country) throw new Error('offline');
              return country;
            },
            dodo: async () => {
              providerCalled = true;
              return Response.json({});
            },
            razorpay: async () => {
              providerCalled = true;
              return Response.json({});
            },
          },
        );
        assert.equal(providerCalled, false);
        if (country) {
          assert.equal(response.status, 200);
          assert.deepEqual(saved, { country });
          assert.equal((await response.json()).provider, country === 'IN' ? 'razorpay' : 'dodo');
        } else {
          assert.equal(response.status, 503);
          assert.equal(saved, null);
        }
      }
    } finally {
      if (previous === undefined) Deno.env.delete('DODO_APP_URL');
      else Deno.env.set('DODO_APP_URL', previous);
    }
  },
);
