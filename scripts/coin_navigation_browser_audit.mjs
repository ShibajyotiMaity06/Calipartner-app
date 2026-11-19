// Local contract fixtures only. No real messages or payments are sent.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const source = fs.readFileSync('scripts/nov4_browser_audit.mjs', 'utf8');
const marker = '  const page = await context.newPage();';
if (!source.includes(marker)) throw new Error('Browser fixture harness changed');
const setup = source
  .slice(0, source.indexOf(marker))
  .replace(
    "out = path.resolve('.artifacts/food-polish/browser')",
    "out = path.resolve('.artifacts/coin-navigation/browser')",
  )
  .replace('let pro = false;', 'let pro = true;')
  .replace('let paid = false,', 'let paid = true,');
const suffix = `
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:8098/today');
  await page.getByTestId('home-coach-icon').waitFor();
  assert.equal(await page.getByTestId('home-squad-previous').count(),0);
  assert.equal(await page.getByTestId('home-squad-next').count(),0);
  await page.getByTestId('tab-chat').click();
  const inbox = page.getByTestId('screen-chat');
  await inbox.waitFor();
  assert.equal(await page.getByTestId('header-cc-balance').filter({ visible: true }).count(),0);
  assert.equal(await page.getByTestId('header-coach-icon').filter({ visible: true }).count(),0);
  await page.getByTestId('chat-friends-tabs-friends').click();
  await page.getByTestId('friend-username-search').waitFor();
  assert.equal(await page.getByTestId('friends-screen').getByTestId('theme-toggle').count(),0);
  assert.equal(await page.getByTestId('friends-screen').getByTestId('header-cc-balance').count(),0);
  await page.screenshot({path:path.join(out,'friends-tab.png'),fullPage:true});
  await page.getByTestId('chat-friends-tabs-chat').click();
  assert.equal(await inbox.getByTestId('chat-coach').count(),0);
  assert.doesNotMatch(await inbox.innerText(), /Your squads/i);
  await page.getByTestId('chat-thread-'+rid(1)).click();
  await page.getByTestId('squad-chat-header').waitFor();
  await page.getByTestId('input-chat-message').waitFor();
  assert.equal(await page.getByTestId('squad-chat-header').getByTestId('theme-toggle').count(),0);
  await page.screenshot({path:path.join(out,'squad-conversation.png'),fullPage:true});
  await page.getByTestId('squad-chat-back').click();
  await inbox.waitFor({state:'visible'});
  await page.getByTestId('tab-progress').click();
  const you = page.getByTestId('screen-progress');
  await you.getByTestId('theme-toggle').waitFor();
  assert.equal(await you.getByTestId('header-coach-icon').count(),0);
  await you.getByTestId('personal-workout-history').scrollIntoViewIfNeeded();
  await you.getByTestId('personal-workout-history').evaluate(element => {
    for(let parent=element.parentElement; parent; parent=parent.parentElement) {
      if(parent.scrollHeight>parent.clientHeight && ['auto','scroll'].includes(getComputedStyle(parent).overflowY)) { parent.scrollTop=parent.scrollHeight; break; }
    }
  });
  await page.waitForTimeout(300);
  const history = await you.getByTestId('personal-workout-history').boundingBox();
  const dock = await page.getByTestId('tab-progress').boundingBox();
  assert.ok(history.y+history.height <= dock.y+4,'Workout history must remain above the dock');
  assert.ok(dock.y-(history.y+history.height)<50,'No excessive empty space below workout history');
  await page.screenshot({path:path.join(out,'you-bottom.png'),fullPage:true});
  await page.goto('http://127.0.0.1:8098/room');
  await page.getByTestId('squad-leaderboard').waitFor();
  assert.equal(await page.getByTestId('header-cc-balance').filter({ visible: true }).count(),0);
  assert.equal(await page.getByTestId('header-coach-icon').filter({ visible: true }).count(),0);
  const cardColor = await page.getByTestId('squad-leaderboard').evaluate(el=>getComputedStyle(el).backgroundColor);
  assert.notEqual(cardColor,'rgb(24, 20, 16)');
  await page.screenshot({path:path.join(out,'squad-light.png'),fullPage:true});
  await page.goto('http://127.0.0.1:8098/friends');
  await page.getByTestId('friend-username-search').waitFor();
  assert.equal(await page.getByTestId('friends-screen').getByTestId('theme-toggle').count(),0);
  assert.equal(await page.getByTestId('friends-screen').getByTestId('header-cc-balance').count(),0);
  assert.equal(await page.getByTestId('header-coach-icon').filter({ visible: true }).count(),0);
  assert.deepEqual(errors,[]);
  console.log('Coin navigation browser: header controls, hidden carousel arrows, inbox-to-conversation routing, return navigation and compact You bottom spacing passed.');
} catch(error) {
  for(const page of browser?.contexts().flatMap(c=>c.pages())??[]) {
    await page.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});
    console.log((await page.locator('body').innerText().catch(()=>'' )).slice(-1000));
  }
  throw error;
} finally { await browser?.close(); await new Promise(resolve=>server.close(resolve)); }
`;
fs.mkdirSync('.cache', { recursive: true });
const filename = '.cache/coin-navigation-browser.mjs';
fs.writeFileSync(filename, setup + suffix);
const result = spawnSync(process.execPath, [filename], { stdio: 'inherit' });
process.exit(result.status ?? 1);
