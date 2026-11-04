import assert from 'node:assert/strict';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.117.3';
import { handleWeeklyPlan } from './index.ts';
const preferences = {
  workout_days: [0],
  location: 'home',
  equipment: ['bodyweight'],
  experience: 'beginner',
  session_minutes: 30,
  limitations: '',
  country: 'India',
  cuisine: 'Indian',
  diet: 'mixed',
  allergies: [],
  exclusions: [],
  meals_per_day: 3,
  cooking_minutes: 30,
  budget: 'economical',
};
const id = 'fa040000-0000-4000-8000-000000000001';
const content = () => ({
  days: Array.from({ length: 7 }, (_, day) => ({
    day,
    workout: {
      title: 'Move',
      minutes: day === 0 ? 30 : 0,
      exercises:
        day === 0
          ? [{ name: 'Squat', equipment: 'bodyweight', sets: 3, reps: 10, rest_seconds: 60 }]
          : [],
    },
    meals: Array.from({ length: 3 }, () => ({
      name: 'Rice and dal',
      ingredients: ['rice 150g', 'lentils 200g'],
      portion: '1 bowl',
      calories: 700,
      protein: 40,
      carbs: 90,
      fat: 20,
    })),
  })),
  workout_tips: ['Use a comfortable load'],
  diet_tips: ['Prepare lentils ahead'],
});
function setup(
  options: {
    auth?: boolean;
    consent?: boolean;
    cached?: boolean;
    safety?: boolean;
    saveFailure?: boolean;
    providerFailure?: boolean;
  } = {},
) {
  let calls = 0;
  const writes: Array<Record<string, unknown>> = [];
  const filters: string[] = [];
  const admin = {
    auth: {
      getUser: async () => ({
        data: { user: options.auth === false ? null : { id: 'owner' } },
        error: null,
      }),
    },
    rpc: async (name: string, args: Record<string, unknown>) => {
      writes.push({ name, ...args });
      if (name === 'reserve_weekly_plan')
        return options.consent === false
          ? { data: null, error: { message: 'CONSENT_REQUIRED' } }
          : { data: { cached: options.cached ?? false, lease: id }, error: null };
      return {
        data: null,
        error: options.saveFailure && args.p_content ? { message: 'write failed' } : null,
      };
    },
    from: (table: string) => {
      const data =
        table === 'profiles'
          ? { date_of_birth: '1995-01-01', sex: 'male' }
          : table === 'health_screening'
            ? {
                pregnant_or_breastfeeding: false,
                has_diabetes_or_medication: options.safety ?? false,
                has_eating_disorder_history: false,
              }
            : { daily_calorie_target: 2100, protein_grams: 120, carb_grams: 270, fat_grams: 60 };
      const query = {
        select() {
          return this;
        },
        eq(_key: string, value: string) {
          filters.push(value);
          return this;
        },
        lte() {
          return this;
        },
        order() {
          return this;
        },
        limit() {
          return this;
        },
        single: async () => ({ data, error: null }),
        maybeSingle: async () => ({ data, error: null }),
      };
      return query;
    },
  };
  return {
    admin: admin as unknown as SupabaseClient,
    generate: async (prompt: string) => {
      calls++;
      assert.ok(prompt.includes('Verified saved daily goals'));
      assert.ok(!prompt.includes('stranger'));
      if (options.providerFailure) throw new Error('network');
      return content();
    },
    calls: () => calls,
    writes,
    filters,
  };
}
function req(auth = true) {
  return new Request('https://example/weekly-plan', {
    method: 'POST',
    headers: auth ? { Authorization: 'Bearer owner' } : {},
    body: JSON.stringify({ request_id: id, user_id: 'stranger', preferences }),
  });
}
Deno.test('Weekly planning authenticates before reading or generating', async () => {
  const state = setup();
  assert.equal((await handleWeeklyPlan(req(false), state)).status, 401);
  assert.equal(state.calls(), 0);
  assert.equal(state.filters.length, 0);
  const denied = setup({ auth: false });
  assert.equal((await handleWeeklyPlan(req(), denied)).status, 401);
  assert.equal(denied.calls(), 0);
});
Deno.test(
  'Monday preview generation requires consent and keeps caller context owner-scoped',
  async () => {
    const denied = setup({ consent: false });
    assert.equal((await handleWeeklyPlan(req(), denied)).status, 403);
    assert.equal(denied.calls(), 0);
    const state = setup();
    const result = await handleWeeklyPlan(req(), state);
    assert.equal(result.status, 200);
    assert.deepEqual(await result.json(), { code: 'PLAN_SAVED', saved: true });
    assert.ok(state.filters.every((id) => id === 'owner'));
    assert.equal(state.calls(), 1);
    assert.ok(state.writes.some((write) => write.name === 'finish_weekly_plan' && write.p_content));
  },
);
Deno.test('Health screening prevents provider calls', async () => {
  const state = setup({ safety: true });
  assert.equal((await handleWeeklyPlan(req(), state)).status, 403);
  assert.equal(state.calls(), 0);
});
Deno.test('Acknowledged retry does not generate again or expose full content', async () => {
  const state = setup({ cached: true });
  const result = await handleWeeklyPlan(req(), state);
  assert.equal(result.status, 200);
  assert.equal(state.calls(), 0);
  assert.ok(!(await result.text()).includes('days'));
});
Deno.test('Provider or database failures cannot confirm a saved plan', async () => {
  for (const options of [{ saveFailure: true }, { providerFailure: true }]) {
    const state = setup(options);
    const result = await handleWeeklyPlan(req(), state);
    assert.equal(result.status, 503);
    assert.equal((await result.json()).saved, false);
    assert.equal(state.writes.at(-1)?.p_content, null);
  }
});
