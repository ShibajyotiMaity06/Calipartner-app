// Contract fixtures only: all backend requests are intercepted; no hosted records are written.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
const npmCache = path.join(process.env.LOCALAPPDATA, 'npm-cache', '_npx');
const installed = fs
  .readdirSync(npmCache)
  .map((name) => path.join(npmCache, name, 'node_modules', 'playwright', 'index.mjs'))
  .find((file) => fs.existsSync(file));
if (!installed) throw new Error('Playwright is required for the browser audit.');
const { chromium } = await import(`file:///${installed.replaceAll('\\', '/')}`);
const root = path.resolve('app/dist'),
  out = path.resolve('.artifacts/fasting-refresh');
fs.mkdirSync(out, { recursive: true });
const bundles = path.join(root, '_expo/static/js/web');
const compiled = fs
  .readdirSync(bundles)
  .map((name) =>
    fs
      .readFileSync(path.join(bundles, name), 'utf8')
      .match(/supabaseUrl:\(0,\w+\.resolveLocalUrl\)\("([^"\s]+)"/),
  )
  .find(Boolean)?.[1];
const apiHost = new URL(compiled ?? 'https://ipxsziqwrowxblwalnqj.supabase.co').host,
  ref = apiHost.split('.')[0];
const uid = (i) => `fc020000-0000-4000-8000-${String(i).padStart(12, '0')}`;
const rid = (i) => `fd020000-0000-4000-8000-${String(i).padStart(12, '0')}`;
const now = '2026-11-03T14:00:00Z',
  day = now.slice(0, 10),
  messageId = rid(80);
const user = {
  id: uid(0),
  email: 'squad-fixture@example.com',
  aud: 'authenticated',
  role: 'authenticated',
  user_metadata: {},
  app_metadata: { provider: 'email' },
  created_at: now,
};
const profile = {
  ...user,
  username: 'maity',
  nickname: 'Maity',
  timezone: 'America/New_York',
  height_cm: 175,
  sex: 'male',
  date_of_birth: '1995-01-01',
};
const goal = {
  id: rid(9),
  user_id: user.id,
  goal: 'bulk',
  activity_level: 'moderate',
  current_weight_kg: 75,
  daily_calorie_target: 2670,
  protein_grams: 160,
  carb_grams: 330,
  fat_grams: 80,
  bmr: 1800,
  tdee: 2400,
  step_goal: 6000,
  water_ml_goal: 2500,
  effective_from: now,
  confirmed_at: now,
  created_at: now,
};
const rooms = [
  {
    id: rid(0),
    name: 'Pav and you',
    member_count: 2,
    member_cap: 2,
    state: 'active',
    role: 'host',
    code: 'PAIR01',
  },
  {
    id: rid(1),
    name: 'Evening crew',
    member_count: 20,
    member_cap: 20,
    state: 'active',
    role: 'host',
    code: 'CREW20',
  },
];
const all = Array.from({ length: 20 }, (_, index) => ({
  user_id: uid(index),
  username: index ? 'member_' + index : 'maity',
  nickname: index ? (['Pav', 'Aarav', 'Naveen', 'Meera'][index - 1] ?? 'Member ' + index) : 'Maity',
  avatar_url: null,
  is_self: !index,
  role: index ? 'member' : 'host',
  status: 'active',
  goal: index ? 'cut' : 'bulk',
  local_date: day,
  calories: index ? 1800 * (1 - index * 0.04) : 1240,
  protein: index ? 140 * (1 - index * 0.04) : 62,
  carbs: index ? 170 * (1 - index * 0.04) : 140,
  fat: index ? 55 * (1 - index * 0.04) : 38,
  steps: index ? 7400 : 3200,
  targets: index
    ? { calories: 1800, protein: 140, carbs: 170, fat: 55, steps: 8000 }
    : { calories: 2670, protein: 160, carbs: 330, fat: 80, steps: 6000 },
  height_cm: index ? null : 175,
  weight_kg: null,
}));
const tagged = {
  id: messageId,
  client_id: messageId,
  room_id: rid(1),
  sender_id: uid(1),
  sender_nickname: 'Pav',
  sender_username: 'member_1',
  sender_avatar_url: null,
  message_type: 'user',
  system_event_type: null,
  text: '@maity leg day tomorrow? I can do 7 am.',
  created_at: '2026-11-01T08:42:00Z',
  deleted_at: null,
  attachments: [],
};
const detail = {
  meals: [
    {
      section: 'lunch',
      calories: 520,
      protein: 42,
      carbs: 54,
      fat: 12,
      items: [{ id: rid(51), name: 'Grilled chicken, rice, salad', quantity: 1, unit: 'serving' }],
    },
  ],
  workouts: [
    {
      id: rid(52),
      name: 'Leg day',
      type: 'strength',
      duration_minutes: 48,
      exercises: [
        {
          id: rid(53),
          name: 'Squat',
          sets: [
            {
              set_number: 1,
              reps: 8,
              weight_kg: 80,
              duration_seconds: null,
              distance_meters: null,
            },
          ],
        },
      ],
    },
  ],
};
let pro = false;
let fastingSettings = null,
  screening = {
    user_id: user.id,
    pregnant_or_breastfeeding: false,
    has_diabetes_or_medication: false,
    has_eating_disorder_history: false,
  };
const fastingRecords = new Map(),
  startIds = [];
let failStart = true;
const savedMeals = new Map();
let saveAttempts = 0;
let paid = false,
  seen = false;
const requests = [],
  errors = [];
let recent = [];
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
await new Promise((resolve) => server.listen(8098, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
    timezoneId: 'America/New_York',
  });
  await context.route('**/*', async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (url.hostname === '127.0.0.1' || url.hostname.endsWith('jsdelivr.net'))
      return route.continue();
    if (url.host !== apiHost) return route.abort();
    let data = [];
    let status = 200;
    if (url.pathname === '/auth/v1/user') data = user;
    else if (url.pathname.includes('/rpc/')) {
      const name = url.pathname.split('/').at(-1),
        body = request.postDataJSON() ?? {};
      requests.push(name);
      if (name === 'save_tracking_changes') {
        for (const change of body.p_changes) {
          if (change.entity === 'fasting_settings') fastingSettings = change.payload;
          if (change.entity === 'health_screening') screening = change.payload;
          if (change.entity === 'fasting_sessions') {
            if (change.payload.status === 'active') startIds.push(change.id);
            if (change.payload.status === 'active' && failStart) {
              failStart = false;
              status = 503;
              data = { message: 'Connection interrupted' };
              continue;
            }
            fastingRecords.set(change.id, change.payload);
          }
        }
        if (status === 200) data = { saved: body.p_changes.length };
      } else if (name === 'get_my_rooms') data = rooms;
      else if (name === 'get_individual_progress') data = null;
      else if (name === 'log_coach_meal') {
        saveAttempts++;
        for (const entry of body.p_entries)
          savedMeals.set(entry.id, { ...entry, user_id: user.id });
        if (saveAttempts === 1) {
          status = 503;
          data = { message: 'Connection lost after save' };
        } else data = body.p_entries.map((entry) => savedMeals.get(entry.id));
      } else if (name === 'get_squad_today')
        data = {
          room_id: body.p_room_id,
          members: body.p_room_id === rid(0) ? all.slice(0, 2) : all,
        };
      else if (name === 'get_squad_mentions')
        data = {
          count: body.p_room_id === rid(1) && !seen ? 1 : 0,
          locked: !paid,
          mentions:
            paid && body.p_room_id === rid(1) && !seen
              ? [
                  {
                    message_id: messageId,
                    sender_id: uid(1),
                    nickname: 'Pav',
                    text: tagged.text,
                    created_at: tagged.created_at,
                  },
                ]
              : [],
          has_more: false,
        };
      else if (name === 'get_squad_member_details') {
        if (!paid) {
          status = 403;
          data = { message: 'PLUS_REQUIRED' };
        } else data = detail;
      } else if (name === 'get_squad_mention_context') data = [tagged];
      else if (name === 'mark_squad_mention_seen') {
        seen = true;
        data = null;
      } else if (name === 'get_room_snapshot')
        data = {
          room: { ...rooms.find((room) => room.id === body.p_room_id), created_by: user.id },
          caller_id: user.id,
          members: (body.p_room_id === rid(0) ? all.slice(0, 2) : all).map((member) => ({
            ...member,
            metrics: {
              status: 'active',
              logged_today: true,
              goal_completion: 50,
              calories: member.calories,
              macros: { protein: member.protein, carbs: member.carbs, fat: member.fat },
              steps: member.steps,
            },
          })),
        };
      else if (name === 'get_friend_inbox')
        data = { incoming: [], outgoing: [], friends: [], quota: { remaining: 3, premium: paid } };
      else if (name === 'get_chat_messages_v2') data = recent;
      else if (name === 'get_chat_unread_count') data = 0;
      else if (name === 'has_accepted_chat_terms') data = true;
      else if (name === 'get_chat_typing' || name === 'get_chat_hidden_senders') data = [];
      else if (name === 'send_chat_message') {
        data = {
          ...tagged,
          id: rid(81),
          client_id: body.p_client_id,
          sender_id: user.id,
          sender_nickname: 'Maity',
          sender_username: 'maity',
          text: body.p_text,
          created_at: now,
        };
        recent.push(data);
      } else if (name === 'get_squad_visibility')
        data = { share_weight: false, share_height: false };
      else if (name === 'set_squad_visibility')
        data = { share_weight: body.p_share_weight, share_height: body.p_share_height };
    } else if (url.pathname.endsWith('/ai-coach')) {
      const body = request.postDataJSON();
      const latest = body.messages.at(-1).content;
      const item = {
        name: 'Boiled eggs',
        quantity: 2,
        unit: 'eggs',
        calories: 156,
        protein: 13,
        carbs: 1,
        fat: 11,
        fiber: 0,
        sugar: 0,
        sodium_mg: 124,
      };
      data = {
        message: {
          content:
            latest === 'I ate eggs'
              ? 'How many eggs, and how were they prepared?'
              : latest === '2 boiled eggs'
                ? 'Was this breakfast, lunch or dinner?'
                : 'Estimated meal. Check the portions before logging.',
        },
        meal_draft:
          latest === 'Lunch'
            ? { description: '2 boiled eggs', mealSection: 'lunch', localDate: day, items: [item] }
            : null,
      };
    } else if (url.pathname.endsWith('/food_entries')) data = [...savedMeals.values()];
    else if (url.pathname.endsWith('/fasting_settings'))
      data = fastingSettings ? [fastingSettings] : [];
    else if (url.pathname.endsWith('/fasting_sessions')) data = [...fastingRecords.values()];
    else if (url.pathname.endsWith('/health_screening')) {
      if (request.method() === 'POST') screening = request.postDataJSON();
      data = screening ? [screening] : [];
    } else if (url.pathname.endsWith('/notification_settings'))
      data = [{ fasting_reminders_enabled: false, pause_all: false }];
    else if (url.pathname.endsWith('/daily_summaries')) data = [];
    else if (url.pathname.endsWith('/profiles')) data = [profile];
    else if (url.pathname.endsWith('/goal_profiles')) data = [goal];
    else if (url.pathname.endsWith('/entitlements'))
      data = paid
        ? [
            {
              user_id: user.id,
              tier: pro ? 'pro' : 'plus',
              status: 'paid',
              period_start: now,
              period_end: '2099-11-02T00:00:00Z',
            },
          ]
        : [];
    else if (url.pathname.endsWith('/rooms')) data = rooms;
    if (request.headers().accept?.includes('vnd.pgrst.object') && Array.isArray(data))
      data = data[0] ?? null;
    return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
  });
  if (context.routeWebSocket) await context.routeWebSocket('**', (socket) => socket.close());
  await context.addInitScript(
    ({ user, ref }) => {
      const encode = (value) =>
        btoa(JSON.stringify(value)).replaceAll('=', '').replaceAll('+', '-').replaceAll('/', '_');
      const key = `sb-${ref}-auth-token`,
        token =
          encode({ alg: 'HS256', typ: 'JWT' }) +
          '.' +
          encode({
            sub: user.id,
            aud: 'authenticated',
            role: 'authenticated',
            exp: Math.floor(new Date('2099-01-01T00:00:00Z').getTime() / 1000),
          }) +
          '.fixture';
      globalThis.localStorage.setItem(
        key,
        JSON.stringify({
          access_token: token,
          refresh_token: 'fixture',
          token_type: 'bearer',
          expires_in: 3600,
          expires_at: Math.floor(new Date('2099-01-01T00:00:00Z').getTime() / 1000),
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
  const snap = async (name) => {
    await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(out, name + '.png'), fullPage: true });
  };
  await page.goto('http://127.0.0.1:8098/fasting');
  await page.getByTestId('locked-fasting_tracker').waitFor();
  assert.equal(await page.getByTestId('button-enable-fasting').count(), 0);
  await snap('free-plan-gate');
  paid = true;
  await page.goto('http://127.0.0.1:8098/me');
  await page.getByTestId('row-fasting').click();
  await page.getByTestId('button-enable-fasting').click();
  await page.getByTestId('button-start-fast').waitFor();
  await page.getByTestId('button-protocol-chip').click();
  await page.getByTestId('protocol-option-18:6').click();
  await page.getByTestId('button-save-protocol').click();
  await page.getByText('18h planned', { exact: true }).waitFor();
  assert.equal(fastingSettings.protocol, '18:6');
  assert.equal(fastingSettings.eating_window_start, '14:00');
  await snap('ready-18-hour-protocol');
  await page.getByTestId('button-start-fast').click();
  await page.getByTestId('fasting-error').waitFor();
  assert.equal(fastingRecords.size, 0);
  await page.getByTestId('fasting-retry').click();
  await page.getByTestId('button-start-fast').click();
  await page.getByTestId('button-end-fast').waitFor();
  assert.equal(startIds.length, 2);
  assert.equal(startIds[0], startIds[1]);
  assert.equal([...fastingRecords.values()][0].planned_minutes, 1080);
  await page.reload();
  await page.getByTestId('button-end-fast').waitFor();
  await snap('active-survives-reload');
  paid = false;
  await page.reload();
  await page.getByTestId('button-end-fast').waitFor();
  assert.equal(await page.getByTestId('button-protocol-chip').count(), 0);
  await snap('expired-plan-safe-end');
  await page.getByTestId('button-end-fast').click();
  await page.getByTestId('locked-fasting_tracker').waitFor();
  assert.equal([...fastingRecords.values()].filter((s) => s.status === 'active').length, 0);
  paid = true;
  await page.goto('http://127.0.0.1:8098/fasting');
  await page.getByTestId('button-open-fasting-history').click();
  await page.getByTestId('fasting-history-modal').waitFor();
  await snap('fasting-history');
  screening = null;
  fastingSettings.enabled = false;
  await page.goto('http://127.0.0.1:8098/fasting');
  await page.getByTestId('fasting-screening-form').waitFor();
  assert.equal(
    await page.getByTestId('fasting-save-screening').getAttribute('aria-disabled'),
    'true',
  );
  for (const field of [
    'pregnant_or_breastfeeding',
    'has_diabetes_or_medication',
    'has_eating_disorder_history',
  ])
    await page.getByTestId('fasting-screening-' + field + '-false').click();
  await page.getByTestId('fasting-save-screening').click();
  await page.getByTestId('button-enable-fasting').waitFor();
  assert.equal(screening.has_diabetes_or_medication, false);
  screening.has_diabetes_or_medication = true;
  await page.reload();
  await page.getByTestId('fasting-safety-blocked').waitFor();
  assert.equal(await page.getByTestId('button-enable-fasting').count(), 0);
  await snap('health-screening-block');
  await page.goto('http://127.0.0.1:8098/recipes');
  for (const width of [375, 390, 844]) {
    await page.setViewportSize({ width, height: 844 });
    await page.getByTestId('recipe-filter-high-protein').waitFor();
    assert.equal(await page.locator('[data-testid^="recipe-filter-"]').count(), 3);
    await page.getByTestId('recipe-filter-indian').click();
    await page.getByTestId('recipe-filter-high-carb').click();
    await snap('recipes-' + width);
    assert.ok(
      await page.evaluate(
        () => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth,
      ),
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:8098/today');
  await page.getByTestId('tab-log').click();
  await page.getByTestId('log-tile-food').click();
  await page.getByTestId('tab-log-scan').click();
  await page.getByTestId('barcode-more-options').waitFor();
  assert.equal(await page.getByTestId('barcode-choose-photo').count(), 0);
  await snap('scanner-simple');
  await page.getByTestId('barcode-more-options').click();
  await page.getByTestId('barcode-choose-photo').waitFor();
  await snap('scanner-options');
  assert.deepEqual(errors, []);
  console.log(
    'Recipes/scanner/fasting browser audit: exactly three filters at 375/390/844px; simple scanner; Free gate; Plus enable/protocol; failed-save rollback and same-ID retry; active timer reload; expired-plan end; history and acknowledged health-screening/safety gates passed',
  );
} catch (error) {
  for (const page of browser?.contexts().flatMap((context) => context.pages()) ?? []) {
    await page.screenshot({ path: path.join(out, 'failure.png'), fullPage: true }).catch(() => {});
    console.log(
      'UI failure:',
      (
        await page
          .locator('body')
          .innerText()
          .catch(() => '')
      ).slice(-2200),
    );
  }
  throw error;
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
