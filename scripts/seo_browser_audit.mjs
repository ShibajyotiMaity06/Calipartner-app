// Local verification only. No real messages, payments or account mutations.
/* global document, innerWidth */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
const npmCache = path.join(process.env.LOCALAPPDATA, 'npm-cache', '_npx');
const installed = fs
  .readdirSync(npmCache)
  .map((name) => path.join(npmCache, name, 'node_modules/playwright/index.mjs'))
  .find((file) => fs.existsSync(file));
if (!installed) throw new Error('Use the existing local Playwright installation for this audit.');
const { chromium } = await import(`file:///${installed.replaceAll('\\', '/')}`);
const root = path.resolve('app/dist');
const out = path.resolve('.artifacts/seo');
fs.mkdirSync(out, { recursive: true });
const config = JSON.parse(fs.readFileSync('app/vercel.json', 'utf8'));
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  let file;
  for (const route of config.routes) {
    if (route.continue) continue;
    if (route.handle === 'filesystem') {
      const candidate = path.resolve(root, '.' + pathname);
      if (
        candidate.startsWith(root + path.sep) &&
        fs.existsSync(candidate) &&
        fs.statSync(candidate).isFile()
      ) {
        file = candidate;
        break;
      }
      continue;
    }
    const regex = new RegExp(`^${route.src}$`);
    if (!regex.test(pathname)) continue;
    if (route.status === 301) {
      res.writeHead(301, { Location: pathname.replace(regex, route.headers.Location) });
      res.end();
      return;
    }
    res.statusCode = route.status ?? 200;
    file = path.resolve(root, '.' + pathname.replace(regex, route.dest));
    break;
  }
  if (!file || !file.startsWith(root + path.sep) || !fs.existsSync(file)) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.setHeader(
    'Content-Type',
    {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.ttf': 'font/ttf',
      '.wasm': 'application/wasm',
      '.xml': 'application/xml',
    }[path.extname(file)] ?? 'text/plain',
  );
  fs.createReadStream(file).pipe(res);
});
await new Promise((resolve) => server.listen(8106, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:8106';
let browser;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  const paths = [
    '/',
    '/features',
    '/pricing',
    '/download',
    '/privacy',
    '/terms',
    '/support',
    '/delete-account',
  ];
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const url of paths) {
      const response = await page.goto(origin + url);
      assert.equal(response.status(), 200);
      assert.equal(await page.locator('h1').count(), 1);
      assert.equal(
        await page.locator('link[rel=canonical]').getAttribute('href'),
        'https://app.calipartner.site' + url,
      );
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
        `${url} overflow at ${width}`,
      );
      const targets = await page.locator('a:not(.skip)').evaluateAll((nodes) =>
        nodes.map((node) => ({
          name: node.textContent,
          width: node.getBoundingClientRect().width,
          height: node.getBoundingClientRect().height,
        })),
      );
      assert.ok(
        targets.every((target) => target.width >= 44 && target.height >= 44),
        JSON.stringify(targets),
      );
      assert.equal(
        await page.locator('a[href*="apps.apple.com"], a[href*="play.google.com"]').count(),
        0,
      );
    }
    await page.goto(origin + '/');
    await page.screenshot({ path: path.join(out, `home-${width}.png`), fullPage: true });
  }
  console.log('Static pages passed; checking enlarged text.');
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto(origin + '/privacy');
  await page.evaluate(() => {
    document.body.style.fontSize = '36px';
    document.querySelector('h1').style.fontSize = '72px';
    document.querySelectorAll('h2').forEach((node) => {
      node.style.fontSize = '52px';
    });
  });
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    true,
    '200% text should wrap',
  );
  await page.screenshot({ path: path.join(out, 'privacy-large-text.png'), fullPage: true });
  assert.equal((await page.goto(origin + '/missing-page')).status(), 404);
  assert.equal((await page.goto(origin + '/privacy.html')).status(), 200);
  assert.equal(new URL(page.url()).pathname, '/privacy');
  console.log('Large text and routing passed; checking app entry.');
  const app = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await app.route('**/*.supabase.co/**', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'No test session' }),
    }),
  );
  await app.goto(origin + '/welcome');
  await app.getByTestId('welcome-audience').waitFor();
  assert.match(await app.getByTestId('welcome-trial').innerText(), /No card/);
  await app.getByTestId('link-privacy-policy').click();
  await app.getByText('AI processing and consent', { exact: true }).waitFor();
  await app.getByTestId('btn-terms-close').click();
  await app.getByTestId('btn-welcome-sign-in').click();
  await app.getByTestId('auth-browser-help').waitFor();
  await app.screenshot({ path: path.join(out, 'sign-in-browser-help.png'), fullPage: true });
  console.log('App legal and sign-in passed; checking offline shell.');
  await app.evaluate(async () => {
    await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('SW readiness timeout')), 10000),
      ),
    ]);
  });
  await app.goto(origin + '/privacy');
  await app.context().setOffline(true);
  await app.goto(origin + '/welcome');
  await app.getByTestId('welcome-title').waitFor();
  await app.context().setOffline(false);
  console.log(
    'SEO browser audit: 8 static pages at 375/1280px without JavaScript, 44px targets, 200% text, real 404/redirect, legal privacy tab, sign-in guidance and offline app shell after visiting public pages passed.',
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
