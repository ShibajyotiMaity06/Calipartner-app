import assert from 'node:assert/strict';
import { validatePlanPreferences, validateWeeklyPlan } from '@calipartner/core';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.117.3';
import { generateWeeklyPlan, handleWeeklyPlan, weeklyPlanPrompt } from './index.ts';
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
Deno.test(
  'The prompt has no fixed meal nutrition example and requires ingredient-based estimates',
  () => {
    const prompt = weeklyPlanPrompt(validatePlanPreferences(preferences), {
      calories: 2100,
      protein: 120,
      carbs: 270,
      fat: 60,
      calorie_floor: 1500,
    });
    assert.ok(!prompt.includes('"calories":600'));
    assert.match(prompt, /actual measured ingredients in EACH meal/);
    assert.match(prompt, /never divide those goals equally/);
    assert.match(prompt, /Do not invent tiny numeric differences/);
  },
);
Deno.test(
  'Copied meal nutrition is rejected before storage even when all daily goals match',
  async () => {
    const state = setup();
    state.generate = async () => {
      const draft = content();
      draft.days[0].meals[1].ingredients = ['eggs 150g', 'toast 80g'];
      return draft;
    };
    const result = await handleWeeklyPlan(req(), state);
    assert.equal(result.status, 503);
    assert.equal((await result.json()).saved, false);
    assert.equal(state.writes.at(-1)?.p_content, null);
  },
);
Deno.test(
  'Copied nutrition gets an ingredient-specific repair; repeated invalid output fails closed',
  async () => {
    for (const repaired of [true, false]) {
      let calls = 0;
      const run = () =>
        generateWeeklyPlan(
          'synthetic preferences',
          async (_url, init) => {
            calls++;
            const draft = content();
            if (calls === 1 || !repaired)
              draft.days[0].meals[1].ingredients = ['eggs 150g', 'toast 80g'];
            if (calls === 2) {
              assert.match(String(init?.body), /repeated_meal_nutrition/);
              assert.match(
                String(init?.body),
                /Recalculate each meal from its measured ingredients/,
              );
            }
            return Response.json({ choices: [{ message: { content: JSON.stringify(draft) } }] });
          },
          (key) => ({ GROQ_API_KEY: 'fixture' })[key],
          (draft) =>
            validateWeeklyPlan(draft, validatePlanPreferences(preferences), {
              calories: 2100,
              protein: 120,
              carbs: 270,
              fat: 60,
              calorie_floor: 1500,
            }),
        );
      if (repaired) assert.deepEqual(await run(), content());
      else await assert.rejects(run, /PLAN_UNAVAILABLE/);
      assert.equal(calls, 2);
    }
  },
);
Deno.test('Arithmetic repair receives the rejected draft and exact meal discrepancy', async () => {
  let calls = 0;
  const result = await generateWeeklyPlan(
    'synthetic preferences',
    async (_url, init) => {
      calls++;
      const request = JSON.parse(String(init?.body));
      const draft = content();
      if (calls === 1) draft.days[2].meals[1].calories = 1900;
      else {
        assert.equal(request.messages.length, 3);
        assert.equal(request.messages[1].role, 'assistant');
        assert.equal(JSON.parse(request.messages[1].content).days[2].meals[1].calories, 1900);
        assert.match(request.messages[2].content, /Day 2, meal 1: reported 1900 kcal/);
        assert.match(request.messages[2].content, /is 700 kcal/);
      }
      return Response.json({ choices: [{ message: { content: JSON.stringify(draft) } }] });
    },
    (key) => ({ GROQ_API_KEY: 'fixture' })[key],
    (draft) =>
      validateWeeklyPlan(draft, validatePlanPreferences(preferences), {
        calories: 2100,
        protein: 120,
        carbs: 270,
        fat: 60,
        calorie_floor: 1500,
      }),
  );
  assert.equal(calls, 2);
  assert.deepEqual(result, content());
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

Deno.test('A retired configured Groq model falls back to the supported model', async () => {
  const models: string[] = [];
  const fetcher: typeof fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    models.push(body.model);
    assert.equal(body.response_format.type, models.length === 1 ? 'json_object' : 'json_schema');
    if (models.length === 2) {
      assert.equal(body.response_format.json_schema.strict, true);
      assert.equal(body.response_format.json_schema.schema.additionalProperties, false);
    }
    assert.equal(body.messages[0].content, 'synthetic preferences');
    return models.length === 1
      ? new Response('{}', { status: 400 })
      : Response.json({ choices: [{ message: { content: JSON.stringify(content()) } }] });
  };
  const result = await generateWeeklyPlan(
    'synthetic preferences',
    fetcher,
    (key) => ({ GROQ_API_KEY: 'fixture', WEEKLY_PLAN_MODEL: 'retired-model' })[key],
  );
  assert.deepEqual(models, ['retired-model', 'openai/gpt-oss-120b']);
  assert.deepEqual(result, content());
});
Deno.test(
  'Weekly planning does not inherit the general chat model ahead of its reasoning default',
  async () => {
    let model = '';
    await generateWeeklyPlan(
      'synthetic preferences',
      async (_url, init) => {
        model = JSON.parse(String(init?.body)).model;
        return Response.json({ choices: [{ message: { content: JSON.stringify(content()) } }] });
      },
      (key) => ({ GROQ_API_KEY: 'fixture', GROQ_MODEL: 'general-chat-model' })[key],
    );
    assert.equal(model, 'openai/gpt-oss-120b');
  },
);

Deno.test(
  'Unavailable OpenRouter models and malformed responses use the free router fallback',
  async () => {
    for (const status of [200, 404]) {
      const models: string[] = [];
      const fetcher: typeof fetch = async (_url, init) => {
        models.push(JSON.parse(String(init?.body)).model);
        return models.length === 1
          ? new Response('malformed provider output', { status })
          : Response.json({ choices: [{ message: { content: JSON.stringify(content()) } }] });
      };
      assert.deepEqual(
        await generateWeeklyPlan(
          'synthetic preferences',
          fetcher,
          (key) => ({ OPENROUTER_API_KEY: 'fixture', OPENROUTER_MODEL: 'retired-model' })[key],
        ),
        content(),
      );
      assert.deepEqual(models, ['retired-model', 'openrouter/free']);
    }
  },
);

Deno.test('Provider failures never fabricate a plan or retry duplicate defaults', async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      generateWeeklyPlan(
        'synthetic preferences',
        async () => {
          calls++;
          return new Response('{}', { status: 503 });
        },
        (key) => ({ GROQ_API_KEY: 'fixture', OPENROUTER_API_KEY: 'fixture' })[key],
      ),
    /PLAN_UNAVAILABLE/,
  );
  assert.equal(calls, 2);
});

Deno.test(
  'The existing configured backup Groq credential handles primary rate limits',
  async () => {
    let calls = 0;
    assert.deepEqual(
      await generateWeeklyPlan(
        'synthetic preferences',
        async (_url, init) => {
          calls++;
          assert.equal(
            new Headers(init?.headers).get('Authorization'),
            calls === 1 ? 'Bearer primary-fixture' : 'Bearer backup-fixture',
          );
          return calls === 1
            ? Response.json({ error: { code: 'rate_limit_exceeded' } }, { status: 429 })
            : Response.json({ choices: [{ message: { content: JSON.stringify(content()) } }] });
        },
        (key) =>
          ({ GROQ_API_KEY: 'primary-fixture', GROQ_API_KEY_FALLBACK: 'backup-fixture' })[key],
      ),
      content(),
    );
    assert.equal(calls, 2);
  },
);

Deno.test(
  'Invalid numeric exercise prescriptions get one validated repair or fail closed',
  async () => {
    for (const repaired of [true, false]) {
      let calls = 0;
      const run = () =>
        generateWeeklyPlan(
          'synthetic preferences',
          async (_url, init) => {
            calls++;
            const draft = content();
            if (calls === 1 || !repaired) draft.days[0].workout.exercises[0].reps = 90;
            if (calls === 2) assert.match(String(init?.body), /exercise_reps/);
            return Response.json({ choices: [{ message: { content: JSON.stringify(draft) } }] });
          },
          (key) => ({ GROQ_API_KEY: 'fixture' })[key],
          (draft) =>
            validateWeeklyPlan(draft, validatePlanPreferences(preferences), {
              calories: 2100,
              protein: 120,
              carbs: 270,
              fat: 60,
              calorie_floor: 1500,
            }),
        );
      if (repaired) assert.deepEqual(await run(), content());
      else await assert.rejects(run, /PLAN_UNAVAILABLE/);
      assert.equal(calls, 2);
    }
  },
);

Deno.test(
  'A provider JSON-mode error gets one parseable text retry without using failed output',
  async () => {
    const requests: Array<Record<string, unknown>> = [];
    const result = await generateWeeklyPlan(
      'synthetic preferences',
      async (_url, init) => {
        requests.push(JSON.parse(String(init?.body)));
        return requests.length === 1
          ? Response.json(
              { error: { code: 'json_validate_failed', failed_generation: 'untrusted partial' } },
              { status: 400 },
            )
          : Response.json({
              choices: [
                { message: { content: '```json\n' + JSON.stringify(content()) + '\n```' } },
              ],
            });
      },
      (key) => ({ GROQ_API_KEY: 'fixture' })[key],
    );
    assert.deepEqual(result, content());
    assert.equal(requests.length, 2);
    assert.equal(requests[0].model, requests[1].model);
    assert.ok(requests[0].response_format);
    assert.equal(requests[1].response_format, undefined);
  },
);
