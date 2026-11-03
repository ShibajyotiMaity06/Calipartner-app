// Disposable accounts only. User writes use JWTs and the acknowledged-save RPC.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { calculateGymTargets } from '../packages/core/src/gymTargets.ts';
const ref = process.env.SUPABASE_PROJECT_REF,
  token = process.env.SUPABASE_ACCESS_TOKEN;
assert.ok(ref && token, 'Load the existing Supabase deployment environment');
assert.equal(ref, fs.readFileSync('supabase/.temp/project-ref', 'utf8').trim());
const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys`, {
  headers: { Authorization: `Bearer ${token}` },
});
if (!response.ok) throw new Error(`Key lookup failed (${response.status})`);
const keys = await response.json(),
  options = { auth: { persistSession: false, autoRefreshToken: false } };
const client = (kind) =>
  createClient(
    `https://${ref}.supabase.co`,
    keys.find((key) => key.name === kind).api_key,
    options,
  );
const admin = client('service_role'),
  created = [],
  clients = [],
  roomId = crypto.randomUUID(),
  failures = [];
const receipt = '.cache/squad-revision-hosted-fixtures.json';
const persist = () =>
  fs.writeFileSync(receipt, JSON.stringify({ accountIds: created, roomId }, null, 2));
const rpc = async (viewer, name, args = {}) => {
  const result = await viewer.rpc(name, args);
  if (result.error) throw new Error(result.error.message);
  return result.data;
};
const now = new Date().toISOString(),
  periodEnd = new Date(Date.now() + 86400000).toISOString();
const plan = calculateGymTargets({
  goal: 'maintain',
  sex: 'male',
  age: 31,
  heightCm: 175,
  weightKg: 70,
  gymDays: 4,
  activityLevel: 'moderate',
});
const day = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Pacific/Kiritimati',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());
let failure;
try {
  for (let index = 0; index < 4; index++) {
    const password = crypto.randomUUID(),
      stamp = Date.now().toString(36),
      email = `squad-revision-${stamp}-${index}@example.com`;
    const result = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (result.error) throw new Error(result.error.message);
    const id = result.data.user.id;
    created.push(id);
    persist();
    const viewer = client('anon');
    const signed = await viewer.auth.signInWithPassword({ email, password });
    if (signed.error) throw new Error(signed.error.message);
    const profile = await viewer.from('profiles').upsert({
      id,
      username: `sq_${stamp}_${index}`,
      nickname: `Squad audit ${index}`,
      date_of_birth: '1995-01-01',
      sex: 'male',
      height_cm: 175,
      timezone: index === 0 ? 'Pacific/Kiritimati' : 'UTC',
      discoverable: false,
    });
    if (profile.error) throw new Error(profile.error.message);
    const goal = await viewer.from('goal_profiles').insert({
      id: crypto.randomUUID(),
      user_id: id,
      goal: 'maintain',
      activity_level: 'moderate',
      current_weight_kg: 70,
      weekly_rate_kg: 0,
      gym_days: 4,
      input_height_cm: 175,
      daily_calorie_target: plan.targetKcal,
      protein_grams: plan.macros.proteinGrams,
      fat_grams: plan.macros.fatGrams,
      carb_grams: plan.macros.carbGrams,
      bmr: plan.bmr,
      tdee: plan.tdee,
      step_goal: 8000,
    });
    if (goal.error) throw new Error(goal.error.message);
    clients.push(viewer);
  }
  const [owner, free, plus, outsider] = clients,
    [ownerId, freeId, plusId] = created;
  const grant = await admin.from('entitlements').upsert([
    { user_id: ownerId, tier: 'pro', status: 'paid', period_end: periodEnd },
    { user_id: plusId, tier: 'plus', status: 'paid', period_end: periodEnd },
  ]);
  if (grant.error) throw new Error(grant.error.message);
  const room = await rpc(owner, 'create_room_v3', {
    p_client_id: roomId,
    p_name: 'Disposable squad audit',
  });
  for (const viewer of [free, plus]) await rpc(viewer, 'join_by_code', { p_code: room.code });
  const workoutId = crypto.randomUUID(),
    exerciseId = crypto.randomUUID();
  const payloads = [
    [
      'food_entries',
      {
        id: crypto.randomUUID(),
        user_id: ownerId,
        food_name: 'Audit rice and dal',
        meal_section: 'lunch',
        quantity: 1,
        unit: 'serving',
        calories: 500,
        protein: 30,
        carbs: 60,
        fat: 10,
        source: 'search',
        logged_at: now,
        local_date: day,
      },
    ],
    [
      'activity_days',
      {
        id: crypto.randomUUID(),
        user_id: ownerId,
        local_date: day,
        steps: 4321,
        distance_m: 3000,
        source: 'manual',
      },
    ],
    [
      'weight_logs',
      { id: crypto.randomUUID(), user_id: ownerId, weight_kg: 72, logged_at: now, local_date: day },
    ],
    [
      'workouts',
      {
        id: workoutId,
        user_id: ownerId,
        type: 'strength',
        name: 'Audit leg day',
        duration_minutes: 48,
        local_date: day,
      },
    ],
    [
      'workout_exercises',
      {
        id: exerciseId,
        workout_id: workoutId,
        user_id: ownerId,
        exercise_name: 'Audit squat',
        order_in_workout: 0,
      },
    ],
    [
      'workout_sets',
      {
        id: crypto.randomUUID(),
        workout_exercise_id: exerciseId,
        workout_id: workoutId,
        user_id: ownerId,
        set_number: 1,
        reps: 8,
        weight_kg: 80,
        completed: true,
      },
    ],
  ];
  const changes = payloads.map(([entity, payload]) => ({
    entity,
    id: payload.id,
    operation: 'upsert',
    payload,
  }));
  await rpc(owner, 'save_tracking_changes', { p_changes: changes });
  await rpc(owner, 'save_tracking_changes', { p_changes: changes });
  const today = await rpc(free, 'get_squad_today', { p_room_id: roomId });
  assert.equal(today.members.length, 3);
  const peer = today.members.find((member) => member.user_id === ownerId);
  assert.equal(peer.calories, 500);
  assert.equal(peer.steps, 4321);
  assert.equal(peer.targets.calories, plan.targetKcal);
  assert.equal(peer.height_cm, null);
  assert.equal(peer.weight_kg, null);
  assert.ok(!JSON.stringify(today).includes('Audit rice'));
  const base = await free.from('food_entries').select('id').eq('user_id', ownerId);
  assert.deepEqual(base.data, []);
  await assert.rejects(
    () => rpc(free, 'get_squad_member_details', { p_room_id: roomId, p_member_id: ownerId }),
    /PLUS_REQUIRED/,
  );
  const detail = await rpc(plus, 'get_squad_member_details', {
    p_room_id: roomId,
    p_member_id: ownerId,
  });
  assert.equal(detail.meals[0].calories, 500);
  assert.equal(detail.meals[0].items[0].name, 'Audit rice and dal');
  assert.equal(detail.workouts[0].exercises[0].sets[0].weight_kg, 80);
  await rpc(owner, 'set_squad_visibility', {
    p_room_id: roomId,
    p_share_weight: true,
    p_share_height: false,
  });
  const visible = (await rpc(free, 'get_squad_today', { p_room_id: roomId })).members.find(
    (member) => member.user_id === ownerId,
  );
  assert.equal(visible.weight_kg, 72);
  assert.equal(visible.height_cm, null);
  const usernames = await admin.from('profiles').select('id,username').in('id', [freeId, plusId]);
  if (usernames.error) throw new Error(usernames.error.message);
  const text = usernames.data.map((person) => '@' + person.username).join(' ') + ' tomorrow?';
  await rpc(owner, 'accept_chat_terms');
  const messageClient = crypto.randomUUID();
  const message = await rpc(owner, 'send_chat_message', {
    p_room_id: roomId,
    p_client_id: messageClient,
    p_text: text,
  });
  await rpc(owner, 'send_chat_message', {
    p_room_id: roomId,
    p_client_id: messageClient,
    p_text: text,
  });
  const unread = await rpc(plus, 'get_squad_mentions', { p_room_id: roomId });
  assert.equal(unread.count, 1);
  assert.equal(unread.mentions[0].message_id, message.id);
  const freeUnread = await rpc(free, 'get_squad_mentions', { p_room_id: roomId });
  assert.equal(freeUnread.count, 1);
  assert.equal(freeUnread.locked, true);
  assert.deepEqual(freeUnread.mentions, []);
  const context = await rpc(plus, 'get_squad_mention_context', {
    p_room_id: roomId,
    p_message_id: message.id,
  });
  assert.equal(context[0].id, message.id);
  await rpc(plus, 'mark_squad_mention_seen', { p_room_id: roomId, p_message_id: message.id });
  await rpc(plus, 'mark_squad_mention_seen', { p_room_id: roomId, p_message_id: message.id });
  assert.equal((await rpc(plus, 'get_squad_mentions', { p_room_id: roomId })).count, 0);
  assert.equal((await rpc(free, 'get_squad_mentions', { p_room_id: roomId })).count, 1);
  for (const name of ['get_squad_today', 'get_squad_mentions'])
    await assert.rejects(() => rpc(outsider, name, { p_room_id: roomId }), /NOT_ROOM_MEMBER/);
  const expire = await admin
    .from('entitlements')
    .update({ period_end: new Date(Date.now() - 86400000).toISOString() })
    .eq('user_id', plusId);
  if (expire.error) throw new Error(expire.error.message);
  await assert.rejects(
    () => rpc(plus, 'get_squad_member_details', { p_room_id: roomId, p_member_id: ownerId }),
    /PLUS_REQUIRED/,
  );
  assert.equal((await rpc(plus, 'get_squad_today', { p_room_id: roomId })).members.length, 3);
} catch (error) {
  failure = error;
} finally {
  const room = await admin.from('rooms').delete().eq('id', roomId);
  if (room.error) failures.push(room.error.message);
  for (const id of [...created]) {
    const result = await admin.auth.admin.deleteUser(id);
    if (result.error) failures.push(result.error.message);
    else {
      created.splice(created.indexOf(id), 1);
      persist();
    }
  }
}
if (failures.length) throw new Error('Fixture cleanup failed: ' + failures.join('; '));
if (failure) throw failure;
console.log(
  'Hosted squad audit: acknowledged saves/retries, Free macros and steps, Plus meals and workout sets, visibility, tags and seen receipts, outsider denial and expired Plus gates passed; 4 disposable accounts and their room removed',
);
