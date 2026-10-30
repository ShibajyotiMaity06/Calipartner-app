// Explicit hosted regression audit: npx tsx scripts/logging_settings_hosted_audit.mjs
// Uses disposable accounts, records fixture IDs and cleans up in finally.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { calculateGymTargets } from '../packages/core/src/gymTargets.ts';
import { harness } from './rooms_profile_browser_audit.mjs';

const env = Object.fromEntries(
  fs
    .readFileSync('supabase/.env', 'utf8')
    .split(/\r?\n/)
    .filter((l) => /^\w+=/.test(l))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i), l.slice(i + 1).replace(/^['"]|['"]$/g, '')];
    }),
);
const ref = env.SUPABASE_PROJECT_REF;
const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys`, {
  headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}` },
});
if (!response.ok) throw new Error(`Key lookup: ${response.status}`);
const keys = await response.json();
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const client = (key) =>
  createClient(`https://${ref}.supabase.co`, keys.find((k) => k.name === key).api_key, options);
const admin = client('service_role');
const record = '.cache/logging-settings-audit-users.json';
const saved = fs.existsSync(record)
  ? JSON.parse(fs.readFileSync(record, 'utf8'))
  : { accounts: [], rooms: [], challenges: [] };
const { accounts, rooms, challenges } = saved;
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
  const r = await request;
  if (r.error) throw new Error(r.error.message);
  return r.data;
};
const rpc = (c, name, args = {}) => query(c.rpc(name, args));
const api = async (c, body) => {
  const r = await c.functions.invoke('challenges-api', { body });
  if (r.error) throw new Error(JSON.stringify(await r.error.context?.json().catch(() => null)));
  return r.data;
};
async function cleanup() {
  for (const id of challenges) await query(admin.from('challenges').delete().eq('id', id));
  for (const id of rooms) await query(admin.from('rooms').delete().eq('id', id));
  for (const a of accounts) {
    await query(admin.from('challenge_events').delete().eq('actor_id', a.id));
    const r = await admin.auth.admin.deleteUser(a.id);
    if (r.error && r.error.status !== 404) throw r.error;
  }
  if (fs.existsSync(record)) fs.unlinkSync(record);
  accounts.length = rooms.length = challenges.length = 0;
  console.log('PASS Hosted audit cleanup: disposable accounts, rooms and challenges removed');
}
if (accounts.length) await cleanup();
process.env.ROOM_AUDIT_EXPORT = '.cache/repair-web-export';
try {
  for (let i = 0; i < 2; i++) {
    const email = `logging-${Date.now()}-${i}@example.com`,
      password = crypto.randomUUID();
    const user = await query(admin.auth.admin.createUser({ email, password, email_confirm: true }));
    const a = { id: user.user.id, username: `qa_${Date.now()}_${i}`, c: client('anon') };
    accounts.push(a);
    persist();
    a.session = (await query(a.c.auth.signInWithPassword({ email, password }))).session;
    persist();
    await query(
      a.c.from('profiles').upsert({
        id: a.id,
        username: a.username,
        nickname: `Logging audit ${i}`,
        date_of_birth: '1995-01-01',
        sex: 'male',
        height_cm: 175,
        timezone: 'America/New_York',
        discoverable: true,
      }),
    );
    const plan = calculateGymTargets({
      goal: 'cut',
      sex: 'male',
      age: 31,
      heightCm: 175,
      weightKg: 80,
      gymDays: 3,
      activityLevel: 'moderate',
      weeklyRateKg: 0.25,
    });
    await query(
      a.c.from('goal_profiles').upsert({
        id: crypto.randomUUID(),
        user_id: a.id,
        goal: 'cut',
        activity_level: 'moderate',
        gym_days: 3,
        input_height_cm: 175,
        current_weight_kg: 80,
        weekly_rate_kg: plan.weeklyRateKg,
        daily_calorie_target: plan.targetKcal,
        protein_grams: plan.macros.proteinGrams,
        fat_grams: plan.macros.fatGrams,
        carb_grams: plan.macros.carbGrams,
        bmr: plan.bmr,
        tdee: plan.tdee,
        effective_from: new Date(Date.now() - 86400000).toISOString(),
        confirmed_at: new Date().toISOString(),
      }),
    );
  }
  const [a, b] = accounts;
  const home = await api(a.c, { action: 'home' });
  const template = home.catalog.templates.find((t) => t.slug === 'log-it');
  const id = crypto.randomUUID();
  challenges.push(id);
  persist();
  await api(a.c, {
    action: 'create',
    id,
    template_id: template.id,
    scope: 'solo',
    duration: 7,
    partners: [],
  });
  assert.ok((await api(a.c, { action: 'home' })).items.length);
  console.log('PASS Hosted challenges: empty and active home load');
  await harness({ ref, saved }, async ({ open }) => {
    const page = await open(a, '/log?flow=weight');
    await page.getByTestId('input-weight-value').fill('79.5');
    await page.getByTestId('input-weight-date').fill('2026-10-29');
    await page.getByTestId('input-weight-notes').fill('Morning check-in');
    await page.getByTestId('btn-weight-save').click();
    await page.getByTestId('modal-weight-entry').waitFor({ state: 'hidden' });
    const weights = await page.evaluate(
      () => JSON.parse(globalThis.localStorage.getItem('calipartner_web_db')).local_weight_logs,
    );
    assert.equal(weights.length, 1);
    assert.equal(weights[0].local_date, '2026-10-29');
    assert.equal(weights[0].notes, 'Morning check-in');
    console.log('PASS Browser weight: entered date and notes persist in the correct fields');
    await page.goto('http://127.0.0.1:8096/friends');
    await page.getByTestId('friend-username-search').fill(b.username);
    await page.getByText(`@${b.username}`, { exact: true }).first().click();
    await page.getByTestId('send-friend-request').click();
    await page.getByTestId('cancel-friend-request').waitFor();
    const inbox = await rpc(b.c, 'get_friend_inbox');
    assert.equal(inbox.incoming.length, 1);
    await rpc(b.c, 'respond_friend_request', {
      p_actor_id: b.id,
      p_request_id: inbox.incoming[0].request_id,
      p_action: 'accept',
    });
    console.log('PASS Browser friends: search and send reach recipient inbox');
    await page.goto('http://127.0.0.1:8096/progress?tab=challenges');
    await page.getByTestId('progress-challenges-view-create-btn').waitFor();
    console.log('PASS Browser challenges: real active challenge screen loads');
    await page.goto('http://127.0.0.1:8096/me');
    await page.getByTestId('row-goals-body').click();
    await page.getByTestId('height-unit-ft').click();
    await page.getByTestId('btn-close-goals-body').click();
    assert.equal(
      await page
        .getByText('Your goals could not refresh. Your saved plan is still on this phone.')
        .count(),
      0,
    );
    await page.getByTestId('row-custom-macros').click();
    assert.equal(await page.getByTestId('custom-macros-override').count(), 0);
    await page.getByTestId('custom-macros-keep').click();
    await query(
      admin.from('entitlements').upsert({
        user_id: a.id,
        tier: 'plus',
        status: 'paid',
        period_end: new Date(Date.now() + 86400000).toISOString(),
      }),
    );
    const before = (
      await query(
        a.c
          .from('goal_profiles')
          .select('*')
          .order('effective_from', { ascending: false })
          .limit(1),
      )
    )[0];
    await page.getByTestId('row-custom-macros').click();
    await page.getByTestId('custom-macros-protein').fill('150');
    await page.getByTestId('custom-macros-carbs').fill('225');
    await page.getByTestId('custom-macros-fat').fill('60');
    await page.getByTestId('custom-macros-keep').click();
    assert.equal(
      (
        await query(
          a.c
            .from('goal_profiles')
            .select('id')
            .order('effective_from', { ascending: false })
            .limit(1),
        )
      )[0].id,
      before.id,
    );
    await page.getByTestId('row-custom-macros').click();
    await page.getByTestId('custom-macros-protein').fill('150');
    await page.getByTestId('custom-macros-carbs').fill('225');
    await page.getByTestId('custom-macros-fat').fill('60');
    await page.getByTestId('custom-macros-override').click();
    await page.getByTestId('custom-macros-modal').waitFor({ state: 'hidden' });
    const after = (
      await query(
        a.c
          .from('goal_profiles')
          .select('*')
          .order('effective_from', { ascending: false })
          .limit(1),
      )
    )[0];
    assert.equal(after.daily_calorie_target, 2040);
    assert.equal(after.custom_macros, true);
    await page.reload();
    await page.getByTestId('row-custom-macros').click();
    await page.getByTestId('custom-macros-protein').waitFor();
    assert.equal(await page.getByTestId('custom-macros-protein').inputValue(), '150');
    await page.screenshot({ path: '.cache/custom-macros-audit.png', fullPage: true });
    console.log(
      'PASS Browser goals: back navigation, Free gate, Plus keep/override and restart persistence',
    );
    await page.getByTestId('custom-macros-keep').click();
    const roomId = crypto.randomUUID();
    rooms.push(roomId);
    persist();
    await rpc(a.c, 'create_room_v3', { p_client_id: roomId, p_name: 'Logging names audit' });
    const invitation = await rpc(a.c, 'send_room_invitation', {
      p_room_id: roomId,
      p_username: b.username,
    });
    const identities = await rpc(b.c, 'get_request_identities', {
      p_request_ids: [invitation.request_id],
    });
    assert.ok(identities.some((person) => person.nickname === 'Logging audit 0'));
    const recipient = await open(b, '/me');
    await recipient.getByTestId('btn-me-requests-bell').click();
    await recipient.getByText('From Logging audit 0', { exact: true }).waitFor();
    console.log('PASS Browser invitation inbox: recipient sees the actual sender name');
  });
} finally {
  await cleanup();
}
