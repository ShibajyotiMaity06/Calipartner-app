import assert from 'node:assert/strict';
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { handleAiCoach } from './index.ts';
const request = () =>
  new Request('https://example/ai-coach', {
    method: 'POST',
    headers: { Authorization: 'Bearer caller' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'How do I train?' }] }),
  });
function setup(allowed = true, code: string | null = null, consent = true, usageError = false) {
  let calls = 0;
  const admin = {
    auth: { getUser: async () => ({ data: { user: { id: 'owner' } }, error: null }) },
    rpc: async (name: string) => {
      if (name === 'check_ai_coach_access') return { data: { allowed, code }, error: null };
      return { error: usageError ? new Error('AI_COACH_ACCESS_DENIED') : null };
    },
    from: (table: string) => ({
      select() {
        return this;
      },
      eq() {
        return this;
      },
      limit: async () => ({ data: consent ? [{ id: 'consent' }] : [] }),
      maybeSingle: async () => ({
        data:
          table === 'goal_profiles'
            ? { goal: 'maintain', daily_calorie_target: 2200, protein_grams: 140 }
            : null,
      }),
    }),
  } as unknown as SupabaseClient;
  return {
    admin,
    reply: async () => {
      calls++;
      return { text: 'Train consistently.', tokens: 30 };
    },
    calls: () => calls,
  };
}
for (const code of [
  'UPGRADE_REQUIRED',
  'DAILY_LIMIT_REACHED',
  'FEATURE_DISABLED',
  'BUDGET_EXCEEDED',
])
  Deno.test(`Coach ${code} never reaches a model`, async () => {
    const state = setup(false, code);
    const result = await handleAiCoach(request(), state);
    assert.equal(
      result.status,
      code === 'DAILY_LIMIT_REACHED' ? 429 : code === 'UPGRADE_REQUIRED' ? 403 : 503,
    );
    assert.equal(state.calls(), 0);
    assert.equal((await result.json()).code, code);
  });
Deno.test('Coach requires explicit processing consent even with Pro', async () => {
  const state = setup(true, null, false);
  const result = await handleAiCoach(request(), state);
  assert.equal(result.status, 403);
  assert.equal(state.calls(), 0);
});
Deno.test('Verified Pro receives a real provider reply after usage is recorded', async () => {
  const state = setup();
  const result = await handleAiCoach(request(), state);
  assert.equal(result.status, 200);
  assert.equal((await result.json()).message.content, 'Train consistently.');
  assert.equal(state.calls(), 1);
});
Deno.test(
  'A racing request cannot return a paid reply when the atomic quota check refuses it',
  async () => {
    const state = setup(true, null, true, true);
    const result = await handleAiCoach(request(), state);
    assert.equal(result.status, 429);
  },
);
Deno.test('Unauthenticated coach calls never reach a provider', async () => {
  const state = setup();
  const result = await handleAiCoach(
    new Request('https://example/ai-coach', { method: 'POST', body: '{}' }),
    state,
  );
  assert.equal(result.status, 401);
  assert.equal(state.calls(), 0);
});
