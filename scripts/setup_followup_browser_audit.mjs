// Local intercepted fixtures only; no hosted accounts, messages or provider calls.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const source = fs.readFileSync('scripts/nov4_browser_audit.mjs', 'utf8');
const marker = '  const page = await context.newPage();';
if (!source.includes(marker)) throw new Error('Browser fixture harness changed');
const setup = source
  .slice(0, source.indexOf(marker))
  .replace(
    "out = path.resolve('.artifacts/food-polish/browser')",
    "out = path.resolve('.artifacts/setup-followup/browser')",
  )
  .replace(
    "else if (name === 'get_my_rooms')",
    "else if (name === 'prepare_onboarding_pair_invite') data = {token: rid(99)};\n      else if (name === 'get_my_rooms')",
  );
const checks = String.raw`
  paid=true; pro=true; trial=false;
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {if(message.type()==='error') console.log('Browser console',message.text());});
  try {
  for (const width of [320,390,844]) {
    await page.setViewportSize({width,height:844});
    await page.goto('http://127.0.0.1:8098/today');
    await page.getByTestId('screen-today').waitFor();
    await page.getByTestId('home-open-title-'+rid(0)).waitFor();
    assert.equal(await page.getByTestId('btn-theme-switch').count(),0);
    assert.equal(await page.getByTestId('home-open-title-'+rid(0)).evaluate(node=>getComputedStyle(node).borderWidth),'0px');
    assert.equal(await page.getByTestId('home-coach-icon').evaluate(node=>getComputedStyle(node).borderWidth),'0px');
    assert.ok(!(await page.getByTestId('btn-header-upgrade').innerText()).includes('Upgrade'));
    assert.ok(!(await page.locator('body').innerText()).includes('Did you log'));
    await page.screenshot({path:path.join(out,'home-'+width+'.png'),fullPage:true});
  }
  await page.getByTestId('home-open-title-'+rid(0)).click();
  await page.waitForURL(/room/);
  assert.ok(page.url().includes(rid(0)));
  await page.goto('http://127.0.0.1:8098/progress');
  await page.getByTestId('you-open-settings').click();
  await page.getByTestId('card-me-room-plan').waitFor();
  assert.equal(await page.getByTestId('btn-me-change-plan').count(),1);
  assert.equal(await page.getByTestId('toggle-plan-details').count(),0);
  await page.screenshot({path:path.join(out,'settings.png'),fullPage:true});
  await page.goto('http://127.0.0.1:8098/log');
  await page.getByTestId('log-tile-food').click();
  await page.getByTestId('tab-log-photo').click();
  await page.getByTestId('btn-start-photo-scan').waitFor();
  assert.equal(await page.getByTestId('photo-access-copy').count(),0);
  assert.ok(!(await page.getByTestId('tab-view-photo-logging').innerText()).toLowerCase().includes('in-memory'));
  const container=await page.getByTestId('tab-view-photo-logging').boundingBox();
  const button=await page.getByTestId('btn-start-photo-scan').boundingBox();
  assert.ok(Math.abs(container.x+container.width/2-button.x-button.width/2)<3);
  await page.screenshot({path:path.join(out,'photo.png'),fullPage:true});
  await page.goto('http://127.0.0.1:8098/pair-start');
  await page.getByTestId('pair-share-sheet').waitFor();
  await page.getByTestId('pair-close-share').click();
  await page.getByTestId('share-pair-invite').click();
  await page.getByTestId('pair-share-sheet').waitFor();
  await page.screenshot({path:path.join(out,'pair-share.png'),fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('Setup follow-up browser: PASS - Home, squad card, Settings, Pro photo centering and automatic invite modal at 320/390/844px.');
  } catch(error) { console.log('Browser failure',page.url(),errors); fs.writeFileSync(path.join(out,'failure.txt'),await page.locator('body').innerText()); await page.screenshot({path:path.join(out,'failure.png'),fullPage:true}); throw error; }
} finally { await browser.close(); server.close(); }
`;
fs.mkdirSync('.artifacts/setup-followup', { recursive: true });
const generated = '.artifacts/setup-followup/browser-fixture.mjs';
fs.writeFileSync(generated, setup + checks);
const result = spawnSync(process.execPath, [generated], { stdio: 'inherit' });
process.exit(result.status ?? 1);
