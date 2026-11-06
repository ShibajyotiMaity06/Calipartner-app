// Exercises the exported app with intercepted API fixtures; no hosted user data is written.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const fixture = fs.readFileSync('scripts/nov4_browser_audit.mjs', 'utf8');
const marker = '  const page = await context.newPage();';
if (!fixture.includes(marker)) throw new Error('Browser fixture harness changed');
let setup = fixture.slice(0, fixture.indexOf(marker));
setup = setup.replace(
  "out = path.resolve('.artifacts/food-polish/browser')",
  "out = path.resolve('.artifacts/habit-blueprint/browser')",
);
setup = setup.replace(
  'const savedMeals = new Map();',
  'const savedMeals = new Map(); const habitLogs = [], habitRepeats = []; let failHabitLog = true;',
);
setup = setup.replace(
  "} else if (name === 'get_personal_weekly_plan') data = projectedPlan();",
  `} else if (name === 'log_weekly_plan_meal') {
  habitLogs.push(body);
  if (failHabitLog) { failHabitLog = false; status = 503; data = { message: 'Response unavailable' }; }
  else data = body.p_id;
} else if (name === 'repeat_previous_day_meal') { habitRepeats.push(body); data = 2;
} else if (name === 'swap_weekly_plan_meal') {
  const meal = weeklyPlan.days[body.p_day].meals[body.p_meal];
  const alternative = meal.alternatives[body.p_option];
  weeklyPlan.days[body.p_day].meals[body.p_meal] = {...alternative, alternatives: [meal]};
  weeklyPlan.revision++; data = projectedPlan();
} else if (name === 'get_personal_weekly_plan') data = projectedPlan();`,
);
const suffix = `
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/functions/v1/challenges-api', route => route.fulfill({contentType:'application/json', body:JSON.stringify({catalog:{templates:[],seasons:[],config:{poll_seconds:120}},items:[]})}));
  page.setDefaultTimeout(30000);
  await page.clock.install({ time: new Date(now) });
  weeklyPlan = {id:rid(90), revision:1, preferences:{}, workout_tips:[], diet_tips:[], days:Array.from({length:7},(_,day)=>({
    day, workout:{title:'Scheduled strength',minutes:30,exercises:[{name:'Bodyweight squat',sets:3,reps:10,rest_seconds:60,equipment:'bodyweight'}]},
    meals:[
      {name:'Breakfast oats',ingredients:['Oats 60 g',day ? 'Private ingredient 40 g':'Yogurt 100 g'],portion:'One bowl',calories:450,protein:30,carbs:60,fat:10,alternatives:[{name:'Tofu breakfast',ingredients:['Tofu 150 g'],portion:'One bowl',calories:440,protein:29,carbs:55,fat:11}]},
      {name:'Lunch lentils',ingredients:['Lentils 200 g','Rice 150 g'],portion:'One plate',calories:650,protein:35,carbs:80,fat:22},
      {name:'Dinner chicken',ingredients:['Chicken 200 g','Rice 150 g'],portion:'One plate',calories:700,protein:50,carbs:75,fat:20}
    ]
  }))};
  paid=false; trial=false;
  await page.goto('http://127.0.0.1:8098/weekly-plan');
  await page.getByTestId('weekly-log-meal-0').waitFor();
  await page.getByTestId('weekly-grocery-open').click();
  await page.getByText('Monday preview. Purchased Plus or Pro includes the full week.',{exact:true}).waitFor();
  assert.equal(await page.getByRole('checkbox',{name:'Private ingredient 40 g'}).count(),0);
  const grocery=page.getByRole('checkbox',{name:'Rice 150 g'});
  await grocery.click(); assert.equal(await grocery.getAttribute('aria-checked'),'true');
  await page.screenshot({path:path.join(out,'monday-groceries.png'),fullPage:true});
  await page.getByTestId('weekly-grocery-close').click();
  await page.getByTestId('weekly-log-meal-0').click();
  await page.getByRole('alert').filter({hasText:'Your change could not be confirmed'}).waitFor();
  assert.equal(await page.getByTestId('weekly-log-meal-0').isEnabled(),true);
  await page.getByTestId('weekly-log-meal-0').click();
  await page.getByTestId('weekly-log-meal-0').getByText('Logged',{exact:true}).waitFor();
  assert.equal(habitLogs.length,2); assert.equal(habitLogs[0].p_id,habitLogs[1].p_id);
  assert.equal(habitLogs[1].p_section,'breakfast');
  paid=true;
  await page.reload();
  await page.getByTestId('weekly-swap-meal-0').click();
  const swapReply=page.waitForResponse(response=>response.url().endsWith('/rpc/swap_weekly_plan_meal'));
  await page.getByTestId('weekly-swap-option-0-0').click();
  await swapReply;
  await page.getByTestId('weekly-swap-option-0-0').waitFor({state:'detached'});
  assert.equal(weeklyPlan.revision,2);
  await page.getByTestId('weekly-grocery-open').click();
  await page.getByRole('checkbox',{name:'Private ingredient 40 g'}).waitFor();
  await page.getByTestId('weekly-grocery-close').click();
  await page.goto('http://127.0.0.1:8098/log');
  await page.getByTestId('log-tile-cardio').click();
  for(const flow of ['cycling','running','steps']) await page.getByTestId('cardio-'+flow).waitFor();
  assert.equal(await page.getByTestId('log-tile-steps').count(),0);
  await page.screenshot({path:path.join(out,'cardio-menu.png'),fullPage:true});
  await page.getByTestId('cardio-cycling').click();
  await page.getByTestId('cardio-form').waitFor();
  await page.clock.runFor(400);
  assert.equal(await page.getByTestId('workout-logger-modal-btn-add-exercise').count(),0);
  for(const [width,height] of [[375,844],[844,390]]) {
    await page.setViewportSize({width,height});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.screenshot({path:path.join(out,'cycling-'+width+'.png'),fullPage:true});
  }
  await page.getByTestId('workout-logger-modal-btn-close').click();
  await page.getByTestId('cardio-running').click();
  await page.getByTestId('cardio-form-input-duration').fill('30');
  await page.getByTestId('cardio-form-input-distance').fill('5');
  const workoutReply=page.waitForResponse(response=>response.url().endsWith('/rpc/save_tracking_changes'));
  await page.getByTestId('workout-logger-modal-btn-save').click();
  await workoutReply;
  const workoutBatch=trackingRequests.at(-1).p_changes;
  assert.deepEqual(workoutBatch.map(change=>change.entity),['workouts','workout_exercises','workout_sets']);
  assert.equal(workoutBatch[2].payload.distance_meters,5000);
  assert.equal(workoutBatch[2].payload.duration_seconds,1800);
  await page.waitForURL(url=>!url.pathname.endsWith('/log'));
  await page.goto('http://127.0.0.1:8098/log?flow=cardio');
  await page.getByTestId('cardio-steps').click();
  await page.getByTestId('input-steps-count').waitFor();
  await page.getByTestId('input-steps-count').fill('5000');
  await page.screenshot({path:path.join(out,'web-manual-steps.png'),fullPage:true});
  await page.goto('http://127.0.0.1:8098/today');
  await page.getByTestId('home-squad-card-'+rid(0)).waitFor();
  assert.equal(await page.getByTestId('personal-day-track-water').count(),0);
  assert.equal(await page.getByTestId('home-workout-summary').count(),0);
  assert.equal(await page.getByTestId('card-section-extra').count(),0);
  assert.equal(await page.getByTestId('repeat-previous-lunch').count(),0);
  await page.getByTestId('home-repeat-yesterday').click();
  for(const section of ['breakfast','lunch','dinner','snacks']) await page.getByTestId('repeat-previous-'+section).waitFor();
  assert.equal(await page.getByTestId('repeat-previous-extra').count(),0);
  await page.getByTestId('repeat-previous-lunch').click();
  await page.getByTestId('repeat-previous-lunch').getByText('Lunch added',{exact:true}).waitFor();
  assert.equal(habitRepeats.length,1);
  await page.screenshot({path:path.join(out,'repeat-yesterday-meals.png'),fullPage:true});
  await page.getByTestId('repeat-yesterday-close').click();
  await page.setViewportSize({width:375,height:844});
  await page.getByTestId('home-squads').scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(out,'compact-home.png'),fullPage:true});
  await page.evaluate(()=>{
    for(const element of document.querySelectorAll('[dir="auto"]')) {
      const css=getComputedStyle(element); element.style.fontSize=(parseFloat(css.fontSize)*2)+'px';
      if(css.lineHeight!=='normal') element.style.lineHeight=(parseFloat(css.lineHeight)*2)+'px';
    }
  });
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:path.join(out,'home-text-200.png'),fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('Habit browser audit: grocery access/checklist, acknowledged retry, swap, Cardio routes, web steps, repeat meal, 375px/landscape/200% text passed');
} finally { await browser?.close(); await new Promise(resolve=>server.close(resolve)); }
`;
const generated = path.resolve('.artifacts/habit-blueprint/browser-run.mjs');
fs.mkdirSync(path.dirname(generated), { recursive: true });
fs.writeFileSync(
  generated,
  setup + suffix.replaceAll('page.screenshot({', "page.screenshot({animations:'disabled',"),
);
const result = spawnSync(process.execPath, [generated], { stdio: 'inherit', cwd: process.cwd() });
process.exitCode = result.status ?? 1;
