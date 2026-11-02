// Local fixture-only UI audit; no requests or account writes reach the hosted backend.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
const npmCache = path.join(process.env.LOCALAPPDATA, 'npm-cache', '_npx');
const installed = fs
  .readdirSync(npmCache)
  .map((name) => path.join(npmCache, name, 'node_modules', 'playwright', 'index.mjs'))
  .find((file) => fs.existsSync(file));
if (!installed) throw new Error('Playwright is required for this browser check.');
const { chromium } = await import(`file:///${installed.replaceAll('\\', '/')}`);
const root = path.resolve('.cache/online-home-export');
const bundleFolder = path.join(root, '_expo/static/js/web');
const compiledUrl = fs
  .readdirSync(bundleFolder)
  .map((name) =>
    fs
      .readFileSync(path.join(bundleFolder, name), 'utf8')
      .match(/supabaseUrl:\(0,\w+\.resolveLocalUrl\)\("([^"\s]+)"/),
  )
  .find(Boolean)?.[1];
const apiHost = new URL(
  process.env.ONLINE_AUDIT_SUPABASE_URL ?? compiledUrl ?? 'https://fixture.supabase.co',
).host;
const ref = apiHost.split('.')[0];
const user = {
  id: 'f3010000-0000-4000-8000-000000000001',
  email: 'fixture@example.com',
  aud: 'authenticated',
  role: 'authenticated',
  user_metadata: {},
  app_metadata: { provider: 'email' },
  created_at: new Date().toISOString(),
};
const now = new Date().toISOString();
const goal = {
  id: 'f3010000-0000-4000-8000-000000000002',
  user_id: user.id,
  goal: 'maintain',
  activity_level: 'moderate',
  current_weight_kg: 75,
  daily_calorie_target: 2400,
  protein_grams: 150,
  carb_grams: 285,
  fat_grams: 70,
  bmr: 1800,
  tdee: 2400,
  step_goal: 8000,
  water_ml_goal: 2500,
  effective_from: now,
  confirmed_at: now,
  created_at: now,
};
const rooms = [2, 5].map((count, index) => ({
  id: `f3020000-0000-4000-8000-00000000000${index}`,
  name: index ? 'Evening crew' : 'Morning squad',
  member_count: count,
  member_cap: 5,
  state: 'active',
  role: 'host',
  code: `TEST0${index}`,
  host_id: user.id,
}));
const members = [
  {
    user_id: user.id,
    nickname: 'Maity',
    is_self: true,
    checked_in: false,
    activities: [],
    note: null,
    occurred_at: null,
  },
  {
    user_id: 'f3010000-0000-4000-8000-000000000003',
    nickname: 'Alex',
    is_self: false,
    checked_in: true,
    activities: ['rest'],
    note: null,
    occurred_at: now,
  },
];
const server = http.createServer((req, res) => {
  let file = path.resolve(root, '.' + decodeURIComponent((req.url ?? '/').split('?')[0]));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory())
    file = path.join(root, 'index.html');
  res.setHeader(
    'Content-Type',
    {
      '.js': 'application/javascript',
      '.html': 'text/html',
      '.ttf': 'font/ttf',
      '.png': 'image/png',
      '.svg': 'image/svg+xml',
      '.json': 'application/json',
      '.wasm': 'application/wasm',
    }[path.extname(file)] ?? 'application/octet-stream',
  );
  fs.createReadStream(file).pipe(res);
});
await new Promise((resolve) => server.listen(8097, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  const errors = [];
  await context.route('**/*', async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (url.hostname === '127.0.0.1' || url.hostname.endsWith('jsdelivr.net'))
      return route.continue();
    if (url.host !== apiHost) return route.abort();
    let data = [];
    if (url.pathname === '/auth/v1/user') data = user;
    else if (url.pathname.includes('/rpc/')) {
      const name = url.pathname.split('/').at(-1);
      if (name === 'get_my_rooms') data = rooms;
      else if (name === 'get_squad_day') data = { members };
      else if (name === 'get_friend_inbox')
        data = { incoming: [], outgoing: [], friends: [], quota: { remaining: 3, premium: true } };
      else if (name === 'get_social_profile')
        data = {
          ...user,
          username: 'maity',
          nickname: 'Maity',
          is_public: false,
          relationship: 'self',
        };
      else if (name === 'get_room_snapshot')
        return route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'ROOM_NOT_FOUND' }),
        });
    } else if (url.pathname.endsWith('/profiles'))
      data = [
        {
          ...user,
          username: 'maity',
          nickname: 'Maity',
          timezone: 'America/New_York',
          height_cm: 175,
          sex: 'male',
          date_of_birth: '1995-01-01',
        },
      ];
    else if (url.pathname.endsWith('/goal_profiles')) data = [goal];
    else if (url.pathname.endsWith('/entitlements'))
      data = [
        {
          user_id: user.id,
          tier: 'pro',
          status: 'paid',
          period_start: now,
          period_end: '2027-11-02T00:00:00Z',
        },
      ];
    if (request.headers().accept?.includes('vnd.pgrst.object') && Array.isArray(data))
      data = data[0] ?? null;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(data),
    });
  });
  if (context.routeWebSocket) await context.routeWebSocket('**', (socket) => socket.close());
  await context.addInitScript(
    ({ user, ref }) => {
      const encode = (value) =>
        btoa(JSON.stringify(value)).replaceAll('=', '').replaceAll('+', '-').replaceAll('/', '_');
      const key = `sb-${ref}-auth-token`;
      const token =
        encode({ alg: 'HS256', typ: 'JWT' }) +
        '.' +
        encode({
          sub: user.id,
          aud: 'authenticated',
          role: 'authenticated',
          exp: Math.floor(Date.now() / 1000) + 3600,
        }) +
        '.fixture';
      globalThis.localStorage.setItem(
        key,
        JSON.stringify({
          access_token: token,
          refresh_token: 'fixture',
          token_type: 'bearer',
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user,
        }),
      );
      globalThis.localStorage.setItem(key + '.last-online', String(Date.now()));
    },
    { user, ref },
  );
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:8097/today');
  await page.getByTestId('home-coach-icon').waitFor();
  await page.getByTestId(`check-in-${rooms[0].id}`).waitFor();
  for (const size of [
    { width: 375, height: 812 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(size);
    const cards = await Promise.all([
      page.getByTestId(`home-squad-card-${rooms[0].id}`).boundingBox(),
      page.getByTestId(`home-squad-card-${rooms[1].id}`).boundingBox(),
      page.getByTestId('home-create-squad-end').boundingBox(),
    ]);
    for (const card of cards.slice(1)) {
      assert.ok(Math.abs(card.y - cards[0].y) < 1);
      assert.ok(Math.abs(card.height - cards[0].height) < 1);
      assert.ok(Math.abs(card.width - cards[0].width) < 1);
    }
    assert.equal(await page.getByTestId('home-personal-streak').count(), 0);
    assert.equal(await page.getByTestId('activity-card-food-logging').count(), 0);
    assert.equal(await page.getByTestId('home-coach-card').count(), 0);
    assert.equal(await page.getByTestId('meal-metrics-breakfast').count(), 0);
    assert.ok(!(await page.locator('body').innerText()).includes('Sync failed'));
    await page.screenshot({ path: `.cache/online-home-${size.width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  await page.getByTestId('btn-add-food-breakfast').click();
  await page.waitForTimeout(400);
  for (const method of ['history', 'search', 'scan', 'photo', 'recipes', 'myFoods'])
    await page.getByTestId(`tab-log-${method}`).waitFor();
  const history = await page.getByTestId('tab-log-history').boundingBox(),
    photo = await page.getByTestId('tab-log-photo').boundingBox();
  assert.ok(photo.y > history.y);
  await page.screenshot({ path: '.cache/online-food-methods.png', fullPage: true });
  await page.getByTestId('btn-close-food-log').click();
  await page.getByTestId('tab-room').click();
  await page.getByTestId('room-tab-progress').click();
  await page.getByTestId('tab-today').click();
  await page.waitForURL('**/today');
  await page.getByTestId('home-coach-icon').waitFor();
  await page.getByTestId('tab-room').click();
  await page.getByTestId('room-tab-progress').click();
  await page.waitForFunction(() => globalThis.history.state?.calipartnerModalStack?.length > 0);
  await page.goBack();
  await page.getByTestId('room-tab-today').waitFor();
  await page.getByTestId('room-extras').waitFor();
  assert.deepEqual(errors, []);
  console.log(
    'Browser UI: 3 viewport layouts, equal squad cards, compact meals, 6 food methods, Squad to Home and browser Back passed',
  );
} catch (failure) {
  for (const page of browser?.contexts().flatMap((context) => context.pages()) ?? []) {
    await page.screenshot({ path: '.cache/online-ui-failure.png', fullPage: true });
    console.log('UI failure screen:', (await page.locator('body').innerText()).slice(0, 2000));
  }
  throw failure;
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
