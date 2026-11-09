// Only disposable private accounts are changed. No real-user messages or purchases.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
const ref = fs.readFileSync('supabase/.temp/project-ref', 'utf8').trim();
const token = process.env.CALI_WORKOUT_MANAGEMENT_TOKEN;
delete process.env.CALI_WORKOUT_MANAGEMENT_TOKEN;
if (!token) throw new Error('OS credential wrapper required');
const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys`, {
  headers: { Authorization: `Bearer ${token}` },
});
assert.ok(response.ok, 'Management key lookup');
const keys = await response.json(),
  anon = keys.find((key) => key.name === 'anon').api_key;
const url = `https://${ref}.supabase.co`,
  options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, keys.find((key) => key.name === 'service_role').api_key, options);
const directory = '.artifacts/workout-routine-live';
fs.mkdirSync(directory, { recursive: true });
const journalPath = directory + '/fixture-ids.json';
let journal = fs.existsSync(journalPath)
  ? JSON.parse(fs.readFileSync(journalPath, 'utf8'))
  : { users: [], rooms: [] };
const persist = () => fs.writeFileSync(journalPath, JSON.stringify(journal));
const query = async (promise) => {
  const { data, error } = await promise;
  if (error) throw new Error(error.message);
  return data;
};
const rpc = (client, name, args = {}) => query(client.rpc(name, args));
async function cleanup() {
  for (const id of journal.rooms) await query(admin.from('rooms').delete().eq('id', id));
  for (const id of journal.users) {
    await query(admin.auth.admin.deleteUser(id));
    const check = await admin.auth.admin.getUserById(id);
    assert.equal(check.data.user, null);
  }
  journal = { users: [], rooms: [] };
  persist();
  console.log('PASS Hosted fixture cleanup: private test accounts, room and records removed');
}
if (journal.users.length || journal.rooms.length) await cleanup();
if (process.argv.includes('--cleanup')) process.exit(0);
const preferences = {
  workout_days: [0, 2, 4],
  location: 'home',
  equipment: ['dumbbell'],
  experience: 'beginner',
  session_minutes: 30,
  limitations: '',
  workout_notes: 'Focus more on arms. No legs.',
  country: 'India',
  cuisine: 'Indian',
  diet: 'mixed',
  allergies: [],
  exclusions: [],
  meals_per_day: 4,
  cooking_minutes: 30,
  budget: 'economical',
};
async function fixture() {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12),
    email = `workout_${suffix}@example.invalid`,
    password = randomUUID() + 'aA8!';
  const account = await query(
    admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { fixture: 'workout-routine-verification' },
    }),
  );
  const id = account.user.id;
  journal.users.push(id);
  persist();
  await query(
    admin.from('profiles').upsert({
      id,
      username: 'workout_' + suffix,
      nickname: 'Private workout fixture',
      date_of_birth: '1995-01-01',
      sex: 'male',
      height_cm: 175,
      timezone: 'America/New_York',
      discoverable: false,
    }),
  );
  await query(
    admin.from('health_screening').upsert({
      user_id: id,
      pregnant_or_breastfeeding: false,
      has_diabetes_or_medication: false,
      has_eating_disorder_history: false,
    }),
  );
  const client = createClient(url, anon, options);
  await query(client.auth.signInWithPassword({ email, password }));
  await rpc(client, 'accept_ai_processing_consent', { p_version: '1.1-weekly-plan' });
  const entry = { id, client };
  return entry;
}
async function endpoint(client, name, body) {
  const auth = await client.auth.getSession();
  const result = await fetch(`${url}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      apikey: anon,
      Authorization: `Bearer ${auth.data.session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(180000),
  });
  const value = await result.json().catch(() => ({ code: 'INVALID_RESPONSE' }));
  return { status: result.status, ...value };
}
async function build(client, initial, id = randomUUID()) {
  const result = await endpoint(client, 'workout-plan', { request_id: id, preferences, initial });
  assert.equal(result.status, 200, 'Workout build: ' + result.code);
  assert.equal(result.saved, true);
  return id;
}
if (process.argv.includes('--entry-only')) {
  try {
    const first = await fixture();
    await query(
      admin.from('entitlements').upsert({
        user_id: first.id,
        tier: 'pro',
        status: 'paid',
        period_end: new Date(Date.now() + 365 * 86400000).toISOString(),
      }),
    );
    let plan = await rpc(first.client, 'get_workout_plan');
    assert.equal(plan.id, null);
    assert.equal(plan.preferences, null);
    assert.equal(plan.can_rebuild, true);
    const training = Object.fromEntries(Object.entries(preferences).slice(0, 7));
    const result = await endpoint(first.client, 'workout-plan', {
      request_id: randomUUID(),
      preferences: training,
      initial: true,
    });
    assert.equal(result.status, 200, 'Initial paid workout: ' + result.code);
    assert.equal(result.saved, true);
    plan = await rpc(first.client, 'get_workout_plan');
    assert.equal(plan.days.length, 7);
    assert.equal(plan.rebuilds_used, 0);
    assert.equal(plan.can_rebuild, true);
    const duplicate = await endpoint(first.client, 'workout-plan', {
      request_id: randomUUID(),
      preferences: training,
      initial: true,
    });
    assert.equal(duplicate.code, 'INITIAL_PLAN_EXISTS');
    console.log(
      'PASS Hosted Pro account without onboarding: initial training-only plan saved; first rebuild remains available; duplicate initial denied',
    );
    const greeting = await endpoint(first.client, 'ai-coach', { message: 'Hello coach' });
    assert.equal(greeting.status, 200);
    assert.equal(greeting.model, 'coach-greeting');
    assert.equal(
      greeting.message.content,
      'I am your health coach on behalf of CaliPartner. Ask me about your nutrition, workouts or health.',
    );
    await query(
      admin
        .from('consent_records')
        .delete()
        .eq('user_id', first.id)
        .eq('consent_type', 'ai_processing'),
    );
    const refused = await endpoint(first.client, 'ai-coach', { message: 'Hello coach' });
    assert.equal(refused.status, 403);
    assert.equal(refused.code, 'CONSENT_REQUIRED');
    console.log('PASS Hosted coach greeting: branded introduction and revoked-consent denial');
  } finally {
    await cleanup();
  }
  process.exit(0);
}
if (process.argv.includes('--counts-only')) {
  try {
    const first = await fixture(),
      now = new Date().toISOString(),
      localDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(
        new Date(),
      );
    const workout = randomUUID(),
      exercise = randomUUID(),
      set = randomUUID(),
      common = { user_id: first.id, created_at: now, updated_at: now, deleted_at: null };
    const changes = [
      {
        id: workout,
        entity: 'workouts',
        operation: 'upsert',
        payload: {
          ...common,
          id: workout,
          type: 'strength',
          name: 'Private set-count check',
          duration_minutes: 0,
          local_date: localDate,
          notes: null,
          effort_rating: null,
          start_time: null,
        },
      },
      {
        id: exercise,
        entity: 'workout_exercises',
        operation: 'upsert',
        payload: {
          ...common,
          id: exercise,
          workout_id: workout,
          exercise_id: null,
          exercise_name: 'Curl',
          order_in_workout: 1,
          notes: null,
        },
      },
      {
        id: set,
        entity: 'workout_sets',
        operation: 'upsert',
        payload: {
          ...common,
          id: set,
          workout_id: workout,
          workout_exercise_id: exercise,
          set_number: 1,
          reps: 10,
          weight_kg: 5,
          duration_seconds: null,
          distance_meters: null,
          is_warmup: false,
          completed: true,
        },
      },
    ];
    await rpc(first.client, 'save_tracking_changes', { p_changes: changes });
    await rpc(first.client, 'save_tracking_changes', { p_changes: changes });
    let values = (
      await rpc(admin, 'challenge_source_days', {
        p_user: first.id,
        p_from: localDate,
        p_to: localDate,
      })
    )[0].values;
    assert.equal(values.workouts_count, 1);
    assert.equal(values.workout_minutes, 0);
    const removed = {
      ...changes[2],
      payload: {
        ...changes[2].payload,
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    };
    await rpc(first.client, 'save_tracking_changes', { p_changes: [removed] });
    values = (
      await rpc(admin, 'challenge_source_days', {
        p_user: first.id,
        p_from: localDate,
        p_to: localDate,
      })
    )[0].values;
    assert.equal(values.workouts_count, 0);
    assert.equal(values.workout_minutes, 0);
    assert.equal(
      (await query(admin.from('challenge_dirty_queue').select('user_id').eq('user_id', first.id)))
        .length,
      1,
    );
    console.log(
      'Hosted strength-count integration: 1 passed, 0 failed (retry-safe count, zero invented minutes, removal and scoring refresh)',
    );
  } finally {
    await cleanup();
  }
  process.exit(0);
}
try {
  const first = await fixture();
  await query(
    first.client.from('goal_profiles').insert({
      id: randomUUID(),
      user_id: first.id,
      goal: 'maintain',
      activity_level: 'moderate',
      current_weight_kg: 70,
      weekly_rate_kg: 0,
      daily_calorie_target: 2100,
      protein_grams: 120,
      carb_grams: 270,
      fat_grams: 60,
      bmr: 1700,
      tdee: 2100,
      custom_macros: true,
      recompute_reason: 'initial_onboarding',
      effective_from: new Date(Date.now() - 120000).toISOString(),
    }),
  );
  console.log('Building a real-provider onboarding day and private weekly workout routine.');
  const onboarding = await endpoint(first.client, 'weekly-plan', {
    request_id: randomUUID(),
    scope: 'day',
    preferences,
  });
  assert.equal(onboarding.status, 200, 'Onboarding generation: ' + onboarding.code);
  const initial = await build(first.client, true);
  const hidden = await rpc(first.client, 'get_workout_plan');
  assert.deepEqual(hidden.days, []);
  assert.equal(hidden.full_access, false);
  assert.ok(
    (await first.client.from('workout_plans').select('*')).error,
    'No direct client table access',
  );
  await query(
    admin.from('entitlements').upsert({
      user_id: first.id,
      tier: 'plus',
      status: 'paid',
      period_end: new Date(Date.now() + 365 * 86400000).toISOString(),
    }),
  );
  let plan = await rpc(first.client, 'get_workout_plan');
  assert.equal(plan.id, initial);
  assert.equal(plan.days.length, 7);
  assert.equal(plan.can_rebuild, true);
  for (const day of plan.days) {
    assert.equal(day.exercises.length > 0, preferences.workout_days.includes(day.day));
    for (const exercise of day.exercises)
      assert.ok(
        !/squat|deadlift|lunge|leg |calf|calves/i.test(exercise.name),
        'Explicit leg exclusion retained',
      );
  }
  console.log(
    'PASS Hosted onboarding: seven real-provider workout days, requested rest days, private Free projection, notes and purchased access',
  );
  const racingIds = [randomUUID(), randomUUID()];
  const reservations = await Promise.all(
    racingIds.map((id) =>
      admin.rpc('reserve_workout_plan', {
        p_user_id: first.id,
        p_id: id,
        p_preferences: preferences,
        p_initial: false,
      }),
    ),
  );
  const granted = reservations.flatMap((result, index) =>
    result.error ? [] : [{ id: racingIds[index], lease: result.data.lease }],
  );
  for (const reservation of granted)
    await rpc(admin, 'finish_workout_plan', {
      p_user_id: first.id,
      p_id: reservation.id,
      p_lease: reservation.lease,
      p_content: null,
    });
  assert.equal(granted.length, 1, 'Only one concurrent rebuild reservation is granted');
  assert.equal(
    reservations.filter((result) => result.error?.message.includes('PLAN_BUSY')).length,
    1,
  );
  assert.equal(
    (await rpc(first.client, 'get_workout_plan')).can_rebuild,
    true,
    'Failed/cancelled provider work consumes no allowance',
  );
  const rebuilt = await build(first.client, false);
  await build(first.client, false, rebuilt);
  plan = await rpc(first.client, 'get_workout_plan');
  assert.equal(plan.rebuilds_used, 1);
  assert.equal(plan.can_rebuild, false);
  const deniedPlus = await endpoint(first.client, 'workout-plan', {
    request_id: randomUUID(),
    preferences,
    initial: false,
  });
  assert.equal(deniedPlus.code, 'WORKOUT_LIFETIME_LIMIT');
  const content = { days: structuredClone(plan.days) },
    training = content.days.find((day) => day.exercises.length);
  training.exercises[0].targetSets = [
    { reps: 12, weightKg: 7.5 },
    { reps: 8, weightKg: 10 },
  ];
  const edited = await rpc(first.client, 'edit_workout_plan', {
    p_id: randomUUID(),
    p_plan_id: plan.id,
    p_revision: plan.revision,
    p_content: content,
  });
  assert.deepEqual(
    edited.days[training.day].exercises[0].targetSets,
    training.exercises[0].targetSets,
  );
  assert.equal(edited.rebuilds_used, 1);
  console.log(
    'PASS Hosted Plus: one lifetime rebuild, cached retry, second-build denial and acknowledged per-set plan edits',
  );
  const second = await fixture();
  const original = await query(
    admin
      .from('personal_weekly_plans')
      .select('preferences,content')
      .eq('user_id', first.id)
      .single(),
  );
  await query(
    admin.from('personal_weekly_plans').insert({
      user_id: second.id,
      id: randomUUID(),
      preferences: original.preferences,
      content: original.content,
    }),
  );
  const seed = randomUUID(),
    reservation = await rpc(admin, 'reserve_workout_plan', {
      p_user_id: second.id,
      p_id: seed,
      p_preferences: preferences,
      p_initial: true,
    });
  await rpc(admin, 'finish_workout_plan', {
    p_user_id: second.id,
    p_id: seed,
    p_lease: reservation.lease,
    p_content: { days: plan.days },
  });
  await query(
    admin.from('entitlements').upsert({
      user_id: second.id,
      tier: 'pro',
      status: 'paid',
      period_end: new Date(Date.now() + 365 * 86400000).toISOString(),
    }),
  );
  assert.equal((await rpc(second.client, 'get_workout_plan')).can_rebuild, true);
  await build(second.client, false);
  const pro = await rpc(second.client, 'get_workout_plan');
  assert.equal(pro.rebuilds_used, 1);
  assert.ok(pro.next_rebuild_at);
  assert.equal(pro.can_rebuild, false);
  const deniedPro = await endpoint(second.client, 'workout-plan', {
    request_id: randomUUID(),
    preferences,
    initial: false,
  });
  assert.equal(deniedPro.code, 'WORKOUT_COOLDOWN');
  console.log(
    'PASS Hosted Pro: immediate first rebuild followed by server-enforced six-month cooldown',
  );
  const room = randomUUID();
  journal.rooms.push(room);
  persist();
  const created = await rpc(first.client, 'create_room_v3', {
    p_client_id: room,
    p_name: 'Private workout verification',
  });
  await rpc(second.client, 'join_by_code', { p_code: created.code });
  const now = new Date().toISOString(),
    localDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(
      new Date(),
    ),
    workoutId = randomUUID(),
    exerciseId = randomUUID();
  const common = { user_id: first.id, created_at: now, updated_at: now, deleted_at: null };
  const changes = [
    {
      id: workoutId,
      entity: 'workouts',
      operation: 'upsert',
      payload: {
        ...common,
        id: workoutId,
        type: 'strength',
        name: 'Private custom curl workout',
        duration_minutes: 0,
        local_date: localDate,
        notes: null,
        effort_rating: null,
        start_time: null,
      },
    },
    {
      id: exerciseId,
      entity: 'workout_exercises',
      operation: 'upsert',
      payload: {
        ...common,
        id: exerciseId,
        workout_id: workoutId,
        exercise_id: null,
        exercise_name: 'Dumbbell curls',
        order_in_workout: 1,
        notes: null,
      },
    },
    ...[
      [12, 7.5],
      [8, 10],
    ].map(([reps, weight], index) => {
      const id = randomUUID();
      return {
        id,
        entity: 'workout_sets',
        operation: 'upsert',
        payload: {
          ...common,
          id,
          workout_id: workoutId,
          workout_exercise_id: exerciseId,
          set_number: index + 1,
          reps,
          weight_kg: weight,
          duration_seconds: null,
          distance_meters: null,
          is_warmup: false,
          completed: true,
        },
      };
    }),
  ];
  await rpc(first.client, 'save_tracking_changes', { p_changes: changes });
  await rpc(first.client, 'save_tracking_changes', { p_changes: changes });
  const logged = await query(first.client.from('workouts').select('id').eq('id', workoutId));
  assert.equal(logged.length, 1);
  const shared = await rpc(second.client, 'get_squad_member_details', {
    p_room_id: room,
    p_member_id: first.id,
  });
  const workout = shared.workouts.find((workout) => workout.id === workoutId);
  assert.ok(workout);
  assert.deepEqual(
    workout.exercises[0].sets.map((set) => [set.reps, set.weight_kg]),
    [
      [12, 7.5],
      [8, 10],
    ],
  );
  assert.deepEqual(
    (await rpc(first.client, 'get_workout_plan')).days,
    edited.days,
    'Custom logs do not change the weekly routine',
  );
  console.log(
    'PASS Hosted logging: retry-safe workout/set save, private diary, paid squad projection and unchanged weekly routine',
  );
  console.log('Hosted workout routine: 5 groups passed, 0 failed');
} finally {
  await cleanup();
}
