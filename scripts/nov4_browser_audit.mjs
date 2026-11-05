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
  out = path.resolve('.artifacts/food-polish/browser');
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
let billingCountry = 'IN',
  razorpayConfirmed = false,
  cancelRenewal = false,
  checkoutRequestId = null;
const billingRequests = [];
let pro = false;
let trial = false,
  weeklyPlan = null;
const buildRequests = [],
  copyRequests = [];
const projectedPlan = () =>
  !weeklyPlan
    ? null
    : {
        ...weeklyPlan,
        full_access: paid && !trial,
        days: paid && !trial ? weeklyPlan.days : weeklyPlan.days.slice(0, 1),
        workout_tips: paid && !trial ? weeklyPlan.workout_tips : [],
        diet_tips: paid && !trial ? weeklyPlan.diet_tips : [],
      };
const savedMeals = new Map();
let emptySquads = false;
const foodLibrary = { foods: [], searches: [] };
const trackingRequests = [];
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
    if (url.hostname === 'checkout.dodopayments.com')
      return route.fulfill({
        contentType: 'text/html',
        body: '<p>International Dodo checkout fixture</p>',
      });
    if (url.host !== apiHost) return route.abort();
    let data = [];
    let status = 200;
    if (url.pathname === '/auth/v1/user') data = user;
    else if (url.pathname.includes('/rpc/')) {
      const name = url.pathname.split('/').at(-1),
        body = request.postDataJSON() ?? {};
      requests.push(name);
      if (name === 'get_food_library') data = foodLibrary;
      else if (name === 'set_food_favorite') {
        foodLibrary.foods = foodLibrary.foods.filter((food) => food.id !== body.p_food.id);
        if (body.p_favorite) foodLibrary.foods.push(body.p_food);
        data = { food_key: body.p_food_key, favorite: body.p_favorite };
      } else if (name === 'record_food_search') {
        const query = body.p_query.trim().toLowerCase();
        foodLibrary.searches = [query, ...foodLibrary.searches.filter((q) => q !== query)];
        data = { query };
      } else if (name === 'clear_food_search_history') {
        foodLibrary.searches = [];
        data = { cleared: true };
      } else if (name === 'get_social_profile')
        data = {
          ...profile,
          id: user.id,
          relationship: 'self',
          is_public: false,
          request_id: null,
        };
      else if (name === 'browse_social_profiles')
        data = Array.from({ length: 5 }, (_, i) => ({
          id: uid(i + 1),
          nickname: 'Goal peer ' + (i + 1),
          username: 'goalpeer' + (i + 1),
          avatar_url: null,
          is_public: false,
          relationship: 'none',
          request_id: null,
        }));
      else if (name === 'save_tracking_changes') {
        trackingRequests.push(body);
        for (const change of body.p_changes ?? [])
          if (change.entity === 'food_entries') savedMeals.set(change.payload.id, change.payload);
        data = { saved: true };
      } else if (name === 'get_personal_weekly_plan') data = projectedPlan();
      else if (name === 'edit_weekly_routine') {
        weeklyPlan.days[body.p_day].workout.exercises = body.p_exercises;
        weeklyPlan.revision++;
        data = projectedPlan();
      } else if (name === 'copy_squad_food') {
        copyRequests.push(body);
        data = {
          id: body.p_client_id,
          user_id: user.id,
          food_id: null,
          food_name: 'Grilled chicken, rice, salad',
          meal_section: body.p_meal_section,
          quantity: 1,
          unit: 'serving',
          calories: 520,
          protein: 42,
          carbs: 54,
          fat: 12,
          fiber: 3,
          sugar: 0,
          sodium_mg: 30,
          logged_at: now,
          local_date: day,
          source: 'copy',
          created_at: now,
          updated_at: now,
          deleted_at: null,
        };
        savedMeals.set(data.id, data);
      } else if (name === 'get_my_rooms') data = emptySquads ? [] : rooms;
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
          locked: false,
          mentions:
            body.p_room_id === rid(1) && !seen
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
    } else if (url.pathname.endsWith('/weekly-plan')) {
      const body = request.postDataJSON();
      buildRequests.push(body);
      weeklyPlan = {
        id: body.request_id,
        preferences: body.preferences,
        revision: 1,
        days: Array.from({ length: 7 }, (_, day) => ({
          day,
          workout: {
            title: day === 0 ? 'Your full-body foundation' : 'Private workout ' + day,
            minutes: day === 0 ? 30 : 0,
            exercises:
              day === 0
                ? [
                    {
                      name: 'Bodyweight squat',
                      equipment: 'bodyweight',
                      sets: 3,
                      reps: 10,
                      rest_seconds: 60,
                    },
                  ]
                : [],
          },
          meals: [
            {
              name: day === 0 ? 'Lentil rice bowl' : 'Private food ' + day,
              ingredients: ['rice 150 g', 'lentils 200 g'],
              portion: 'One bowl',
              calories: 890,
              protein: 53,
              carbs: 110,
              fat: 27,
            },
          ],
        })),
        workout_tips: ['Private workout tip'],
        diet_tips: ['Private food tip'],
      };
      data = { saved: true, code: 'PLAN_SAVED' };
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
    } else if (url.pathname.endsWith('/web-billing')) {
      const body = request.postDataJSON() ?? {};
      billingRequests.push(body);
      const provider = billingCountry === 'IN' ? 'razorpay' : 'dodo';
      if (body.action === 'routing' || body.action === 'country')
        data = { country: billingCountry };
      else if (body.action === 'catalog')
        data = {
          provider,
          products: ['plus_monthly', 'plus_annual', 'pro_monthly', 'pro_annual'].map((key) => ({
            key,
            currency: provider === 'razorpay' ? 'INR' : 'USD',
            amount:
              key === 'plus_monthly'
                ? provider === 'razorpay'
                  ? 249
                  : 4.99
                : key === 'plus_annual'
                  ? provider === 'razorpay'
                    ? 1499
                    : 29.99
                  : key === 'pro_monthly'
                    ? provider === 'razorpay'
                      ? 499
                      : 9.99
                    : provider === 'razorpay'
                      ? 2499
                      : 49.99,
            trialDays: key.startsWith('plus') ? 7 : 0,
          })),
        };
      else {
        checkoutRequestId = body.request_id;
        data = {
          provider: 'razorpay',
          key_id: 'rzp_test_Fixture',
          subscription_id: 'sub_Fixture',
          request_id: body.request_id,
          email: user.email,
        };
      }
    } else if (url.pathname.endsWith('/razorpay-checkout')) {
      const body = request.postDataJSON() ?? {};
      billingRequests.push(body);
      if (body.action === 'manage')
        data = { request_id: checkoutRequestId, cancelled: cancelRenewal };
      else if (body.action === 'cancel') {
        cancelRenewal = true;
        data = { status: 'renewal_cancelled' };
      } else if (body.action === 'dismiss') data = { status: 'checkout_cancelled' };
      else data = { status: 'awaiting_webhook' };
    } else if (url.pathname.endsWith('/dodo-checkout')) {
      billingRequests.push(request.postDataJSON() ?? {});
      data = { checkout_url: 'https://checkout.dodopayments.com/fixture' };
    } else if (url.pathname.endsWith('/food_entries')) data = [...savedMeals.values()];
    else if (url.pathname.endsWith('/profiles')) data = [profile];
    else if (url.pathname.endsWith('/goal_profiles')) data = [goal];
    else if (url.pathname.endsWith('/entitlements'))
      data = paid
        ? [
            {
              user_id: user.id,
              tier: pro ? 'pro' : 'plus',
              status: trial ? 'trial' : 'paid',
              period_start: now,
              source: razorpayConfirmed ? 'razorpay' : 'dodo',
              period: 'annual',
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
      globalThis.Razorpay = class {
        constructor(options) {
          this.options = options;
        }
        open() {
          globalThis.__razorpayOpened = true;
          if (globalThis.__razorpayDismiss) this.options.modal.ondismiss();
          else
            this.options.handler({
              razorpay_payment_id: 'pay_Fixture',
              razorpay_subscription_id: 'sub_Fixture',
              razorpay_signature: 'fixture-signature',
            });
        }
      };
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
  const home = async () => {
    await page.goto('http://127.0.0.1:8098/today');
    await page.getByTestId('personal-day-card').waitFor();
    await page
      .getByTestId('home-squad-card-' + rid(0))
      .getByTestId('squad-member-' + uid(1))
      .waitFor();
  };
  paid = true;
  pro = true;
  savedMeals.set(rid(90), {
    id: rid(90),
    user_id: user.id,
    food_id: null,
    food_name: 'Oats and milk',
    brand_name: null,
    meal_section: 'breakfast',
    quantity: 1,
    unit: 'bowl',
    calories: 350,
    protein: 24,
    carbs: 45,
    fat: 10,
    fiber: 5,
    sugar: 8,
    sodium_mg: 70,
    logged_at: now,
    local_date: day,
    source: 'photo',
    updated_at: now,
    created_at: now,
    deleted_at: null,
  });
  await page.clock.install({ time: new Date(now) });
  await home();
  await page.getByText('Did you log your Breakfast?', { exact: true }).waitFor();
  await page.getByTestId('home-open-friends').click();
  await page.getByTestId('community-panel').waitFor();
  await page.getByTestId('community-person-' + uid(1)).waitFor();
  assert.equal(await page.locator('[data-testid^="community-person-"]').count(), 5);

  await home();
  await page.getByTestId('tab-log').click();
  const boxes = await Promise.all(
    ['food', 'workout', 'water', 'steps', 'weight'].map(async (name) => {
      await page.getByTestId('log-tile-' + name).waitFor();
      return page.getByTestId('log-tile-' + name).boundingBox();
    }),
  );
  assert.ok(Math.abs(boxes[0].width - boxes[4].width) < 1);
  assert.ok(Math.abs(boxes[4].x + boxes[4].width / 2 - 195) < 2);
  assert.ok(boxes[4].y > boxes[2].y);
  await snap('log-centered-weight');
  await page.getByTestId('log-tile-food').click();
  for (const method of ['search', 'recipes', 'photo', 'scan'])
    await page.getByTestId('tab-log-' + method).waitFor();
  for (const method of ['history', 'myFoods'])
    assert.equal(await page.getByTestId('tab-log-' + method).count(), 0);
  assert.equal(await page.getByTestId('food-log-describe').count(), 0);
  await page.getByText('Oats and milk', { exact: true }).waitFor();
  await snap('food-recent-rows');
  await page.getByTestId('input-food-search').fill('Gouda Cheese');
  await page.getByText('Gouda Cheese (ready-to-eat)', { exact: true }).waitFor();
  await snap('supplied-food-search');
  await page.getByTestId('btn-close-food-log').click();
  await page.getByTestId('modal-food-log').waitFor({ state: 'hidden' });
  await page.getByTestId('log-hub-close').click();
  await page.getByTestId('tab-progress').click();
  await page.getByTestId('you-food-' + rid(90)).waitFor();
  await page.getByTestId('you-daily-macros').waitFor();
  assert.equal(await page.getByTestId('progress-range-selector').count(), 0);
  for (const size of [
    { width: 375, height: 812 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(size);
    await snap('you-diary-' + size.width);
    assert.equal(
      await page.evaluate(
        () => globalThis.document.documentElement.scrollWidth > globalThis.innerWidth,
      ),
      false,
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId('you-tabs-progress').click();
  await page.getByTestId('progress-range-selector-option-30d').waitFor();
  await page.getByTestId('progress-range-selector-option-90d').waitFor();
  assert.equal(await page.getByTestId('progress-range-selector-option-7d').count(), 0);
  await snap('you-progress');
  await page.goto('http://127.0.0.1:8098/room?room=' + rid(1));
  await page.getByTestId('room-tab-progress').click();
  assert(!(await page.getByTestId('squad-leaderboard-list').innerText()).includes('kcal'));
  assert.equal(
    await page
      .getByTestId('room-tab-progress')
      .evaluate(
        (element) => globalThis.getComputedStyle(element.querySelector('[dir="auto"]')).color,
      ),
    'rgb(244, 212, 119)',
  );
  assert.notEqual(
    await page
      .getByTestId('room-tab-today')
      .evaluate(
        (element) => globalThis.getComputedStyle(element.querySelector('[dir="auto"]')).color,
      ),
    'rgb(244, 212, 119)',
  );
  await page.getByTestId('room-tab-chat').click();
  await page.getByTestId('input-chat-message').waitFor();
  await page.waitForFunction(
    () => !globalThis.document.querySelector('[data-testid="floating-tab-bar"]'),
  );
  await page.getByTestId('input-chat-message').fill('@');
  const first = await page.getByTestId('tag-member-' + uid(1)).boundingBox();
  const second = await page.getByTestId('tag-member-' + uid(2)).boundingBox();
  assert.ok(second.y >= first.y + first.height);
  await snap('chat-vertical-mentions');
  await page.getByTestId('squad-chat-back').click();
  await page.getByTestId('floating-tab-bar').waitFor();
  assert.equal(await page.getByTestId('room-tab-progress').getAttribute('aria-selected'), 'true');
  await page.goto('http://127.0.0.1:8098/room?room=' + rid(1) + '&tab=progress');
  await page.getByTestId('room-tab-progress').waitFor();
  await page.getByTestId('room-tab-today').click();
  await page.getByTestId('squad-choose-person').click();
  await page.getByTestId('choose-member-' + uid(2)).click();
  await page.waitForTimeout(200);
  assert.equal(await page.getByTestId('room-tab-today').getAttribute('aria-selected'), 'true');
  await page.goto('http://127.0.0.1:8098/coach');
  await page.getByTestId('screen-coach-chat').waitFor();
  const promptFont = await page
    .getByTestId('chip-prompt-meal')
    .evaluate(
      (el) =>
        globalThis.getComputedStyle(
          [...el.querySelectorAll('[dir="auto"]')].find((node) =>
            node.textContent.includes('Help me log'),
          ),
        ).fontFamily,
    );
  assert.ok(promptFont.includes('PlusJakartaSans'));
  for (const [text, response] of [
    ['I ate eggs', 'How many eggs, and how were they prepared?'],
    ['2 boiled eggs', 'Was this breakfast, lunch or dinner?'],
    ['Lunch', 'Estimated meal. Check the portions before logging.'],
  ]) {
    await page.getByTestId('input-coach-message').fill(text);
    await page.getByTestId('btn-coach-send').click();
    await page.getByText(response, { exact: true }).waitFor();
  }
  await page.getByTestId('coach-meal-log').waitFor();
  await snap('coach-log-action');
  await page.getByTestId('coach-meal-log').click();
  await page
    .getByText(
      'Your meal was not confirmed saved. Check your connection and tap Log meal to retry safely.',
      { exact: true },
    )
    .waitFor();
  await page.getByTestId('coach-meal-log').click();
  await page.getByText('Meal logged', { exact: true }).waitFor();
  assert.equal(saveAttempts, 2);
  assert.equal(savedMeals.size, 2);
  await snap('coach-meal-acknowledged');

  // Chronological Back: nested screens, repeated tabs and Log subflows.
  await home();
  await page.getByTestId('tab-progress').click();
  await page.getByTestId('screen-progress').waitFor();
  await page.getByTestId('tab-room').click();
  await page.getByTestId('squad-person-inline').waitFor();
  await page.getByTestId('squad-choose-person').click();
  await page.getByTestId('choose-member-' + uid(0)).click();
  await page.getByTestId('squad-person-inline').getByText('You', { exact: true }).first().waitFor();
  await page.waitForTimeout(200);
  assert.equal(await page.getByTestId('room-tab-today').getAttribute('aria-selected'), 'true');
  await page.getByTestId('open-two-person-compare').click();
  await page.getByTestId('screen-squad-compare').waitFor();
  assert.equal(await page.getByTestId('compare-choose-left').locator('img').count(), 0);
  await page.getByTestId('log-peer-food-' + rid(51)).waitFor();
  assert.equal(await page.locator('[data-testid^="log-peer-food-"]').count(), 1);
  const idleReads = requests.filter(
    (name) => name === 'get_squad_today' || name === 'get_squad_member_details',
  ).length;
  await page.clock.fastForward(65000);
  assert.equal(
    requests.filter((name) => name === 'get_squad_today' || name === 'get_squad_member_details')
      .length,
    idleReads,
  );
  await page.getByTestId('log-peer-food-' + rid(51)).click();
  await page.getByTestId('copy-food-section-dinner').click();
  await page.getByTestId('confirm-peer-food-log').click();
  await page.getByText('Added to your diary', { exact: true }).waitFor();
  assert.equal(copyRequests.length, 1);
  assert.equal(copyRequests[0].p_member_id, uid(1));
  assert.equal(copyRequests[0].p_meal_section, 'dinner');
  await snap('compare-food-cards');
  await page.getByTestId('compare-back').click();
  await page.getByTestId('screen-room').waitFor();
  await page.goBack();
  await page.getByTestId('screen-progress').waitFor();
  await page.getByTestId('tab-log').click();
  await page.getByTestId('log-tile-food').click();
  await page.getByTestId('modal-food-log').waitFor();
  await page.goBack();
  await page.getByTestId('log-hub-view').waitFor();
  await page.getByTestId('log-hub-close').click();
  await page.getByTestId('screen-progress').waitFor();

  // The free and trial client receive Monday only; Plus returns the server's full projection.
  paid = false;
  pro = false;
  await page.goto('http://127.0.0.1:8098/weekly-plan');
  await page.getByTestId('weekly-plan-form').waitFor();
  await page.getByTestId('weekly-plan-next').click();
  await page.getByTestId('plan-country').fill('India');
  await page.getByTestId('plan-cuisine').fill('Indian');
  await page.getByTestId('plan-allergies').fill('none');
  await page.getByTestId('plan-exclusions').fill('none');
  await page.getByTestId('weekly-plan-consent').click();
  await page.getByTestId('build-weekly-plan').click();
  await page.getByTestId('weekly-plan-paid-lock').waitFor();
  assert.equal(buildRequests.length, 1);
  assert.equal(
    await page
      .getByTestId('screen-weekly-plan')
      .getByText('Private food 1', { exact: true })
      .count(),
    0,
  );
  assert.equal(await page.getByTestId('weekly-personal-tips').count(), 0);
  await snap('weekly-monday-preview');
  paid = true;
  trial = true;
  await page.reload();
  await page.getByTestId('weekly-plan-paid-lock').waitFor();
  assert.equal(await page.getByTestId('edit-preferred-routine').count(), 0);
  await page.getByTestId('weekly-plan-day-1').click();
  await page.getByTestId('text-paywall-title').waitFor();
  assert.equal(
    await page.getByTestId('text-paywall-title').innerText(),
    'The rest of your week, with Plus',
  );
  await page.goBack();
  await page.getByTestId('weekly-plan-paid-lock').waitFor();
  trial = false;
  await page.reload();
  await page.getByTestId('weekly-personal-tips').waitFor();
  await page.getByTestId('weekly-plan-day-1').click();
  await page.getByText('Private food 1', { exact: true }).waitFor();
  await page.getByTestId('weekly-plan-day-0').click();
  await page.getByTestId('edit-preferred-routine').click();
  await page.getByTestId('routine-name-0').fill('Comfortable squat');
  await page.getByTestId('save-weekly-routine').click();
  await page.getByText('Comfortable squat', { exact: true }).waitFor();
  await page.reload();
  await page.getByText('Comfortable squat', { exact: true }).waitFor();
  for (const width of [375, 844]) {
    await page.setViewportSize({ width, height: 844 });
    await snap('weekly-paid-' + width);
    assert.ok(
      await page.evaluate(
        () => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth,
      ),
    );
  }
  await snap('weekly-paid-plan');
  paid = false;
  pro = false;
  await page.goto('http://127.0.0.1:8098/room?room=' + rid(0) + '&tab=chat');
  await page.getByTestId('room-chat-view').waitFor();
  const composer = page.getByTestId('chat-composer');
  await composer.getByRole('textbox').fill('Free squad chat check');
  await composer.getByTestId('btn-chat-send').click();
  await page.getByText('Free squad chat check', { exact: true }).waitFor();
  await snap('free-squad-chat');

  await page.setViewportSize({ width: 375, height: 844 });
  // Owner follow-up: empty-Squad widths, discovery, challenges and food library/editor.
  emptySquads = true;
  await page.goto('http://127.0.0.1:8098/today');
  await page.getByTestId('personal-day-card').waitFor();
  const emptyCard = await page.getByTestId('home-create-squad-end').boundingBox();
  const personalCard = await page.getByTestId('personal-day-card').boundingBox();
  assert(Math.abs(emptyCard.width - personalCard.width) <= 1);
  await snap('empty-squad-width');
  emptySquads = false;
  await page.goto('http://127.0.0.1:8098/friends');
  await page.getByTestId('community-person-' + uid(1)).waitFor();
  assert.equal(await page.locator('[data-testid^="community-person-"]').count(), 5);
  await snap('five-goal-suggestions');
  await page.goto('http://127.0.0.1:8098/progress');
  await page.getByTestId('you-tabs-challenges').click();
  await page.getByTestId('challenges-view').waitFor();
  await snap('you-challenges');
  await page.getByTestId('you-tabs-diary').click();
  await page.getByTestId('you-daily-macros').waitFor();
  for (const [label, color] of [
    ['Protein', 'rgb(46, 192, 131)'],
    ['Carbs', 'rgb(255, 255, 255)'],
    ['Fat', 'rgb(246, 92, 88)'],
  ]) {
    assert.equal(
      await page
        .getByTestId('you-daily-macros')
        .getByText(label, { exact: true })
        .evaluate((node) => globalThis.getComputedStyle(node).color),
      color,
    );
  }
  await page.goto('http://127.0.0.1:8098/today');
  await page.getByTestId('btn-add-food-lunch').click();
  await page.getByTestId('input-food-search').fill('chicken');
  const searchRow = page.locator('[data-testid^="search-result-"]').first();
  await searchRow.waitFor();
  await searchRow.locator('[data-testid^="favorite-food-"]').click();
  await page.waitForFunction(
    () =>
      !globalThis.document.querySelector('[data-testid^="favorite-food-"][aria-disabled="true"]'),
  );
  await page.getByTestId('tab-log-favorites').click();
  await page.locator('[data-testid^="favorite-result-"]').first().waitFor();
  assert.equal(foodLibrary.foods.length, 1);
  await snap('food-and-recipe-favorites');
  await page.getByTestId('tab-log-search').click();
  await page.locator('[data-testid^="search-result-"]').first().click();
  await page.getByTestId('unit-pill-g').click();
  await page.getByTestId('input-quantity-amount').fill('100');
  await page.getByTestId('edit-nutrition').click();
  await page.getByTestId('edit-nutrient-protein').fill('50');
  await snap('edited-food-macros');
  await page.getByTestId('btn-submit-quantity').click();
  await page.getByTestId('input-food-search').waitFor({ state: 'hidden' });
  assert(
    trackingRequests.some((request) =>
      request.p_changes.some(
        (change) => change.entity === 'food_entries' && change.payload.protein === 50,
      ),
    ),
  );
  await page.getByTestId('btn-add-food-lunch').click();
  await page.getByTestId('clear-food-search-history').click();
  await page.waitForTimeout(100);
  assert.deepEqual(foodLibrary.searches, []);
  assert.equal(foodLibrary.foods.length, 1);
  await page.getByTestId('btn-create-custom-food').click();
  await page.getByTestId('input-custom-food-name').fill('My custom food');
  await page.getByTestId('input-custom-food-calories').fill('450');
  await page.getByTestId('input-custom-food-protein').fill('50');
  await page.getByTestId('input-custom-food-carbs').fill('30');
  await page.getByTestId('input-custom-food-fat').fill('10');
  await page.getByTestId('btn-submit-custom-food').click();
  await page.getByTestId('btn-submit-quantity').waitFor();
  await snap('custom-food-portion');
  await page.getByTestId('btn-submit-quantity').click();
  await page.getByTestId('input-food-search').waitFor({ state: 'hidden' });

  paid = false;
  pro = false;
  trial = false;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:8098/paywall');
  assert.equal(await page.locator('select').count(), 0);
  await page.getByText('\u20b91,499.00 / year', { exact: true }).waitFor();
  await page.evaluate(() => {
    globalThis.__razorpayDismiss = true;
  });
  await page.getByTestId('btn-paywall-cta').click();
  await page
    .getByText('Checkout was cancelled. Your plan has not changed.', { exact: true })
    .waitFor();
  await page.evaluate(() => {
    globalThis.__razorpayDismiss = false;
  });
  await page.getByTestId('btn-paywall-cta').click();
  await page.getByText('Check plan status', { exact: true }).waitFor();
  assert.ok(billingRequests.some((body) => body.action === 'verify'));
  await snap('razorpay-pending');
  razorpayConfirmed = true;
  paid = true;
  await page.getByTestId('modal-purchase-success').waitFor();
  await page.goto('http://127.0.0.1:8098/paywall');
  await page.getByTestId('btn-paywall-cta').click();
  await page.getByTestId('btn-razorpay-cancel').click();
  assert.equal(cancelRenewal, false);
  await page.getByTestId('btn-confirm-razorpay-cancel').click();
  await page
    .getByText('Renewal stopped. Your current access continues until its expiry date.', {
      exact: true,
    })
    .first()
    .waitFor();
  assert.equal(cancelRenewal, true);
  await snap('razorpay-management');
  paid = false;
  razorpayConfirmed = false;
  billingCountry = 'US';
  await page.setViewportSize({ width: 375, height: 844 });
  await page.goto('http://127.0.0.1:8098/paywall');

  await page.getByText('$29.99 / year', { exact: true }).waitFor();
  await snap('international-web-prices');
  await page.getByTestId('btn-paywall-cta').click();
  await page.waitForURL('https://checkout.dodopayments.com/fixture');
  assert.deepEqual(errors, []);
  console.log(
    'November 4 browser audit: nutrient text colours, full-width empty Home, five goal suggestions, restored Challenges, food favourites/search clearing, custom food and acknowledged 50g protein correction, plus previous food/polish coverage, chronological nested/tab/Log Back, inline member selection, stable idle Compare, acknowledged peer-food copying, Monday-only Free/trial, full paid week/tips and persisted routine editing, India Razorpay dismissal/pending/verified access/confirmed cancellation and international Dodo routing passed at 375/390/844px',
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
