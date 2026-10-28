import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
const npmCache = path.join(process.env.LOCALAPPDATA, 'npm-cache', '_npx');
const installed = fs
  .readdirSync(npmCache)
  .map((name) => path.join(npmCache, name, 'node_modules', 'playwright', 'index.mjs'))
  .find((file) => fs.existsSync(file));
if (!installed) throw new Error('Playwright is required for this explicit browser audit.');
const { chromium } = await import(`file:///${installed.replaceAll('\\', '/')}`);
const record = '.cache/challenge-audit-users.json';
const saved = JSON.parse(fs.readFileSync(record, 'utf8'));
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
const keys = await (
  await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys`, {
    headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}` },
  })
).json();
const [a, b] = saved.accounts;
const client = createClient(url, keys.find((k) => k.name === 'anon').api_key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
await client.auth.setSession(a.session);
const home = await client.rpc('challenge_home');
if (home.error) throw home.error;
const complete = home.data.items.find((item) => item.self.status === 'completed');
assert.ok(complete);
const root = path.resolve('.cache/challenges-export');
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
      '.wasm': 'application/wasm',
      '.json': 'application/json',
    }[path.extname(file)] ?? 'application/octet-stream',
  );
  fs.createReadStream(file)
    .on('error', () => {
      res.statusCode = 503;
      res.end('Export unavailable');
    })
    .pipe(res);
});
await new Promise((resolve) => server.listen(8098, '127.0.0.1', resolve));
let browser, page;
const errors = [];
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const makeContext = async (account) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      acceptDownloads: true,
    });
    await context.addInitScript(
      ({ session, key }) => {
        if (globalThis.location.hostname === '127.0.0.1') {
          globalThis.localStorage.setItem(key, JSON.stringify(session));
          globalThis.localStorage.setItem(key + '.last-online', String(Date.now()));
          Object.defineProperty(globalThis.navigator, 'canShare', {
            value: () => false,
            configurable: true,
          });
        }
      },
      { session: account.session, key: `sb-${ref}-auth-token` },
    );
    context.on('request', (request) => {
      if (!request.url().endsWith('/challenges-api')) return;
      try {
        const body = request.postDataJSON();
        if (['create', 'occasion'].includes(body.action) && !saved.challenges.includes(body.id)) {
          saved.challenges.push(body.id);
          fs.writeFileSync(record, JSON.stringify(saved));
        }
      } catch {
        /* Ignore requests without a JSON body. */
      }
    });
    return context;
  };
  const context = await makeContext(a);
  page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.text().includes('challenge-create'))
      console.log('BROWSER', m.text().slice(0, 250));
  });
  await page.goto('http://127.0.0.1:8098/progress?tab=challenges');
  await page.getByTestId('progress-challenges-view').waitFor({ timeout: 60000 });
  await page.getByTestId('challenge-trophies').waitFor({ timeout: 60000 });
  assert.equal(await page.getByText('Priya', { exact: true }).count(), 0);
  assert.equal(await page.getByText('Rahul', { exact: true }).count(), 0);
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(
      await page
        .getByTestId('progress-challenges-view')
        .evaluate((el) => el.scrollWidth > el.clientWidth),
      false,
      `Challenge home must fit ${width}px`,
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId('progress-challenges-view').evaluate((root) => {
    globalThis.__challengeTextStyles = Array.from(root.querySelectorAll('[dir="auto"]')).map(
      (node) => [node, node.getAttribute('style')],
    );
    for (const [node] of globalThis.__challengeTextStyles) {
      const computed = globalThis.getComputedStyle(node);
      node.style.fontSize = `${parseFloat(computed.fontSize) * 2}px`;
      const line = parseFloat(computed.lineHeight);
      if (Number.isFinite(line)) node.style.lineHeight = `${line * 2}px`;
    }
  });
  assert.equal(
    await page
      .getByTestId('progress-challenges-view')
      .evaluate((node) => node.scrollWidth > node.clientWidth),
    false,
    'Challenge home must fit at 200% text',
  );
  await page.screenshot({ path: '.cache/challenges-large-text.png', fullPage: true });
  await page.evaluate(() => {
    for (const [node, style] of globalThis.__challengeTextStyles) {
      if (style === null) node.removeAttribute('style');
      else node.setAttribute('style', style);
    }
    delete globalThis.__challengeTextStyles;
  });
  await page.screenshot({ path: '.cache/challenges-home.png', fullPage: true });
  await page.getByTestId(`challenge-open-${complete.challenge.id}`).click();
  await page.getByTestId('challenge-detail-modal').waitFor();
  await page.getByText('You completed this challenge', { exact: true }).waitFor();
  assert.match(
    await page.getByTestId('challenge-percent-self').innerText(),
    /100%/,
    'Completed detail must show the final result rather than today’s empty progress',
  );
  const download = page.waitForEvent('download');
  await page.getByTestId('challenge-share').click();
  const image = await download;
  await image.saveAs('.cache/challenge-real-share.png');
  assert.ok(fs.statSync('.cache/challenge-real-share.png').size > 1000);
  await page.screenshot({ path: '.cache/challenges-completion.png', fullPage: true });
  await page.getByTestId('challenge-detail-modal-close').click();
  await page.getByTestId('challenge-trophies').click();
  await page.getByTestId('challenge-trophy-shelf').waitFor();
  await page.getByTestId('challenge-trophy-shelf-close').click();
  await page.getByTestId('progress-challenges-view-create-btn').click();
  await page.getByTestId('create-template-daily-steps').click();
  await page.getByTestId('challenge-scope-pair').click();
  await page.getByTestId(`challenge-partner-${b.id}`).click();
  await page.getByTestId('challenge-create-submit').click();
  await page.getByText('Challenge saved', { exact: true }).waitFor({ timeout: 45000 });
  await page.getByTestId('create-challenge-modal-close').click();
  const current = await client.rpc('challenge_home');
  const pending = current.data.items.find(
    (item) => item.challenge.status === 'invited' && item.challenge.scope === 'pair',
  );
  assert.ok(pending);
  const peerContext = await makeContext(b);
  const peerPage = await peerContext.newPage();
  peerPage.on('pageerror', (e) => errors.push(e.message));
  await peerPage.goto(
    `http://127.0.0.1:8098/progress?tab=challenges&challenge=${pending.challenge.id}`,
  );
  await peerPage.getByTestId('challenge-accept').waitFor({ timeout: 60000 });
  await peerPage.getByTestId('challenge-accept').click();
  await peerPage.getByTestId('challenge-accept').waitFor({ state: 'hidden', timeout: 45000 });
  await peerPage.screenshot({ path: '.cache/challenges-partner-accepted.png', fullPage: true });
  await context.setOffline(true);
  await page.getByText('Offline · showing saved progress', { exact: true }).first().waitFor();
  await page.getByTestId('progress-challenges-view-create-btn').click();
  await page.getByTestId('create-template-focus-streak').click();
  await page.getByTestId('challenge-create-submit').click();
  await page
    .getByText('Saved on this device. Your invitation will send when you reconnect.', {
      exact: true,
    })
    .waitFor();
  await page.getByTestId('create-challenge-modal-close').click();
  await page.getByText('Waiting to sync', { exact: true }).first().waitFor();
  await context.setOffline(false);
  await page
    .getByText('Waiting to sync', { exact: true })
    .first()
    .waitFor({ state: 'hidden', timeout: 60000 });
  await page.goto('http://127.0.0.1:8098/pair-start');
  await page.getByTestId('pair-start-screen').waitFor({ timeout: 30000 });
  await page.getByText('CaliPartner works best in pairs', { exact: true }).waitFor();
  await page.screenshot({ path: '.cache/challenges-pair-onboarding.png', fullPage: true });
  const guest = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const guestPage = await guest.newPage();
  await guestPage.goto(`http://127.0.0.1:8098/invite/${saved.pairToken}`);
  await guestPage.getByTestId('accept-onboarding-pair').waitFor({ timeout: 30000 });
  await guestPage.screenshot({ path: '.cache/challenges-invite-signup.png', fullPage: true });
  assert.deepEqual(errors, []);
  console.log(
    'PASS Browser: two-account create/accept, real completion/share PNG/trophies, responsive widths, offline queue/reconnect, pair onboarding and invite-before-signup; no uncaught runtime errors',
  );
} catch (error) {
  if (page) {
    console.log(
      'VIEW',
      await page
        .locator('body')
        .innerText()
        .catch(() => ''),
    );
    console.log('RUNTIME', JSON.stringify(errors));
    console.log(
      'LOCAL QUEUE',
      await page
        .evaluate(() => {
          const db = JSON.parse(globalThis.localStorage.getItem('calipartner_web_db') ?? '{}');
          return (db.local_challenge_outbox ?? []).map((row) => ({
            id: row.id,
            status: row.status,
            error: row.last_error,
            action: JSON.parse(row.payload).action,
          }));
        })
        .catch(() => []),
    );
  }
  if (page)
    await page
      .screenshot({ path: '.cache/challenges-browser-error.png', fullPage: true })
      .catch(() => {});
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  server.close();
}
