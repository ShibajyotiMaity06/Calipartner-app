import assert from 'node:assert/strict';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.117.3';
import { handleAiCoach } from './index.ts';
const request = () =>
  new Request('https://example/ai-coach', {
    method: 'POST',
    headers: { Authorization: 'Bearer caller' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'How do I train?' }] }),
  });
Deno.test(
  'Challenge recaps do not load additional private goals or daily health summaries',
  async () => {
    const state = setup();
    const response = await handleAiCoach(
      new Request('https://example/ai-coach', {
        method: 'POST',
        headers: { Authorization: 'Bearer caller' },
        body: JSON.stringify({
          context_mode: 'challenge_summary',
          messages: [{ role: 'user', content: 'My challenge: 5 of 7 habit days.' }],
        }),
      }),
      state,
    );
    assert.equal(response.status, 200);
    assert.deepEqual(state.tables(), ['consent_records']);
    assert.equal(state.calls(), 1);
  },
);
function setup(allowed = true, code: string | null = null, consent = true, usageError = false) {
  let calls = 0;
  const tables: string[] = [];
  const admin = {
    auth: { getUser: async () => ({ data: { user: { id: 'owner' } }, error: null }) },
    rpc: async (name: string) => {
      if (name === 'check_ai_coach_access') return { data: { allowed, code }, error: null };
      return { error: usageError ? new Error('AI_COACH_ACCESS_DENIED') : null };
    },
    from: (table: string) => ({
      select() {
        tables.push(table);
        return this;
      },
      eq() {
        return this;
      },
      gte() {
        return this;
      },
      lte() {
        return this;
      },
      is() {
        return this;
      },
      order() {
        return this;
      },
      limit() {
        return table === 'consent_records'
          ? Promise.resolve({ data: consent ? [{ id: 'consent' }] : [] })
          : ['profiles', 'goal_profiles'].includes(table)
            ? this
            : Promise.resolve({ data: [], error: null });
      },
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
    tables: () => tables,
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

const mealItem = {
  name: 'Boiled eggs',
  quantity: 2,
  unit: 'eggs',
  calories: 156,
  protein: 13,
  carbs: 1,
  fat: 11,
  fiber: 0,
  sugar: 0,
  sodium_mg: 124,
};
const mealRequest = () =>
  new Request('https://example/ai-coach', {
    method: 'POST',
    headers: { Authorization: 'Bearer caller' },
    body: JSON.stringify({
      meal_logging: true,
      messages: [{ role: 'user', content: '2 boiled eggs for lunch' }],
    }),
  });
for (const status of ['needs_details', 'needs_section', 'ready']) {
  Deno.test('Coach meal ' + status + ' returns only a proposal and never logs food', async () => {
    const state = setup();
    const response = await handleAiCoach(mealRequest(), {
      ...state,
      reply: async () => ({
        text: JSON.stringify({
          content:
            status === 'ready'
              ? 'Estimated meal. Review before logging.'
              : 'Which portion or meal section?',
          meal: {
            status,
            description: '2 boiled eggs',
            detailsConfirmed: true,
            sectionConfirmed: true,
            mealSection: 'lunch',
            items: [mealItem],
          },
        }),
        tokens: 120,
      }),
    });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(Boolean(result.meal_draft), status === 'ready');
    assert.equal(state.tables().includes('food_entries'), true);
    assert.equal(state.tables().includes('profiles'), true);
  });
}
Deno.test('Malformed model nutrition never enables a meal action', async () => {
  const response = await handleAiCoach(mealRequest(), {
    ...setup(),
    reply: async () => ({
      text: JSON.stringify({
        content: 'Estimate',
        meal: {
          status: 'ready',
          description: 'Food',
          detailsConfirmed: true,
          sectionConfirmed: true,
          mealSection: 'lunch',
          items: [{ ...mealItem, calories: -5 }],
        },
      }),
      tokens: 120,
    }),
  });
  assert.equal(response.status, 422);
  assert.equal((await response.json()).code, 'INVALID_COACH_MEAL');
});

Deno.test(
  'Coach supplies owner-scoped dated foods, steps, all macros and workout sets to the provider',
  async () => {
    const calls: Array<{ table: string; filters: Array<[string, unknown]> }> = [];
    const rows: Record<string, unknown[]> = {
      profiles: [{ timezone: 'America/New_York', nickname: 'Owner' }],
      goal_profiles: [{ goal: 'maintain', daily_calorie_target: 2200, protein_grams: 140 }],
      daily_summaries: [
        {
          local_date: '2026-10-15',
          calories: 1900,
          protein: 125,
          carbs: 210,
          fat: 65,
          steps: 8000,
          water_ml: 1800,
        },
      ],
      food_entries: [
        {
          local_date: '2026-10-15',
          meal_section: 'breakfast',
          food_name: 'Oats',
          quantity: 60,
          unit: 'g',
        },
      ],
      workouts: [
        { id: 'workout', local_date: '2026-10-15', name: 'Strength', duration_minutes: 45 },
      ],
      workout_exercises: [{ id: 'exercise', workout_id: 'workout', exercise_name: 'Squat' }],
      workout_sets: [
        { workout_id: 'workout', workout_exercise_id: 'exercise', reps: 8, weight_kg: 60 },
      ],
    };
    const base = setup();
    const admin = {
      auth: base.admin.auth,
      rpc: base.admin.rpc,
      from(table: string) {
        const call = { table, filters: [] as Array<[string, unknown]> };
        calls.push(call);
        return {
          select() {
            return this;
          },
          eq(key: string, value: unknown) {
            call.filters.push([key, value]);
            return this;
          },
          gte(key: string, value: unknown) {
            call.filters.push(['gte:' + key, value]);
            return this;
          },
          lte(key: string, value: unknown) {
            call.filters.push(['lte:' + key, value]);
            return this;
          },
          is(key: string, value: unknown) {
            call.filters.push(['is:' + key, value]);
            return this;
          },
          in(key: string, value: unknown) {
            call.filters.push(['in:' + key, value]);
            return this;
          },
          order() {
            return this;
          },
          limit() {
            return ['profiles', 'goal_profiles'].includes(table)
              ? this
              : Promise.resolve({
                  data: table === 'consent_records' ? [{ id: 'yes' }] : (rows[table] ?? []),
                  error: null,
                });
          },
          maybeSingle: async () => ({ data: rows[table]?.[0] ?? null, error: null }),
        };
      },
    } as unknown as SupabaseClient;
    let prompt = '';
    const result = await handleAiCoach(
      new Request('https://example/ai-coach', {
        method: 'POST',
        headers: { Authorization: 'Bearer owner' },
        body: JSON.stringify({
          user_id: 'victim',
          messages: [{ role: 'user', content: 'What did I eat and train on 2026-10-15?' }],
        }),
      }),
      {
        admin,
        reply: async (text) => {
          prompt = text;
          return { text: 'Your logged breakfast was oats.', tokens: 80 };
        },
      },
    );
    assert.equal(result.status, 200);
    for (const table of [
      'daily_summaries',
      'food_entries',
      'workouts',
      'workout_exercises',
      'workout_sets',
    ]) {
      const call = calls.find((entry) => entry.table === table)!;
      assert.ok(call.filters.some(([key, value]) => key === 'user_id' && value === 'owner'));
      assert.ok(!call.filters.some(([, value]) => value === 'victim'));
    }
    assert.ok(
      prompt.includes('Oats') &&
        prompt.includes('8000') &&
        prompt.includes('210') &&
        prompt.includes('Squat') &&
        prompt.includes('60'),
    );
    const foods = calls.find((call) => call.table === 'food_entries')!;
    assert.ok(
      foods.filters.some(([key, value]) => key === 'gte:local_date' && value === '2026-10-15'),
    );
    assert.ok(foods.filters.some(([key, value]) => key === 'is:deleted_at' && value === null));
  },
);
