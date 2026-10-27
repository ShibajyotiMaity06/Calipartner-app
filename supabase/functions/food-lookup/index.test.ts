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

for (const access of ['free', 'plus', 'pro', 'expired', 'invalid-token', 'spoofed-body'])
  Deno.test(`Barcode nutrition respects verified ${access} access`, async () => {
    const food = {
      id: 'public',
      name: 'Cereal',
      calories_per_100g: 400,
      protein_per_100g: 12,
      carbs_per_100g: 70,
      fat_per_100g: 7,
      fiber_per_100g: 9,
      sugar_per_100g: 11,
      sodium_mg_per_100g: 350,
      nutrition_details: { saturated_fat: 2, cholesterol_mg: 10 },
    };
    const paid = access === 'plus' || access === 'pro';
    const admin = {
      auth: {
        getUser: async () => ({
          data: { user: access === 'invalid-token' ? null : { id: 'verified-caller' } },
          error: null,
        }),
      },
      rpc: async (name: string, args: Record<string, unknown>) => {
        assert.equal(name, 'can_view_advanced_nutrition');
        assert.equal(args.p_user_id, 'verified-caller');
        return { data: paid, error: null };
      },
      from: () => ({
        select() {
          return this;
        },
        eq() {
          return this;
        },
        is() {
          return this;
        },
        limit: async () => ({ data: [food], error: null }),
      }),
    } as unknown as SupabaseClient;
    const response = await handleFoodLookup(
      new Request('https://example/food-lookup', {
        method: 'POST',
        headers: { Authorization: 'Bearer user' },
        body: JSON.stringify({ barcode: '4006381333931', user_id: 'paid-stranger', tier: 'pro' }),
      }),
      { admin },
    );
    assert.equal(response.status, 200);
    const value = (await response.json()).food;
    assert.equal(value.protein_per_100g, 12);
    assert.equal(value.fiber_per_100g, paid ? 9 : 0);
    assert.equal(value.sugar_per_100g, paid ? 11 : 0);
    assert.equal(value.sodium_mg_per_100g, paid ? 350 : 0);
    assert.deepEqual(value.nutrition_details, paid ? food.nutrition_details : { locked: true });
  });
