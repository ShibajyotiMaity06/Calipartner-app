import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';

export async function harness({ ref, saved }, run) {
  const npmCache = path.join(process.env.LOCALAPPDATA, 'npm-cache', '_npx');
  const installed = fs
    .readdirSync(npmCache)
    .map((name) => path.join(npmCache, name, 'node_modules', 'playwright', 'index.mjs'))
    .find((file) => fs.existsSync(file));
  if (!installed) throw new Error('Playwright is required for the explicit browser audit.');
  const { chromium } = await import(`file:///${installed.replaceAll('\\', '/')}`);
  const root = path.resolve(process.env.ROOM_AUDIT_EXPORT ?? '.cache/profile-room-export-final');
  const server = http.createServer((req, res) => {
    let file = path.resolve(root, '.' + decodeURIComponent((req.url ?? '/').split('?')[0]));
    if (
      !file.startsWith(root + path.sep) ||
      !fs.existsSync(file) ||
      fs.statSync(file).isDirectory()
    )
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
  for (let attempt = 0; ; attempt++) {
    try {
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(8096, '127.0.0.1', () => {
          server.removeListener('error', reject);
          resolve();
        });
      });
      break;
    } catch (error) {
      if (error.code !== 'EADDRINUSE' || attempt >= 120) throw error;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const open = async (account, route) => {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        reducedMotion: 'reduce',
      });
      await context.addInitScript(
        ({ session, key }) => {
          if (globalThis.location.hostname === '127.0.0.1') {
            globalThis.localStorage.setItem(key, JSON.stringify(session));
            globalThis.localStorage.setItem(key + '.last-online', String(Date.now()));
          }
        },
        { session: account.session, key: `sb-${ref}-auth-token` },
      );
      const page = await context.newPage();
      page.setDefaultTimeout(30000);
      page.setDefaultNavigationTimeout(60000);
      page.on('pageerror', (error) => console.log('BROWSER ERROR', error.message.slice(0, 250)));
      page.on('response', async (r) => {
        const pathname = new URL(r.url()).pathname;
        if (
          r.status() >= 400 &&
          (pathname.includes('/rpc/') || pathname.includes('/functions/v1/'))
        ) {
          const b = await r.json().catch(() => ({}));
          console.log(
            'AUDIT REQUEST FAILED',
            pathname,
            r.status(),
            b.error ?? b.message ?? 'unavailable',
          );
        }
      });
      page.on('requestfailed', (r) =>
        console.log(
          'AUDIT NETWORK FAILURE',
          new URL(r.url()).pathname.split('/').slice(0, 3).join('/'),
          r.failure()?.errorText,
        ),
      );
      await page.goto(`http://127.0.0.1:8096${route}`);
      return page;
    };
    await run({ saved, open });
  } catch (error) {
    for (const [index, page] of (browser?.contexts().flatMap((c) => c.pages()) ?? []).entries()) {
      await page.screenshot({ path: `.cache/room-audit-failure-${index}.png` }).catch(() => {});
      console.log(
        'AUDIT SCREEN',
        index,
        (
          await page
            .locator('body')
            .innerText()
            .catch(() => '')
        ).slice(-1200),
      );
    }
    throw error;
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
}
export async function pendingBrowser(options) {
  await harness(options, async ({ saved, open }) => {
    const page = await open(saved.accounts[0], '/room');
    await page.getByTestId('room-waiting-state').waitFor({ timeout: 60000 });
    assert.equal(await page.getByTestId('room-extras').count(), 0);
    await page.screenshot({ path: '.cache/profile-room-pending.png', fullPage: true });
    console.log('PASS Browser: pending room only shows waiting/code controls');
  });
}
export async function runRoomsBrowser(options) {
  await harness(options, async ({ saved, open }) => {
    const switchRoom = async (page, id) => {
      await page.getByTestId('btn-room-title-switcher').waitFor({ timeout: 60000 });
      await page.getByTestId('btn-room-title-switcher').click();
      const response = page.waitForResponse(
        async (result) =>
          result.url().includes('/rpc/get_room_snapshot') &&
          (await result.json().catch(() => ({}))).room?.id === id,
        { timeout: 60000 },
      );
      await page.getByTestId(`btn-switch-room-${id}`).click();
      await response;
      await page.waitForFunction(
        () => !globalThis.document.querySelector('[data-testid=room-loading]'),
      );
    };
    const page = await open(saved.accounts[0], '/me');
    await page.getByTestId('screen-me').waitFor({ timeout: 60000 });
    await page.getByTestId('toggle-plan-details').waitFor({ timeout: 60000 });
    for (const width of [320, 390, 430, 844]) {
      await page.setViewportSize({ width, height: width === 844 ? 390 : 844 });
      assert.equal(
        await page.getByTestId('screen-me').evaluate((el) => el.scrollWidth > el.clientWidth),
        false,
        `Profile width ${width}`,
      );
    }
    await page.setViewportSize({ width: 390, height: 844 });
    const dimensions = await page
      .getByTestId('profile-scroll')
      .evaluate((el) => ({ content: el.scrollHeight, viewport: el.clientHeight }));
    console.log('PROFILE scroll dimensions', JSON.stringify(dimensions));
    await page.screenshot({ path: '.cache/profile-compact.png', fullPage: true });
    for (const name of ['preferences', 'privacy', 'storage', 'help']) {
      const toggle = page.getByTestId(`section-${name}`);
      await toggle.click();
      await page.getByTestId(`section-${name}-content`).waitFor();
      await toggle.click();
      assert.equal(await page.getByTestId(`section-${name}-content`).count(), 0);
    }
    await page.getByTestId('section-preferences').click();
    await page.screenshot({ path: '.cache/profile-preferences-open.png', fullPage: true });
    await page.getByTestId('screen-me').evaluate((root) => {
      root.querySelectorAll('[dir="auto"]').forEach((node) => {
        const style = globalThis.getComputedStyle(node);
        node.style.fontSize = `${parseFloat(style.fontSize) * 2}px`;
        node.style.lineHeight = `${parseFloat(style.lineHeight) * 2}px`;
      });
    });
    assert.equal(
      await page.getByTestId('screen-me').evaluate((el) => el.scrollWidth > el.clientWidth),
      false,
      'Profile 200% text',
    );
    await page.screenshot({ path: '.cache/profile-200-percent.png', fullPage: true });
    console.log(
      'PASS Browser: compact profile widths, section actions, reduced motion and 200% text',
    );
    await page.goto('http://127.0.0.1:8096/friends');
    await page.getByTestId('community-panel').waitFor({ timeout: 60000 });
    await page.getByTestId('community-suggestions-hint').waitFor();
    await page.waitForFunction(
      () =>
        !globalThis.document
          .querySelector('[data-testid="community-panel"]')
          ?.textContent?.includes('Loading'),
    );
    assert((await page.locator('[data-testid^="community-person-"]').count()) <= 5);
    assert.equal(await page.getByTestId('load-more-friends').count(), 0);
    await page.getByTestId('friend-username-search').fill(saved.accounts[1].username);
    await page.getByTestId(`community-person-${saved.accounts[1].id}`).waitFor({ timeout: 15000 });
    await page.screenshot({ path: '.cache/profile-community-search.png', fullPage: true });
    console.log('PASS Browser: five suggestions, no browse pagination, cross-goal username search');
    await page.goto('http://127.0.0.1:8096/room');
    await switchRoom(page, saved.group.room_id);
    await page.getByTestId('hero-paired-card').waitFor({ timeout: 60000 });
    await page.getByTestId('room-overview-section').waitFor({ timeout: 60000 });
    await page.getByTestId('input-search-overview').fill(saved.accounts[19].username);
    await page.getByTestId(`overview-card-${saved.accounts[19].id}`).waitFor();
    await page.getByTestId(`overview-card-${saved.accounts[19].id}`).click();
    await page.getByTestId('input-search-overview').fill('');
    await page.screenshot({ path: '.cache/profile-room-20-today.png', fullPage: true });
    const todayDimensions = await page
      .getByTestId('screen-room')
      .evaluate((el) =>
        Math.max(...Array.from(el.querySelectorAll('*')).map((node) => node.scrollHeight)),
      );
    console.log('ROOM20 Today largest scroll height', todayDimensions);
    console.log(
      'OBSERVATION Room capacity notice:',
      (await page.getByTestId('sheet-room-full-host').innerText()).replaceAll('\n', ' '),
    );
    await page.getByTestId('room-tab-members').click();
    await page.getByTestId(`member-row-${saved.accounts[19].id}`).waitFor();
    assert.equal(await page.locator('[data-testid^="member-row-"]').count(), 20);
    await page.screenshot({ path: '.cache/profile-room-20-members.png', fullPage: true });
    await page.getByTestId('room-tab-progress').click();
    await page.getByTestId('room-progress-segment').waitFor({ timeout: 60000 });
    await page.getByTestId('room-progress-segment-open-member-picker').waitFor({ timeout: 60000 });
    await page.getByTestId('room-progress-segment-open-member-picker').click();
    await page.getByTestId('room-progress-segment-search-input').fill(saved.accounts[19].username);
    await page
      .getByTestId(`progress-member-option-${saved.accounts[19].id}`)
      .waitFor({ timeout: 20000 });
    await page.getByTestId(`progress-member-option-${saved.accounts[19].id}`).click();
    await page.getByTestId('close-progress-member-picker').click();
    await page.screenshot({ path: '.cache/profile-room-20-progress.png', fullPage: true });
    await page.getByTestId('room-tab-chat').click();
    await page.getByTestId('room-chat-segment').waitFor({ timeout: 60000 });
    await page.getByText('Hosted room audit message', { exact: true }).waitFor({ timeout: 30000 });
    await page.screenshot({ path: '.cache/profile-room-20-chat.png', fullPage: true });
    console.log(
      'PASS Browser: 20-member overview search/selection, complete roster, progress picker and paid chat',
    );
    const free = await open(saved.accounts[5], '/room');
    await switchRoom(free, saved.group.room_id);
    await free.getByTestId('basic-room-summary').waitFor({ timeout: 60000 });
    assert.equal(await free.getByTestId('room-tab-members').count(), 0);
    await free.getByTestId('room-tab-chat').click();
    await free.getByTestId('upgrade-room-chat').waitFor();
    await free.screenshot({ path: '.cache/profile-room-free-chat.png', fullPage: true });
    for (const room of saved.proRooms.filter((room) => room.count < 20)) {
      await switchRoom(page, room.id);
      await page.getByTestId('hero-paired-card').waitFor({ timeout: 60000 });
      assert.equal(await page.getByTestId('room-tab-members').count(), room.count > 2 ? 1 : 0);
      assert.equal(await page.getByTestId('room-overview-section').count(), room.count > 2 ? 1 : 0);
      await page.screenshot({
        path: `.cache/profile-room-pro-${room.count}-today.png`,
        fullPage: true,
      });
      await page.getByTestId('room-tab-chat').click();
      await page.getByTestId('room-chat-segment').waitFor();
      await page.getByTestId('room-tab-progress').click();
      await page.getByTestId('room-progress-segment').waitFor();
    }
    const plusPage = await open(saved.accounts[1], '/room');
    for (const room of saved.plusRooms) {
      await switchRoom(plusPage, room.id);
      if (room.count === 1) await plusPage.getByTestId('room-waiting-state').waitFor();
      else await plusPage.getByTestId('hero-paired-card').waitFor({ timeout: 60000 });
      assert.equal(await plusPage.getByTestId('room-tab-members').count(), room.count > 2 ? 1 : 0);
      await plusPage.screenshot({
        path: `.cache/profile-room-plus-${room.count}-today.png`,
        fullPage: true,
      });
    }
    await switchRoom(plusPage, saved.group.room_id);
    await plusPage.getByTestId('btn-accept-shared-meal').waitFor({ timeout: 20000 });
    await plusPage.getByTestId('btn-accept-shared-meal').click();
    await plusPage
      .getByTestId('btn-accept-shared-meal')
      .waitFor({ state: 'hidden', timeout: 20000 });
    for (const [index, paid] of [
      [2, true],
      [3, false],
      [6, true],
      [7, false],
      [8, false],
    ]) {
      const memberPage = await open(saved.accounts[index], '/room');
      if (index === 6 || index === 7) await switchRoom(memberPage, saved.group.room_id);
      await memberPage
        .getByTestId(paid ? 'hero-paired-card' : 'basic-room-summary')
        .waitFor({ timeout: 60000 });
      assert.equal(await memberPage.getByTestId('room-tab-members').count(), paid ? 1 : 0);
      await memberPage.getByTestId('room-tab-chat').click();
      await memberPage.getByTestId(paid ? 'room-chat-segment' : 'upgrade-room-chat').waitFor();
      await memberPage.screenshot({
        path: `.cache/profile-room-plan-${index}-chat.png`,
        fullPage: true,
      });
      await memberPage.close();
    }
    console.log(
      'PASS Browser matrix: Pro five rooms, Plus three rooms, 1/2/3/4/5/20 members and trial/grace/expired/Free plan gates',
    );
    const pair = await open(saved.accounts[21], '/room');
    await pair.getByTestId('basic-room-summary').waitFor({ timeout: 60000 });
    assert.equal(await pair.getByTestId('room-tab-members').count(), 0);
    assert.equal(await pair.getByTestId('room-overview-section').count(), 0);
    await pair.screenshot({ path: '.cache/profile-room-pair-today.png', fullPage: true });
    await pair.getByTestId('room-tab-progress').click();
    await pair
      .getByText(
        'Shared progress charts are included with Plus. Your daily room summary stays free.',
        { exact: true },
      )
      .waitFor();
    await pair.screenshot({ path: '.cache/profile-room-pair-progress.png', fullPage: true });
    await options.plan(21, 'plus');
    await pair.reload();
    await pair.getByTestId('hero-paired-card').waitFor({ timeout: 60000 });
    assert.equal(await pair.getByTestId('room-tab-members').count(), 0);
    await pair.screenshot({ path: '.cache/profile-room-pair-paid-today.png', fullPage: true });
    await pair.getByTestId('room-tab-progress').click();
    await pair.getByTestId('room-progress-segment').waitFor();
    await pair.screenshot({ path: '.cache/profile-room-pair-paid-progress.png', fullPage: true });
    console.log('PASS Browser: Free member chat/roster gates and one-on-one Today/progress');
  });
}
export async function runRoomManagementBrowser(options) {
  await harness(options, async ({ saved, open }) => {
    const page = await open(saved.accounts[0], '/room');
    const select = async (id) => {
      await page.getByTestId('btn-room-title-switcher').waitFor({ timeout: 60000 });
      await page.getByTestId('btn-room-title-switcher').click();
      await page.getByTestId(`btn-switch-room-${id}`).click();
      await page.getByTestId('hero-paired-card').waitFor({ timeout: 60000 });
    };
    await select(saved.group.room_id);
    await page.getByTestId('room-tab-members').click();
    await page.waitForFunction(
      () => globalThis.document.querySelectorAll('[data-testid^="member-row-"]').length === 19,
      {},
      { timeout: 30000 },
    );
    await page.screenshot({ path: '.cache/profile-room-19-members.png', fullPage: true });
    await page.getByTestId('room-tab-progress').click();
    await page.getByTestId('room-progress-segment').waitFor({ timeout: 30000 });
    await page.screenshot({ path: '.cache/profile-room-19-progress.png', fullPage: true });
    await select(saved.proRooms.find((r) => r.count === 5).id);
    page.on('dialog', (dialog) => dialog.accept());
    await page.getByTestId('btn-room-settings').click();
    await page.getByTestId('radio-any-member-invite').click();
    await page.getByTestId('radio-any-member-invite').waitFor();
    await page.getByTestId(`btn-remove-member-${saved.accounts[7].id}`).click();
    await page
      .getByTestId(`btn-remove-member-${saved.accounts[7].id}`)
      .waitFor({ state: 'hidden', timeout: 30000 });
    await page.getByTestId(`btn-make-host-${saved.accounts[4].id}`).click();
    await page.getByTestId('radio-any-member-invite').waitFor({ state: 'hidden', timeout: 30000 });
    await page.getByTestId('btn-close-room-settings').click();
    const projection = await options.rpc(saved.accounts[0].c, 'get_my_rooms');
    const changed = projection.find((r) => r.id === saved.proRooms.find((r) => r.count === 5).id);
    assert.equal(changed.role, 'member');
    assert.equal(changed.member_count, 4);
    assert.equal(changed.who_can_invite, 'any_member');
    console.log(
      'PASS Browser: 19-member roster/progress; actual settings permissions, removal and host transfer',
    );
  });
}
