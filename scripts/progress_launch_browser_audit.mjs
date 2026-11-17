// Local contract fixtures only; no real payments, messages or account writes.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const source = fs.readFileSync('scripts/nov4_browser_audit.mjs', 'utf8');
const marker = '  const page = await context.newPage();';
let setup = source
  .slice(0, source.indexOf(marker))
  .replace(
    "out = path.resolve('.artifacts/food-polish/browser')",
    "out = path.resolve('.artifacts/progress-launch/browser')",
  )
  .replace("file = path.join(root, 'index.html')", "file = path.join(root, 'app-shell.html')")
  .replace('viewport: { width: 390, height: 844 }', 'viewport: { width: 375, height: 844 }')
  .replace(
    "else if (name === 'get_individual_progress') data = null;",
    `else if (name === 'get_individual_progress') data = {
    range: body.p_range, start_date: '2026-11-01', end_date: day,
    weight: { history: [{ date: '2026-11-01', raw_weight_kg: 76, trend_weight_kg: 76 }, { date: day, raw_weight_kg: 75, trend_weight_kg: 75.5 }], start_weight_kg: 78, current_weight_kg: 75, current_trend_kg: 75.5, total_change_kg: -3, total_change_pct: -4, target_weight_kg: 70, weekly_pace_kg: -0.3, projected_date: null, goal_progress_pct: 37.5 },
    calories: { daily: [{ date: day, calories: 1800, target_calories: 2000, is_logged_day: true, is_goal_day: true }], average_calories: 1800, average_target: 2000, logged_days_count: 1, goal_days_count: 1, total_days_in_range: 3, adherence_pct: 100 },
    macros: { protein_avg_g: 120, carbs_avg_g: 200, fat_avg_g: 60, protein_target_g: 100, carbs_target_g: 220, fat_target_g: 65, food_days: 1, protein_goal_days: 1 },
    steps: { daily: [{date: day, steps: 8000, distance_km: 5}], average_steps: 8000, total_steps: 8000, total_distance_km: 5, goal_steps: 8000 },
    water: { daily: [{date: day, water_ml: 2000}], average_water_ml: 2000, total_water_ml: 2000, goal_water_ml: 2500 },
    workouts: { total_workouts: 2, sessions_per_week: 2, total_duration_minutes: 60, total_volume_kg: 300, total_strength_sets: 1, daily_sessions: [{date:day,sessions:2}], strength_sets: [{exercise_id:null,exercise_name:'Press',date:day,weight_kg:60,reps:5}], exercise_progression: [] },
    consistency: { current_streak:1,longest_streak:1,weekly_scores:[] }, goal_progress_pct:37.5,
  };`,
  )
  .replace(
    "else if (url.pathname.endsWith('/goal_profiles')) data = [goal];",
    "else if (url.pathname.endsWith('/goal_profiles')) data = [{...goal,target_weight_kg:70}];\n    else if (url.pathname.endsWith('/weight_logs')) data = [{id:rid(500),user_id:user.id,local_date:day,weight_kg:75,logged_at:now,created_at:now,updated_at:now,deleted_at:null}];",
  );
const suffix = `
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(error.message));
  const origin = 'http://127.0.0.1:8098';
  const visible = id => page.getByTestId(id).filter({visible:true});
  const checkFit = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),true,'No page overflow at 375px');
  await page.goto(origin+'/today');
  await visible('theme-toggle').waitFor();
  await visible('btn-header-upgrade').waitFor();
  await visible('btn-header-upgrade').getByText('Upgrade',{exact:true}).waitFor();
  const pill = await visible('btn-header-upgrade').boundingBox();
  assert(pill.width>=44 && pill.height>=44);
  assert.equal(await visible('home-view-challenge').count(),0);
  await checkFit();
  await page.screenshot({path:path.join(out,'home-light-375.png'),fullPage:true});
  await page.goto(origin+'/progress');
  await visible('weight-goal-hero').waitFor();
  await visible('progress-view-weight').waitFor();
  assert.equal(await visible('theme-toggle').count(),0);
  assert.equal(await visible('calories-chart').count(),0);
  for (const range of ['7d','90d','all','30d']) {
    await visible('progress-range-selector-option-'+range).click();
    await visible('progress-view-weight').waitFor();
  }
  await page.screenshot({path:path.join(out,'weight-light-375.png'),fullPage:true});
  for (const category of ['nutrition','workouts','habits']) {
    await visible('progress-category-'+category).click();
    await visible('progress-view-'+category).waitFor();
    await checkFit();
    await page.screenshot({path:path.join(out,category+'-light-375.png'),fullPage:true});
  }
  await visible('progress-category-photos').click();
  await visible('progress-photos-locked').waitFor();
  await visible('progress-photos-upgrade').click();
  await visible('btn-paywall-cta').waitFor();
  assert.match(await page.locator('body').innerText(),/Challenges, trophies and badges/);
  assert.equal(await visible('theme-toggle').count(),0);
  paid=true;pro=false;
  await page.goto(origin+'/progress');
  await visible('btn-header-upgrade').getByText('Go Pro',{exact:true}).waitFor();
  await visible('progress-category-photos').click();
  await visible('photos-gallery').waitFor();
  const vault = await visible('progress-photo-vault').boundingBox();
  assert(vault.height>100,'Embedded photo vault has visible content');
  await page.screenshot({path:path.join(out,'photos-plus-375.png'),fullPage:true});
  await visible('btn-header-upgrade').click();
  assert.match(page.url(),/tier=pro/);
  await page.goto(origin+'/chat');
  await visible('chat-friends-tabs-friends').click();
  await visible('friend-username-search').waitFor();
  for (const id of ['community-tab-discover','community-tab-requests','community-tab-friends','community-invite']) {
    const box = await visible(id).boundingBox();
    assert(box.height>=44 && box.height<=64,id+' compact accessible height');
  }
  assert.equal(await visible('theme-toggle').count(),0);
  await checkFit();
  await page.screenshot({path:path.join(out,'friends-light-375.png'),fullPage:true});
  pro=true;
  await page.goto(origin+'/me');
  await visible('btn-header-upgrade').getByText('Pro',{exact:true}).waitFor();
  assert.equal(await visible('theme-toggle').count(),0);
  await visible('btn-me-change-plan').getByText('Manage web subscription',{exact:true}).waitFor();
  assert.equal(await visible('open-trophies').count(),0);
  await checkFit();
  await page.screenshot({path:path.join(out,'account-web-pro-375.png'),fullPage:true});
  await page.goto(origin+'/today');
  await visible('theme-toggle').click();
  await page.goto(origin+'/progress');
  await visible('weight-goal-hero').waitFor();
  await visible('progress-view-weight').waitFor();
  await page.screenshot({path:path.join(out,'progress-dark-375.png'),fullPage:true});
  await checkFit();
  await page.addStyleTag({content:'[dir="auto"] { font-size:200% !important; line-height:1.3 !important; }'});
  await checkFit();
  await page.screenshot({path:path.join(out,'progress-large-text.png'),fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('Progress launch browser: 375px light/dark layouts, large text, ranges, five focused categories, paid photo vault, Free/Plus/Pro upgrade routes, Home-only theme and compact Friends controls passed.');
} catch(error) {
  for(const page of browser?.contexts().flatMap(c=>c.pages())??[]) {
    await page.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});
    console.log((await page.locator('body').innerText().catch(()=>'' )).slice(-1200));
  }
  throw error;
} finally { await browser?.close(); await new Promise(resolve=>server.close(resolve)); }
`;
fs.mkdirSync('.cache', { recursive: true });
const filename = '.cache/progress-launch-browser.mjs';
fs.writeFileSync(filename, setup + suffix);
const result = spawnSync(process.execPath, [filename], { stdio: 'inherit' });
process.exit(result.status ?? 1);
