// Reuse the existing intercepted API fixtures; this audit never writes hosted data.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const fixture = fs.readFileSync('scripts/nov4_browser_audit.mjs', 'utf8');
const marker = '  const page = await context.newPage();';
if (!fixture.includes(marker)) throw new Error('Browser fixture harness changed.');
let setup = fixture.slice(0, fixture.indexOf(marker));
setup = setup.replace(
  "out = path.resolve('.artifacts/food-polish/browser')",
  "out = path.resolve('.artifacts/blueprint/browser')",
);
setup = setup.replace(
  'current_weight_kg: 75,',
  'current_weight_kg: 75, gym_days: 3, input_height_cm: 175, weekly_rate_kg: 0.25, target_weight_kg: 78,',
);
setup = setup.replace('steps: index ? 7400 : 3200,', 'steps: index ? 7400 : 3200, water: 1200,');
setup = setup
  .replaceAll('steps: 8000 }', 'steps: 8000, water: 2500 }')
  .replaceAll('steps: 6000 }', 'steps: 6000, water: 2500 }');
setup = setup.replace(
  "} else if (url.pathname.endsWith('/weekly-plan')) {",
  "} else if (url.pathname.endsWith('/weekly-plan')) { await new Promise(resolve=>setTimeout(resolve,1500));",
);
const suffix = `
  const page = await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.setDefaultTimeout(30000);
  await page.clock.install({time:new Date(now)});
  paid=false;pro=false;
  await page.goto('http://127.0.0.1:8098/weekly-plan?setup=1');
  await page.getByTestId('weekly-plan-next').click();
  await page.getByTestId('plan-country').fill('India');
  await page.getByTestId('plan-cuisine').fill('Indian');
  await page.getByTestId('plan-allergies').fill('none');
  await page.getByTestId('plan-exclusions').fill('none');
  await page.getByTestId('weekly-plan-consent').click();
  await page.getByTestId('build-weekly-plan').click();
  await page.getByTestId('onboarding-blueprint').waitFor();
  assert.equal(buildRequests.length,0);
  for(const width of [375,844]){
    await page.setViewportSize({width,height:width===844?390:844});
    await page.screenshot({path:path.join(out,'blueprint-'+width+'.png'),fullPage:true});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
  }
  await page.setViewportSize({width:375,height:844});
  await page.evaluate(()=>{
    const text=Array.from(document.querySelectorAll('[dir="auto"]')).map(element=>({element,size:getComputedStyle(element).fontSize,line:getComputedStyle(element).lineHeight}));
    for(const item of text){item.element.dataset.originalFontSize=item.size;item.element.dataset.originalLineHeight=item.line;item.element.style.fontSize=(parseFloat(item.size)*2)+'px';if(item.line!=='normal')item.element.style.lineHeight=(parseFloat(item.line)*2)+'px';}
  });
  await page.screenshot({path:path.join(out,'blueprint-text-200.png'),fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
  await page.evaluate(()=>{for(const element of document.querySelectorAll('[data-original-font-size]')){element.style.fontSize=element.dataset.originalFontSize;element.style.lineHeight=element.dataset.originalLineHeight;}});
  await page.getByTestId('projection-assumptions').click();
  await page.getByText('Basic and Plus use the same nutrition targets in this illustration. Their paths overlap.',{exact:true}).waitFor();
  await page.getByTestId('blueprint-make-plan').click();
  await page.getByTestId('weekly-plan-preparing').waitFor();
  await page.getByTestId('preparing-tip-food').click();
  await page.screenshot({path:path.join(out,'preparing.png'),fullPage:true});
  await page.getByTestId('weekly-plan-paid-lock').waitFor();
  assert.equal(buildRequests.length,1);
  assert.equal(await page.getByTestId('weekly-personal-tips').count(),0);
  await page.screenshot({path:path.join(out,'locked-preview.png'),fullPage:true});
  await page.getByTestId('weekly-plan-choose-support').click();
  await page.getByTestId('onboarding-support-paywall').waitFor();
  await page.getByText('₹1,499.00 billed each year',{exact:true}).waitFor();
  await page.getByTestId('support-duration-monthly').click();
  await page.getByText('₹249.00 a month',{exact:true}).waitFor();
  await page.screenshot({path:path.join(out,'support-paywall.png'),fullPage:true});
  await page.getByTestId('support-buy-pro').click();
  await page.getByTestId('text-paywall-title').waitFor();
  // No checkout button is clicked. All prices and purchase APIs are fixtures.
  await page.goBack();
  await page.getByTestId('onboarding-support-paywall').waitFor();
  await page.goBack();
  await page.getByTestId('weekly-plan-paid-lock').waitFor();
  paid=true;trial=false;
  weeklyPlan.days.forEach(day=>day.meals.forEach(meal=>{meal.alternatives=[{...meal,name:'Alternate measured meal'}];}));
  await page.reload();
  await page.getByTestId('meal-alternatives-0').waitFor();
  await page.screenshot({path:path.join(out,'paid-alternatives.png'),fullPage:true});
  await page.goto('http://127.0.0.1:8098/today');
  await page.getByTestId('personal-day-track-water').waitFor();
  await page.getByTestId('home-workout-summary').waitFor();
  const homeCard=page.getByTestId('home-squad-card-'+rid(0));
  const scoreHelp=homeCard.getByTestId('home-squad-score-help-'+rid(0));
  const scoreHint=homeCard.getByTestId('home-squad-score-hint-'+rid(0));
  assert.equal(await scoreHelp.innerText(),'Daily target %');
  for(const [id,steps] of [[uid(0),'3,200 steps'],[uid(1),'7,400 steps']]) {
    const row=homeCard.getByTestId('squad-member-'+id);
    const stepLabel=row.getByTestId('home-squad-steps-'+id);
    assert.equal(await stepLabel.innerText(),steps);
    assert.ok((await row.getAttribute('aria-label')).includes(steps));
  }
  assert.equal(await scoreHint.count(),0);
  const cardBefore=await homeCard.boundingBox();
  await scoreHelp.click();
  await scoreHint.waitFor();
  assert.ok((await scoreHint.innerText()).includes('calorie, protein, carb and fat'));
  assert.equal(await scoreHelp.getAttribute('aria-expanded'),'true');
  const cardAfter=await homeCard.boundingBox();
  assert.equal(cardBefore.height,cardAfter.height);
  await page.screenshot({path:path.join(out,'home-squad-score-hint.png'),fullPage:true});
  await page.keyboard.press('Escape');
  await scoreHint.waitFor({state:'detached'});
  await scoreHelp.click();
  await scoreHelp.click();
  await scoreHint.waitFor({state:'detached'});
  const helpBounds=await scoreHelp.boundingBox();
  assert.ok(helpBounds.width>=44 && helpBounds.height>=44);
  for(const width of [375,390]) {
    await page.setViewportSize({width,height:844});
    const scaled=await page.addStyleTag({content:'[data-testid^="home-squad-card-"] [dir="auto"] {font-size:200% !important;line-height:normal !important;}'});
    await scoreHelp.click();
    await scoreHint.waitFor();
    const bounds=await homeCard.boundingBox();
    for(const item of [scoreHelp,scoreHint,homeCard.getByTestId('home-squad-steps-'+uid(0)),homeCard.getByTestId('home-squad-steps-'+uid(1))]) {
      const box=await item.boundingBox();
      assert.ok(box.x>=bounds.x && box.x+box.width<=bounds.x+bounds.width+1);
      assert.ok(await item.evaluate(element=>element.scrollWidth<=element.clientWidth+1));
    }
    await page.screenshot({path:path.join(out,'home-squad-large-text-'+width+'.png'),fullPage:true});
    await page.keyboard.press('Escape');
    await scaled.evaluate(element=>element.remove());
  }
  const largerSquad=page.getByTestId('home-squad-card-'+rid(1));
  await largerSquad.scrollIntoViewIfNeeded();
  await largerSquad.getByTestId('home-squad-steps-'+uid(3)).waitFor();
  assert.equal(await largerSquad.locator('[data-testid^="home-squad-steps-"]').count(),3);
  assert.equal(await largerSquad.getByTestId('home-squad-steps-'+uid(4)).count(),0);
  for(const id of [uid(1),uid(2),uid(3)]) assert.equal(await largerSquad.getByTestId('home-squad-steps-'+id).innerText(),'7,400 steps');
  await page.screenshot({path:path.join(out,'home-squad-top-three-steps.png'),fullPage:true});
  await page.screenshot({path:path.join(out,'home-water-workout.png'),fullPage:true});
  await page.goto('http://127.0.0.1:8098/squad/compare?room='+rid(0));
  await page.getByTestId('member-metric-'+uid(1)+'-water').waitFor();
  assert.ok((await page.getByTestId('member-metric-'+uid(1)+'-water').innerText()).includes('1,200 / 2,500 ml'));
  assert.ok((await page.getByTestId('member-metric-'+uid(1)+'-calories').innerText()).includes('1,728 / 1,800 kcal'));
  await page.screenshot({path:path.join(out,'compare-numbers-water.png'),fullPage:true});
  await page.goto('http://127.0.0.1:8098/room?room='+rid(0));
  await page.getByTestId('squad-choose-person').click();
  await page.getByTestId('squad-member-picker').waitFor();
  assert.equal(await page.getByTestId('choose-member-'+uid(0)).count(),0);
  assert.equal(await page.getByTestId('choose-member-'+uid(1)).count(),1);
  assert.deepEqual(errors,[]);
  console.log('Blueprint browser audit passed: onboarding/plan/paywall, Home steps and tap-only score hint (toggle/Escape, stable card height, 44px target, 200% text at 375/390px), Home water/workouts, numeric Compare and peer-only selector.');
} catch(error) {
  for(const page of browser?.contexts().flatMap(context=>context.pages())??[]){
    await page.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});
    console.log('UI failure:',(await page.locator('body').innerText().catch(()=>'' )).slice(-1800));
  }
  throw error;
} finally {
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
}
`;
const generated = path.resolve('.artifacts/blueprint/browser-audit.generated.mjs');
fs.mkdirSync(path.dirname(generated), { recursive: true });
fs.writeFileSync(generated, setup + suffix);
const result = spawnSync(process.execPath, [generated], { stdio: 'inherit' });
process.exitCode = result.status ?? 1;
