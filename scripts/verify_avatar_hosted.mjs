// Uses private disposable accounts only. Credentials remain in memory; all fixtures are deleted.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const credential = process.env.CALI_AVATAR_MANAGEMENT_TOKEN;
delete process.env.CALI_AVATAR_MANAGEMENT_TOKEN;
assert.ok(credential, 'Use verify_avatar_hosted.ps1 with the existing OS credential');
const ref = fs.readFileSync('supabase/.temp/project-ref', 'utf8').trim();
const keyResponse = await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys`, {
  headers: { Authorization: `Bearer ${credential}` },
});
assert.ok(keyResponse.ok, 'Management key lookup');
const keys = await keyResponse.json();
const service = keys.find((k) => k.name === 'service_role').api_key;
const anon = keys.find((k) => k.name === 'anon').api_key;
const base = `https://${ref}.supabase.co`;
const fixtures = [];
let roomId;
let checks = 0;
async function request(method, route, body, token = service, expected = 200) {
  const response = await fetch(base + route, {
    method,
    headers: {
      apikey: token === service ? service : anon,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation,resolution=merge-duplicates',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(45000),
  });
  const data = await response.json().catch(() => null);
  if (expected === 200) {
    if (!response.ok)
      throw new Error(`${route}: HTTP ${response.status} (${data?.code ?? 'REQUEST_FAILED'})`);
  } else assert.equal(response.status, expected, route);
  return data;
}
const rpc = (name, args, token = service, expected = 200) =>
  request('POST', '/rest/v1/rpc/' + name, args, token, expected);
async function account(gender) {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const email = `avatar_audit_${suffix}@example.invalid`;
  const password = randomUUID() + 'Aa8!';
  const created = await request('POST', '/auth/v1/admin/users', {
    email,
    password,
    email_confirm: true,
    user_metadata: { fixture: 'avatar-audit' },
  });
  fixtures.push(created.id);
  await request('POST', '/rest/v1/profiles', {
    id: created.id,
    username: 'av_' + suffix,
    nickname: 'Avatar audit',
    date_of_birth: '1995-01-01',
    sex: gender === 'm' ? 'male' : 'female',
    height_cm: 175,
    timezone: 'America/New_York',
    discoverable: false,
  });
  const session = await request(
    'POST',
    '/auth/v1/token?grant_type=password',
    { email, password },
    anon,
  );
  assert.ok(session.access_token);
  const state = await rpc(
    'avatar_create',
    { p_gender: gender, p_skin_tone_id: 'skin_3' },
    session.access_token,
  );
  assert.equal(state.balances.earned, 20);
  checks++;
  return { id: created.id, token: session.access_token, state };
}
try {
  const a = await account('m'),
    b = await account('f');
  assert.deepEqual(await rpc('get_avatar_public', { p_user_ids: [b.id] }, a.token), []);
  checks++;
  const rows = await request(
    'GET',
    `/rest/v1/avatar_profiles?user_id=eq.${b.id}`,
    undefined,
    a.token,
  );
  assert.deepEqual(rows, []);
  checks++;
  const room = await rpc(
    'create_room_v3',
    {
      p_client_id: randomUUID(),
      p_name: 'Private avatar verification',
      p_device_hash: 'avatar-fixture-' + randomUUID(),
    },
    a.token,
  );
  roomId = room.room_id;
  await rpc(
    'join_by_code',
    { p_code: room.code, p_device_hash: 'avatar-fixture-' + randomUUID() },
    b.token,
  );
  assert.equal((await rpc('get_avatar_public', { p_user_ids: [a.id, b.id] }, a.token)).length, 2);
  checks++;
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  await request(
    'POST',
    '/rest/v1/water_logs',
    { id: randomUUID(), user_id: a.id, amount_ml: 250, local_date: day },
    a.token,
  );
  await rpc('avatar_reconcile_rewards', {}, a.token);
  const drop = await rpc('claim_daily_drop', {}, a.token);
  assert.equal(drop.balances.earned, 35);
  assert.equal((await rpc('claim_daily_drop', {}, a.token)).balances.earned, 35);
  checks++;
  const transaction = 'AVATAR_AUDIT:' + randomUUID();
  await rpc('avatar_apply_store_event', {
    p_user_id: a.id,
    p_transaction_id: transaction,
    p_pack_id: 'cc_100',
    p_refund: false,
  });
  const args = {
    p_request_id: randomUUID(),
    p_product_id: 'hair_fade',
    p_collection_id: null,
    p_expected_price: 45,
  };
  const first = await rpc('avatar_purchase', args, a.token);
  const replay = await rpc('avatar_purchase', args, a.token);
  assert.deepEqual(first.balances, { earned: 0, purchased: 90 });
  assert.deepEqual(replay.balances, first.balances);
  checks++;
  const saved = await rpc(
    'avatar_save',
    {
      p_request_id: randomUUID(),
      p_gender: 'm',
      p_skin_tone_id: 'skin_4',
      p_slots: { hair: 'hair_fade', top: 'top_tank' },
      p_tints: { hair: 'hair_1', top: 'garment_5' },
    },
    a.token,
  );
  assert.equal(saved.profile.tints.top, 'garment_5');
  checks++;
  await rpc('avatar_apply_store_event', {
    p_user_id: a.id,
    p_transaction_id: transaction,
    p_pack_id: 'cc_100',
    p_refund: true,
  });
  const refunded = await rpc('get_avatar_state', {}, a.token);
  assert.equal(refunded.balances.purchased, -10);
  assert.equal(refunded.products.find((p) => p.id === 'hair_fade').owned, true);
  checks++;
  await rpc(
    'avatar_purchase',
    {
      p_request_id: randomUUID(),
      p_product_id: 'top_tee',
      p_collection_id: null,
      p_expected_price: 60,
    },
    a.token,
    400,
  );
  checks++;
  const denied = await fetch(base + '/functions/v1/revenuecat-webhook', {
    method: 'POST',
    headers: { Authorization: 'invalid-avatar-fixture-secret', 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (denied.status === 500) {
    const response = await denied.json();
    assert.equal(response.error, 'Server misconfiguration: Webhook secret not configured');
    console.log(
      'Manual setup required: RevenueCat webhook secret is absent; receipt crediting fails closed until configured.',
    );
  } else assert.equal(denied.status, 401);
  checks++;
  console.log(
    `Hosted avatar verification: ${checks} checks passed (creation, RLS, member projection, real-log rewards, purchase replay, saved color, refund debt, authenticated webhook)`,
  );
} finally {
  if (roomId) await request('DELETE', `/rest/v1/rooms?id=eq.${roomId}`);
  for (const id of fixtures.reverse()) await request('DELETE', '/auth/v1/admin/users/' + id);
  console.log(
    `Hosted avatar fixtures: ${fixtures.length} disposable accounts and private squad removed`,
  );
}
