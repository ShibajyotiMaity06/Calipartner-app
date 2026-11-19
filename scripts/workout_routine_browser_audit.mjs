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
const workoutRows={exercises:new Map(),workouts:new Map(),workout_exercises:new Map(),workout_sets:new Map()};
workoutRows.workouts.set('previous-workout',{id:'previous-workout',user_id:user.id,type:'strength',name:'Actual previous workout',duration_minutes:20,local_date:'2026-11-10',created_at:now,updated_at:now,deleted_at:null});
const workoutProjection=()=>({id:workoutFixture?.id ?? null,revision:workoutFixture?.revision ?? 0,full_access:paid,tier:paid?(pro?'pro':'plus'):'free',preferences:paid?(workoutFixture?.preferences ?? null):null,needs_initial:false,days:paid?(workoutFixture?.days ?? []):[],can_rebuild:paid && workoutBuilds===0,rebuilds_used:workoutBuilds,next_rebuild_at:pro && workoutBuilds?'2027-05-11T14:00:00Z':null});`,
  )
  .replace(
    "else if (name === 'get_individual_progress') data = null;",
    `else if (name === 'get_individual_progress') data = null;
else if(name==='get_workout_plan')data=workoutProjection();
else if(name==='edit_workout_plan'||name==='save_custom_workout_plan'){
 workoutEdits.push(body);
 workoutFixture={...workoutFixture,id:workoutFixture?.id??body.p_id,days:body.p_content.days,revision:(workoutFixture?.revision??0)+1};
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
 else {workoutFixture={id:body.request_id,revision:(workoutFixture?.revision ?? 0)+1,preferences:body.preferences,days:routineDays()};if(!body.initial||pro&&body.preferences.ai_workout_split)workoutBuilds++;data={saved:true,code:'WORKOUT_PLAN_SAVED'};}
} else if (url.pathname.endsWith('/weekly-plan')) {`,
  )
  .replace(
    "else if (url.pathname.endsWith('/profiles'))",
    `else if (url.pathname.endsWith('/exercises')) data=[...JSON.parse(fs.readFileSync('app/src/data/exercises_seed.json','utf8')).map(exercise=>({...exercise,owner_id:null,created_at:now,updated_at:now})),...workoutRows.exercises.values()];
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
 const chooseDay=async value=>{await page.getByTestId('workout-day-calendar').click();await page.getByTestId('day-cell-'+value).click();await page.getByTestId('workout-calendar-confirm').click();};
 await chooseDay('2026-11-10');
 await page.getByText('Actual previous workout',{exact:true}).waitFor();assert.equal(await page.getByTestId('workout-free-sample').count(),0);assert.equal(await page.getByTestId('workout-hub-modal-btn-add-exercise').count(),0);
 await chooseDay('2026-11-11');
 const openPicker=async()=>{await page.getByTestId('workout-hub-modal-btn-add-exercise').click();await page.getByTestId('exercise-picker-modal-input-search').waitFor();};
 await openPicker();
 const query=page.getByTestId('exercise-picker-modal-input-search'), heart=page.getByTestId('workout-my-exercises');
 await page.clock.runFor(400);
 const [queryBox,heartBox]=await Promise.all([page.getByTestId('workout-search-field').boundingBox(),heart.boundingBox()]);assert.ok(Math.abs(queryBox.y+queryBox.height/2-heartBox.y-heartBox.height/2)<3);assert.ok(queryBox.width>heartBox.width*4);
 assert.equal(await page.locator('[data-testid^="exercise-item-"]').count(),0);
 assert.equal(await page.locator('[data-testid^="chip-muscle-"]').count(),0);
 await query.fill('seated chest press');await page.getByText('Seated Chest Press',{exact:true}).waitFor();
 await capture('workout-search');await query.fill('Personal pendulum row');
 await page.getByTestId('exercise-picker-modal-btn-create-custom-empty').click();
 await page.getByTestId('btn-save-custom-exercise').click();
 await page.getByTestId('exercise-set-count').fill('3');
 await page.getByTestId('exercise-set-plus-0').click();await page.getByTestId('exercise-set-minus-1').click();
 await page.getByTestId('exercise-set-weight-1').fill('7.5');await capture('workout-log-sets');
 await page.getByTestId('exercise-confirm-sets').click();await page.getByTestId('exercise-sets-form').getByText(/Your workout could not be confirmed/).waitFor();
 await page.getByTestId('exercise-confirm-sets').click();await page.getByTestId('exercise-picker-modal').waitFor({state:'hidden'});
 const logs=trackingRequests.filter(request=>request.p_changes?.some(change=>change.entity==='exercises'));
 assert.equal(logs.length,2);
 assert.deepEqual(logs[0].p_changes.map(change=>change.id),logs[1].p_changes.map(change=>change.id));
 assert.equal(workoutRows.exercises.size,1);assert.ok(!workoutFixture);
 const savedWorkout=[...workoutRows.workouts.values()].find(row=>row.name==='Personal pendulum row');
 assert.ok(savedWorkout);
 await page.getByTestId('logged-workout-edit-'+savedWorkout.id).click();
 await page.getByTestId('logged-edit-name-0').fill('Paused pendulum row');
 await page.getByTestId('logged-edit-0-reps-0').fill('14');await page.getByTestId('logged-edit-save').click();
 await page.getByTestId('logged-workout-edit-modal').waitFor({state:'hidden'});
 await page.getByTestId('logged-workout-'+savedWorkout.id).getByText('Paused pendulum row',{exact:true}).waitFor();
 assert.equal([...workoutRows.exercises.values()][0].name,'Personal pendulum row');
 await openPicker();await heart.click();await page.getByText('Personal pendulum row',{exact:true}).waitFor();await capture('workout-favorites');
 paid=true;pro=true;await open();
 await page.getByTestId('workout-build-new-plan').click();
 await page.getByTestId('plan-split').click();
 await page.getByTestId('plan-split-none').waitFor();
 assert.equal(await page.getByTestId('plan-split-hybrid').count(),0);
 await page.getByTestId('plan-split-none').click();
 assert.equal(await page.getByTestId('plan-location').count(),0);
 await page.getByTestId('weekly-plan-consent').click();await page.getByTestId('build-weekly-plan').click();
 await page.getByTestId('workout-build-form').waitFor({state:'hidden'});
 assert.equal(workoutRequests.at(-1).preferences.ai_workout_split,'none');
 await page.getByTestId('workout-ai-unavailable').waitFor();
 assert.equal(await page.getByTestId('workout-build-new-plan').isDisabled(),true);
 await page.getByTestId('workout-custom-plan').click();
 await page.getByTestId('custom-plan-day-6').click();
 await page.getByTestId('custom-plan-add-exercise').click();
 await page.getByTestId('custom-plan-exercise-name').fill('Sunday press');
 await page.getByTestId('exercise-confirm-sets').click();
 await page.getByTestId('custom-plan-save').click();
 await page.getByTestId('custom-plan-modal').waitFor({state:'hidden'});
 assert.equal(workoutFixture.days[6].exercises[0].name,'Sunday press');
 assert.equal(workoutRequests.length,1);
 await page.getByTestId('workout-ai-unavailable').waitFor();
 await capture('workout-pro-cooldown');
 await page.goto('http://127.0.0.1:8098/squad/compare?room='+rid(1));
 await page.getByTestId('compare-choose-left').click();
 await page.getByTestId('compare-members-left').waitFor();
 assert.equal(await page.getByTestId('compare-member-'+uid(1)).count(),0);
 await page.getByTestId('compare-member-'+uid(2)).click();
 assert.match(await page.getByTestId('compare-choose-left').innerText(),/Aarav/);
 await page.getByTestId('compare-choose-right').click();
 await capture('squad-compare-dropdown');
 assert.deepEqual(errors,[]);console.log('Browser: workout search and favorites, retry-safe log and rename, manual week, AI split and cooldown, and Squad dropdown passed at 375px and 844px.');
} catch(error){for(const page of browser?.contexts().flatMap(context=>context.pages())??[]){await page.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});console.log((await page.locator('body').innerText().catch(()=>'')).slice(-1800));}throw error;}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
`;
fs.mkdirSync('.artifacts/workout-routine', { recursive: true });
const generated = '.artifacts/workout-routine/browser-fixture.mjs';
fs.writeFileSync(generated, setup + suffix);
const result = spawnSync(process.execPath, [generated], { stdio: 'inherit' });
process.exitCode = result.status ?? 1;
