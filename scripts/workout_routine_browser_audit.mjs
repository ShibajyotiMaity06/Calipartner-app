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
    "out = path.resolve('.artifacts/workout-routine/browser')",
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
const suffix = `
 const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(error.message));
 await page.clock.install({time:new Date(now)});
 const capture=async name=>{for(const width of [375,844]){await page.setViewportSize({width,height:width===375?844:390});await page.screenshot({path:path.join(out,name+'-'+width+'.png'),fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),name+' overflow');}await page.setViewportSize({width:375,height:844});};
 const open=async()=>{await page.goto('http://127.0.0.1:8098/log');await page.getByTestId('log-tile-workout').click();await page.getByTestId('workout-day-date').waitFor();};
 await open();await page.getByTestId('workout-free-sample').waitFor();
 assert.match(await page.getByTestId('workout-free-sample').innerText(),/Seated dumbbell curls/);await capture('free-wednesday');
 await page.getByTestId('workout-day-previous').click();await page.getByText('Actual previous workout',{exact:true}).waitFor();assert.equal(await page.getByTestId('workout-free-sample').count(),0);assert.equal(await page.getByTestId('workout-hub-modal-btn-add-exercise').count(),0);await capture('previous-actual-history');
 await page.getByTestId('workout-day-next').click();await page.getByTestId('workout-hub-modal-btn-add-exercise').click();
 await page.getByTestId('exercise-picker-modal-input-search').waitFor();
 const chipRects=await Promise.all(['upper','lower','core'].map(async key=>page.getByTestId('chip-muscle-'+key).boundingBox()));assert.ok(Math.max(...chipRects.map(r=>r.y))-Math.min(...chipRects.map(r=>r.y))<2);
 assert.equal(await page.getByTestId('chip-muscle-all').count(),0);assert.equal(await page.getByTestId('chip-muscle-full').count(),0);assert.equal(await page.getByTestId('exercise-picker-modal-btn-open-custom').count(),0);
 assert.equal(await page.locator('[data-testid^="exercise-item-"]').count(),5);await page.getByTestId('exercise-show-more').click();assert.equal(await page.locator('[data-testid^="exercise-item-"]').count(),10);
 await page.getByTestId('chip-muscle-lower').click();await page.clock.runFor(100);assert.equal(await page.locator('[data-testid^="exercise-item-"]').count(),5);await page.getByTestId('chip-muscle-core').click();await page.clock.runFor(100);assert.equal(await page.locator('[data-testid^="exercise-item-"]').count(),5);
 await page.getByTestId('chip-muscle-upper').click();await page.getByTestId('exercise-picker-modal-input-search').fill('curl');
 await page.locator('[data-testid^="exercise-item-"]').first().click();await page.getByTestId('exercise-set-count').fill('3');
 await page.getByTestId('exercise-set-plus-0').click();await page.getByTestId('exercise-set-minus-1').click();
 await page.getByTestId('exercise-add-weights').click();await page.getByTestId('exercise-set-weight-1').fill('7.5');await capture('per-set-controls');
 await page.getByTestId('exercise-confirm-sets').click();await page.getByText('Your workout could not be confirmed. Check your connection and try again.',{exact:true}).first().waitFor();
 await page.getByTestId('exercise-confirm-sets').click();await page.getByTestId('exercise-sets-form').waitFor({state:'hidden'});
 const writes=trackingRequests.filter(request=>request.p_changes?.some(change=>change.entity==='workouts'));assert.equal(writes.length,2);assert.deepEqual(writes[0].p_changes.map(change=>change.id),writes[1].p_changes.map(change=>change.id));
 assert.equal(workoutRows.workouts.size,2);const sets=[...workoutRows.workout_sets.values()];assert.deepEqual(sets.map(set=>set.reps),[11,9,10]);assert.deepEqual(sets.map(set=>set.weight_kg),[0,7.5,0]);assert.ok(!workoutFixture,'Free custom logs never create a routine');
 paid=true;pro=true;workoutFixture=null;await open();await page.getByTestId('workout-build-new-plan').waitFor();assert.equal(await page.getByTestId('workout-build-new-plan').isDisabled(),false);assert.equal(await page.getByTestId('workout-setup-plan').count(),0);await page.getByTestId('workout-build-new-plan').click();await page.getByTestId('weekly-plan-consent').click();await page.getByTestId('build-weekly-plan').click();await page.getByTestId('workout-build-form').waitFor({state:'hidden'});assert.equal(workoutRequests.at(-1).initial,true);assert.equal(workoutBuilds,0);await capture('pro-no-onboarding-build');pro=false;
 paid=true;workoutFixture={id:rid(90),revision:1,preferences:workoutPreferences,days:routineDays()};await open();await page.getByTestId('workout-paid-routine').waitFor();await capture('paid-onboarding-routine');
 await page.getByTestId('workout-plan-edit-day-2-exercise-0').click();await page.getByTestId('exercise-set-count').fill('3');await page.getByTestId('exercise-set-plus-0').click();await page.getByTestId('exercise-add-weights').click();await page.getByTestId('exercise-set-weight-1').fill('12.5');await page.getByTestId('exercise-confirm-sets').click();await page.getByTestId('workout-target-editor').waitFor({state:'hidden'});
 assert.deepEqual(workoutFixture.days[2].exercises[0].targetSets,[{reps:11,weightKg:0},{reps:8,weightKg:12.5},{reps:10,weightKg:0}]);assert.equal(workoutBuilds,0);
 await page.getByTestId('workout-plan-remove-day-2-exercise-0').click();await page.getByTestId('workout-rest-day').waitFor();assert.equal(workoutFixture.days[0].exercises.length,1);await capture('paid-rest-and-custom');
 await page.getByTestId('workout-build-new-plan').click();await page.getByTestId('plan-workout-notes').fill('Focus more on arms. No legs.');await page.getByTestId('weekly-plan-consent').click();await page.getByTestId('build-weekly-plan').click();
 await page.getByTestId('plan-workout-notes').waitFor();assert.equal(await page.getByTestId('plan-workout-notes').inputValue(),'Focus more on arms. No legs.');assert.equal(workoutBuilds,0);const failedId=workoutRequests.at(-1).request_id;
 await page.getByTestId('weekly-plan-consent').click();await page.getByTestId('build-weekly-plan').click();await page.getByTestId('workout-build-form').waitFor({state:'hidden'});assert.equal(workoutRequests.at(-1).request_id,failedId);assert.equal(workoutBuilds,1);assert.equal(workoutFixture.preferences.workout_notes,'Focus more on arms. No legs.');assert.equal(await page.getByTestId('workout-build-new-plan').isDisabled(),true);await capture('plus-rebuild-used');
 pro=true;await open();await page.getByText(/You can rebuild your plan on/).waitFor();assert.equal(await page.getByTestId('workout-build-new-plan').isDisabled(),true);await capture('pro-six-month-date');
 await page.evaluate(()=>{for(const element of document.querySelectorAll('[dir="auto"]')){const css=getComputedStyle(element);element.style.fontSize=(parseFloat(css.fontSize)*2)+'px';if(css.lineHeight!=='normal')element.style.lineHeight=(parseFloat(css.lineHeight)*2)+'px';}});await capture('workout-large-font-reduced-motion');
 assert.deepEqual(errors,[]);console.log('Workout routine browser: Free/paid/date history, horizontal filters, per-set controls, lost-ack retry, direct logging, plan edits/removal, rest day, notes preservation, Plus allowance, Pro date and 375/844px/large text passed.');
} catch(error){for(const page of browser?.contexts().flatMap(context=>context.pages())??[]){await page.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});console.log((await page.locator('body').innerText().catch(()=>'')).slice(-1800));}throw error;}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
`;
fs.mkdirSync('.artifacts/workout-routine', { recursive: true });
const generated = '.artifacts/workout-routine/browser-fixture.mjs';
fs.writeFileSync(generated, setup + suffix);
const result = spawnSync(process.execPath, [generated], { stdio: 'inherit' });
process.exitCode = result.status ?? 1;
