// Contract fixtures: all external requests are intercepted; no real users or payments.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
const npmCache = path.join(process.env.LOCALAPPDATA, 'npm-cache', '_npx');
const installed = fs
  .readdirSync(npmCache)
  .map((name) => path.join(npmCache, name, 'node_modules/playwright/index.mjs'))
  .find((file) => fs.existsSync(file));
if (!installed) throw new Error('Playwright is required.');
const { chromium } = await import(`file:///${installed.replaceAll('\\', '/')}`);
const root = path.resolve('app/dist'),
  out = path.resolve('.artifacts/entry-refresh');
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
const user = {
  id: 'fc040000-0000-4000-8000-000000000001',
  email: 'entry-fixture@example.invalid',
  aud: 'authenticated',
  role: 'authenticated',
  app_metadata: { provider: 'email' },
  user_metadata: {},
  created_at: '2026-11-04T00:00:00Z',
};
const profile = {
  ...user,
  username: 'entryfixture',
  nickname: 'Sam',
  timezone: 'America/New_York',
  height_cm: 175,
  sex: 'male',
  date_of_birth: '1995-01-01',
  country: null,
};
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
  const errors = [];
  for (const width of [375, 844]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 844 ? 390 : 844 },
      reducedMotion: 'reduce',
    });
    await context.route('**/*', (route) =>
      new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort(),
    );
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('http://127.0.0.1:8097/welcome');
    await page.getByTestId('welcome-logo').waitFor();
    await page.screenshot({ path: path.join(out, `welcome-${width}.png`), fullPage: true });
    await page.getByTestId('btn-welcome-get-started').click();
    await page.getByTestId('input-email').waitFor();
    assert.equal(await page.locator('input[type="password"]').count(), 0);
    await page.screenshot({ path: path.join(out, `signup-${width}.png`), fullPage: true });
    await page.getByTestId('auth-tab-signin').click();
    await page.getByText('Welcome back.', { exact: true }).waitFor();
    await page.screenshot({ path: path.join(out, `login-${width}.png`), fullPage: true });
    assert(
      await page.evaluate(
        () => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth,
      ),
    );
    await context.close();
  }
  for (const step of ['motivation', 'premium']) {
    for (const country of step === 'premium' ? ['IN', 'US'] : ['IN']) {
      const context = await browser.newContext({
        viewport: { width: 375, height: 844 },
        reducedMotion: 'reduce',
        timezoneId: 'America/New_York',
      });
      const billingCalls = [];
      let locationFails = false;
      await context.route('**/*', async (route) => {
        const request = route.request(),
          url = new URL(request.url());
        if (url.hostname === '127.0.0.1') return route.continue();
        if (url.host !== apiHost) return route.abort();
        let data = [],
          status = 200;
        if (url.pathname === '/auth/v1/user') data = user;
        else if (url.pathname.endsWith('/profiles')) data = [profile];
        else if (url.pathname.endsWith('/web-billing')) {
          const body = request.postDataJSON();
          billingCalls.push(body.action);
          if (locationFails) {
            status = 503;
            data = { error: 'BILLING_COUNTRY_REQUIRED' };
          } else if (body.action === 'routing') data = { country };
          else
            data = {
              provider: country === 'IN' ? 'razorpay' : 'dodo',
              products: ['plus_monthly', 'plus_annual', 'pro_monthly', 'pro_annual'].map((key) => ({
                key,
                currency: country === 'IN' ? 'INR' : 'USD',
                amount:
                  key === 'plus_monthly'
                    ? country === 'IN'
                      ? 249
                      : 4.99
                    : key === 'plus_annual'
                      ? country === 'IN'
                        ? 1499
                        : 29.99
                      : key === 'pro_monthly'
                        ? country === 'IN'
                          ? 499
                          : 9.99
                        : country === 'IN'
                          ? 2499
                          : 49.99,
                trialDays: key.startsWith('plus') ? 7 : 0,
              })),
            };
        } else if (url.pathname.includes('/rpc/')) {
          const name = url.pathname.split('/').at(-1);
          if (name === 'get_effective_entitlement') data = null;
        }
        if (request.headers().accept?.includes('vnd.pgrst.object+json') && Array.isArray(data))
          data = data[0] ?? null;
        await route.fulfill({
          status,
          contentType: 'application/json',
          body: JSON.stringify(data),
        });
      });
      await context.addInitScript(
        ({ user, ref, step }) => {
          const encode = (value) =>
            btoa(JSON.stringify(value))
              .replaceAll('=', '')
              .replaceAll('+', '-')
              .replaceAll('/', '_');
          const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, aud: 'authenticated', role: 'authenticated', exp: 4070908800 })}.fixture`;
          const key = `sb-${ref}-auth-token`;
          globalThis.localStorage.setItem(
            key,
            JSON.stringify({
              access_token: token,
              refresh_token: 'fixture',
              token_type: 'bearer',
              expires_in: 3600,
              expires_at: 4070908800,
              user,
            }),
          );
          globalThis.localStorage.setItem(key + '.last-online', String(Date.now()));
          globalThis.localStorage.setItem(
            'calipartner_web_db',
            JSON.stringify({
              local_onboarding_drafts: [
                {
                  user_id: user.id,
                  payload: JSON.stringify({
                    currentStep: step,
                    goal: 'bulk',
                    heightCm: 175,
                    weightKg: 70,
                    gymDays: 4,
                    sex: 'male',
                    dateOfBirth: '1995-01-01',
                  }),
                },
              ],
            }),
          );
        },
        { user, ref, step },
      );
      const page = await context.newPage();
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto('http://127.0.0.1:8097/onboarding');
      await page
        .getByTestId(step === 'premium' ? 'premium-highlights' : 'motivation-bulk')
        .waitFor();
      if (step === 'premium') {
        await page.getByTestId('onboarding-monthly-price').waitFor();
        assert(
          (await page.getByTestId('onboarding-monthly-price').innerText()).includes(
            country === 'IN' ? '₹249' : '$4.99',
          ),
        );
        assert.deepEqual(billingCalls.slice(0, 2), ['routing', 'catalog']);
        assert.equal(await page.locator('select').count(), 0);
        await page.getByTestId('onboarding-plan-pro').click();
        assert(
          (await page.getByTestId('btn-onboarding-next').innerText()).includes('Continue with Pro'),
        );
        await page.getByTestId('onboarding-plan-plus').click();
      }
      assert(
        await page.evaluate(
          () => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth,
        ),
      );
      await page.screenshot({ path: path.join(out, `${step}-${country}.png`), fullPage: true });
      if (step === 'premium') {
        assert((await page.getByTestId('btn-onboarding-free').boundingBox()).y < 844);
        await page.evaluate(() => {
          const text = [...globalThis.document.querySelectorAll('[dir="auto"]')].map((element) => [
            element,
            parseFloat(globalThis.getComputedStyle(element).fontSize),
            parseFloat(globalThis.getComputedStyle(element).lineHeight),
          ]);
          for (const [element, font, line] of text) {
            element.style.fontSize = font * 2 + 'px';
            if (Number.isFinite(line)) element.style.lineHeight = line * 2 + 'px';
          }
        });
        assert(
          await page.evaluate(
            () => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth,
          ),
        );
        await page.getByTestId('btn-onboarding-free').scrollIntoViewIfNeeded();
        await page.screenshot({
          path: path.join(out, `premium-${country}-large-text.png`),
          fullPage: true,
        });
        await page.getByTestId('btn-onboarding-next').click();
        await page.getByTestId('modal-paywall').waitFor();
        assert.equal(await page.locator('select').count(), 0);
        await page.getByTestId('btn-close-paywall').click();
      }
      await context.close();
    }
  }
  assert.deepEqual(errors, []);
  console.log(
    'Entry screen browser audit passed: Welcome/signup/login at 375/844px, onboarding previews, INR/USD routing, Pro without trial, no country dropdown.',
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
