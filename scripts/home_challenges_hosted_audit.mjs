// Actual browser + hosted API checks, using a disposable private fixture account only.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { buildChallengeHome } from '../packages/core/src/challengeViewModel.ts';

const ref = fs.readFileSync('supabase/.temp/project-ref', 'utf8').trim();
const managementToken = process.env.CALI_CHALLENGE_AUDIT_TOKEN;
delete process.env.CALI_CHALLENGE_AUDIT_TOKEN;
if (!managementToken) throw new Error('OS credential wrapper required');
const keyResponse = await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys`, {
  headers: { Authorization: `Bearer ${managementToken}` },
});
assert.ok(keyResponse.ok, 'Management key lookup');
const keys = await keyResponse.json();
const url = `https://${ref}.supabase.co`;
const anonKey = keys.find((key) => key.name === 'anon').api_key;
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, keys.find((key) => key.name === 'service_role').api_key, options);
const client = createClient(url, anonKey, options);
const check = async (promise) => {
  const { data, error } = await promise;
  if (error) throw new Error(error.message);
  return data;
};
const out = path.resolve('.artifacts/home-challenges-hosted');
fs.mkdirSync(out, { recursive: true });
const journalPath = path.join(out, 'fixture.json');
let fixture = fs.existsSync(journalPath) ? JSON.parse(fs.readFileSync(journalPath, 'utf8')) : {};
let browser, server;
async function cleanup() {
  for (const challenge of [fixture.challenge, fixture.groupChallenge].filter(Boolean)) {
    await check(admin.from('challenge_events').delete().eq('challenge_id', challenge));
    await check(
      admin.from('challenges').delete().eq('id', challenge).eq('creator_id', fixture.user),
    );
  }
  if (fixture.room)
    await check(
      admin.from('rooms').delete().eq('id', fixture.room).eq('plan_holder_id', fixture.user),
    );
  if (fixture.peer) await check(admin.auth.admin.deleteUser(fixture.peer));
  if (fixture.user) await check(admin.auth.admin.deleteUser(fixture.user));
  fixture = {};
  fs.writeFileSync(journalPath, '{}');
}
try {
  await cleanup();
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const email = `challengecheck_${suffix}@example.invalid`,
    password = randomUUID() + 'aA8!';
  const made = await check(
    admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { fixture: 'home-challenges-audit' },
    }),
  );
  fixture.user = made.user.id;
  fs.writeFileSync(journalPath, JSON.stringify(fixture));
  const id = fixture.user;
  const login = await check(client.auth.signInWithPassword({ email, password }));
  await check(
    admin.from('profiles').upsert({
      id,
      username: `chcheck_${suffix}`,
      nickname: 'Challenge fixture',
      date_of_birth: '1995-01-01',
      sex: 'male',
      height_cm: 175,
      timezone: 'America/New_York',
      country: 'IN',
      discoverable: false,
    }),
  );
  await check(
    admin.from('goal_profiles').insert({
      id: randomUUID(),
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
      effective_from: new Date(Date.now() - 86400000).toISOString(),
      confirmed_at: new Date().toISOString(),
    }),
  );
  const response = await client.functions.invoke('challenges-api', { body: { action: 'home' } });
  if (response.error) throw new Error('Hosted home request failed');
  const home = buildChallengeHome(response.data);
  console.log('Actual SDK home: parsed successfully; items=' + home.items.length);
  fixture.challenge = randomUUID();
  fs.writeFileSync(journalPath, JSON.stringify(fixture));
  const template = home.catalog.templates.find((item) => item.slug === 'daily-steps');
  await check(
    client.functions.invoke('challenges-api', {
      body: {
        action: 'create',
        id: fixture.challenge,
        template_id: template.id,
        scope: 'solo',
        duration: 7,
      },
    }),
  );
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(
    new Date(),
  );
  const end = new Date(`${today}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 6);
  await check(
    admin
      .from('challenges')
      .update({ status: 'active', start_date: today, end_date: end.toISOString().slice(0, 10) })
      .eq('id', fixture.challenge)
      .eq('creator_id', id),
  );
  await check(
    admin
      .from('challenge_participants')
      .update({ start_date: today })
      .eq('challenge_id', fixture.challenge)
      .eq('user_id', id),
  );
  const active = await check(
    client.functions.invoke('challenges-api', { body: { action: 'home' } }),
  );
  assert.equal(buildChallengeHome(active).items.length, 1);
  const peer = createClient(url, anonKey, options);
  const peerEmail = `challengepeer_${suffix}@example.invalid`;
  const peerUser = await check(
    admin.auth.admin.createUser({ email: peerEmail, password, email_confirm: true }),
  );
  fixture.peer = peerUser.user.id;
  fs.writeFileSync(journalPath, JSON.stringify(fixture));
  await check(peer.auth.signInWithPassword({ email: peerEmail, password }));
  await check(
    admin.from('profiles').upsert({
      id: fixture.peer,
      username: `chpeer_${suffix}`,
      nickname: 'Challenge peer fixture',
      date_of_birth: '1995-01-01',
      sex: 'male',
      height_cm: 175,
      timezone: 'America/New_York',
      discoverable: false,
    }),
  );
  const invite = await check(
    client.rpc('prepare_onboarding_pair_invite', {
      p_client_id: randomUUID(),
      p_room_name: 'Challenge audit pair',
    }),
  );
  const room = await check(peer.rpc('accept_onboarding_pair_invite', { p_token: invite.token }));
  fixture.room = room.room_id;
  fs.writeFileSync(journalPath, JSON.stringify(fixture));
  fixture.groupChallenge = randomUUID();
  fs.writeFileSync(journalPath, JSON.stringify(fixture));
  await check(
    client.functions.invoke('challenges-api', {
      body: {
        action: 'create',
        id: fixture.groupChallenge,
        template_id: template.id,
        scope: 'pair',
        duration: 7,
        partners: [fixture.peer],
      },
    }),
  );
  await check(
    peer.functions.invoke('challenges-api', {
      body: { action: 'respond', id: fixture.groupChallenge, accept: true },
    }),
  );
  await check(
    admin
      .from('challenges')
      .update({ status: 'active', start_date: today, end_date: end.toISOString().slice(0, 10) })
      .eq('id', fixture.groupChallenge)
      .eq('creator_id', id),
  );
  await check(
    admin
      .from('challenge_participants')
      .update({ start_date: today })
      .eq('challenge_id', fixture.groupChallenge),
  );
  const grouped = await check(
    client.functions.invoke('challenges-api', { body: { action: 'home' } }),
  );
  assert.equal(buildChallengeHome(grouped).items.length, 2);
  console.log('Actual SDK active solo and paired challenges: parsed successfully');
  const npmCache = path.join(process.env.LOCALAPPDATA, 'npm-cache', '_npx');
  const installed = fs
    .readdirSync(npmCache)
    .map((name) => path.join(npmCache, name, 'node_modules/playwright/index.mjs'))
    .find((file) => fs.existsSync(file));
  assert.ok(installed, 'Playwright available');
  const { chromium } = await import(`file:///${installed.replaceAll('\\', '/')}`);
  const root = path.resolve(process.env.CALI_CHALLENGE_AUDIT_BUILD ?? 'app/dist');
  const mime = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.woff2': 'font/woff2',
    '.wasm': 'application/wasm',
  };
  server = http.createServer((request, reply) => {
    const requested = path.resolve(root, '.' + new URL(request.url, 'http://127.0.0.1').pathname);
    if (requested !== root && !requested.startsWith(root + path.sep)) {
      reply.writeHead(403);
      reply.end();
      return;
    }
    const file =
      fs.existsSync(requested) && fs.statSync(requested).isFile()
        ? requested
        : path.join(root, 'index.html');
    reply.writeHead(200, {
      'Content-Type': mime[path.extname(file)] ?? 'application/octet-stream',
    });
    fs.createReadStream(file).pipe(reply);
  });
  await new Promise((resolve) => server.listen(8097, '127.0.0.1', resolve));
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  await context.addInitScript(
    ({ ref, session }) => {
      const key = `sb-${ref}-auth-token`;
      globalThis.localStorage.setItem(key, JSON.stringify(session));
      globalThis.localStorage.setItem(key + '.last-online', String(Date.now()));
    },
    { ref, session: login.session },
  );
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const errors = [],
    requests = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && /challenge|CORS/.test(message.text()))
      errors.push(message.text());
  });
  page.on('response', async (reply) => {
    if (!reply.url().includes(ref + '.supabase.co')) return;
    const pathname = new URL(reply.url()).pathname;
    if (pathname.includes('challenge')) requests.push({ pathname, status: reply.status() });
  });
  await page.goto('http://127.0.0.1:8097/today');
  try {
    await page.getByTestId('home-challenge-' + fixture.challenge).waitFor();
  } catch (error) {
    await page.screenshot({
      path: path.join(out, 'failure.png'),
      fullPage: true,
      animations: 'disabled',
    });
    fs.writeFileSync(
      path.join(out, 'failure.json'),
      JSON.stringify({ errors, requests, body: await page.locator('body').innerText() }, null, 2),
    );
    throw error;
  }
  assert.equal(await page.getByTestId('home-challenge-retry').count(), 0);
  console.log('Hosted browser Home challenge card passed');
  await page.getByTestId('home-view-challenge-' + fixture.challenge).click();
  try {
    await page.getByTestId('challenge-detail-modal').waitFor({ timeout: 10000 });
  } catch (error) {
    await page.screenshot({
      path: path.join(out, 'detail-failure.png'),
      fullPage: true,
      animations: 'disabled',
    });
    fs.writeFileSync(
      path.join(out, 'detail-failure.json'),
      JSON.stringify(
        { url: page.url(), errors, requests, body: await page.locator('body').innerText() },
        null,
        2,
      ),
    );
    throw error;
  }
  assert.equal(await page.getByTestId('challenges-retry').count(), 0);
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    path.join(out, 'result.json'),
    JSON.stringify({ errors, requests, passed: true }, null, 2),
  );
  console.log('Hosted browser challenge Home and Challenges views passed');
} finally {
  await browser?.close();
  if (server) await new Promise((resolve) => server.close(resolve));
  await cleanup();
}
