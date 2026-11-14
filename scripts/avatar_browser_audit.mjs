// Deterministic API contract fixtures; no real account or payment is changed.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
const npmCache = path.join(process.env.LOCALAPPDATA, 'npm-cache', '_npx');
const installed = fs
  .readdirSync(npmCache)
  .map((d) => path.join(npmCache, d, 'node_modules/playwright/index.mjs'))
  .find(fs.existsSync);
if (!installed) throw new Error('Local Playwright installation required');
const { chromium } = await import(`file:///${installed.replaceAll('\\', '/')}`);
const root = path.resolve('app/dist');
const out = path.resolve('.artifacts/avatar-browser');
fs.mkdirSync(out, { recursive: true });
const ref = fs.readFileSync('supabase/.temp/project-ref', 'utf8').trim();
const uid = 'a8190000-0000-4000-8000-000000000001';
const now = new Date().toISOString();
const user = {
  id: uid,
  email: 'avatar-contract@example.invalid',
  aud: 'authenticated',
  role: 'authenticated',
  user_metadata: {},
  app_metadata: { provider: 'email' },
  created_at: now,
};
const profile = {
  ...user,
  username: 'avatar_test',
  nickname: 'Maya',
  timezone: 'America/New_York',
  height_cm: 170,
  sex: 'female',
  date_of_birth: '1995-01-01',
};
const goal = {
  id: 'a8190000-0000-4000-8000-000000000002',
  user_id: uid,
  goal: 'maintain',
  activity_level: 'moderate',
  current_weight_kg: 70,
  daily_calorie_target: 2100,
  protein_grams: 120,
  carb_grams: 270,
  fat_grams: 60,
  bmr: 1700,
  tdee: 2100,
  step_goal: 8000,
  water_ml_goal: 2500,
  effective_from: now,
  confirmed_at: now,
  created_at: now,
};
const seed = JSON.parse(fs.readFileSync('supabase/seed/avatar_catalog.json', 'utf8'));
let avatar = null,
  earned = 200;
let saved = [];
let purchase = [];
let failSave = true;
const owned = new Set();
const state = () => ({
  enabled: true,
  profile: avatar,
  balances: { earned, purchased: 0 },
  tier: 'free',
  config: { ...seed.config, starter_path: seed.starter_path },
  levels: seed.levels,
  tints: seed.tints,
  collections: seed.collections.map((c) => ({ ...c, price_to_complete: 100 })),
  products: seed.products.map((p) => ({
    ...p,
    owned: owned.has(p.id),
    accessible: seed.collections.find((c) => c.id === p.collection_id).tier_required === 'free',
    effective_price: p.price_cc,
  })),
  daily_drop: { available: true, claimed: false, amount: 5 },
  starter_progress: avatar ? ['create_character'] : [],
  ledger: [],
  packs: seed.packs,
  wishlist: [],
});
const server = http.createServer((req, res) => {
  let file = path.resolve(root, '.' + decodeURIComponent((req.url ?? '/').split('?')[0]));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory())
    file = path.join(root, 'index.html');
  res.setHeader(
    'Content-Type',
    {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.ttf': 'font/ttf',
      '.webp': 'image/webp',
      '.png': 'image/png',
      '.wasm': 'application/wasm',
    }[path.extname(file)] ?? 'application/octet-stream',
  );
  fs.createReadStream(file).pipe(res);
});
await new Promise((resolve) => server.listen(8099, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    reducedMotion: 'reduce',
    timezoneId: 'America/New_York',
  });
  await context.route('**/*', async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    if (url.hostname === '127.0.0.1' || url.hostname.endsWith('jsdelivr.net'))
      return route.continue();
    if (url.hostname !== `${ref}.supabase.co`) return route.abort();
    let data = [];
    let status = 200;
    if (url.pathname === '/auth/v1/user') data = user;
    else if (url.pathname.endsWith('/profiles')) data = [profile];
    else if (url.pathname.endsWith('/goal_profiles')) data = [goal];
    else if (url.pathname.includes('/rpc/')) {
      const name = url.pathname.split('/').at(-1),
        body = req.postDataJSON() ?? {};
      if (name === 'get_avatar_state') data = state();
      else if (name === 'avatar_reconcile_rewards') data = null;
      else if (name === 'avatar_create') {
        seed.products.filter((p) => p.starter).forEach((p) => owned.add(p.id));
        avatar = {
          user_id: uid,
          gender: body.p_gender,
          skin_tone_id: body.p_skin_tone_id,
          xp: 0,
          level: 1,
          form: 1,
          created_at: now,
          slots: Object.fromEntries(
            seed.products
              .filter((p) => p.starter && p.genders.includes(body.p_gender))
              .map((p) => [p.slot, p.id]),
          ),
          tints: {},
        };
        data = state();
      } else if (name === 'avatar_save') {
        saved.push(body);
        if (failSave) {
          failSave = false;
          status = 503;
          data = { message: 'NETWORK_UNAVAILABLE' };
        } else {
          avatar = {
            ...avatar,
            gender: body.p_gender,
            skin_tone_id: body.p_skin_tone_id,
            slots: body.p_slots,
            tints: body.p_tints,
          };
          data = state();
        }
      } else if (name === 'avatar_purchase') {
        purchase.push(body);
        owned.add(body.p_product_id);
        earned -= body.p_expected_price;
        data = state();
      } else if (name === 'get_avatar_public')
        data = avatar ? [{ ...avatar, user_id: body.p_user_ids[0] }] : [];
      else if (name === 'get_plus_trial_offer')
        data = { eligible: false, active: false, expired: false, server_now: now };
      else if (name === 'get_squad_today')
        data = {
          room_id: body.p_room_id,
          members: [
            {
              ...profile,
              user_id: uid,
              is_self: true,
              status: 'active',
              role: 'host',
              targets: {
                calories: 2100,
                protein: 120,
                carbs: 270,
                fat: 60,
                steps: 8000,
                water: 2500,
              },
              calories: 1000,
              protein: 60,
              carbs: 140,
              fat: 25,
              steps: 4000,
              water: 1000,
            },
            {
              ...profile,
              user_id: 'a8190000-0000-4000-8000-000000000003',
              nickname: 'Aarav',
              is_self: false,
              status: 'active',
              role: 'member',
              targets: {
                calories: 2100,
                protein: 120,
                carbs: 270,
                fat: 60,
                steps: 8000,
                water: 2500,
              },
              calories: 1200,
              protein: 70,
              carbs: 160,
              fat: 30,
              steps: 5000,
              water: 1300,
            },
          ],
        };
      else if (name === 'get_tracking_preferences')
        data = { calories: true, protein: true, carbs: true, fat: true, steps: true, water: true };
    } else if (url.pathname.endsWith('/functions/v1/challenges-api'))
      data = { catalog: { templates: [], seasons: [], config: { poll_seconds: 120 } }, items: [] };
    if (req.headers().accept?.includes('vnd.pgrst.object') && Array.isArray(data))
      data = data[0] ?? null;
    return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
  });
  if (context.routeWebSocket) await context.routeWebSocket('**', (socket) => socket.close());
  await context.addInitScript(
    ({ user, ref }) => {
      const encode = (v) =>
        globalThis
          .btoa(JSON.stringify(v))
          .replaceAll('=', '')
          .replaceAll('+', '-')
          .replaceAll('/', '_');
      const key = `sb-${ref}-auth-token`;
      globalThis.localStorage.setItem(
        key,
        JSON.stringify({
          access_token:
            encode({ alg: 'HS256', typ: 'JWT' }) +
            '.' +
            encode({ sub: user.id, aud: 'authenticated', role: 'authenticated', exp: 4070908800 }) +
            '.fixture',
          refresh_token: 'fixture',
          token_type: 'bearer',
          expires_in: 3600,
          expires_at: 4070908800,
          user,
        }),
      );
      globalThis.localStorage.setItem(key + '.last-online', String(Date.now()));
    },
    { user, ref },
  );
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:8099/avatar/create');
  await page.getByTestId('avatar-model-f').waitFor();
  await page.getByTestId('avatar-skin_5').click();
  await page.getByTestId('avatar-save').click();
  await page.getByRole('alert').filter({ hasText: 'offline' }).waitFor();
  assert.equal(saved.length, 1);
  await page.getByTestId('avatar-save').click();
  await page.getByText('Your character is saved', { exact: true }).waitFor();
  assert.equal(saved[0].p_request_id, saved[1].p_request_id);
  assert.equal(avatar.gender, 'f');
  assert.equal(avatar.skin_tone_id, 'skin_5');
  await page.getByTestId('avatar-tab-top').click();
  await page.getByTestId('avatar-color-garment_5').click();
  await page.getByTestId('avatar-page-back').click();
  await page.getByTestId('avatar-keep-editing').click();
  await page.screenshot({ path: path.join(out, 'wardrobe-color-375.png'), fullPage: true });
  await page.getByTestId('avatar-save').click();
  await page.getByText('Your character is saved', { exact: true }).waitFor();
  assert.equal(avatar.tints.top, 'garment_5');
  await page.getByTestId('wardrobe-shop').click();
  await page.getByTestId('shop-collection-gym_basics').click();
  await page.getByTestId('buy-top_tee').click();
  await page.getByTestId('avatar-confirm-purchase').click();
  await page.getByTestId('buy-top_tee').waitFor({ state: 'detached' });
  assert.equal(purchase.length, 1);
  assert.ok(owned.has('top_tee'));
  await page.goto('http://127.0.0.1:8099/today');
  await page.getByTestId('home-avatar-hero').waitFor();
  assert.equal(
    await page.evaluate(
      () => globalThis.getComputedStyle(globalThis.document.body).backgroundColor,
    ),
    'rgb(221, 213, 199)',
  );
  await page.screenshot({ path: path.join(out, 'home-light-375.png'), fullPage: true });
  await page.getByTestId('theme-dark').click();
  assert.equal(
    await page.evaluate(
      () => globalThis.getComputedStyle(globalThis.document.body).backgroundColor,
    ),
    'rgb(21, 20, 19)',
  );
  await page.screenshot({ path: path.join(out, 'home-dark-375.png'), fullPage: true });
  await page.getByTestId('theme-yellow').click();
  await page.reload();
  await page.getByTestId('home-avatar-hero').waitFor();
  assert.equal(
    await page.evaluate(
      () => globalThis.getComputedStyle(globalThis.document.body).backgroundColor,
    ),
    'rgb(14, 11, 8)',
  );
  await page.getByTestId('theme-light').click();
  await page.goto('http://127.0.0.1:8099/progress');
  await page.getByTestId('you-avatar').waitFor();
  await page.screenshot({ path: path.join(out, 'you-375.png'), fullPage: true });
  await page.setViewportSize({ width: 812, height: 375 });
  await page.screenshot({ path: path.join(out, 'you-landscape.png'), fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('http://127.0.0.1:8099/squad/compare?room=a8190000-0000-4000-8000-000000000004');
  await page.getByTestId('screen-squad-compare').waitFor();
  await page.getByTestId('avatar-view').first().waitFor();
  assert.equal(await page.getByTestId('avatar-view').count(), 2);
  await page.screenshot({ path: path.join(out, 'compare-375.png'), fullPage: true });
  assert.deepEqual(errors, []);
  console.log(
    'Avatar browser audit: creation, failed-save retry UUID, skin/outfit tint, CC item purchase, Home/You, all three themes, persistence and narrow/landscape screens passed',
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
