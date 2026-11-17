// Local fixtures; all account writes are intercepted.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const source = fs.readFileSync('scripts/nov4_browser_audit.mjs', 'utf8');
const marker = '  const page = await context.newPage();';
const setup = source
  .slice(0, source.indexOf(marker))
  .replace(
    "out = path.resolve('.artifacts/food-polish/browser')",
    "out = path.resolve('.artifacts/workout-polish/browser')",
  )
  .replace("file = path.join(root, 'index.html')", "file = path.join(root, 'app-shell.html')")
  .replace('viewport: { width: 390, height: 844 }', 'viewport: { width: 375, height: 844 }')
  .replace(
    'let recent = [];',
    'let recent = []; const loggedRows={workouts:new Map(),workout_exercises:new Map(),workout_sets:new Map()};',
  )
  .replace(
    'trackingRequests.push(body);',
    `trackingRequests.push(body);
   for(const change of body.p_changes??[]) if(loggedRows[change.entity]) {
     const existing=loggedRows[change.entity].get(change.id)??{};
     loggedRows[change.entity].set(change.id,{...existing,...change.payload});
   }`,
  )
  .replace(
    "else if (url.pathname.endsWith('/goal_profiles')) data = [goal];",
    `else if (url.pathname.endsWith('/goal_profiles')) data = [goal];
   else if (url.pathname.endsWith('/exercises')) data=[{id:rid(700),name:'Fixture press',muscle_group:'chest',equipment:'bodyweight',is_custom:false,created_at:now}];
   else if(loggedRows[url.pathname.split('/').at(-1)]) data=[...loggedRows[url.pathname.split('/').at(-1)].values()];`,
  );
const suffix = `
 const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(error.message));
 const origin='http://127.0.0.1:8098';
 await page.goto(origin+'/log?flow=workout');
 await page.getByTestId('workout-hub-modal-btn-add-exercise').click();
 await page.locator('[data-testid^="exercise-item-"]').first().click();
 await page.getByTestId('exercise-set-count').fill('3');
 for(let i=0;i<3;i++) {
   const reps=page.getByTestId('exercise-set-reps-'+i),weight=page.getByTestId('exercise-set-weight-'+i);
   assert.equal(await weight.inputValue(),'');
   const r=await reps.boundingBox(),w=await weight.boundingBox();
   assert(Math.abs(r.y-w.y)<2 && w.x>r.x,'Reps and weight are side by side');
 }
 assert.equal(await page.getByTestId('exercise-add-weights').count(),0);
 await page.screenshot({path:path.join(out,'paired-sets-375.png'),fullPage:true});
 await page.getByTestId('exercise-confirm-sets').click();
 await page.getByTestId('workout-day-history').waitFor();
 assert.match(page.url(),/log/);
 const workout=[...loggedRows.workouts.values()][0];
 const card=page.getByTestId('logged-workout-'+workout.id);
 await page.getByTestId('exercise-picker-modal').waitFor({state:'hidden'});
 await card.scrollIntoViewIfNeeded();
 await page.waitForTimeout(450);
 assert.doesNotMatch(await card.innerText(),/0 kg/);
 assert.equal((await card.innerText()).split(workout.name).length-1,1);
 await page.screenshot({path:path.join(out,'saved-workout-375.png'),fullPage:true});
 await page.getByTestId('logged-workout-edit-'+workout.id).click();
 await page.getByTestId('logged-workout-edit-modal').waitFor();
 await page.getByTestId('logged-edit-count-0').fill('2');
 await page.getByTestId('logged-edit-0-reps-0').fill('12');
 await page.getByTestId('logged-edit-0-weight-0').fill('15');
 await page.screenshot({path:path.join(out,'edit-dialog-375.png'),fullPage:true});
 await page.getByTestId('logged-edit-save').click();
 await page.getByTestId('logged-workout-edit-modal').waitFor({state:'hidden'});
 await card.getByText('12 reps',{exact:true}).waitFor();
 assert.match(await card.innerText(),/15 kg/);
 assert.equal([...loggedRows.workout_sets.values()].filter(set=>!set.deleted_at).length,2);
 assert.match(page.url(),/log/);
 await page.getByTestId('logged-workout-delete-'+workout.id).click();
 await page.getByTestId('logged-workout-delete-modal').waitFor();
 const before=trackingRequests.length;
 await page.screenshot({path:path.join(out,'delete-confirmation-375.png'),fullPage:true});
 await page.getByTestId('logged-delete-cancel').click();
 assert.equal(trackingRequests.length,before);
 await page.getByTestId('logged-workout-delete-'+workout.id).click();
 await page.getByTestId('logged-delete-confirm').click();
 await card.waitFor({state:'hidden'});
 assert.match(page.url(),/log/);
 assert(loggedRows.workouts.get(workout.id).deleted_at);
 await page.goto(origin+'/log?flow=water');
 await page.getByTestId('input-water-amount').waitFor();
 await page.waitForTimeout(450);
 await page.screenshot({path:path.join(out,'water-log-blue-375.png'),fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('Workout polish browser: paired blank weight fields, exact set rows, save stays in log, unique title/no zero weight, modal edits and confirmed deletion passed at 375px.');
} catch(error) {
 for(const page of browser?.contexts().flatMap(c=>c.pages())??[]) {
  await page.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});
  console.log((await page.locator('body').innerText().catch(()=>'' )).slice(-1000));
 }
 throw error;
} finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
`;
fs.mkdirSync('.cache', { recursive: true });
const filename = '.cache/workout-polish-browser.mjs';
fs.writeFileSync(filename, setup + suffix);
const result = spawnSync(process.execPath, [filename], { stdio: 'inherit' });
process.exit(result.status ?? 1);
