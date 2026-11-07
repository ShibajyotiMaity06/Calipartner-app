// Intercepted API fixtures only; no hosted writes or purchases.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const fixture = fs.readFileSync('scripts/nov4_browser_audit.mjs', 'utf8');
const marker = '  const page = await context.newPage();';
if (!fixture.includes(marker)) throw new Error('Browser fixture harness changed');
let setup = fixture.slice(0, fixture.indexOf(marker));
setup = setup.replace(
  "out = path.resolve('.artifacts/food-polish/browser')",
  "out = path.resolve('.artifacts/personalised-day/browser')",
);
setup = setup.replace(
  'let pro = false;',
  'let trackingFixture = null; let failTracking = true; let pro = false;',
);
setup = setup.replace(
  "} else if (url.pathname.endsWith('/weekly-plan')) {",
  `}
    else if (url.pathname.endsWith('/tracking_preferences')) {
      if(request.method()==='POST') {
        trackingFixture=request.postDataJSON();
        trackingRequests.push(trackingFixture);
        if(failTracking) { failTracking=false; status=503; data={message:'Connection lost'}; }
        else data=trackingFixture;
      } else data=trackingFixture ? [trackingFixture] : [];
    } else if (url.pathname.endsWith('/weekly-plan')) {`,
);
setup = setup.replace(
  'days: Array.from({ length: 7 }, (_, day) => ({',
  "scope:body.scope === 'day' ? 'day':'week', days: Array.from({ length: body.scope === 'day' ? 1:7 }, (_, day) => ({",
);
const suffix = `
  const page = await context.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  page.setDefaultTimeout(30000);
  await page.clock.install({time:new Date(now)});
  await page.goto('http://127.0.0.1:8098/weekly-plan?setup=1');
  await page.getByTestId('weekly-plan-next').click();
  for(const [id,value] of [['plan-country','India'],['plan-cuisine','Indian'],['plan-allergies','none'],['plan-exclusions','none']]) await page.getByTestId(id).fill(value);
  await page.getByTestId('weekly-plan-consent').click();
  await page.getByTestId('build-weekly-plan').click();
  await page.getByTestId('personalised-preview-0').waitFor();
  assert.equal(buildRequests.length,1);assert.equal(buildRequests[0].scope,'day');assert.equal(weeklyPlan.days.length,1);
  assert.equal(await page.getByTestId('onboarding-blueprint').count(),0);
  assert.equal(await page.getByTestId('weekly-plan-day-0').count(),0);
  const capture=async name=>{
    for(const width of [375,844]) {
      await page.setViewportSize({width,height:width===844?390:844});
      await page.screenshot({path:path.join(out,name+'-'+width+'.png'),fullPage:true});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),name+' horizontal overflow');
    }
    await page.setViewportSize({width:375,height:844});
    await page.evaluate(()=>{for(const element of document.querySelectorAll('[dir="auto"]')){element.dataset.auditFont=element.style.fontSize;element.dataset.auditLine=element.style.lineHeight;const css=getComputedStyle(element);element.style.fontSize=(parseFloat(css.fontSize)*2)+'px';if(css.lineHeight!=='normal')element.style.lineHeight=(parseFloat(css.lineHeight)*2)+'px';}});
    await page.screenshot({path:path.join(out,name+'-text-200.png'),fullPage:true});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),name+' scaled overflow');
    await page.evaluate(()=>{for(const element of document.querySelectorAll('[data-audit-font]')){element.style.fontSize=element.dataset.auditFont;element.style.lineHeight=element.dataset.auditLine;}});
  };
  await capture('day');
  await page.getByTestId('personalised-preview-next').click();
  await page.getByTestId('onboarding-coach-demo').waitFor();
  assert.equal(await page.locator('[data-testid^="msg-bubble-demo-ai"]').count(),3);
  assert.equal(await page.locator('[data-testid^="msg-bubble-demo-human"]').count(),2);
  await page.getByText('Your plan pairs a measured calorie surplus with resistance training.',{exact:false}).waitFor();
  await capture('coach');
  await page.getByTestId('personalised-preview-next').click();
  await page.getByTestId('onboarding-compare-demo').waitFor();
  await page.getByText('Your partner',{exact:true}).waitFor();
  await capture('compare');
  await page.getByTestId('personalised-preview-next').click();
  await page.getByTestId('onboarding-support-paywall').waitFor();
  await page.getByTestId('weekly-plan-back').click();
  await page.getByTestId('personalised-preview-2').waitFor();
  await page.getByTestId('weekly-plan-back').click();
  await page.getByTestId('personalised-preview-1').waitFor();
  await page.goto('http://127.0.0.1:8098/today');
  await page.getByTestId('edit-daily-tracking').click();
  await page.getByTestId('track-water').click();
  await page.getByTestId('track-protein').click();
  await page.getByTestId('save-tracking-preferences').click();
  await page.getByText('Your tracking choices could not be saved. Check your connection and try again.',{exact:true}).waitFor();
  assert.equal(await page.getByTestId('personal-day-track-water').count(),0);
  await page.getByTestId('save-tracking-preferences').click();
  await page.getByTestId('personal-day-track-water').waitFor();
  assert.equal(await page.getByTestId('personal-day-track-protein').count(),0);
  assert.equal(trackingRequests[0].request_id,trackingRequests[1].request_id);
  await page.reload();
  await page.getByTestId('personal-day-track-water').waitFor();
  assert.equal(await page.getByTestId('personal-day-track-protein').count(),0);
  await page.screenshot({path:path.join(out,'home-tracking.png'),fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('Personalised day browser: one-day build, three demos, five chat messages, paywall/back flow, 375/844px, 200% text and acknowledged tracking retry/persistence passed');
} finally {if(browser) await browser.close(); await new Promise(resolve=>server.close(resolve));}
`;
const temporary = path.resolve('.artifacts/personalised_day_audit_runtime.mjs');
fs.mkdirSync(path.dirname(temporary), { recursive: true });
fs.writeFileSync(temporary, setup + suffix);
const result = spawnSync(process.execPath, [temporary], { stdio: 'inherit', env: process.env });
fs.unlinkSync(temporary);
process.exit(result.status ?? 1);
