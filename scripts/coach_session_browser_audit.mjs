// Local intercepted fixtures only; no hosted data is changed.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const source = fs.readFileSync('scripts/nov4_browser_audit.mjs', 'utf8');
const marker = '  const page = await context.newPage();';
if (!source.includes(marker)) throw new Error('Browser fixture harness changed');
const setup = source
  .slice(0, source.indexOf(marker))
  .replace("path.resolve('app/dist')", "path.resolve('.artifacts/followup-export')")
  .replace(
    "out = path.resolve('.artifacts/food-polish/browser')",
    "out = path.resolve('.artifacts/coach-session/browser')",
  )
  .replace('let pro = false;', 'let pro = true;')
  .replace('let paid = false,', 'let paid = true,')
  .replace(
    "} else if (url.pathname.endsWith('/ai-coach')) {",
    "} else if (url.pathname.endsWith('/ai-coach')) { await new Promise(resolve => setTimeout(resolve, 2500));",
  );
const suffix = `
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(error.message));
  let calls = 0;
  page.on('request', request => { if (request.url().endsWith('/ai-coach')) calls++; });
  await page.goto('http://127.0.0.1:8098/today');
  await page.getByTestId('home-coach-icon').click();
  await page.getByTestId('screen-coach-chat').waitFor();
  await page.getByTestId('input-coach-message').fill('I ate eggs');
  await Promise.all([
    page.waitForRequest(request => request.url().endsWith('/ai-coach')),
    page.getByTestId('btn-coach-send').click(),
  ]);
  await page.getByTestId('btn-coach-back').click();
  await page.getByTestId('home-coach-icon').waitFor();
  await page.waitForTimeout(2800);
  await page.getByTestId('home-coach-icon').click();
  await page.getByText('How many eggs, and how were they prepared?', {exact:true}).waitFor();
  await page.getByTestId('input-coach-message').fill('Two boiled eggs');
  await page.getByTestId('btn-coach-back').click();
  await page.waitForTimeout(2000);
  await page.getByTestId('home-coach-icon').click();
  assert.equal(await page.getByTestId('input-coach-message').inputValue(), 'Two boiled eggs');
  await page.evaluate(() => {
    globalThis.coachLoadingFrames = 0;
    new MutationObserver(() => {
      if (document.querySelector('[data-testid="view-coach-loading"]')) globalThis.coachLoadingFrames++;
    }).observe(document.body, {childList:true, subtree:true});
    Object.defineProperty(document, 'visibilityState', {value:'hidden', configurable:true});
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(2000);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', {value:'visible', configurable:true});
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(1000);
  assert.equal(await page.evaluate(() => globalThis.coachLoadingFrames), 0);
  assert.equal(await page.getByTestId('input-coach-message').inputValue(), 'Two boiled eggs');
  assert.equal(calls, 1, 'Returning to chat must not regenerate the reply');
  await page.screenshot({path:path.join(out,'retained-conversation.png'),fullPage:true});
  assert.deepEqual(errors, []);
  console.log('Coach session browser audit: pending reply, route return, draft, foreground refresh and no duplicate AI call passed.');
} catch(error) {
  for(const page of browser?.contexts().flatMap(c=>c.pages())??[]) {
    await page.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});
    console.log((await page.locator('body').innerText().catch(()=>'' )).slice(-1200));
  }
  throw error;
} finally { await browser?.close(); await new Promise(resolve=>server.close(resolve)); }
`;
fs.mkdirSync('.cache', { recursive: true });
const filename = '.cache/coach-session-browser.mjs';
fs.writeFileSync(filename, setup + suffix);
const result = spawnSync(process.execPath, [filename], { stdio: 'inherit' });
process.exit(result.status ?? 1);
