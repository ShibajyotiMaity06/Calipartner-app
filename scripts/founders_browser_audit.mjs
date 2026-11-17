// Intercepted local fixtures only. No real ratings or reviews are submitted.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const source = fs.readFileSync('scripts/nov4_browser_audit.mjs', 'utf8');
const marker = '  const page = await context.newPage();';
if (!source.includes(marker)) throw new Error('Browser fixture harness changed');
const setup = source
  .slice(0, source.indexOf(marker))
  .replace(
    "out = path.resolve('.artifacts/food-polish/browser')",
    "out = path.resolve('.artifacts/founders/browser')",
  );
const checks = String.raw`
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(error.message));
  try {
    for (const width of [320,390,844]) {
      await page.setViewportSize({width,height:844});
      await page.goto('http://127.0.0.1:8098/founders?next=plan');
      await page.getByTestId('founders-thanks-screen').waitFor();
      await page.waitForFunction(() => {
        const node = document.querySelector('[data-testid="founders-handshake"] img');
        return node?.complete && node.naturalWidth > 0;
      });
      assert.equal(await page.getByTestId('btn-header-upgrade').count(),0);
      assert.match(await page.locator('body').innerText(), /honest review/);
      for (const id of ['founders-rate','founders-continue']) {
        const box = await page.getByTestId(id).boundingBox();
        assert.ok(box.height >= 44 && box.width >= 44);
      }
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({path:path.join(out,'founders-'+width+'.png'),fullPage:true});
    }
    await page.setViewportSize({width:320,height:844});
    await page.evaluate(() => {
      for (const node of document.querySelectorAll('[data-testid="founders-thanks-screen"] [dir="auto"]')) {
        const computed = getComputedStyle(node);
        node.style.fontSize = parseFloat(computed.fontSize)*2+'px';
        node.style.lineHeight = parseFloat(computed.lineHeight)*2+'px';
      }
    });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.getByTestId('founders-continue').scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(out,'founders-320-large-text.png'),fullPage:true});
    await page.goto('http://127.0.0.1:8098/founders?next=plan');
    await page.getByTestId('founders-rate').click();
    await page.getByTestId('founders-status').waitFor();
    assert.match(await page.getByTestId('founders-status').innerText(), /live in your app store/);
    await page.getByTestId('founders-continue').click();
    await page.waitForURL(/weekly-plan\?setup=1/);
    assert.equal(await page.evaluate(owner => localStorage.getItem('calipartner.founders_review.'+owner),uid(0)), 'done');
    assert.deepEqual(errors,[]);
    console.log('Founders browser: PASS - image, 320/390/844px, 200% text, accessible controls, no upgrade header, unavailable listing and optional continuation.');
  } catch(error) { console.log('Browser failure',page.url(),errors); fs.writeFileSync(path.join(out,'failure.txt'),await page.locator('body').innerText()); await page.screenshot({path:path.join(out,'failure.png'),fullPage:true}); throw error; }
} finally { await browser.close(); server.close(); }
`;
fs.mkdirSync('.artifacts/founders', { recursive: true });
const generated = '.artifacts/founders/browser-fixture.mjs';
fs.writeFileSync(generated, setup + checks);
const result = spawnSync(process.execPath, [generated], { stdio: 'inherit' });
process.exit(result.status ?? 1);
