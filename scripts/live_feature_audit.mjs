// Explicit owner-requested live audit. Only disposable, private accounts are changed.
// Credentials stay in memory. The journal contains IDs only, for crash recovery.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const ref = fs.readFileSync('supabase/.temp/project-ref', 'utf8').trim();
const managementToken = process.env.CALI_AUDIT_MANAGEMENT_TOKEN;
delete process.env.CALI_AUDIT_MANAGEMENT_TOKEN;
if (!managementToken) throw new Error('OS credential wrapper is required');
const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys`, {
  headers: { Authorization: `Bearer ${managementToken}` },
});
assert.ok(response.ok, 'Management key lookup');
const keys = await response.json();
const url = `https://${ref}.supabase.co`;
const anonKey = keys.find((k) => k.name === 'anon').api_key;
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, keys.find((k) => k.name === 'service_role').api_key, options);
const out = path.resolve('.artifacts/live-feature-audit');
fs.mkdirSync(out, { recursive: true });
const journalPath = path.join(out, 'fixture-ids.json');
let journal = fs.existsSync(journalPath)
  ? JSON.parse(fs.readFileSync(journalPath, 'utf8'))
  : { users: [], rooms: [], challenges: [] };
const persist = () => fs.writeFileSync(journalPath, JSON.stringify(journal));
const query = async (promise) => {
  const { data, error } = await promise;
  if (error) throw new Error(error.message);
  return data;
};
const rpc = (client, name, args = {}) => query(client.rpc(name, args));
const findings = [];
function pass(name) {
  findings.push({ name, passed: true });
  console.log('PASS ' + name);
}
async function cleanup() {
  const ids = journal.users;
  if (ids.length) {
    await query(admin.from('challenge_events').delete().in('actor_id', ids));
    const challenges = await query(admin.from('challenges').select('id').in('creator_id', ids));
    for (const row of challenges) await query(admin.from('challenges').delete().eq('id', row.id));
    const rooms = await query(admin.from('rooms').select('id').in('plan_holder_id', ids));
    for (const row of rooms) await query(admin.from('rooms').delete().eq('id', row.id));
    for (const id of ids) {
      const buckets = await query(admin.from('rate_limit_buckets').select('bucket_key').like('bucket_key', `%${id}%`));
      if (buckets.length) await query(admin.from('rate_limit_buckets').delete().in('bucket_key', buckets.map((b) => b.bucket_key)));
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error && error.status !== 404) throw new Error('Fixture account cleanup failed');
      const remaining = await admin.auth.admin.getUserById(id);
      assert.equal(remaining.data.user, null, 'Fixture account was deleted');
    }
  }
  journal = { users: [], rooms: [], challenges: [] };
  persist();
  console.log('PASS Cleanup: disposable accounts and their test records deleted');
}
if (journal.users.length) await cleanup();
if (process.argv.includes('--cleanup')) process.exit(0);

let browser;
let page;
let phase = 'provision';
const frontendErrors = [];
async function makeAccount(plus) {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 10);
  const email = `liveaudit_${suffix}@example.invalid`;
  const password = randomUUID() + 'aA8!';
  const made = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { fixture: 'owner-live-feature-audit' } });
  if (made.error) throw new Error('Fixture account creation failed');
  const id = made.data.user.id;
  journal.users.push(id);persist();
  if (plus) await query(admin.from('entitlements').insert({ user_id:id,tier:'plus',source:'none',status:'paid',period:'monthly',period_end:new Date(Date.now()+30*86400000).toISOString() }));
  const goals = await query(admin.from('goal_profiles').select('id').eq('user_id',id));
  assert.equal(goals.length,0,'Account has not completed onboarding');
  const c = createClient(url,anonKey,options);
  const login = await c.auth.signInWithPassword({email,password});
  if(login.error) throw new Error('Fixture sign-in failed');
  await query(c.from('profiles').upsert({id,username:`audit_${suffix}`,nickname:plus?'Plus audit':'Free audit',date_of_birth:'1995-01-01',sex:'male',height_cm:175,timezone:'Asia/Kolkata',country:'IN',discoverable:false}));
  return {id,c,session:login.data.session};
}
async function screenshot(name) {
  await page.screenshot({path:path.join(out,name+'.png'),fullPage:true});
}
try {
  const host = await makeAccount(true);
  const peer = await makeAccount(false);
  pass('New account has Plus before onboarding, with no saved goals or plan');
  const npmCache = path.join(process.env.LOCALAPPDATA,'npm-cache','_npx');
  const installed = fs.readdirSync(npmCache).map(name=>path.join(npmCache,name,'node_modules','playwright','index.mjs')).find(file=>fs.existsSync(file));
  assert.ok(installed,'Playwright is installed');
  const {chromium}=await import(`file:///${installed.replaceAll('\\','/')}`);
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.addInitScript(({ref,session})=>{
    const key=`sb-${ref}-auth-token`;
    localStorage.setItem(key,JSON.stringify(session));
    localStorage.setItem(key+'.last-online',String(Date.now()));
  },{ref,session:host.session});
  page=await context.newPage();page.setDefaultTimeout(35000);
  page.on('pageerror',error=>frontendErrors.push(error.message));
  page.on('response',async response=>{
    if(response.url().includes(ref+'.supabase.co') && response.status()>=400) {
      let detail;try{const data=await response.json();detail=data.message??data.error??data.code;}catch{detail='';}
      console.log(`REQUEST ${response.status()} ${new URL(response.url()).pathname} ${typeof detail==='string'?detail.slice(0,180):''}`);
    }
  });
  phase='onboarding';
  await page.goto('https://app.calipartner.site/onboarding');
  await page.getByTestId('goal-card-maintain').click();
  await page.getByTestId('btn-onboarding-next').click();
  await page.getByTestId('btn-onboarding-next').click();
  await page.getByTestId('activity-card-moderate').click();
  await page.getByTestId('btn-onboarding-next').click();
  await page.getByTestId('input-weight').fill('70');
  await page.getByTestId('input-height').fill('175');
  await page.getByTestId('gym-days-3').click();
  await page.getByTestId('btn-onboarding-next').click();
  await page.getByTestId('btn-onboarding-next').click();
  await page.getByTestId('input-water-goal').fill('2500');
  await page.getByTestId('input-step-goal').fill('6000');
  await page.getByTestId('btn-onboarding-next').click();
  await page.getByTestId('premium-highlights').waitFor();
  await page.getByTestId('btn-premium-close').click();
  await page.getByTestId('btn-use-recommended').click();
  await page.getByTestId('weekly-plan-form').waitFor();
  const entitlement=await query(host.c.from('entitlements').select('*').eq('user_id',host.id).single());
  assert.equal(entitlement.tier,'plus');assert.equal(entitlement.status,'paid');
  pass('Live onboarding saves goals and keeps the pre-existing Plus entitlement');
  phase='generation';
  await page.getByTestId('weekly-plan-next').click();
  await page.getByTestId('plan-country').fill('India');
  await page.getByTestId('plan-cuisine').fill('Indian');
  await page.getByTestId('plan-allergies').fill('none');
  await page.getByTestId('plan-exclusions').fill('beef');
  await page.getByTestId('plan-meals-4').click();
  await page.getByTestId('weekly-plan-consent').click();
  const generation=page.waitForResponse(response=>response.url().endsWith('/functions/v1/weekly-plan'),{timeout:240000});
  await page.getByTestId('build-weekly-plan').click();
  const generated=await generation;
  assert.equal(generated.status(),200,'Real weekly plan generation succeeds');
  await page.getByTestId('preferred-workout-day').waitFor();
  const plan=await rpc(host.c,'get_personal_weekly_plan');
  assert.ok(plan.full_access);assert.equal(plan.days.length,7);
  fs.writeFileSync(path.join(out,'plan-review.json'),JSON.stringify({preferences:plan.preferences,targets:plan.targets,days:plan.days,workout_tips:plan.workout_tips,diet_tips:plan.diet_tips},null,2));
  assert.deepEqual(plan.preferences.workout_days,[0,2,4]);
  assert.equal(plan.preferences.meals_per_day,4);
  for(const day of plan.days){
    assert.equal(day.meals.length,4);
    assert.ok(day.meals.every(meal=>meal.name&&meal.portion&&meal.ingredients.length));
    assert.ok(day.meals.every(meal=>Number.isFinite(meal.calories)&&meal.calories>0));
    assert.equal(day.workout.exercises.length>0,[0,2,4].includes(day.day));
    assert.ok(day.workout.exercises.every(exercise=>plan.preferences.equipment.includes(exercise.equipment)));
  }
  pass('Real AI plan persists all seven days, chosen training days/equipment and four meals per day');
  await screenshot('saved-weekly-plan');
  phase='edit-workout';
  await page.getByTestId('edit-preferred-routine').click();
  await page.getByTestId('routine-name-0').fill('Audit bodyweight squat');
  await page.getByTestId('routine-sets-0').fill('2');
  await page.getByTestId('routine-reps-0').fill('8');
  await page.getByTestId('save-weekly-routine').click();
  await page.getByTestId('weekly-routine-editor').waitFor({state:'hidden'});
  await page.reload();
  await page.getByTestId('preferred-workout-day').getByText('Audit bodyweight squat',{exact:true}).waitFor();
  const edited=await rpc(host.c,'get_personal_weekly_plan');
  assert.equal(edited.days[0].workout.exercises[0].sets,2);
  assert.equal(edited.days[0].workout.exercises[0].reps,8);
  pass('Workout edits are acknowledged and survive a browser reload');
  await screenshot('edited-weekly-workout');
  // Further live checks run below; credentials and accounts are always cleaned up.
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({phase,findings,frontendErrors},null,2));
} catch(error) {
  if(page){await screenshot('failure-'+phase).catch(()=>{});console.log('SCREEN '+(await page.locator('body').innerText().catch(()=>'' )).slice(-6000));}
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({phase,findings,error:error.message,frontendErrors},null,2));
  throw error;
} finally {
  await browser?.close();
  await cleanup();
}
