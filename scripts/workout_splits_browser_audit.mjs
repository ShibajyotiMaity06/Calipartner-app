// Local intercepted fixtures only. No hosted accounts or provider calls.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const source = fs.readFileSync('scripts/nov4_browser_audit.mjs', 'utf8');
const marker = '  const page = await context.newPage();';
if (!source.includes(marker)) throw new Error('Browser fixture harness changed');
let setup = source
  .slice(0, source.indexOf(marker))
  .replace(
    "out = path.resolve('.artifacts/food-polish/browser')",
    "out = path.resolve('.artifacts/workout-splits/browser')",
  )
  .replace("const now = '2026-11-03T14:00:00Z'", "const now = '2026-11-11T14:00:00Z'")
  .replace(
    'let pro = false;',
    `let pro = false;
let workoutFixture=null,workoutBuilds=0,failWorkoutSave=true,failWorkoutBuild=true;
const workoutRequests=[],workoutEdits=[];
const workoutPreferences={workout_days:[0,2,4],location:'home',equipment:['dumbbell'],experience:'beginner',session_minutes:30,limitations:'',workout_notes:'',country:'India',cuisine:'Indian',diet:'mixed',allergies:[],exclusions:[],meals_per_day:4,cooking_minutes:30,budget:'economical'};
const routineDays=()=>Array.from({length:7},(_,day)=>({day,title:[0,2,4].includes(day)?'Your arms routine':'Rest day',minutes:[0,2,4].includes(day)?30:0,exercises:[0,2,4].includes(day)?[{id:'day-'+day+'-exercise-0',name:'Seated dumbbell curls',equipment:'dumbbell',targetSets:[{reps:10,weightKg:0},{reps:8,weightKg:0}]}]:[]}));
const workoutRows={workouts:new Map(),workout_exercises:new Map(),workout_sets:new Map()};
workoutRows.workouts.set('previous-workout',{id:'previous-workout',user_id:user.id,type:'strength',name:'Actual previous workout',duration_minutes:20,local_date:'2026-11-10',created_at:now,updated_at:now,deleted_at:null});
const workoutProjection=()=>({id:workoutFixture?.id ?? null,revision:workoutFixture?.revision ?? 0,full_access:paid,tier:paid?(pro?'pro':'plus'):'free',preferences:paid?(workoutFixture?.preferences ?? null):null,needs_initial:false,days:paid?(workoutFixture?.days ?? []):[],can_rebuild:paid && workoutBuilds===0,rebuilds_used:workoutBuilds,next_rebuild_at:pro && workoutBuilds?'2027-05-11T14:00:00Z':null});`,
  )
  .replace(
    "else if (name === 'get_individual_progress') data = null;",
    `else if (name === 'get_individual_progress') data = null;
else if(name==='get_workout_plan')data=workoutProjection();
else if(name==='edit_workout_plan'){
 workoutEdits.push(body);
 workoutFixture={...workoutFixture,days:body.p_content.days,revision:workoutFixture.revision+1};
 data=workoutProjection();
}`,
  )
  .replace(
    '        trackingRequests.push(body);',
    `        trackingRequests.push(body);
        for(const change of body.p_changes ?? []) if(workoutRows[change.entity]) workoutRows[change.entity].set(change.payload.id,change.payload);
        if((body.p_changes ?? []).some(change=>change.entity==='workouts') && failWorkoutSave){failWorkoutSave=false;return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Lost acknowledgement'})});}`,
  )
  .replace(
    "} else if (url.pathname.endsWith('/weekly-plan')) {",
    `} else if (url.pathname.endsWith('/workout-plan')) {
 const body=request.postDataJSON();workoutRequests.push(body);
 if(!body.initial && failWorkoutBuild){failWorkoutBuild=false;status=503;data={saved:false,code:'PLAN_UNAVAILABLE'};}
 else {workoutFixture={id:body.request_id,revision:(workoutFixture?.revision ?? 0)+1,preferences:body.preferences,days:routineDays()};if(!body.initial)workoutBuilds++;data={saved:true,code:'WORKOUT_PLAN_SAVED'};}
} else if (url.pathname.endsWith('/weekly-plan')) {`,
  )
  .replace(
    "else if (url.pathname.endsWith('/profiles'))",
    `else if (url.pathname.endsWith('/exercises')) data=JSON.parse(fs.readFileSync('app/src/data/exercises_seed.json','utf8')).map(exercise=>({...exercise,owner_id:null,created_at:now,updated_at:now}));
else if (url.pathname.endsWith('/workouts'))data=[...workoutRows.workouts.values()];
else if (url.pathname.endsWith('/workout_exercises'))data=[...workoutRows.workout_exercises.values()];
else if (url.pathname.endsWith('/workout_sets'))data=[...workoutRows.workout_sets.values()];
else if (url.pathname.endsWith('/profiles'))`,
  );
setup = setup.replace(
  "chromium.launch({ channel: 'chrome', headless: true })",
  "chromium.launch({ executablePath: path.join(process.env.LOCALAPPDATA, 'ms-playwright/chromium-1243/chrome-win64/chrome.exe'), headless: true })",
);
const suffix = `
 const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(error.message));
 await page.clock.setFixedTime(new Date(now));
 const capture=async name=>{for(const width of [320,390,844]){await page.setViewportSize({width,height:844});await page.waitForTimeout(350);await page.screenshot({path:path.join(out,name+'-'+width+'.png'),fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),name+' overflow');}await page.setViewportSize({width:390,height:844});};
 await page.goto('http://127.0.0.1:8098/today');await page.getByTestId('screen-today').waitFor();
 assert.equal(await page.getByText(/Did you log your/).count(),0);
 await page.goto('http://127.0.0.1:8098/paywall');await page.getByTestId('paywall-coming-soon').waitFor();
 for(const tier of ['picker-size-6-20','picker-size-21-50']) {await page.getByTestId(tier).click();const future=await page.getByTestId('paywall-coming-soon').innerText();assert.equal((future.match(/Coming Soon/g)||[]).length,1);assert.ok(!future.includes('purchase today'));assert.ok(!future.includes('?'));}
 await page.getByTestId('paywall-coming-soon').scrollIntoViewIfNeeded();await capture('pricing');
 paid=true;pro=true;
 const open=async()=>{await page.goto('http://127.0.0.1:8098/log');await page.getByTestId('log-tile-workout').click();await page.getByTestId('workout-day-date').waitFor();};
 await open();await page.getByTestId('workout-build-new-plan').click();
 assert.equal(await page.getByTestId('plan-target-muscles').count(),0);
 const choose=async(id,value)=>{await page.getByTestId(id).click();await page.getByTestId(id+'-'+value).click();};
 await page.getByTestId('plan-split').click();
 for(const split of ['full_body','upper_lower','ppl','body_part','hybrid']) assert.equal(await page.getByTestId('plan-split-'+split).count(),1);
 await capture('split-choices');await page.getByTestId('plan-split-hybrid').click();
 await page.getByTestId('plan-split-days-error').waitFor();await page.getByTestId('weekly-plan-consent').click();assert.ok(await page.getByTestId('build-weekly-plan').isDisabled());
 await choose('plan-day-count',5);assert.equal(await page.getByTestId('plan-split-days-error').count(),0);await capture('hybrid-form');
 await page.getByTestId('build-weekly-plan').click();await page.getByTestId('workout-build-form').waitFor({state:'hidden'});
 assert.equal(workoutRequests.at(-1).preferences.workout_split,'hybrid');assert.deepEqual(workoutRequests.at(-1).preferences.workout_days,[0,1,2,4,5]);assert.ok(!('target_muscles' in workoutRequests.at(-1).preferences));
 await page.getByTestId('workout-paid-routine').waitFor();assert.ok(!(await page.getByTestId('workout-paid-routine').innerText()).includes('kg'));await capture('plan-reps-only');
 await page.getByTestId('workout-plan-edit-day-2-exercise-0').click();assert.equal(await page.getByTestId('exercise-set-weight-0').count(),0);await page.getByTestId('exercise-set-plus-0').click();await page.getByTestId('exercise-confirm-sets').click();await page.getByTestId('workout-target-editor').waitFor({state:'hidden'});
 assert.equal(workoutFixture.days[2].exercises[0].targetSets[0].reps,11);
 await page.getByTestId('workout-plan-log-day-2-exercise-0').click();await page.getByTestId('exercise-set-weight-0').waitFor();assert.equal(await page.getByTestId('exercise-set-weight-0').inputValue(),'');await page.getByTestId('exercise-cancel-sets').click();
 await page.getByTestId('workout-build-new-plan').click();await choose('plan-split','ppl');await choose('plan-day-count',3);await page.getByTestId('weekly-plan-consent').click();await page.getByTestId('build-weekly-plan').click();
 await page.getByTestId('plan-split').waitFor();assert.ok((await page.getByTestId('plan-split').innerText()).includes('Push / pull / legs'));const failedId=workoutRequests.at(-1).request_id;
 await page.getByTestId('weekly-plan-consent').click();await page.getByTestId('build-weekly-plan').click();await page.getByTestId('workout-build-form').waitFor({state:'hidden'});assert.equal(workoutRequests.at(-1).request_id,failedId);assert.equal(workoutBuilds,1);
 workoutBuilds=0;await open();await page.getByTestId('workout-build-new-plan').click();await page.getByTestId('plan-split').click();
 await page.evaluate(()=>{for(const element of document.querySelectorAll('[dir="auto"]')){const css=getComputedStyle(element);element.style.fontSize=(parseFloat(css.fontSize)*2)+'px';if(css.lineHeight!=='normal')element.style.lineHeight=(parseFloat(css.lineHeight)*2)+'px';}});await capture('split-large-text');
 const titleRect=await page.getByText('Choose your workout split',{exact:true}).last().boundingBox();assert.ok(titleRect.x+titleRect.width<=390,'Large split title stays within the screen');
 assert.deepEqual(errors,[]);console.log('Workout splits browser: five choices, frequency validation, no priorities, acknowledged retry, reps-only plans, optional logging weights, pricing and Home copy passed at 320/390/844px and 200% text.');
} catch(error){for(const page of browser?.contexts().flatMap(context=>context.pages())??[]){await page.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});console.log((await page.locator('body').innerText().catch(()=>'')).slice(-1600));}throw error;}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
`;
fs.mkdirSync('.artifacts/workout-splits', { recursive: true });
const generated = '.artifacts/workout-splits/browser-fixture.mjs';
fs.writeFileSync(generated, setup + suffix);
const result = spawnSync(process.execPath, [generated], { stdio: 'inherit' });
process.exitCode = result.status ?? 1;
