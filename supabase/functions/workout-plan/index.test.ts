import assert from 'node:assert/strict';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.117.3';
import { handleWorkoutPlan, workoutRoutinePrompt } from './index.ts';
const preferences = {
  workout_days: [0, 2, 4],
  location: 'home' as const,
  equipment: ['dumbbell' as const],
  experience: 'beginner' as const,
  session_minutes: 30,
  limitations: '',
  workout_notes: 'Focus more on arms. No legs.',
  country: 'India',
  cuisine: 'Indian',
  diet: 'mixed' as const,
  allergies: [],
  exclusions: [],
  meals_per_day: 4,
  cooking_minutes: 30,
  budget: 'economical' as const,
};
const id = 'fa080000-0000-4000-8000-000000000111';
const content = () => ({
  days: Array.from({ length: 7 }, (_, day) => ({
    day,
    workout: {
      title: 'Training',
      minutes: [0, 2, 4].includes(day) ? 30 : 0,
      exercises: [0, 2, 4].includes(day)
        ? [
            {
              name: 'Seated dumbbell curls',
              equipment: 'dumbbell',
              sets: 3,
              reps: 10,
              rest_seconds: 60,
            },
            {
              name: 'Hammer curls',
              equipment: 'dumbbell',
              sets: 3,
              reps: 10,
              rest_seconds: 60,
            },
            {
              name: 'Dumbbell triceps extension',
              equipment: 'dumbbell',
              sets: 3,
              reps: 10,
              rest_seconds: 60,
            },
          ]
        : [],
    },
  })),
});
function setup(
  options: {
    denied?: string;
    cached?: boolean;
    failure?: boolean;
    unsafe?: boolean;
    saveFailure?: boolean;
    legacy?: boolean;
  } = {},
) {
  const writes: Record<string, unknown>[] = [];
  let calls = 0;
  const admin = {
    auth: { getUser: async () => ({ data: { user: { id: 'owner' } }, error: null }) },
    from: (table: string) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        single: async () => ({
          data:
            table === 'personal_weekly_plans' && options.legacy
              ? { content: content() }
              : { date_of_birth: '1995-01-01' },
          error: null,
        }),
        maybeSingle: async () => ({
          data: {
            pregnant_or_breastfeeding: options.unsafe ?? false,
            has_diabetes_or_medication: false,
            has_eating_disorder_history: false,
          },
          error: null,
        }),
      };
      return table === 'profiles' ? chain : chain;
    },
    rpc: async (name: string, args: Record<string, unknown>) => {
      writes.push({ name, ...args });
      if (name === 'reserve_workout_plan')
        return options.denied
          ? { data: null, error: { message: options.denied } }
          : { data: options.cached ? { cached: true } : { lease: 'lease' }, error: null };
      return {
        data: null,
        error: options.saveFailure && args.p_content ? { message: 'offline' } : null,
      };
    },
  } as unknown as SupabaseClient;
  const generate = async () => {
    calls++;
    if (options.failure) throw new Error('provider unavailable');
    return content();
  };
  const run = (body: unknown = { request_id: id, initial: false, preferences }) =>
    handleWorkoutPlan(
      new Request('https://example.invalid/workout-plan', {
        method: 'POST',
        headers: { Authorization: 'Bearer fixture' },
        body: JSON.stringify(body),
      }),
      { admin, generate },
    );
  return { run, writes, calls: () => calls };
}
Deno.test('Database quotas and purchased-plan decisions run before any provider call', async () => {
  for (const code of [
    'WORKOUT_LIFETIME_LIMIT',
    'WORKOUT_COOLDOWN',
    'PURCHASED_PLUS_REQUIRED',
    'PLAN_BUSY',
  ]) {
    const test = setup({ denied: code });
    const result = await test.run();
    assert.ok(result.status >= 400);
    assert.equal((await result.json()).code, code);
    assert.equal(test.calls(), 0);
  }
});
Deno.test(
  'Successful generation carries notes, saves seven days with per-set targets, and acknowledges only after SQL',
  async () => {
    const test = setup();
    const result = await test.run();
    assert.equal(result.status, 200);
    assert.equal((await result.json()).saved, true);
    const saved = test.writes.find((write) => write.name === 'finish_workout_plan')!
      .p_content as ReturnType<typeof content>;
    assert.equal(saved.days.length, 7);
    assert.match(workoutRoutinePrompt(preferences), /Focus more on arms/);
    assert.match(workoutRoutinePrompt(preferences), /never instructions/);
    assert.equal(test.calls(), 1);
  },
);
Deno.test(
  'Cached retries skip AI; provider/storage failures release the reservation without a successful build',
  async () => {
    const cached = setup({ cached: true });
    assert.equal((await cached.run()).status, 200);
    assert.equal(cached.calls(), 0);
    for (const option of [{ failure: true }, { saveFailure: true }]) {
      const test = setup(option);
      assert.equal((await test.run()).status, 503);
      assert.equal(test.writes.at(-1)!.p_content, null);
    }
  },
);
Deno.test('Unsafe profiles and malformed preferences cannot reserve a build', async () => {
  const unsafe = setup({ unsafe: true });
  assert.equal((await unsafe.run()).status, 403);
  assert.equal(unsafe.writes.length, 0);
  const invalid = setup();
  assert.equal(
    (await invalid.run({ request_id: id, initial: false, preferences: {} })).status,
    400,
  );
  assert.equal(invalid.writes.length, 0);
});

Deno.test('Existing full-week routines are adopted without another AI generation', async () => {
  const test = setup({ legacy: true });
  const result = await test.run({ request_id: id, initial: true, preferences });
  assert.equal(result.status, 200);
  assert.equal(test.calls(), 0);
  assert.equal(test.writes.at(-1)!.name, 'finish_workout_plan');
});
