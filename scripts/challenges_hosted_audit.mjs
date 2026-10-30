// Explicit integration audit. Creates only two disposable Auth accounts; all IDs are durably
// recorded before further writes. No real users, catalogue rules or season clocks are changed.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
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
const ref = env.SUPABASE_PROJECT_REF,
  url = `https://${ref}.supabase.co`;
const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys`, {
  headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}` },
});
if (!response.ok) throw new Error(`Key lookup: ${response.status}`);
const keys = await response.json();
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, keys.find((k) => k.name === 'service_role').api_key, options);
const client = () => createClient(url, keys.find((k) => k.name === 'anon').api_key, options);
const record = '.cache/challenge-audit-users.json';
const saved = fs.existsSync(record)
  ? JSON.parse(fs.readFileSync(record, 'utf8'))
  : { accounts: [], rooms: [], challenges: [] };
const accounts = saved.accounts,
  rooms = saved.rooms,
  challenges = saved.challenges;
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
export const rpc = async (c, name, args = {}) => {
  const { data, error } = await c.rpc(name, args);
  if (error) throw new Error(`${name}: ${error.message}`);
  return data;
};
const query = async (p) => {
  const result = await p;
  if (result.error) throw new Error(result.error.message);
  return result.data;
};
const api = async (c, body, expectedError) => {
  const { data, error } = await c.functions.invoke('challenges-api', { body });
  let json = data;
  if (error?.context) json = await error.context.json().catch(() => ({}));
  if (expectedError) {
    assert.equal(json?.error, expectedError);
    return json;
  }
  if (error || json?.error)
    throw new Error(`challenges-api ${body.action}: ${json?.error ?? String(error)}`);
  return json;
};
async function cleanup() {
  await query(
    admin
      .from('challenge_events')
      .delete()
      .in(
        'actor_id',
        accounts.map((a) => a.id),
      ),
  );
  for (const id of challenges) await query(admin.from('challenges').delete().eq('id', id));
  for (const id of rooms) await query(admin.from('rooms').delete().eq('id', id));
  for (const account of accounts) {
    const buckets = await query(
      admin.from('rate_limit_buckets').select('bucket_key').like('bucket_key', `%${account.id}%`),
    );
    if (buckets.length)
      await query(
        admin
          .from('rate_limit_buckets')
          .delete()
          .in(
            'bucket_key',
            buckets.map((b) => b.bucket_key),
          ),
      );
    const r = await admin.auth.admin.deleteUser(account.id);
    if (r.error && r.error.status !== 404) throw r.error;
  }
  if (fs.existsSync(record)) fs.unlinkSync(record);
  console.log('PASS Cleanup: all disposable accounts, rooms and challenge instances removed');
}
if (process.argv[2] === 'cleanup') {
  await cleanup();
  process.exit(0);
}
if (process.argv[2] === 'cleanup-browser') {
  const baseline =
    saved.api_challenge_ids ?? saved.challenges.slice(0, (saved.results?.length ?? 0) + 2);
  for (const id of saved.challenges.filter((id) => !baseline.includes(id))) {
    const row = await query(
      admin.from('challenges').select('creator_id').eq('id', id).maybeSingle(),
    );
    if (row && !accounts.some((a) => a.id === row.creator_id))
      throw new Error('Refusing to remove a non-audit challenge');
    await query(admin.from('challenges').delete().eq('id', id));
  }
  saved.challenges = baseline;
  saved.api_challenge_ids = baseline;
  fs.writeFileSync(record, JSON.stringify(saved));
  await query(
    admin
      .from('rate_limit_buckets')
      .delete()
      .in(
        'bucket_key',
        accounts.map((a) => `challenge_create:${a.id}`),
      ),
  );
  console.log(
    'PASS Browser fixtures and their own creation rate limits reset; API fixtures preserved',
  );
  process.exit(0);
}
if (accounts.length)
  throw new Error(
    'A previous audit has disposable data pending cleanup. Run this script with cleanup first.',
  );
let passed = false;
try {
  const suffix = String(Date.now()).slice(-8);
  for (let i = 0; i < 2; i++) {
    const email = `challenges.audit.${Date.now()}.${i}@example.com`,
      password = crypto.randomBytes(24).toString('hex');
    const made = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (made.error) throw made.error;
    const id = made.data.user.id,
      c = client();
    const account = { id, username: `chaudit${suffix}${i}` };
    accounts.push(account);
    persist();
    const login = await c.auth.signInWithPassword({ email, password });
    if (login.error) throw login.error;
    Object.assign(account, { session: login.data.session });
    persist();
    account.c = c;
    await query(
      c.from('profiles').upsert({
        id,
        username: account.username,
        nickname: i ? 'Audit partner' : 'Audit host',
        date_of_birth: '1995-01-01',
        sex: 'male',
        height_cm: 175,
        timezone: 'UTC',
        country: 'IN',
        discoverable: true,
      }),
    );
    const now = new Date().toISOString();
    await query(
      c.from('goal_profiles').upsert({
        id: crypto.randomUUID(),
        user_id: id,
        goal: 'maintain',
        activity_level: 'moderate',
        gym_days: 3,
        input_height_cm: 175,
        current_weight_kg: 70,
        weekly_rate_kg: 0,
        daily_calorie_target: 2500,
        protein_grams: 154,
        fat_grams: 84,
        carb_grams: 282,
        bmr: 1700,
        tdee: 2500,
        effective_from: new Date(Date.now() - 14 * 86400000).toISOString(),
        confirmed_at: now,
      }),
    );
  }
  const [a, b] = accounts;
  const pairId = crypto.randomUUID();
  const invitation = await rpc(a.c, 'prepare_onboarding_pair_invite', {
    p_client_id: pairId,
    p_room_name: 'Audit training pair',
  });
  assert.equal(await rpc(a.c, 'can_create_room', { p_user_id: a.id }), true);
  const room = await rpc(b.c, 'accept_onboarding_pair_invite', { p_token: invitation.token });
  rooms.push(room.room_id);
  saved.pairToken = invitation.token;
  persist();
  assert.equal(await rpc(a.c, 'can_create_room', { p_user_id: a.id }), false);
  assert.equal(
    (await rpc(b.c, 'accept_onboarding_pair_invite', { p_token: invitation.token })).room_id,
    room.room_id,
  );
  const friend = crypto.randomUUID();
  await rpc(a.c, 'send_friend_request', {
    p_actor_id: a.id,
    p_request_id: friend,
    p_recipient_id: b.id,
  });
  await rpc(b.c, 'respond_friend_request', {
    p_actor_id: b.id,
    p_request_id: friend,
    p_action: 'accept',
  });
  let home = await api(a.c, { action: 'home' });
  assert.equal(home.catalog.plan, 'free');
  assert.equal(home.items.length, 0);
  assert.ok(home.catalog.partners.some((p) => p.id === b.id));
  const templates = home.catalog.templates;
  const cfg = home.catalog.config;
  const step = templates.find((t) => t.slug === 'daily-steps');
  const id = crypto.randomUUID();
  challenges.push(id);
  persist();
  const create = {
    action: 'create',
    id,
    template_id: step.id,
    scope: 'pair',
    duration: 7,
    partners: [b.id],
  };
  await api(a.c, create);
  await api(a.c, create);
  await api(a.c, { ...create, id: crypto.randomUUID() }, 'CHALLENGE_LIMIT');
  let detail = await api(b.c, { action: 'detail', id });
  assert.equal(detail.self.status, 'invited');
  assert.equal(detail.participants.find((p) => !p.self).percent, 'locked');
  assert.equal(detail.participants.find((p) => !p.self).days, null);
  await api(b.c, { action: 'respond', id, accept: true });
  await api(b.c, { action: 'respond', id, accept: true });
  detail = await api(a.c, { action: 'detail', id });
  assert.equal(detail.challenge.status, 'scheduled');
  assert.ok(detail.self.targets.steps > 0);
  await api(a.c, { action: 'analytics' }, 'NOT_AUTHORIZED');
  await api(a.c, {
    action: 'social',
    id,
    request_id: crypto.randomUUID(),
    kind: 'nudge',
    target: b.id,
  });
  await api(
    a.c,
    { action: 'social', id, request_id: crypto.randomUUID(), kind: 'nudge', target: b.id },
    'NUDGE_LIMIT',
  );
  await api(b.c, {
    action: 'social',
    id,
    request_id: crypto.randomUUID(),
    kind: 'comparison',
    value: { enabled: true },
  });
  detail = await api(a.c, { action: 'detail', id });
  assert.equal(detail.participants.find((p) => !p.self).percent, 'locked');
  await api(b.c, {
    action: 'social',
    id,
    request_id: crypto.randomUUID(),
    kind: 'comparison',
    value: { enabled: false },
  });
  for (const account of accounts)
    await query(
      admin.from('entitlements').upsert(
        {
          user_id: account.id,
          tier: 'plus',
          period: 'annual',
          source: 'apple',
          status: 'paid',
          period_end: new Date(Date.now() + 86400000).toISOString(),
        },
        { onConflict: 'user_id' },
      ),
    );
  // End the initial invitation before running each independent template fixture.
  const leave = crypto.randomUUID();
  await api(a.c, { action: 'social', id, request_id: leave, kind: 'leave' });
  await api(a.c, { action: 'social', id, request_id: leave, kind: 'leave' });
  await api(b.c, { action: 'social', id, request_id: crypto.randomUUID(), kind: 'leave' });
  const now = new Date(home.catalog.now);
  const day = (offset) => new Date(now.getTime() + offset * 86400000).toISOString().slice(0, 10);
  for (const account of accounts) {
    for (let offset = -8; offset <= 0; offset++) {
      const local = day(offset);
      await query(
        account.c.from('activity_days').upsert(
          {
            id: crypto.randomUUID(),
            user_id: account.id,
            local_date: local,
            steps: 20000,
            distance_m: 20000,
            source: 'manual',
            active_calories: 0,
          },
          { onConflict: 'user_id,local_date' },
        ),
      );
      await query(
        account.c.from('water_logs').upsert({
          id: crypto.randomUUID(),
          user_id: account.id,
          local_date: local,
          amount_ml: 3500,
          logged_at: `${local}T10:00:00Z`,
        }),
      );
      await query(
        account.c.from('workouts').upsert({
          id: crypto.randomUUID(),
          user_id: account.id,
          type: 'strength',
          name: 'Audit workout',
          local_date: local,
          duration_minutes: 60,
        }),
      );
      for (const meal of ['breakfast', 'lunch', 'dinner'])
        await query(
          account.c.from('food_entries').upsert({
            id: crypto.randomUUID(),
            user_id: account.id,
            source: 'search',
            food_name: 'Audit meal',
            meal_section: meal,
            quantity: 1,
            unit: 'serving',
            calories: 500,
            protein: 50,
            carbs: 50,
            fat: 10,
            local_date: local,
            logged_at: `${local}T10:00:00Z`,
          }),
        );
    }
  }
  let index = 0;
  const results = [];
  for (const template of templates.filter((t) => !t.season_id)) {
    const host = index++ < 8 ? a : b,
      peer = host === a ? b : a,
      challenge = crypto.randomUUID();
    challenges.push(challenge);
    persist();
    const duration = template.duration_options[0];
    const targets = Object.fromEntries(
      template.tasks.map((metric) => [metric, cfg.rules.metrics[metric].fallback.default]),
    );
    await api(host.c, {
      action: 'create',
      id: challenge,
      template_id: template.id,
      scope: 'pair',
      duration,
      partners: [peer.id],
      targets,
    });
    await api(peer.c, { action: 'respond', id: challenge, accept: true });
    // Fixture clocks affect only these recorded disposable instances. No global clocks or rules change.
    const start = day(-duration - 1);
    await query(
      admin
        .from('challenges')
        .update({ start_date: start, end_date: day(-2), status: 'active' })
        .eq('id', challenge),
    );
    await query(
      admin
        .from('challenge_participants')
        .update({ start_date: start })
        .eq('challenge_id', challenge),
    );
    const result = await api(host.c, { action: 'detail', id: challenge });
    assert.equal(result.self.status, 'completed');
    assert.equal(result.participants.find((p) => p.self).days.length, duration);
    assert.ok(
      result.participants.every(
        (p) => p.percent === 'locked' || (p.percent >= 0 && p.percent <= 100),
      ),
    );
    results.push({ slug: template.slug, format: template.format, result: result.self.status });
  }
  assert.equal(new Set(results.map((r) => r.format)).size, 6);
  saved.results = results;
  for (const template of templates.filter((t) => t.season_id)) {
    const season = home.catalog.seasons.find((s) => s.id === template.season_id);
    if (!season) continue;
    await api(a.c, { action: 'remind', template_id: template.id, enabled: true });
    if (season.starts_at > home.catalog.now)
      await api(
        a.c,
        {
          action: 'create',
          id: crypto.randomUUID(),
          template_id: template.id,
          scope: 'season',
          duration: template.duration_options[0],
          partners: [],
        },
        'SEASON_NOT_OPEN',
      );
  }
  const occasionId = crypto.randomUUID();
  challenges.push(occasionId);
  persist();
  await api(b.c, {
    action: 'occasion',
    id: occasionId,
    template_id: templates.find((t) => t.slug === 'habit-checklist').id,
    partner_id: a.id,
    event_type: 'wedding',
    event_date: day(30),
    target_weight: 69,
  });
  const privateView = await api(a.c, { action: 'detail', id: occasionId });
  assert.equal(privateView.occasion.private_plan, null);
  assert.ok(privateView.occasion.milestones.every((m) => m.weight === null));
  await query(admin.from('entitlements').update({ status: 'lapsed' }).eq('user_id', a.id));
  const running = await api(a.c, { action: 'home' });
  assert.equal(running.catalog.plan, 'free');
  assert.ok(running.items.some((item) => item.self.benefits.custom));
  console.log(
    `PASS Hosted: two accounts; onboarding allocation/retry; Free quota; invite consent; private projections; reminder cap; ${results.length} logged templates/all six formats; season states; private occasion milestones; plan lapse`,
  );
  saved.accounts = accounts.map((account) =>
    Object.fromEntries(Object.entries(account).filter(([key]) => key !== 'c')),
  );
  saved.api_challenge_ids = [...challenges];
  persist();
  passed = true;
} catch (error) {
  console.error('AUDIT FAILURE', error.message);
  throw error;
} finally {
  if (!passed)
    await cleanup().catch((error) => {
      console.error('CLEANUP PENDING', error.message);
    });
}
