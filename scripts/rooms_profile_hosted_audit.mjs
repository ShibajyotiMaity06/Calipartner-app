// Explicit hosted QA only: creates disposable users, exercises public APIs and the
// exported app, and removes its fixtures in finally. Never run as part of npm test.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { calculateGymTargets } from '../packages/core/src/gymTargets.ts';

const env = Object.fromEntries(
  fs
    .readFileSync('supabase/.env', 'utf8')
    .split(/\r?\n/)
    .filter((line) => /^\w+=/.test(line))
    .map((line) => {
      const i = line.indexOf('=');
      return [line.slice(0, i), line.slice(i + 1).replace(/^['"]|['"]$/g, '')];
    }),
);
const ref = env.SUPABASE_PROJECT_REF;
const keyResponse = await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys`, {
  headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}` },
});
if (!keyResponse.ok) throw new Error(`Key lookup failed: ${keyResponse.status}`);
const keys = await keyResponse.json();
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(
  `https://${ref}.supabase.co`,
  keys.find((k) => k.name === 'service_role').api_key,
  options,
);
const makeClient = () =>
  createClient(`https://${ref}.supabase.co`, keys.find((k) => k.name === 'anon').api_key, options);
const record = '.cache/profile-room-audit-users.json';
const saved = fs.existsSync(record)
  ? JSON.parse(fs.readFileSync(record, 'utf8'))
  : { accounts: [], rooms: [] };
const { accounts, rooms } = saved;
const persist = () =>
  fs.writeFileSync(
    record,
    JSON.stringify({
      ...saved,
      accounts: accounts.map((account) =>
        Object.fromEntries(Object.entries(account).filter(([key]) => key !== 'c')),
      ),
    }),
  );
const query = async (request) => {
  const result = await request;
  if (result.error) throw new Error(result.error.message);
  return result.data;
};
const rpc = (client, name, args = {}) => query(client.rpc(name, args));
const fail = (client, name, args, pattern) =>
  assert.rejects(() => rpc(client, name, args), pattern);
const plan = (a, tier, status = 'paid', expired = false) =>
  tier === 'free'
    ? query(admin.from('entitlements').delete().eq('user_id', a.id))
    : query(
        admin.from('entitlements').upsert({
          user_id: a.id,
          tier,
          status,
          source: 'none',
          plan: 'annual',
          period_end: new Date(Date.now() + (expired ? -1 : 365) * 86400000).toISOString(),
        }),
      );
async function cleanup() {
  for (const id of saved.mediaOwners ?? []) {
    const account = accounts.find((a) => a.id === id);
    if (!account?.session) throw new Error('Missing media cleanup session');
    const c = account.c ?? makeClient();
    await c.auth.setSession(account.session);
    const removed = await c.functions.invoke('chat-image-moderation', {
      body: { action: 'cleanup' },
    });
    if (removed.error || removed.data?.status !== 'deleted')
      throw new Error('R2 fixture cleanup failed; account retained for retry');
  }
  for (const id of rooms) await query(admin.from('rooms').delete().eq('id', id));
  for (const a of accounts) {
    await query(admin.from('rate_limit_buckets').delete().like('bucket_key', `%${a.id}%`));
    const removed = await admin.auth.admin.deleteUser(a.id);
    if (removed.error && removed.error.status !== 404) throw removed.error;
  }
  const checks = await Promise.all(accounts.map((a) => admin.auth.admin.getUserById(a.id)));
  for (const check of checks)
    assert.equal(check.data.user, null, 'Disposable Auth account must be gone');
  for (const table of [
    'profiles',
    'entitlements',
    'goal_profiles',
    'water_logs',
    'activity_days',
    'workouts',
    'food_entries',
  ]) {
    const field = table === 'profiles' ? 'id' : 'user_id';
    const data = await query(
      admin
        .from(table)
        .select(field)
        .in(
          field,
          accounts.map((a) => a.id),
        ),
    );
    assert.equal(data.length, 0, `${table} cleanup`);
  }
  if (fs.existsSync(record)) fs.unlinkSync(record);
  console.log(
    `PASS Cleanup verified: ${accounts.length} Auth accounts and their owned records; ${rooms.length} rooms deleted`,
  );
}
if (process.argv.includes('--cleanup')) {
  await cleanup();
  process.exit(0);
}
if (accounts.length)
  throw new Error('Previous audit fixtures remain. Run with --cleanup before another audit.');
let passed = 0;
const failures = [];
const test = async (name, fn) => {
  try {
    await fn();
    passed++;
    console.log(`PASS ${name}`);
  } catch (error) {
    failures.push({ name, error: error.message });
    console.log(`FAIL ${name}: ${error.message}`);
  }
};
try {
  const suffix = String(Date.now()).slice(-8);
  for (let i = 0; i < 22; i++) {
    const email = `room.profile.audit.${Date.now()}.${i}@example.com`;
    const password = crypto.randomBytes(24).toString('hex');
    const made = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (made.error) throw made.error;
    const a = {
      id: made.data.user.id,
      username: `rpa${suffix}${String(i).padStart(2, '0')}`,
      c: makeClient(),
    };
    accounts.push(a);
    persist();
    const login = await a.c.auth.signInWithPassword({ email, password });
    if (login.error) throw login.error;
    a.session = login.data.session;
    persist();
    await query(
      a.c.from('profiles').upsert({
        id: a.id,
        username: a.username,
        nickname: `Room audit ${String(i).padStart(2, '0')}`,
        date_of_birth: '1995-01-01',
        sex: 'male',
        height_cm: 175,
        timezone: 'UTC',
        country: 'IN',
        discoverable: true,
      }),
    );
    const now = new Date().toISOString();
    a.goal = ['maintain', 'bulk', 'cut'][i % 3];
    const targets = calculateGymTargets({
      goal: a.goal,
      sex: 'male',
      age: 31,
      heightCm: 175,
      weightKg: 70,
      gymDays: 3,
      activityLevel: 'moderate',
      weeklyRateKg: a.goal === 'maintain' ? 0 : 0.25,
    });
    await query(
      a.c.from('goal_profiles').upsert({
        id: crypto.randomUUID(),
        user_id: a.id,
        goal: a.goal,
        activity_level: 'moderate',
        gym_days: 3,
        input_height_cm: 175,
        current_weight_kg: 70,
        weekly_rate_kg: targets.weeklyRateKg,
        daily_calorie_target: targets.targetKcal,
        protein_grams: targets.macros.proteinGrams,
        fat_grams: targets.macros.fatGrams,
        carb_grams: targets.macros.carbGrams,
        bmr: targets.bmr,
        tdee: targets.tdee,
        effective_from: new Date(Date.now() - 86400000).toISOString(),
        confirmed_at: now,
      }),
    );
    const local_date = now.slice(0, 10);
    const water = { id: crypto.randomUUID(), user_id: a.id, amount_ml: 500, local_date };
    await query(a.c.from('water_logs').upsert(water));
    await query(a.c.from('water_logs').upsert(water));
    await query(
      a.c.from('activity_days').upsert(
        {
          id: crypto.randomUUID(),
          user_id: a.id,
          local_date,
          steps: 3000 + i * 100,
          source: 'manual',
        },
        { onConflict: 'user_id,local_date' },
      ),
    );
  }
  const [host, plus, trial, expired] = accounts;
  await plan(host, 'pro');
  await plan(plus, 'plus');
  await plan(trial, 'plus', 'trial');
  await plan(expired, 'pro', 'paid', true);
  await plan(accounts[4], 'pro');
  await plan(accounts[6], 'pro', 'grace');
  await plan(accounts[7], 'pro', 'trial');
  await plan(accounts[8], 'plus', 'lapsed');
  await plan(accounts[20], 'plus');
  const roomId = crypto.randomUUID();
  rooms.push(roomId);
  persist();
  const room = await rpc(host.c, 'create_room_v3', {
    p_client_id: roomId,
    p_name: '20-person room audit',
  });
  saved.group = room;
  persist();
  await test('Room creation retries preserve one room and pending snapshot has only the host', async () => {
    assert.equal(
      (await rpc(host.c, 'create_room_v3', { p_client_id: roomId, p_name: '20-person room audit' }))
        .room_id,
      roomId,
    );
    const snapshot = await rpc(host.c, 'get_room_snapshot', { p_room_id: roomId });
    assert.equal(snapshot.members.length, 1);
    assert.equal(snapshot.room.state, 'dormant');
  });
  if (process.argv.includes('--browser') && !process.argv.includes('--chat-only')) {
    const { pendingBrowser } = await import('./rooms_profile_browser_audit.mjs');
    await pendingBrowser({ ref, saved });
  }
  await test('Explicit invitation acceptance adds a member once, then code joins fill exactly 20 places', async () => {
    await rpc(host.c, 'send_room_invitation', { p_room_id: roomId, p_username: plus.username });
    const [invite] = await query(
      plus.c
        .from('room_requests')
        .select('id')
        .eq('room_id', roomId)
        .eq('recipient_id', plus.id)
        .eq('status', 'pending'),
    );
    await fail(
      expired.c,
      'respond_to_request',
      { p_request_id: invite.id, p_accept: true },
      /NOT_AUTHORIZED/,
    );
    await rpc(plus.c, 'respond_to_request', { p_request_id: invite.id, p_accept: true });
    await rpc(plus.c, 'respond_to_request', { p_request_id: invite.id, p_accept: true });
    for (const a of accounts.slice(2, 20)) await rpc(a.c, 'join_by_code', { p_code: room.code });
    await rpc(accounts[19].c, 'join_by_code', { p_code: room.code });
    const snap = await rpc(host.c, 'get_room_snapshot', { p_room_id: roomId });
    assert.equal(snap.members.length, 20);
    assert.equal(snap.room.is_large_room, true);
    await fail(accounts[20].c, 'join_by_code', { p_code: room.code }, /ROOM_FULL/);
  });
  await test('20-person snapshots preserve privacy, pagination, search and base-table RLS', async () => {
    const snapshot = await rpc(host.c, 'get_room_snapshot', { p_room_id: roomId });
    for (const m of snapshot.members.filter((m) => m.user_id !== host.id)) {
      assert.equal(m.metrics.calories, 'locked');
      assert.equal(m.metrics.weight_kg, 'locked');
    }
    const a = await rpc(host.c, 'get_room_snapshot', {
      p_room_id: roomId,
      p_page: 1,
      p_page_size: 10,
    });
    const b = await rpc(host.c, 'get_room_snapshot', {
      p_room_id: roomId,
      p_page: 2,
      p_page_size: 10,
    });
    assert.equal(new Set([...a.members, ...b.members].map((m) => m.user_id)).size, 20);
    const search = await rpc(host.c, 'get_room_snapshot', {
      p_room_id: roomId,
      p_search: accounts[19].username,
    });
    assert.equal(search.members.length, 1);
    for (const table of ['goal_profiles', 'water_logs', 'activity_days', 'weight_logs', 'workouts'])
      assert.equal((await query(host.c.from(table).select('*').eq('user_id', plus.id))).length, 0);
    await fail(accounts[20].c, 'get_room_snapshot', { p_room_id: roomId }, /NOT_ROOM_MEMBER/);
    await rpc(plus.c, 'set_privacy', {
      p_room_id: roomId,
      p_privacy_settings: { share_steps: false, share_water: false, share_goal_completion: false },
    });
    const hidden = (await rpc(host.c, 'get_room_snapshot', { p_room_id: roomId })).members.find(
      (m) => m.user_id === plus.id,
    );
    for (const field of ['steps', 'water_ml', 'goal_completion'])
      assert.equal(hidden.metrics[field], 'locked');
  });
  await test('Chat sends are idempotent; Plus/Pro/trial can read, Free/expired/outsiders cannot', async () => {
    await rpc(host.c, 'accept_chat_terms');
    const args = {
      p_room_id: roomId,
      p_client_id: crypto.randomUUID(),
      p_text: 'Hosted room audit message',
    };
    await rpc(host.c, 'send_chat_message', args);
    await rpc(host.c, 'send_chat_message', args);
    for (const a of [host, plus, trial])
      assert.equal(
        (await rpc(a.c, 'get_chat_messages', { p_room_id: roomId })).filter(
          (m) => m.text === args.p_text,
        ).length,
        1,
      );
    for (const a of [accounts[5], expired]) {
      await fail(a.c, 'get_chat_messages', { p_room_id: roomId }, /PLUS_REQUIRED/);
      assert.equal(
        (await query(a.c.from('chat_messages').select('id').eq('room_id', roomId))).length,
        0,
      );
    }
    await fail(accounts[20].c, 'get_chat_messages', { p_room_id: roomId }, /NOT_ROOM_MEMBER/);
  });
  await test('Large-room progress selects a bounded chart and supports member search; Free is gated', async () => {
    const data = await rpc(host.c, 'get_room_progress', { p_room_id: roomId, p_range: '7d' });
    assert.equal(data.total_members, 20);
    for (const series of Object.values(data.members_series)) assert(series.length <= 8);
    assert.equal(
      (
        await rpc(host.c, 'search_room_members_for_progress', {
          p_room_id: roomId,
          p_query: accounts[19].username,
        })
      ).length,
      1,
    );
    await fail(accounts[5].c, 'get_room_progress', { p_room_id: roomId }, /PLUS_REQUIRED/);
  });
  await test('Explicit workout sharing retries once and respects privacy toggles retroactively', async () => {
    const workout = crypto.randomUUID();
    saved.workout = workout;
    persist();
    await query(
      host.c.from('workouts').upsert({
        id: workout,
        user_id: host.id,
        name: 'Room audit strength',
        type: 'strength',
        duration_minutes: 30,
        local_date: new Date().toISOString().slice(0, 10),
      }),
    );
    const args = { p_client_id: crypto.randomUUID(), p_room_id: roomId, p_workout_id: workout };
    await rpc(host.c, 'share_room_workout', args);
    await rpc(host.c, 'share_room_workout', args);
    assert.equal((await rpc(plus.c, 'get_room_workout_shares', { p_room_id: roomId })).length, 1);
    await rpc(host.c, 'set_privacy', {
      p_room_id: roomId,
      p_privacy_settings: { share_workouts: false },
    });
    assert.equal((await rpc(plus.c, 'get_room_workout_shares', { p_room_id: roomId })).length, 0);
    await rpc(host.c, 'set_privacy', {
      p_room_id: roomId,
      p_privacy_settings: { share_workouts: true },
    });
  });
  const pairHost = accounts[21],
    pairMember = accounts[19];
  await test('Free one-on-one invitation requires acceptance, creates one pair, rejects a third person', async () => {
    const pairId = crypto.randomUUID();
    rooms.push(pairId);
    persist();
    const pending = await rpc(pairHost.c, 'prepare_onboarding_pair_invite', {
      p_client_id: pairId,
      p_room_name: 'One-on-one audit',
    });
    assert.equal(await rpc(pairHost.c, 'can_create_room', { p_user_id: pairHost.id }), true);
    const pair = await rpc(pairMember.c, 'accept_onboarding_pair_invite', {
      p_token: pending.token,
    });
    saved.pair = pair;
    persist();
    assert.equal(
      (await rpc(pairMember.c, 'accept_onboarding_pair_invite', { p_token: pending.token }))
        .room_id,
      pair.room_id,
    );
    assert.equal(
      (await rpc(pairHost.c, 'get_room_snapshot', { p_room_id: pair.room_id })).members.length,
      2,
    );
    const full = await query(admin.from('rooms').select('code').eq('id', pair.room_id).single());
    await fail(accounts[20].c, 'join_by_code', { p_code: full.code }, /ROOM_FULL/);
  });
  await test('Community suggestions are capped and match current goal; username search crosses goals', async () => {
    const suggestions = await rpc(host.c, 'browse_social_profiles');
    assert(suggestions.length <= 5);
    assert.equal(
      (
        await rpc(host.c, 'browse_social_profiles', {
          p_after: suggestions.at(-1)?.username ?? 'anything',
        })
      ).length,
      0,
    );
    const found = await rpc(host.c, 'browse_social_profiles', { p_query: plus.username });
    assert.equal(found[0].id, plus.id);
    const fixtureSuggestions = suggestions.filter((p) => accounts.some((a) => a.id === p.id));
    for (const p of fixtureSuggestions)
      assert.equal(accounts.find((a) => a.id === p.id).goal, host.goal);
    assert.equal(
      (await query(host.c.from('water_logs').select('id').eq('user_id', host.id))).length,
      1,
    );
  });
  await test('Pro hosts five rooms, Plus hosts three; odd/even rooms preserve independent snapshots and quotas', async () => {
    saved.proRooms = [{ id: roomId, name: '20-person room audit', count: 20 }];
    saved.plusRooms = [];
    for (const count of [2, 3, 4, 5]) {
      const id = crypto.randomUUID();
      rooms.push(id);
      persist();
      const name = `Pro matrix ${count} people`;
      const created = await rpc(host.c, 'create_room_v3', { p_client_id: id, p_name: name });
      for (const member of accounts.slice(4, 4 + count - 1))
        await rpc(member.c, 'join_by_code', { p_code: created.code });
      assert.equal(
        (await rpc(host.c, 'get_room_snapshot', { p_room_id: id })).members.length,
        count,
      );
      saved.proRooms.push({ id, name, count });
      persist();
    }
    await fail(
      host.c,
      'create_room_v3',
      { p_client_id: crypto.randomUUID(), p_name: 'Excess Pro room' },
      /HOSTED_ROOM_LIMIT/,
    );
    for (const count of [1, 2, 5]) {
      const id = crypto.randomUUID();
      rooms.push(id);
      persist();
      const name = `Plus matrix ${count} people`;
      const created = await rpc(plus.c, 'create_room_v3', { p_client_id: id, p_name: name });
      for (const member of accounts.slice(10, 10 + count - 1))
        await rpc(member.c, 'join_by_code', { p_code: created.code });
      saved.plusRooms.push({ id, name, count });
      persist();
    }
    await fail(
      plus.c,
      'create_room_v3',
      { p_client_id: crypto.randomUUID(), p_name: 'Excess Plus room' },
      /HOSTED_ROOM_LIMIT/,
    );
  });
  await test('Hosted room social actions use real events and preserve retry and meal consent', async () => {
    await query(
      plus.c.from('workouts').upsert({
        id: crypto.randomUUID(),
        user_id: plus.id,
        name: 'Real audit workout',
        type: 'strength',
        duration_minutes: 20,
        local_date: new Date().toISOString().slice(0, 10),
      }),
    );
    const nudge = {
      p_client_id: crypto.randomUUID(),
      p_room_id: roomId,
      p_recipient_id: plus.id,
      p_message: 'Room audit check-in',
    };
    await rpc(host.c, 'send_room_nudge_v2', nudge);
    await rpc(host.c, 'send_room_nudge_v2', nudge);
    await rpc(host.c, 'react_to_room_member', {
      p_room_id: roomId,
      p_target_user_id: plus.id,
      p_reaction: 'clap',
    });
    const mealId = crypto.randomUUID();
    saved.foodEntry = mealId;
    persist();
    await query(
      host.c.from('food_entries').upsert({
        id: mealId,
        user_id: host.id,
        food_name: 'Audit rice',
        meal_section: 'lunch',
        quantity: 100,
        unit: 'g',
        calories: 200,
        protein: 10,
        carbs: 30,
        fat: 5,
        fiber: 4,
        sugar: 3,
        sodium_mg: 20,
        local_date: new Date().toISOString().slice(0, 10),
        source: 'search',
      }),
    );
    await rpc(host.c, 'set_privacy', {
      p_room_id: roomId,
      p_privacy_settings: { share_meals: 'per_meal', share_calories_macros: true },
    });
    const args = {
      p_client_id: crypto.randomUUID(),
      p_room_id: roomId,
      p_food_entry_id: mealId,
      p_participant_user_ids: [plus.id, accounts[5].id],
    };
    await rpc(host.c, 'share_room_meal', args);
    await rpc(host.c, 'share_room_meal', args);
    saved.pendingMeal = args.p_client_id;
    persist();
    assert.equal((await rpc(plus.c, 'get_pending_room_meals', { p_room_id: roomId })).length, 1);
    const accepted = await rpc(accounts[5].c, 'respond_shared_meal', {
      p_shared_meal_id: args.p_client_id,
      p_accept: true,
      p_quantity: 150,
      p_meal_section: 'dinner',
    });
    const retry = await rpc(accounts[5].c, 'respond_shared_meal', {
      p_shared_meal_id: args.p_client_id,
      p_accept: true,
      p_quantity: 150,
      p_meal_section: 'dinner',
    });
    assert.equal(accepted.diary_entry_id, retry.diary_entry_id);
  });
  if (process.argv.includes('--browser') && !process.argv.includes('--chat-only')) {
    const { runRoomsBrowser } = await import('./rooms_profile_browser_audit.mjs');
    await runRoomsBrowser({
      ref,
      saved,
      plan: (index, tier, status = 'paid') => plan(accounts[index], tier, status),
    });
  }
  if (process.argv.includes('--browser')) {
    const { runChatHostedBrowser } = await import('./rooms_chat_browser_audit.mjs');
    await test('Concurrent hosted chat, typing, private photos/videos and cleanup', () =>
      runChatHostedBrowser({
        ref,
        saved,
        persist,
        rpc,
        admin,
        query,
        plan: (index, tier, status = 'paid') => plan(accounts[index], tier, status),
      }));
  }
  await test('Leaving releases capacity, rejects former-member reads and lets a replacement join', async () => {
    await rpc(accounts[18].c, 'leave_room', { p_room_id: roomId });
    await fail(accounts[18].c, 'get_room_snapshot', { p_room_id: roomId }, /NOT_ROOM_MEMBER/);
    if (process.argv.includes('--browser') && !process.argv.includes('--chat-only')) {
      const { runRoomManagementBrowser } = await import('./rooms_profile_browser_audit.mjs');
      await runRoomManagementBrowser({ ref, saved, rpc });
    }
    await rpc(accounts[20].c, 'join_by_code', { p_code: room.code });
    assert.equal(
      (await rpc(host.c, 'get_room_snapshot', { p_room_id: roomId })).members.length,
      20,
    );
    await rpc(pairHost.c, 'leave_room', { p_room_id: saved.pair.room_id });
    assert.equal(await rpc(pairHost.c, 'can_create_room', { p_user_id: pairHost.id }), true);
  });
  console.log(`Hosted room/profile tests: ${passed} passed, ${failures.length} failed`);
  fs.writeFileSync('.cache/profile-room-results.json', JSON.stringify({ passed, failures }));
  if (failures.length) process.exitCode = 1;
} finally {
  await cleanup();
}
