// Explicit hosted audit: only private disposable users and their own records are changed.
// Run with the OS credential wrapper; credentials stay in memory and never enter reports.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const managementToken = process.env.CALI_AUDIT_MANAGEMENT_TOKEN;
delete process.env.CALI_AUDIT_MANAGEMENT_TOKEN;
assert.ok(managementToken, 'OS credential wrapper is required');
const project = fs.readFileSync('supabase/.temp/project-ref', 'utf8').trim();
const keysResponse = await fetch(`https://api.supabase.com/v1/projects/${project}/api-keys`, {
  headers: { Authorization: `Bearer ${managementToken}` },
});
assert.ok(keysResponse.ok, 'Project key lookup');
const keys = await keysResponse.json();
const service = keys.find((item) => item.name === 'service_role').api_key;
const anon = keys.find((item) => item.name === 'anon').api_key;
const base = `https://${project}.supabase.co`;
const users = [];
let room;
async function request(method, path, body, token = service, expected = 200) {
  const result = await fetch(base + path, {
    method,
    headers: {
      apikey: token === service ? service : anon,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(95000),
  });
  const data = await result.json().catch(() => null);
  if (expected !== 200) {
    assert.equal(result.status, expected, `${method} ${path} expected rejection`);
  } else if (!result.ok) {
    const code = /^[A-Z_]{1,64}$/.test(data?.code) ? data.code : 'REQUEST_FAILED';
    throw new Error(`${method} ${path} HTTP ${result.status} ${code}`);
  }
  return data;
}
const rpc = (name, body, token) => request('POST', '/rest/v1/rpc/' + name, body, token);
async function account(pro) {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const email = `ai_audit_${suffix}@example.invalid`;
  const password = randomUUID() + 'Aa8!';
  const created = await request('POST', '/auth/v1/admin/users', {
    email,
    password,
    email_confirm: true,
    user_metadata: { fixture: 'gemini-model-check' },
  });
  users.push(created.id);
  await request('POST', '/rest/v1/profiles', {
    id: created.id,
    username: `ai_${suffix}`,
    nickname: 'AI audit',
    date_of_birth: '1995-01-01',
    sex: 'male',
    height_cm: 175,
    timezone: 'UTC',
    discoverable: false,
  });
  if (pro)
    await request('POST', '/rest/v1/entitlements', {
      user_id: created.id,
      tier: 'pro',
      status: 'paid',
      source: 'none',
      period: 'monthly',
      period_end: new Date(Date.now() + 86400000).toISOString(),
    });
  const session = await request(
    'POST',
    '/auth/v1/token?grant_type=password',
    { email, password },
    anon,
  );
  return { id: created.id, token: session.access_token };
}
try {
  const pro = await account(true);
  const free = await account(false);

  const weightId = randomUUID();
  const weightChange = {
    id: weightId,
    entity: 'weight_logs',
    operation: 'upsert',
    payload: {
      id: weightId,
      user_id: pro.id,
      weight_kg: 79,
      local_date: new Date().toISOString().slice(0, 10),
      logged_at: new Date().toISOString(),
    },
  };
  await rpc('save_tracking_changes', { p_changes: [weightChange] }, pro.token);
  await rpc('save_tracking_changes', { p_changes: [weightChange] }, pro.token);
  const savedWeights = await request('GET', '/rest/v1/weight_logs?select=id', undefined, pro.token);
  assert.equal(savedWeights.length, 1);
  const future = await request(
    'POST',
    '/rest/v1/rpc/save_tracking_changes',
    {
      p_changes: [
        { ...weightChange, payload: { ...weightChange.payload, local_date: '2999-01-01' } },
      ],
    },
    pro.token,
    400,
  );
  assert.match(future.message, /INVALID_WEIGHT_DATE/);
  console.log('PASS Hosted weight retries remain unique and future dates are rejected');
  const messages = [{ role: 'user', content: 'Suggest one simple, safe beginner exercise.' }];
  await request('POST', '/functions/v1/ai-coach', { messages }, free.token, 403);
  await request(
    'POST',
    '/functions/v1/ai-food-photo',
    { description: '2 boiled eggs' },
    free.token,
    403,
  );
  await request('POST', '/functions/v1/ai-coach', { messages }, pro.token, 403);
  await rpc('accept_ai_processing_consent', { p_version: '1.1-gemini-audit' }, pro.token);
  console.log('PASS Free AI denial and purchased-Pro processing consent');

  for (const message of ['Who are you?', 'What model are you using?']) {
    const identity = await request('POST', '/functions/v1/ai-coach', { message }, pro.token);
    assert.match(identity.message.content, /health coach on behalf of CaliPartner/);
    assert.ok(!/claude|haiku|anthropic|gemini|groq/i.test(JSON.stringify(identity)));
  }
  console.log('PASS Hosted coach identity answers use only CaliPartner wording');
  const coach = await request('POST', '/functions/v1/ai-coach', { messages }, pro.token);
  assert.equal(coach.model, 'calipartner-coach');
  assert.ok(coach.message.content.trim());
  console.log(
    'PASS Real coach reply with the configured Haiku-first chain and private provider identity',
  );

  const draft = await request(
    'POST',
    '/functions/v1/ai-coach',
    {
      meal_logging: true,
      messages: [
        {
          role: 'user',
          content:
            "Please log 2 large boiled eggs (100 g edible weight), without added fat, for today's lunch. Food, quantity and meal section are confirmed.",
        },
      ],
    },
    pro.token,
  );
  assert.equal(draft.model, 'calipartner-coach');
  assert.ok(draft.meal_draft?.items?.length, 'Explicit complete meal yields a reviewable draft');
  assert.deepEqual(
    await request('GET', '/rest/v1/food_entries?select=id', undefined, pro.token),
    [],
  );
  const entries = draft.meal_draft.items.map((item) => ({
    id: randomUUID(),
    food_name: item.name,
    meal_section: draft.meal_draft.mealSection,
    local_date: draft.meal_draft.localDate,
    quantity: item.quantity,
    unit: item.unit,
    calories: item.calories,
    protein: item.protein,
    carbs: item.carbs,
    fat: item.fat,
    fiber: item.fiber,
    sugar: item.sugar,
    sodium_mg: item.sodium_mg,
  }));
  const saved = await rpc('log_coach_meal', { p_entries: entries }, pro.token);
  const retry = await rpc('log_coach_meal', { p_entries: entries }, pro.token);
  assert.deepEqual(
    saved.map((row) => row.id),
    retry.map((row) => row.id),
  );
  assert.equal(saved.length, entries.length);
  console.log(
    'PASS Real meal draft makes no diary write; confirmed save and retry acknowledge identical entries',
  );

  // Public food fixture, inspected as a single apple. No user photograph is uploaded.
  const photoResponse = await fetch(
    'https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?w=480&q=70',
    {
      signal: AbortSignal.timeout(15000),
    },
  );
  assert.ok(photoResponse.ok, 'Public apple photo fixture is available');
  const photo = Buffer.from(await photoResponse.arrayBuffer()).toString('base64');
  const analysis = await request(
    'POST',
    '/functions/v1/ai-food-photo',
    { image: photo, mime_type: 'image/jpeg' },
    pro.token,
  );
  assert.ok(
    analysis.candidates?.some((item) => /apple/i.test(item.matched_food.name)),
    'Food photograph identifies the apple',
  );
  const before = await request('GET', '/rest/v1/food_entries?select=id', undefined, pro.token);
  assert.equal(before.length, entries.length, 'Analysis never logs food automatically');
  const candidate = analysis.candidates.find((item) => /apple/i.test(item.matched_food.name));
  assert.ok(candidate.nutrients.calories > 0);
  const photoEntry = {
    id: candidate.id,
    user_id: pro.id,
    food_name: candidate.matched_food.name,
    meal_section: 'snacks',
    local_date: new Date().toISOString().slice(0, 10),
    quantity: candidate.quantity,
    unit: candidate.unit,
    source: 'photo',
    calories: candidate.nutrients.calories,
    protein: candidate.nutrients.protein,
    carbs: candidate.nutrients.carbs,
    fat: candidate.nutrients.fat,
    fiber: candidate.nutrients.fiber,
    sugar: candidate.nutrients.sugar,
    sodium_mg: candidate.nutrients.sodium_mg,
  };
  await request('POST', '/rest/v1/food_entries', photoEntry, pro.token);
  await request('POST', '/rest/v1/food_entries', photoEntry, pro.token);
  const confirmed = await request(
    'GET',
    `/rest/v1/food_entries?id=eq.${candidate.id}&select=id,calories,source`,
    undefined,
    pro.token,
  );
  assert.equal(confirmed.length, 1);
  assert.equal(confirmed[0].calories, photoEntry.calories);
  assert.equal(confirmed[0].source, 'photo');
  assert.deepEqual(
    await request('GET', '/rest/v1/food_entries?select=id', undefined, free.token),
    [],
  );
  console.log(
    'PASS Real apple photo estimate, explicit acknowledged photo save, duplicate-free retry and cross-account privacy',
  );

  room = randomUUID();
  const created = await rpc(
    'create_room_v3',
    { p_client_id: room, p_name: 'AI audit chat' },
    free.token,
  );
  await rpc('join_by_code', { p_code: created.code }, pro.token);
  for (const token of [free.token, pro.token]) await rpc('accept_chat_terms', {}, token);
  const original = await rpc(
    'send_chat_message',
    { p_room_id: room, p_client_id: randomUUID(), p_text: 'Original audit message' },
    free.token,
  );
  const replyArgs = {
    p_room_id: room,
    p_client_id: randomUUID(),
    p_reply_to_id: original.id,
    p_text: 'Reply audit message',
  };
  const reply = await rpc('send_chat_reply', replyArgs, pro.token);
  assert.equal(reply.reply.text, 'Original audit message');
  assert.equal((await rpc('send_chat_reply', replyArgs, pro.token)).id, reply.id);
  const projected = await rpc('get_chat_messages_v2', { p_room_id: room }, free.token);
  assert.equal(projected.find((item) => item.id === reply.id).reply.id, original.id);
  await rpc('delete_own_chat_message', { p_message_id: original.id }, free.token);
  const afterDeletion = await rpc('get_chat_messages_v2', { p_room_id: room }, pro.token);
  assert.equal(afterDeletion.find((item) => item.id === reply.id).reply, null);
  console.log(
    'PASS Human chat replies preserve authorized quotes, acknowledged retries, Free-member reads and quote removal after deletion',
  );
  console.log('Hosted AI features: all checks passed.');
} finally {
  if (room) await request('DELETE', `/rest/v1/rooms?id=eq.${room}`);
  for (const id of users) await request('DELETE', `/auth/v1/admin/users/${id}`);
  console.log('Hosted AI fixture cleanup completed.');
}
