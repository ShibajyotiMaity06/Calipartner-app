// Intercepted local fixtures only; never writes to the hosted project.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const source = fs.readFileSync('scripts/nov4_browser_audit.mjs', 'utf8');
const marker = '  const page = await context.newPage();';
if (!source.includes(marker)) throw new Error('Browser fixture harness changed');
const setup = source
  .slice(0, source.indexOf(marker))
  .replace(
    "out = path.resolve('.artifacts/food-polish/browser')",
    "out = path.resolve('.artifacts/ai-weight-squad/browser')",
  )
  .replace(
    'const savedMeals = new Map();',
    `const savedWeights = new Map([
    [rid(201),{id:rid(201),user_id:user.id,weight_kg:74,local_date:day,logged_at:now,created_at:now,updated_at:now,deleted_at:null,notes:null}],
    [rid(202),{id:rid(202),user_id:user.id,weight_kg:75,local_date:'2026-10-26',logged_at:'2026-10-26T12:00:00Z',created_at:now,updated_at:now,deleted_at:null,notes:null}],
    [rid(203),{id:rid(203),user_id:user.id,weight_kg:76,local_date:'2026-10-19',logged_at:'2026-10-19T12:00:00Z',created_at:now,updated_at:now,deleted_at:null,notes:null}],
  ]); const savedMeals = new Map();`,
  )
  .replace(
    "if (change.entity === 'food_entries') savedMeals.set(change.payload.id, change.payload);",
    "if (change.entity === 'weight_logs') savedWeights.set(change.payload.id,change.payload); else if (change.entity === 'food_entries') savedMeals.set(change.payload.id, change.payload);",
  )
  .replace(
    "else if (url.pathname.endsWith('/profiles'))",
    "else if (url.pathname.endsWith('/weight_logs')) data=[...savedWeights.values()]; else if (url.pathname.endsWith('/profiles'))",
  );
const suffix = `
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on('pageerror',error=>errors.push(error.message));
  await page.clock.install({time:new Date(now)});
  const capture=async name=>{
    await page.clock.runFor(400);
    await page.waitForTimeout(400);
    for(const width of [375,844]) {
      await page.setViewportSize({width,height:width===375?844:390});
      await page.screenshot({path:path.join(out,name+'-'+width+'.png'),fullPage:true});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),name+' overflow');
    }
    await page.setViewportSize({width:375,height:844});
  };
  await page.goto('http://127.0.0.1:8098/today');
  await page.getByTestId('home-open-title-'+rid(0)).waitFor();
  assert.equal(await page.getByTestId('home-edit-squad-name-'+rid(0)).count(),0);
  await capture('home-no-pencil');
  await page.getByTestId('home-squad-carousel').hover();
  await page.mouse.wheel(5000,0); await page.clock.runFor(400);
  assert.ok(Math.abs(await page.getByTestId('home-squad-carousel').evaluate(element=>element.scrollLeft)-332)<2,'Long wheel advances only one card');
  await page.mouse.wheel(-5000,0); await page.clock.runFor(400);
  assert.equal(await page.getByTestId('home-squad-carousel').evaluate(element=>element.scrollLeft),0);

  await page.getByTestId('home-open-title-'+rid(0)).click();
  await page.getByTestId('room-tab-today').waitFor();
  assert.equal(await page.getByTestId('open-full-leaderboard').count(),0);
  await page.getByTestId('squad-edit-squad-name-'+rid(0)).waitFor();
  await capture('squad-matched-tabs');
  await page.getByTestId('room-tab-chat').click();
  await page.getByTestId('squad-chat-header').waitFor();
  await page.getByTestId('list-chat-messages').waitFor();
  assert.equal(await page.getByTestId('room-tab').count(),0);
  assert.equal(await page.getByTestId('btn-room-title-switcher').count(),0);
  assert.equal(await page.getByTestId('squad-edit-squad-name-'+rid(0)).count(),0);
  await page.getByTestId('btn-room-settings').waitFor();
  fs.writeFileSync(path.join(out,'navigation-metrics.json'),JSON.stringify(await page.getByTestId('squad-chat-back').evaluate(element=>({html:element.outerHTML,box:element.getBoundingClientRect().toJSON(),svg:element.querySelector('svg')?.getBoundingClientRect().toJSON()}))));
  await capture('chat-name-settings-conversation');
  await page.goto('http://127.0.0.1:8098/me');
  await page.getByTestId('section-preferences').click();
  for(const id of ['row-coach-history','row-units-language','row-appearance','section-storage']) assert.equal(await page.getByTestId(id).count(),0,id);
  await capture('settings-simplified');
  await page.goto('http://127.0.0.1:8098/log');
  await page.getByTestId('log-tile-weight').click();
  await page.getByTestId('btn-weight-progress').waitFor();
  await page.getByTestId('input-weight-date').fill('2999-01-01');
  await page.getByTestId('btn-weight-save').click();
  await page.getByTestId('weight-entry-error').waitFor();
  assert.equal(trackingRequests.filter(r=>r.p_changes?.some(c=>c.entity==='weight_logs')).length,0);
  await capture('weight-future-date-error');
  await page.getByTestId('btn-weight-progress').click();
  await page.getByTestId('item-weight-log-'+rid(202)).waitFor();
  assert.match(await page.getByTestId('list-weight-history').innerText(),/2026-10-26/);
  assert.match(await page.getByTestId('list-weight-history').innerText(),/2026-10-19/);
  await capture('weekly-actual-dates');
  await page.evaluate(()=>{for(const element of document.querySelectorAll('[dir="auto"]')){const css=getComputedStyle(element);element.style.fontSize=(parseFloat(css.fontSize)*2)+'px';if(css.lineHeight!=='normal')element.style.lineHeight=(parseFloat(css.lineHeight)*2)+'px';}});
  await capture('weekly-large-text-reduced-motion');
  await page.getByTestId('btn-edit-weight-'+rid(202)).click();
  await page.getByTestId('input-weight-value').fill('74.5');
  await page.getByTestId('input-weight-date').fill('2026-10-25');
  await page.getByTestId('btn-weight-save').click();
  await page.getByTestId('log-tile-weight').waitFor();
  assert.equal(savedWeights.size,3);
  assert.equal(savedWeights.get(rid(202)).local_date,'2026-10-25');
  assert.equal(savedWeights.get(rid(201)).weight_kg,74);
  await page.goto('http://127.0.0.1:8098/today');
  await page.getByTestId('home-open-title-'+rid(0)).waitFor();
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
  await page.reload();
  await page.getByTestId('home-open-title-'+rid(0)).waitFor();
  await page.getByTestId('home-leaderboard-'+rid(0)).waitFor();
  await context.setOffline(true);
  await page.getByTestId('offline-read-banner').waitFor();
  await page.reload();
  await page.getByTestId('offline-read-banner').waitFor();
  await page.getByTestId('home-open-title-'+rid(0)).waitFor();
  await capture('offline-reopen-cached-squads');
  await context.setOffline(false);
  assert.deepEqual(errors,[]);
  console.log('AI/weight/Squad browser: simplified chat/settings, matching tabs, actual weekly history, date edits, future-date rejection and offline reopening at 375/844px passed.');
} catch(error) {
  for(const page of browser?.contexts().flatMap(c=>c.pages())??[]) {
    await page.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});
    console.log((await page.locator('body').innerText().catch(()=>'' )).slice(-1800));
  }
  throw error;
} finally { await browser?.close(); await new Promise(resolve=>server.close(resolve)); }
`;
fs.mkdirSync('.artifacts/ai-weight-squad', { recursive: true });
const generated = '.artifacts/ai-weight-squad/browser-fixture.mjs';
fs.writeFileSync(generated, setup + suffix);
const result = spawnSync(process.execPath, [generated], { stdio: 'inherit' });
process.exitCode = result.status ?? 1;
