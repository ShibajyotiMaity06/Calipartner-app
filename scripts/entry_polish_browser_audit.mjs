// Local guest-flow audit. External requests are blocked; no real accounts or payments.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
const cache = path.join(process.env.LOCALAPPDATA, 'npm-cache', '_npx');
const installed = fs
  .readdirSync(cache)
  .map((name) => path.join(cache, name, 'node_modules/playwright/index.mjs'))
  .find((file) => fs.existsSync(file));
if (!installed) throw new Error('Use the locally installed Playwright for this audit.');
const { chromium } = await import(`file:///${installed.replaceAll('\\', '/')}`);
const root = path.resolve('app/dist'),
  out = path.resolve('.artifacts/entry-polish');
fs.mkdirSync(out, { recursive: true });
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const candidate = path.resolve(root, '.' + decodeURIComponent(url.pathname));
  const file =
    candidate.startsWith(root + path.sep) &&
    fs.existsSync(candidate) &&
    fs.statSync(candidate).isFile()
      ? candidate
      : path.join(root, 'app-shell.html');
  const mime = {
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.html': 'text/html',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.ttf': 'font/ttf',
    '.wasm': 'application/wasm',
  };
  res.writeHead(200, { 'Content-Type': mime[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((resolve) => server.listen(8105, '127.0.0.1', resolve));
const browser = await chromium.launch({
  headless: true,
  executablePath: path.join(
    process.env.LOCALAPPDATA,
    'ms-playwright/chromium-1243/chrome-win64/chrome.exe',
  ),
});
const errors = [];
try {
  for (const theme of ['light', 'yellow']) {
    const context = await browser.newContext({
      viewport: { width: theme === 'light' ? 320 : 390, height: 844 },
      reducedMotion: 'reduce',
    });
    await context.addInitScript(
      (value) => globalThis.localStorage.setItem('calipartner.appearance', value),
      theme,
    );
    await context.route('**/*', (route) =>
      new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort(),
    );
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('http://127.0.0.1:8105/');
    await page.getByTestId('onboarding-title').waitFor({ timeout: 30000 });
    assert.match(page.url(), /onboarding/);
    await page.getByTestId('btn-onboarding-next').click();
    await page.getByTestId('btn-onboarding-next').click();
    await page.getByTestId('body-stats-pickers').waitFor();
    await page.getByTestId('input-nickname').fill('Alex');
    await page.getByTestId('weight-ruler-select').click();
    await page.getByTestId('height-cm-wheel-select').click();
    await page.getByTestId('age-wheel-select').click();
    await page.getByTestId('weight-ruler-increase').click();
    assert.match(await page.getByTestId('weight-value').innerText(), /70.5/);
    await page.getByTestId('height-cm-wheel-scroll').hover();
    await page.mouse.wheel(0, 96);
    await page.waitForFunction(
      () =>
        globalThis.document.querySelector('[data-testid="height-cm-wheel-select"]')?.textContent !==
        '175 cm',
    );
    await page.getByTestId('weight-ruler-scroll').hover();
    await page.mouse.wheel(24, 0);
    await page.waitForFunction(
      () =>
        globalThis.document.querySelector('[data-testid="weight-value"]')?.textContent !==
        '70.5 kg',
    );
    const savedWeight = await page.getByTestId('weight-value').innerText();
    await page.reload();
    await page.getByTestId('body-stats-pickers').waitFor();
    assert.equal(await page.getByTestId('input-nickname').inputValue(), 'Alex');
    assert.equal(await page.getByTestId('weight-value').innerText(), savedWeight);
    await page.getByTestId('weight-units').getByRole('tab', { name: 'lb', exact: true }).click();
    await page.getByTestId('height-cm-wheel').waitFor();
    assert.equal(await page.getByTestId('btn-header-upgrade').count(), 0);
    await page
      .getByTestId('height-units')
      .getByRole('tab', { name: 'ft / in', exact: true })
      .click();
    await page.getByTestId('height-ft-wheel').waitFor();
    await page.getByTestId('height-ft-wheel').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(out, `height-wheels-${theme}.png`) });
    await page.getByTestId('weight-units').getByRole('tab', { name: 'kg', exact: true }).click();
    assert.equal(await page.getByTestId('weight-value').innerText(), savedWeight);
    await page.screenshot({ path: path.join(out, `pickers-${theme}.png`), fullPage: true });
    await page.getByTestId('btn-onboarding-next').click();
    await page.getByTestId('growth-projection-step').waitFor();
    assert.match(await page.getByTestId('growth-disclosure').innerText(), /not measured results/);
    await page.screenshot({ path: path.join(out, `growth-${theme}.png`), fullPage: true });
    assert(
      await page.evaluate(
        () => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth,
      ),
    );
    await page.getByTestId('btn-onboarding-next').click();
    await page.getByTestId('btn-onboarding-next').click();
    await page.getByTestId('btn-onboarding-next').click();
    await page.getByTestId('setup-create-account').waitFor();
    await page.screenshot({ path: path.join(out, `account-${theme}.png`), fullPage: true });
    await page.getByTestId('setup-create-account').click();
    await page.getByTestId('input-email').waitFor();
    await context.close();
  }
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'no-preference',
  });
  await context.route('**/*', (route) =>
    new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort(),
  );
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:8105/');
  await page.getByTestId('animated-logo-splash').waitFor();
  await page.screenshot({ path: path.join(out, 'splash.png') });
  await page.getByTestId('onboarding-title').waitFor({ timeout: 20000 });
  const primary = page.getByTestId('btn-onboarding-next');
  assert.equal(
    await primary.evaluate((node) => globalThis.getComputedStyle(node).borderRadius),
    '16px',
  );
  assert((await primary.boundingBox()).height >= 44);
  await primary.hover();
  await page.mouse.down();
  await page.waitForFunction(() =>
    globalThis
      .getComputedStyle(globalThis.document.querySelector('[data-testid="btn-onboarding-next"]'))
      .transform.includes('0.985'),
  );
  await page.mouse.up();
  await context.close();
  assert.deepEqual(errors, []);
  console.log(
    'Entry browser audit: PASS — brown/apricot despite saved Light, 320/390px, guest draft restore, unit toggles, growth chart, deferred account entry, animated/reduced-motion launch.',
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
