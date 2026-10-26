import assert from 'node:assert/strict';
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { handleFoodLookup } from './index.ts';
function request() {
  return new Request('https://example/food-lookup', {
    method: 'POST',
    body: JSON.stringify({ barcode: '4006381333931' }),
  });
}
Deno.test('Public barcode cache cannot disclose another account’s custom food', async () => {
  let publicOnly = false;
  const privateFood = { id: 'private-food', name: 'Secret custom product', owner_id: 'stranger' };
  const admin = {
    from: () => ({
      select() {
        return this;
      },
      eq() {
        return this;
      },
      is(key: string, value: unknown) {
        if (key === 'owner_id' && value === null) publicOnly = true;
        return this;
      },
      limit: async () => ({ data: publicOnly ? [] : [privateFood] }),
      insert() {
        return this;
      },
      single: async () => ({
        data: { id: 'public-food', name: 'Public packaged food' },
        error: null,
      }),
    }),
  } as unknown as SupabaseClient;
  const response = await handleFoodLookup(request(), {
    admin,
    fetch: async () =>
      Response.json({
        status: 1,
        product: {
          product_name: 'Public packaged food',
          nutriments: { 'energy-kcal_100g': 123, proteins_100g: 4 },
        },
      }),
  });
  assert.equal(response.status, 200);
  const json = await response.json();
  assert.equal(json.food.name, 'Public packaged food');
  assert.equal(publicOnly, true);
  assert.ok(!JSON.stringify(json).includes('Secret custom product'));
});
Deno.test(
  'An upstream outage remains a lookup error rather than a false product-not-found',
  async () => {
    const response = await handleFoodLookup(request(), {
      fetch: async () => new Response('Unavailable', { status: 503 }),
    });
    assert.equal(response.status, 502);
  },
);
