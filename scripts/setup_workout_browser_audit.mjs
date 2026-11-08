// Local intercepted fixtures only: no hosted user writes, purchases or AI calls.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const source = fs.readFileSync('scripts/nov4_browser_audit.mjs', 'utf8');
const marker = '  const page = await context.newPage();';
if (!source.includes(marker)) throw new Error('Browser fixture harness changed');
let setup = source
  .slice(0, source.indexOf(marker))
  .replace(
    "out = path.resolve('.artifacts/food-polish/browser')",
    "out = path.resolve('.artifacts/setup-workout/browser')",
  );
setup = setup.replace(
  "else if (url.pathname.endsWith('/profiles'))",
  `else if (url.pathname.endsWith('/exercises')) data = JSON.parse(fs.readFileSync('app/src/data/exercises_seed.json','utf8')).map(exercise => ({...exercise,owner_id:null,created_at:now,updated_at:now}));
    else if (url.pathname.endsWith('/profiles'))`,
);
setup = setup.replace(
  "      data = { saved: true, code: 'PLAN_SAVED' };",
  `
      weeklyPlan.scope='day'; weeklyPlan.days=weeklyPlan.days.slice(0,1);
      weeklyPlan.days[0].meals=['breakfast','lunch','dinner','snacks'].map((section,index)=>({section,name:['Oats and yogurt','Lentil rice bowl','Chicken and potatoes','Yogurt and fruit'][index],ingredients:[],portion:'One serving',calories:400+index*100,protein:20+index*5,carbs:50+index*10,fat:10+index*2}));
      data = { saved: true, code: 'PLAN_SAVED' };`,
);
const suffix = `
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.setDefaultTimeout(20000);
  await page.clock.install({ time: new Date(now) });
  const capture = async name => {
    for (const width of [375, 844]) {
      await page.setViewportSize({ width, height: width === 375 ? 844 : 390 });
      await page.screenshot({ path: path.join(out, name + '-' + width + '.png'), fullPage: true });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), name + ' overflow');
    }
    await page.setViewportSize({ width: 375, height: 844 });
  };
  await page.goto('http://127.0.0.1:8098/weekly-plan?setup=1');
  await page.getByTestId('plan-location').click();
  await page.getByTestId('plan-location-basic').click();
  assert.equal(await page.getByTestId('plan-location-basic').count(), 0);
  await page.getByTestId('plan-equipment').click();
  await page.getByTestId('plan-equipment-dumbbell').click();
  await page.getByTestId('plan-equipment-done').click();
  await capture('compact-training');
  await page.getByTestId('weekly-plan-next').click();
  for(const [id,value] of [['plan-country','India'],['plan-cuisine','Indian']]) await page.getByTestId(id).fill(value);
  assert.equal(await page.getByTestId('plan-allergies').inputValue(), '');
  assert.equal(await page.getByTestId('plan-exclusions').inputValue(), '');
  await capture('optional-allergies');
  await page.getByTestId('weekly-plan-consent').click();
  await page.getByTestId('build-weekly-plan').click();
  await page.getByTestId('personalised-preview-0').waitFor();
  assert.deepEqual(buildRequests[0].preferences.allergies, []);
  assert.deepEqual(buildRequests[0].preferences.exclusions, []);
  weeklyPlan.scope='day';
  weeklyPlan.days=[{day:0,workout:{title:'Private personalised workout',minutes:30,exercises:[{name:'Push-Ups',sets:3,reps:10,rest_seconds:60,equipment:'bodyweight'}]},meals:[]}];
  paid=false;
  await page.goto('http://127.0.0.1:8098/log');
  await page.getByTestId('log-tile-workout').click();
  await page.getByTestId('workout-plan-upgrade').waitFor();
  assert.equal(await page.getByText('Private personalised workout',{exact:true}).count(),0);
  await capture('basic-workout-lock');
  await page.getByTestId('workout-hub-modal-btn-add-exercise').click();
  await page.getByTestId('exercise-picker-modal-list').waitFor();
  assert.equal(await page.locator('[data-testid^="exercise-item-"]').count(),5);
  await page.getByTestId('chip-muscle-lower').click();
  await page.waitForFunction(()=>document.querySelectorAll('[data-testid^="exercise-item-"]').length===5);
  await capture('five-lower-exercises');
  await page.getByTestId('exercise-picker-modal-input-search').fill('Squat');
  await page.waitForFunction(()=>{const rows=[...document.querySelectorAll('[data-testid^="exercise-item-"]')];return rows.length>0&&rows.every(row=>row.textContent.toLowerCase().includes('squat'));});
  await page.locator('[data-testid^="exercise-item-"]').first().click();
  await page.getByTestId('exercise-set-count').fill('3');
  for(const [index,reps] of ['10','8','6'].entries()) await page.getByTestId('exercise-set-reps-'+index).fill(reps);
  await capture('individual-set-entry');
  await page.getByTestId('exercise-confirm-sets').click();
  await page.getByTestId('workout-exercise-card-0').waitFor();
  assert.equal(await page.getByTestId('input-reps-0-0').inputValue(),'10');
  assert.equal(await page.getByTestId('input-reps-0-1').inputValue(),'8');
  assert.equal(await page.getByTestId('input-reps-0-2').inputValue(),'6');
  await capture('manual-workout');
  await page.getByTestId('workout-hub-modal-btn-close').click();
  paid=true;
  await page.reload();
  await page.getByTestId('log-tile-workout').click();
  await page.getByText('Private personalised workout',{exact:true}).waitFor();
  await page.getByTestId('workout-use-today-plan').click();
  await page.getByTestId('workout-exercise-card-0').waitFor();
  await capture('purchased-today-plan');
  await page.getByTestId('workout-hub-modal-btn-close').click();
  await page.goto('http://127.0.0.1:8098/onboarding');
  await page.getByTestId('btn-onboarding-next').click();
  await page.getByTestId('activity-level').click();
  await page.getByTestId('activity-level-moderate').click();
  await page.getByTestId('btn-onboarding-next').click();
  await page.getByTestId('input-weight').fill('80');
  await page.getByTestId('input-height').fill('175');
  await page.getByTestId('gym-days').click();
  await page.getByTestId('gym-days-3').click();
  await capture('compact-onboarding-training');
  await page.getByTestId('btn-onboarding-next').click();
  await page.getByTestId('btn-onboarding-next').click();
  await page.getByTestId('btn-onboarding-next').click();
  await page.getByTestId('continue-calculated-plan').waitFor();
  assert.equal(await page.getByTestId('btn-build-your-plan').count(),1);
  await capture('two-macro-actions');
  await page.getByTestId('btn-how-calculated').click();
  await page.getByTestId('btn-close-details').click();
  await page.getByTestId('btn-build-your-plan').click();
  await page.getByTestId('custom-target-protein').fill('186');
  assert.equal(await page.getByTestId('plan-save-error').count(),0);
  await capture('simple-custom-macros');
  await page.goto('http://127.0.0.1:8098/log');
  await page.getByTestId('log-tile-workout').click();
  await page.getByTestId('workout-use-today-plan').click();
  await page.emulateMedia({ reducedMotion:'reduce' });
  await page.evaluate(()=>{ for (const element of document.querySelectorAll('[dir="auto"]')) { const css=getComputedStyle(element); element.style.fontSize=(parseFloat(css.fontSize)*2)+'px'; if(css.lineHeight!=='normal') element.style.lineHeight=(parseFloat(css.lineHeight)*2)+'px'; } });
  await capture('workout-large-text-reduced-motion');
  assert.deepEqual(errors,[]);
  console.log('Setup/workout browser: compact selectors, optional allergies, Basic plan concealment, real catalogue search, five category suggestions, individual 10/8/6 reps, purchased day and 375/844px layouts passed.');
} catch(error) {
  for(const page of browser?.contexts().flatMap(context=>context.pages())??[]) {
    await page.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});
    console.log((await page.locator('body').innerText().catch(()=>'' )).slice(-1800));
  }
  throw error;
} finally {
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
}
`;
fs.mkdirSync('.artifacts/setup-workout', { recursive: true });
const generated = '.artifacts/setup-workout/browser-fixture.mjs';
fs.writeFileSync(generated, setup + suffix);
const result = spawnSync(process.execPath, [generated], { stdio: 'inherit' });
process.exitCode = result.status ?? 1;
