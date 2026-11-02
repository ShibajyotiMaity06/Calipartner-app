// Disposable accounts only. Every actual mutation below uses a user JWT and RLS.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(
  fs
    .readFileSync('supabase/.env', 'utf8')
    .split(/\r?\n/)
    .filter((line) => /^\w+=/.test(line))
    .map((line) => {
      const split = line.indexOf('=');
      return [line.slice(0, split), line.slice(split + 1).replace(/^['"]|['"]$/g, '')];
    }),
);
const ref = env.SUPABASE_PROJECT_REF;
const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys`, {
  headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}` },
});
if (!response.ok) throw new Error(`Key lookup failed (${response.status})`);
const keys = await response.json();
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const makeClient = (kind) =>
  createClient(
    `https://${ref}.supabase.co`,
    keys.find((key) => key.name === kind).api_key,
    options,
  );
const admin = makeClient('service_role');
const created = [];
const day = new Date().toISOString().slice(0, 10),
  now = new Date().toISOString();
const receipt = '.cache/online-save-audit-fixtures.json';
const persist = () => fs.writeFileSync(receipt, JSON.stringify({ accountIds: created }, null, 2));
let verified = false;
let auditFailure;
const failures = [];
try {
  const clients = [];
  for (let index = 0; index < 2; index++) {
    const password = crypto.randomUUID(),
      suffix = `${Date.now()}_${index}`,
      email = `online-save-${suffix}@example.com`;
    const result = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (result.error) throw new Error(result.error.message);
    created.push(result.data.user.id);
    persist();
    const client = makeClient('anon');
    const signed = await client.auth.signInWithPassword({ email, password });
    if (signed.error) throw new Error(signed.error.message);
    const profile = await client.from('profiles').upsert({
      id: result.data.user.id,
      username: `on_${suffix}`,
      nickname: 'Online save audit',
      date_of_birth: '1995-01-01',
      sex: 'male',
      height_cm: 175,
      timezone: 'UTC',
    });
    if (profile.error) throw new Error(profile.error.message);
    clients.push(client);
  }
  const [first, second] = clients,
    [owner] = created;
  const waterId = crypto.randomUUID(),
    workoutId = crypto.randomUUID(),
    exerciseId = crypto.randomUUID(),
    setId = crypto.randomUUID();
  const change = (entity, id, payload) => ({ entity, id, operation: 'upsert', payload });
  const water = (id, amount) =>
    change('water_logs', id, {
      id,
      user_id: owner,
      amount_ml: amount,
      logged_at: now,
      local_date: day,
    });
  const changes = [
    water(waterId, 250),
    change('workouts', workoutId, {
      id: workoutId,
      user_id: owner,
      type: 'strength',
      name: 'Online audit',
      duration_minutes: 20,
      local_date: day,
    }),
    change('workout_exercises', exerciseId, {
      id: exerciseId,
      user_id: owner,
      workout_id: workoutId,
      exercise_name: 'Squat',
      order_in_workout: 1,
    }),
    change('workout_sets', setId, {
      id: setId,
      user_id: owner,
      workout_id: workoutId,
      workout_exercise_id: exerciseId,
      set_number: 1,
      reps: 8,
      weight_kg: 40,
      completed: true,
      is_warmup: false,
    }),
  ];
  for (let retry = 0; retry < 2; retry++) {
    const result = await first.rpc('save_tracking_changes', { p_changes: changes });
    if (result.error) throw new Error(result.error.message);
  }
  for (const [table, id] of [
    ['water_logs', waterId],
    ['workouts', workoutId],
    ['workout_exercises', exerciseId],
    ['workout_sets', setId],
  ]) {
    const result = await first.from(table).select('id').eq('id', id);
    if (result.error) throw new Error(result.error.message);
    assert.equal(result.data.length, 1);
  }
  const rolledBack = crypto.randomUUID();
  const rejected = await first.rpc('save_tracking_changes', {
    p_changes: [water(rolledBack, 250), water(crypto.randomUUID(), -1)],
  });
  assert.ok(rejected.error);
  assert.deepEqual((await first.from('water_logs').select('id').eq('id', rolledBack)).data, []);
  const denied = await second.rpc('save_tracking_changes', {
    p_changes: [{ entity: 'water_logs', id: waterId, operation: 'delete', payload: {} }],
  });
  assert.ok(denied.error?.message.includes('SAVE_NOT_ALLOWED'));
  assert.deepEqual((await second.from('water_logs').select('id').eq('id', waterId)).data, []);
  const invalid = await first.rpc('save_tracking_changes', {
    p_changes: [change('entitlements', owner, { user_id: owner, tier: 'pro' })],
  });
  assert.ok(invalid.error?.message.includes('INVALID_SAVE'));
  verified = true;
} catch (error) {
  auditFailure = error;
} finally {
  for (const id of [...created]) {
    const result = await admin.auth.admin.deleteUser(id);
    if (result.error) failures.push(result.error.message);
    else {
      created.splice(created.indexOf(id), 1);
      persist();
    }
  }
}
if (failures.length) throw new Error(`Fixture cleanup failed: ${failures.join('; ')}`);
if (auditFailure) throw auditFailure;
if (verified)
  console.log(
    'Hosted online saves: atomic logging, identical retry, rollback, cross-account denial and whitelist passed; 2 disposable accounts removed',
  );
