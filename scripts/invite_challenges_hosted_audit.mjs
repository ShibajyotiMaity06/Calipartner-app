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
const record = '.cache/invite-challenge-audit-users.json';
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
try {
  const suffix = String(Date.now()).slice(-8);
  for (let i = 0; i < 2; i++) {
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

  await plan(accounts[0], 'pro');
  const olderId = crypto.randomUUID();
  rooms.push(olderId);
  persist();
  await rpc(accounts[0].c, 'create_room_v3', {
    p_client_id: olderId,
    p_name: 'Older waiting room',
  });
  const inviteId = crypto.randomUUID();
  rooms.push(inviteId);
  persist();
  const invite = await rpc(accounts[0].c, 'prepare_onboarding_pair_invite', {
    p_client_id: inviteId,
    p_room_name: 'Invite acceptance audit',
  });
  assert.equal(
    (await rpc(accounts[0].c, 'get_my_rooms')).length,
    1,
    'Sharing consumes no additional hosted slot',
  );
  await fail(
    accounts[0].c,
    'accept_onboarding_pair_invite',
    { p_token: invite.token },
    /SELF_INVITE/,
  );
  const { harness } = await import('./rooms_profile_browser_audit.mjs');
  await harness({ ref, saved }, async ({ open }) => {
    const path = `/invite/${invite.token}`;
    const sender = await open(accounts[0], path);
    await sender.getByTestId('share-own-pair-invite').waitFor({ timeout: 60000 });
    assert.equal(await sender.getByTestId('accept-onboarding-pair').count(), 0);
    await sender.screenshot({ path: '.cache/invite-own-link.png', fullPage: true });
    const recipient = await open(accounts[1], path);
    await recipient.getByTestId('accept-onboarding-pair').waitFor({ timeout: 60000 });
    assert.equal((await rpc(accounts[1].c, 'get_my_rooms')).length, 0);
    await recipient.screenshot({ path: '.cache/invite-recipient-link.png', fullPage: true });
    await recipient.getByTestId('accept-onboarding-pair').click();
    await recipient.getByTestId('basic-room-summary').waitFor({ timeout: 60000 });
    assert((await recipient.url()).includes(`room=${inviteId}`));
    assert.equal((await rpc(accounts[0].c, 'get_my_rooms')).length, 2);
    assert.equal((await rpc(accounts[1].c, 'get_my_rooms')).length, 1);
    await rpc(accounts[1].c, 'accept_onboarding_pair_invite', { p_token: invite.token });
    assert.equal((await rpc(accounts[1].c, 'get_my_rooms')).length, 1);
    await sender.reload();
    await sender.getByTestId('open-invited-room').waitFor({ timeout: 60000 });
    assert.equal(await sender.getByTestId('accept-onboarding-pair').count(), 0);
    await sender.getByTestId('open-invited-room').click();
    await sender.getByTestId('hero-paired-card').waitFor({ timeout: 60000 });
    await sender.getByText('Invite acceptance audit', { exact: true }).waitFor();
    assert((await sender.url()).includes(`room=${inviteId}`));
    await recipient.goto(`http://127.0.0.1:8096${path}`);
    await recipient.getByTestId('open-invited-room').waitFor({ timeout: 60000 });
    assert.equal(await recipient.getByTestId('accept-onboarding-pair').count(), 0);
    await sender.goto('http://127.0.0.1:8096/progress?tab=challenges');
    await sender.getByTestId('progress-challenges-view-create-btn').waitFor({ timeout: 60000 });
    for (const width of [320, 390, 844]) {
      await sender.setViewportSize({ width, height: 844 });
      const metrics = await sender.getByTestId('progress-challenges-view').evaluate((el) => ({
        left: parseFloat(globalThis.getComputedStyle(el).paddingLeft),
        right: parseFloat(globalThis.getComputedStyle(el).paddingRight),
        width: el.scrollWidth,
        viewport: globalThis.innerWidth,
      }));
      assert(metrics.left >= 16 && metrics.right >= 16);
      assert(metrics.width <= metrics.viewport);
    }
    await sender.setViewportSize({ width: 390, height: 844 });
    await sender.screenshot({ path: '.cache/challenges-padding.png', fullPage: true });
    console.log(
      'PASS Browser: sender never sees Join; recipient explicitly joins once; both reopen exact room; Challenges gutters at 320/390/844',
    );
  });
} finally {
  await cleanup();
}
