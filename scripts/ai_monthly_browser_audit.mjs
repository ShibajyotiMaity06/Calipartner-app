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
    "out = path.resolve('.artifacts/ai-monthly/browser')",
  )
  .replace('let pro = false;', 'let pro = true; let monthlyDenied = false;')
  .replace('let paid = false,', 'let paid = true,')
  .replace(
    "if (name === 'get_plus_trial_offer')",
    `if (name === 'check_ai_food_photo_access') data = {allowed:!monthlyDenied,code:monthlyDenied?'MONTHLY_LIMIT_REACHED':null,user_state:'paid_pro'};
      else if (name === 'has_ai_processing_consent') data = true;
      else if (name === 'get_plus_trial_offer')`,
  )
  .replace(
    'const body = request.postDataJSON();\n      const latest',
    `if (monthlyDenied) return route.fulfill({status:429,contentType:'application/json',body:JSON.stringify({code:'MONTHLY_LIMIT_REACHED',error:'To support reliable, responsible use, AI chat is paused until next month.'})});
      const body = request.postDataJSON();
      const latest`,
  );
const suffix = `
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on('pageerror',error=>errors.push(error.message));
  await page.clock.install({time:new Date(now)});
  const capture=async name=>{
    await page.clock.runFor(400); await page.waitForTimeout(400);
    for(const width of [375,844]) {
      await page.setViewportSize({width,height:width===375?844:390});
      await page.screenshot({path:path.join(out,name+'-'+width+'.png'),fullPage:true});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),name+' overflow');
    }
    await page.setViewportSize({width:375,height:844});
  };
  await page.goto('http://127.0.0.1:8098/coach');
  await page.getByTestId('screen-coach-chat').waitFor();
  assert.equal(await page.getByTestId('banner-coach-daily-limit').count(),0);
  await page.getByTestId('input-coach-message').fill('Suggest a simple nutritious snack.');
  await page.getByTestId('btn-coach-send').click();
  await page.getByText('Estimated meal. Check the portions before logging.',{exact:true}).waitFor();
  await capture('coach-normal-no-quota');
  monthlyDenied=true;
  await page.getByTestId('input-coach-message').fill('Suggest another nutritious snack.');
  await page.getByTestId('btn-coach-send').click();
  const banner=page.getByTestId('banner-coach-daily-limit');
  await banner.waitFor();
  assert.match(await banner.innerText(),/responsible|reliable/);
  assert.match(await banner.innerText(),/next month/);
  assert.doesNotMatch(await banner.innerText(),/300|900|remaining|daily cap/i);
  assert.equal(await page.getByRole('alert').count(),0,'Monthly pause has one calm banner, without a duplicate error');
  await capture('coach-monthly-pause');
  await page.goto('http://127.0.0.1:8098/log');
  await page.getByTestId('log-tile-food').click();
  await page.getByTestId('tab-log-photo').click();
  await page.getByTestId('btn-start-photo-scan').click();
  const modal=page.getByTestId('modal-food-photo-limit');
  await modal.waitFor();
  assert.match(await page.getByTestId('text-limit-body').innerText(),/next month/);
  assert.equal(await page.getByTestId('pill-scan-usage').count(),0);
  assert.equal(await page.getByTestId('card-gentle-upsell').count(),0);
  assert.doesNotMatch(await modal.innerText(),/300|900|remaining|daily cap/i);
  await capture('photo-monthly-pause-manual-available');
  await page.getByTestId('btn-limit-log-manually').click();
  await modal.waitFor({state:'hidden'});
  await page.getByTestId('input-food-search').waitFor();
  assert.deepEqual(errors,[]);
  console.log('Monthly AI browser: normal chat hides quotas, monthly chat/photo messages are polite, no counters or upsell, manual logging remains available; 375/844px and reduced motion passed.');
} catch(error) {
  for(const page of browser?.contexts().flatMap(c=>c.pages())??[]) {
    await page.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});
    console.log((await page.locator('body').innerText().catch(()=>'' )).slice(-1800));
  }
  throw error;
} finally { await browser?.close(); await new Promise(resolve=>server.close(resolve)); }
`;
fs.mkdirSync('.artifacts/ai-monthly', { recursive: true });
const generated = '.artifacts/ai-monthly/browser-fixture.mjs';
fs.writeFileSync(generated, setup + suffix);
const result = spawnSync(process.execPath, [generated], { stdio: 'inherit' });
process.exitCode = result.status ?? 1;
