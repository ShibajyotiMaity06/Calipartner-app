import assert from 'node:assert/strict';
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { recoverFoodEnergy } from './recoverEnergy.ts';
const foodId = 'fa040000-0000-4000-8000-000000000010';
function fixture(owned = true, matching = true) {
  const filters: unknown[][] = [],
    writes: unknown[][] = [];
  const admin = {
    auth: { getUser: async () => ({ data: { user: { id: 'owner' } }, error: null }) },
    from: (table: string) => ({
      select() {
        return this;
      },
      eq(key: string, value: unknown) {
        filters.push([table, key, value]);
        return this;
      },
      is() {
        return this;
      },
      limit: async () => ({ data: owned ? [{ id: 'entry' }] : [], error: null }),
      maybeSingle: async () => ({
        data: {
          id: foodId,
          source: 'usda',
          name: 'Chicken breast',
          brand: null,
          calories_per_100g: 0,
          protein_per_100g: 31,
          carbs_per_100g: 0,
          fat_per_100g: 3.6,
        },
        error: null,
      }),
    }),
    rpc: async (name: string, args: unknown) => {
      writes.push([name, args]);
      return { data: null, error: null };
    },
  };
  const remote = (async () =>
    new Response(
      JSON.stringify({
        foods: [
          {
            description: matching ? 'Chicken breast' : 'Other chicken',
            foodNutrients: [
              { nutrientId: 2048, value: 165 },
              { nutrientId: 1003, value: 31 },
              { nutrientId: 1004, value: 3.6 },
              { nutrientId: 1005, value: 0 },
            ],
          },
        ],
      }),
    )) as typeof fetch;
  return { admin: admin as unknown as SupabaseClient, remote, filters, writes };
}
const req = () =>
  new Request('https://example/repair', { headers: { Authorization: 'Bearer owner' } });
Deno.test(
  'Energy repair uses exact upstream nutrition and the caller-owned zero-energy logs only',
  async () => {
    const state = fixture();
    assert.equal(await recoverFoodEnergy(req(), state.admin, foodId, state.remote), true);
    assert.ok(
      state.filters.some(
        (filter) => JSON.stringify(filter) === JSON.stringify(['food_entries', 'user_id', 'owner']),
      ),
    );
    assert.deepEqual(state.writes, [
      ['recover_food_energy', { p_food_id: foodId, p_calories: 165 }],
    ]);
  },
);
Deno.test(
  'Energy repair rejects another user’s entry or a different upstream food without guessing',
  async () => {
    for (const state of [fixture(false), fixture(true, false)]) {
      await assert.rejects(() => recoverFoodEnergy(req(), state.admin, foodId, state.remote));
      assert.equal(state.writes.length, 0);
    }
  },
);
Deno.test('Energy repair cannot run without authentication', async () => {
  const state = fixture();
  await assert.rejects(
    () => recoverFoodEnergy(new Request('https://example'), state.admin, foodId, state.remote),
    /UNAUTHENTICATED/,
  );
  assert.equal(state.filters.length, 0);
});
