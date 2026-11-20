// Uses the existing isolated browser fixtures, with no hosted writes.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const source = fs.readFileSync('scripts/nov4_browser_audit.mjs', 'utf8');
const marker = '  const page = await context.newPage();';
if (!source.includes(marker)) throw new Error('Browser fixture harness changed');
const setup = source
  .slice(0, source.indexOf(marker))
  .replace(
    "out = path.resolve('.artifacts/food-polish/browser')",
    "out = path.resolve('.artifacts/feed/browser')",
  );
const check = `
  const photo = fs.readFileSync('app/public/icon.png');
  const author = { id: uid(1), nickname: 'Pav', username: 'member_1' };
  const post = { id: rid(89), author, caption: 'A morning walk', description: 'A trail in the morning',
    media_type: 'image/png', audience: 'community', published_at: now, liked: false, likes: 0, comments: 0 };
  const comments = [];
  let comparison = { status: 'ready', date: day, you: 60, author: 75 };
  let savedDraft = null;
  let publicationCount = 0;
  let sharedPost = false;
  const sendJson = (route, data) => route.fulfill({ json: data, headers: { 'Access-Control-Allow-Origin': '*' } });
  await context.route('**/rest/v1/rpc/**', async (route) => {
    const request = route.request();
    const name = new URL(request.url()).pathname.split('/').at(-1);
    const args = request.postDataJSON() ?? {};
    if (name === 'list_feed_posts') {
      const visible = args.p_shared && !sharedPost ? [] : [post];
      return sendJson(route, visible);
    }
    if (name === 'get_feed_post') return sendJson(route, args.p_post === post.id ? post : {
      ...post, id: savedDraft.p_id, caption: savedDraft.p_caption,
      description: savedDraft.p_description, author: { id: user.id, nickname: 'Maity' }, liked: false, likes: 0, comments: 0,
    });
    if (name === 'get_feed_preferences') return sendJson(route, { accepted: true, community: true });
    if (name === 'get_feed_profile') return sendJson(route, { ...author, bio: 'Training for a trail walk' });
    if (name === 'list_feed_comments') return sendJson(route, comments);
    if (name === 'set_feed_like') {
      post.liked = args.p_liked;
      post.likes = Number(post.liked);
      return sendJson(route, post);
    }
    if (name === 'feed_share_targets') return sendJson(route, { people: [author], squads: [rooms[1]] });
    if (name === 'share_feed_post') {
      assert.equal(args.p_post, post.id);
      assert.equal(args.p_target, author.id);
      sharedPost = true;
      return sendJson(route, 1);
    }
    if (name === 'reserve_feed_post') {
      savedDraft = args;
      return sendJson(route, args.p_id);
    }
    return route.fallback();
  });
  await context.route('**/functions/v1/feed-api?*', async (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: {
      'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST',
      'Access-Control-Allow-Headers': 'authorization,apikey,content-type',
    } });
    const params = new URL(route.request().url()).searchParams;
    if (params.get('action') === 'media') return sendJson(route, { url: 'data:image/png;base64,' + photo.toString('base64') });
    if (params.get('action') === 'compare') return sendJson(route, comparison);
    if (params.get('action') === 'comment') {
      const id = params.get('id');
      comments.push({ id, author: { id: user.id, nickname: 'Maity' }, body: route.request().postData(), created_at: now });
      post.comments = comments.length;
      return sendJson(route, { id });
    }
    if (params.get('action') === 'publish') {
      assert.equal(params.get('post'), savedDraft.p_id);
      assert.deepEqual(route.request().postDataBuffer(), photo);
      publicationCount++;
      return sendJson(route, { id: savedDraft.p_id });
    }
    return route.fallback();
  });

  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:8098/today');
  const log = page.getByTestId('home-log');
  await log.waitFor();
  const logChrome = await log.evaluate(el => {
    const style = getComputedStyle(el);
    return [style.backgroundColor, style.borderTopWidth];
  });
  assert.ok(logChrome[0] === 'rgba(0, 0, 0, 0)' && logChrome[1] === '0px');
  assert.equal(await page.getByTestId('tab-log').count(), 0);
  await log.click();
  await page.getByTestId('log-tile-post').click();
  await page.getByTestId('screen-feed-create').waitFor();
  const choosing = page.waitForEvent('filechooser');
  await page.getByTestId('feed-choose-media').click();
  await (await choosing).setFiles({ name: 'trail.png', mimeType: 'image/png', buffer: photo });
  await page.getByTestId('feed-caption').fill('A new walk');
  await page.getByTestId('feed-description').fill('An empty trail');
  await page.getByTestId('feed-publish').click();
  await page.getByTestId('screen-feed-post').getByText('A new walk').waitFor();
  assert.equal(publicationCount, 1);
  assert.equal(savedDraft.p_audience, 'friends');
  assert.equal(savedDraft.p_share_progress, false);

  await page.goto('http://127.0.0.1:8098/today');
  await page.getByTestId('tab-feed').click();
  const screen = page.getByTestId('screen-feed');
  await screen.getByText('A morning walk').waitFor();
  await screen.getByLabel('A trail in the morning', { exact: true }).waitFor();
  const like = screen.getByTestId('feed-like');
  await like.click();
  await screen.getByRole('button', { name: 'Remove like, 1 like' }).waitFor();
  await page.getByTestId('feed-comments').click();
  await page.getByTestId('feed-comment-input').fill('Enjoy the trail');
  await page.getByTestId('feed-comment-send').click();
  await page.getByText('Enjoy the trail').waitFor();
  await page.getByTestId('feed-sheet-close').click();
  await page.getByTestId('feed-share').click();
  await page.getByTestId('feed-copy-link').waitFor();
  await page.getByTestId('feed-share-person').click();
  await page.getByText('Shared with Pav').waitFor();
  await page.getByTestId('feed-sheet-close').click();
  await page.getByTestId('feed-shared').click();
  await screen.getByText('A morning walk').waitFor();
  await screen.getByTestId('feed-compare').click();
  await page.getByText('60%', { exact: true }).waitFor();
  await page.getByText('75%', { exact: true }).waitFor();
  await page.getByTestId('feed-sheet-close').click();
  comparison = { status: 'locked' };
  await screen.getByTestId('feed-compare').click();
  await page.waitForURL('**/paywall?tier=plus');
  await page.goto('http://127.0.0.1:8098/feed/post/' + post.id);
  await page.getByTestId('feed-open-profile').click();
  await page.getByText('Training for a trail walk').waitFor();
  await page.getByTestId('screen-feed-profile').getByText('A morning walk').waitFor();
  assert.deepEqual(errors, []);
  await page.screenshot({ path: path.join(out, 'profile.png'), fullPage: true });
  console.log('Feed browser: unboxed Home Log, composer upload, tab navigation, like, comment, share, comparison, paywall and author profile passed.');
} catch (error) {
  for (const page of browser?.contexts().flatMap(context => context.pages()) ?? []) {
    await page.screenshot({ path: path.join(out, 'failure.png'), fullPage: true }).catch(() => {});
    console.log((await page.locator('body').innerText().catch(() => '')).slice(-1000));
  }
  throw error;
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
`;
fs.mkdirSync('.cache', { recursive: true });
const filename = '.cache/feed-browser.mjs';
fs.writeFileSync(filename, setup + check);
const result = spawnSync(process.execPath, [filename], { stdio: 'inherit' });
process.exit(result.status ?? 1);
