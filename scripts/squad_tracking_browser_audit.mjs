// Intercepted local fixtures only; no hosted writes or purchases.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const source = fs.readFileSync('scripts/nov4_browser_audit.mjs', 'utf8');
const marker = '  const page = await context.newPage();';
if (!source.includes(marker)) throw new Error('Browser fixture harness changed');
let setup = source
  .slice(0, source.indexOf(marker))
  .replace(
    "out = path.resolve('.artifacts/food-polish/browser')",
    "out = path.resolve('.artifacts/squad-tracking/browser')",
  )
  .replace('let pro = false;', 'let trackingFixture = null; let chatUnread = 140; let pro = false;')
  .replaceAll('body.p_room_id === rid(1) && !seen', '!seen')
  .replace(
    "else if (name === 'get_chat_unread_count') data = 0;",
    "else if (name === 'get_chat_unread_count') data = chatUnread; else if (name === 'mark_chat_read') { chatUnread = 0; data = null; }",
  )
  .replace(
    'members: body.p_room_id === rid(0) ? all.slice(0, 2) : all,',
    `members: (body.p_room_id === rid(0) ? all.slice(0, 2) : all).map(member => {
    const tracking = member.is_self ? (trackingFixture?.enabled ?? {calories:true,protein:true,carbs:true,fat:true,steps:true,water:false}) : {calories:true,protein:false,carbs:true,fat:true,steps:true,water:true};
    const item = {...member,tracking,water:500,targets:{...member.targets,water:2000}};
    for(const key of Object.keys(tracking)) if(!tracking[key]) item[key]=null;
    return item;
  }),`,
  )
  .replace(
    "} else if (url.pathname.endsWith('/weekly-plan')) {",
    `} else if (url.pathname.endsWith('/tracking_preferences')) {
    if(request.method()==='POST') { trackingFixture=request.postDataJSON(); data=trackingFixture; }
    else data=trackingFixture ? [trackingFixture] : [];
  } else if (url.pathname.endsWith('/weekly-plan')) {`,
  );
const suffix = `
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.setDefaultTimeout(20000);
  await page.clock.install({time:new Date(now)});
  const capture = async name => {
    for(const width of [375,844]) {
      await page.setViewportSize({width,height:width===375?844:390});
      await page.screenshot({path:path.join(out,name+'-'+width+'.png'),fullPage:true});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),name+' overflow');
    }
    await page.setViewportSize({width:375,height:844});
  };
  await page.goto('http://127.0.0.1:8098/today');
  await page.getByTestId('personal-day-card').waitFor();
  await page.getByTestId('home-squad-unread-'+rid(0)).waitFor();
  assert.equal(await page.getByTestId('home-squad-unread-'+rid(0)).innerText(),'99+');
  const initialCard = await page.getByTestId('home-squad-card-'+rid(0)).boundingBox();
  const off=page.getByTestId('personal-day-metric-water');
  assert.match(await off.getAttribute('aria-label'),/Not tracked/);
  await capture('home-compact-icons');
  await page.getByTestId('mentions-'+rid(0)).click();
  await page.getByTestId('open-mention-'+messageId).waitFor();
  assert.equal(seen,false);
  await page.getByTestId('close-home-mentions').click();
  assert.equal(seen,true);
  await page.getByTestId('edit-daily-tracking').click();
  await page.getByTestId('track-protein').click();
  await page.getByTestId('track-water').click();
  await page.getByTestId('save-tracking-preferences').click();
  await page.getByTestId('save-tracking-preferences').waitFor({state:'hidden'});
  await page.getByTestId('edit-daily-tracking').waitFor();
  assert.match(await page.getByTestId('personal-day-metric-protein').getAttribute('aria-label'),/Not tracked/);
  assert.ok(!/Not tracked/.test(await page.getByTestId('personal-day-metric-water').getAttribute('aria-label')));
  await capture('home-disabled-blur');
  await page.goto('http://127.0.0.1:8098/squad/compare?room='+rid(0));
  await page.getByTestId('member-metric-'+uid(1)+'-protein').waitFor();
  assert.match(await page.getByTestId('member-metric-'+uid(1)+'-protein').innerText(),/Not tracked/);
  await capture('compare-not-tracked');
  await page.goto('http://127.0.0.1:8098/today');
  recent=[{...tagged,room_id:rid(0)}];
  await page.getByTestId('home-squad-chat-'+rid(0)).click();
  await page.getByTestId('list-chat-messages').waitFor();
  await page.clock.runFor(300);
  assert.equal(chatUnread,0);
  await page.goto('http://127.0.0.1:8098/today');
  await page.getByTestId('home-open-title-'+rid(0)).waitFor();
  assert.equal(await page.getByTestId('home-squad-chat-'+rid(0)).count(),0);
  assert.equal(await page.getByTestId('home-squad-unread-'+rid(0)).count(),0);
  await page.clock.runFor(300);
  const clearedCard = await page.getByTestId('home-squad-card-'+rid(0)).boundingBox();
  const clearedCarousel = await page.getByTestId('home-squad-carousel').boundingBox();
  assert.ok(clearedCard.height < initialCard.height, 'Squad shrinks when notification row is empty');
  assert.ok(Math.abs(clearedCarousel.height - clearedCard.height) <= 2, 'Carousel releases empty notification space');
  await capture('home-no-unread-compact');
  await page.goto('http://127.0.0.1:8098/log');
  await page.getByTestId('log-tile-workout').click();
  await page.getByTestId('workout-hub-modal-btn-add-exercise').waitFor();
  assert.equal(await page.getByTestId('workout-show-details').count(),0);
  assert.equal(await page.getByTestId('workout-hub-modal-running-timer-bar').count(),0);
  assert.equal(await page.getByTestId('workout-hub-modal-input-duration').count(),0);
  await capture('workout-exercises-only');
  assert.deepEqual(errors,[]);
  console.log('Squad tracking browser: compact cards/icons, disabled blur, acknowledged tracking, Compare Not tracked, 99+ unread/reset, mention dismissal and exercise-only workout at 375/844px passed.');
} catch(error) {
  for(const page of browser?.contexts().flatMap(c=>c.pages())??[]) {
    await page.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});
    console.log((await page.locator('body').innerText().catch(()=>'' )).slice(-1400));
  }
  throw error;
} finally { await browser?.close(); await new Promise(resolve=>server.close(resolve)); }
`;
fs.mkdirSync('.artifacts/squad-tracking', { recursive: true });
const generated = '.artifacts/squad-tracking/browser-fixture.mjs';
fs.writeFileSync(generated, setup + suffix);
const result = spawnSync(process.execPath, [generated], { stdio: 'inherit' });
process.exitCode = result.status ?? 1;
