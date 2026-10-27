import assert from 'node:assert/strict';
import { callVisionModel, handleAiFoodPhoto } from './index.ts';
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

function setup(allowed = true, advanced = false) {
  let usage = 0;
  const admin = {
    auth: { getUser: async () => ({ data: { user: { id: 'caller' } }, error: null }) },
    rpc: async (name: string) => {
      if (name === 'can_view_advanced_nutrition') return { data: advanced, error: null };
      if (name === 'check_ai_food_photo_access')
        return {
          data: { allowed, code: 'CONSENT_REQUIRED', used: 0, cap: 3, user_state: 'free_taste' },
          error: null,
        };
      usage++;
      return { error: null };
    },
    from: () => ({
      select() {
        return this;
      },
      is() {
        return this;
      },
      or() {
        return this;
      },
      ilike() {
        return this;
      },
      limit: async () => ({ data: [] }),
    }),
  } as unknown as SupabaseClient;
  return { admin, usage: () => usage };
}
const request = () =>
  new Request('https://example/ai-food-photo', {
    method: 'POST',
    headers: { Authorization: 'Bearer user' },
    body: JSON.stringify({ image: '/9j/AAAA', mime_type: 'image/jpeg' }),
  });
const model = (value: unknown) => async () => ({
  rawText: JSON.stringify(value),
  tokens: 10,
  cost: 0.001,
});

Deno.test('A non-food image produces an actionable error and never food candidates', async () => {
  const state = setup();
  const response = await handleAiFoodPhoto(request(), {
    admin: state.admin,
    model: model({ is_food: false, items: [] }),
  });
  assert.equal(response.status, 422);
  assert.equal((await response.json()).code, 'NO_FOOD_DETECTED');
  assert.equal(state.usage(), 1);
});
Deno.test(
  'A food image returns its specific estimated macros rather than a generic meal',
  async () => {
    const state = setup();
    const response = await handleAiFoodPhoto(request(), {
      admin: state.admin,
      model: model({
        items: [
          {
            food_name: 'Grilled chicken',
            estimated_grams: 200,
            confidence: 0.9,
            nutrition_per_100g: { calories: 165, protein: 31, carbs: 0, fat: 3.6 },
          },
        ],
      }),
    });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.candidates[0].nutrients.calories, 330);
    assert.equal(result.candidates[0].nutrients.protein, 62);
    assert.match(result.candidates[0].matched_food.id, /^[0-9a-f-]{36}$/);
  },
);
Deno.test('Provider failure cannot fabricate a successful sample result', async () => {
  const state = setup();
  const response = await handleAiFoodPhoto(request(), {
    admin: state.admin,
    model: async () => {
      throw new Error('Unavailable');
    },
  });
  assert.equal(response.status, 502);
  assert.equal((await response.json()).code, 'MODEL_ERROR');
  assert.equal(state.usage(), 0);
});
Deno.test('Missing provider credentials fail instead of substituting sample food', async () => {
  await assert.rejects(
    () => callVisionModel('/9j/AAAA', 'image/jpeg', undefined, undefined, undefined, undefined),
    /VISION_PROVIDER_UNAVAILABLE/,
  );
});
Deno.test('Consent denial prevents the image reaching any provider', async () => {
  const state = setup(false);
  let called = false;
  const response = await handleAiFoodPhoto(request(), {
    admin: state.admin,
    model: async () => {
      called = true;
      return { rawText: '{}', tokens: 0, cost: 0 };
    },
  });
  assert.equal(response.status, 403);
  assert.equal(called, false);
});
Deno.test('Unauthenticated photos cannot reach a model', async () => {
  const response = await handleAiFoodPhoto(
    new Request('https://example/ai-food-photo', { method: 'POST', body: '{}' }),
  );
  assert.equal(response.status, 401);
});

for (const advanced of [false, true])
  Deno.test(
    `AI photo advanced nutrition is ${advanced ? 'included for paid access' : 'redacted for Free'}`,
    async () => {
      const state = setup(true, advanced);
      const response = await handleAiFoodPhoto(request(), {
        admin: state.admin,
        model: model({
          items: [
            {
              food_name: 'Cereal',
              estimated_grams: 50,
              confidence: 0.9,
              nutrition_per_100g: {
                calories: 400,
                protein: 12,
                carbs: 70,
                fat: 7,
                fiber: 9,
                sugar: 11,
                sodium_mg: 350,
                saturated_fat: 2,
                cholesterol_mg: 10,
              },
            },
          ],
        }),
      });
      assert.equal(response.status, 200);
      const item = (await response.json()).candidates[0];
      assert.equal(item.nutrients.calories, 200);
      assert.equal(item.nutrients.fiber, advanced ? 4.5 : 0);
      assert.equal(item.nutrients.sugar, advanced ? 5.5 : 0);
      assert.equal(item.nutrients.sodium_mg, advanced ? 175 : 0);
      assert.equal(item.matched_food.nutrition_details.saturated_fat, advanced ? 2 : undefined);
      assert.equal(item.nutrients.nutrition_details.saturated_fat, advanced ? 1 : undefined);
      assert.equal(item.nutrients.nutrition_details.locked, advanced ? undefined : true);
    },
  );
