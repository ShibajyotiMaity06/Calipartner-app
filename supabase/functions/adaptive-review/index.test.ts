import assert from 'node:assert/strict';
import { handleAdaptiveReview } from './index.ts';
const id = 'ac050000-0000-4000-8000-000000000001';
function setup({ auth = true, gate = false, stale = false, foods = 2, safe = true } = {}) {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const context = {
    age: 31,
    now: '2026-11-05T12:00:00Z',
    sex: 'male',
    safe,
    goal: {
      id: 'goal',
      goal: 'cut',
      current_weight_kg: 80,
      input_height_cm: 180,
      weekly_rate_kg: 0.5,
      tdee: 2500,
      daily_calorie_target: 2000,
      confirmed_at: '2026-10-01T12:00:00Z',
    },
    days: Array.from({ length: 14 }, (_, i) => ({
      date: new Date(Date.UTC(2026, 9, 22 + i)).toISOString().slice(0, 10),
      calories: 2100,
      foods,
      weight: [0, 3, 8, 13].includes(i) ? (i < 7 ? 81 : 80) : null,
    })),
  };
  const admin = {
    auth: {
      getUser: async () => ({
        data: { user: auth ? { id: 'verified-owner' } : null },
        error: null,
      }),
    },
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return name === 'adaptive_review_context'
        ? { data: context, error: gate ? { message: 'PURCHASED_PRO_REQUIRED' } : null }
        : {
            data: { id, args, proposal: args.p_proposal },
            error: stale ? { message: 'REVIEW_STALE' } : null,
          };
    },
  } as unknown as NonNullable<Parameters<typeof handleAdaptiveReview>[1]>['admin'];
  const run = (token = true) =>
    handleAdaptiveReview(
      new Request('https://example.test', {
        method: 'POST',
        headers: token ? { authorization: 'Bearer test' } : {},
        body: JSON.stringify({ request_id: id, user_id: 'attacker-chosen' }),
      }),
      { admin },
    );
  return { run, calls };
}
Deno.test('Authentication and purchased-Pro gate run before storing any proposal', async () => {
  const missing = setup();
  assert.equal((await missing.run(false)).status, 401);
  assert.equal(missing.calls.length, 0);
  const invalid = setup({ auth: false });
  assert.equal((await invalid.run()).status, 401);
  assert.equal(invalid.calls.length, 0);
  const gated = setup({ gate: true });
  assert.equal((await gated.run()).status, 403);
  assert.equal(gated.calls.length, 1);
});
Deno.test(
  'Owner evidence is calculated by core, stored privately, and never automatically accepted',
  async () => {
    const request = setup();
    const response = await request.run();
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.proposal.tdee, 2545);
    assert.ok(request.calls.every((call) => call.args.p_user_id === 'verified-owner'));
    assert.equal(request.calls[1]!.name, 'store_adaptive_review');
    assert.equal(request.calls.length, 2);
  },
);
Deno.test('Incomplete food logs and health screening produce no stored suggestion', async () => {
  const incomplete = setup({ foods: 1 });
  assert.equal((await (await incomplete.run()).json()).reason, 'need_data');
  assert.equal(incomplete.calls.length, 1);
  const safety = setup({ safe: false });
  assert.equal((await (await safety.run()).json()).reason, 'safety');
  assert.equal(safety.calls.length, 1);
});
Deno.test('Evidence changed during calculation fails closed with a refreshable error', async () => {
  const request = setup({ stale: true });
  const response = await request.run();
  assert.equal(response.status, 409);
  assert.equal((await response.json()).code, 'REVIEW_STALE');
});
