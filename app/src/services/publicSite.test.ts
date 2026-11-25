import { afterEach, expect, it } from 'vitest';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {
  authReturnScript,
  buildPublicSite,
  renderPage,
  storeConfig,
} from '../../../scripts/build-public-site.mts';
import { pages } from '../../../scripts/site/pages';
import listing from '../../../scripts/site/store-listing.json';
import routing from '../../../vercel.json';
import { publicSite as copy } from '../i18n/publicSite';

let temp: string | undefined;
afterEach(async () => {
  if (temp) await rm(temp, { recursive: true, force: true });
  temp = undefined;
});

it('keeps store fields within official limits and copy within delivered capabilities', () => {
  for (const [text, limit] of [
    [listing.apple.name, 30],
    [listing.apple.subtitle, 30],
    [listing.apple.keywords, 100],
    [listing.apple.promotionalText, 170],
    [listing.google.name, 30],
    [listing.google.shortDescription, 80],
    [listing.description, 4000],
  ] as const)
    expect(
      Buffer.byteLength(text, 'utf8') <= limit || (limit !== 100 && [...text].length <= limit),
    ).toBe(true);
  expect(listing.apple.keywords).not.toContain(', ');
  expect(listing.description).toContain('monthly progress reviews');
  expect(listing.description).toContain('Personal tracking is free forever');
  expect(listing.description).not.toMatch(
    /150\+|weekly growth|300 photo|900|focus session|partner finder/i,
  );
});

it('renders meaningful crawlable pages with unique metadata and no invented ratings', () => {
  expect(new Set(pages.map((p) => p.title)).size).toBe(pages.length);
  expect(new Set(pages.map((p) => p.description)).size).toBe(pages.length);
  for (const page of pages) {
    const html = renderPage(page);
    expect(html.match(/<h1>/g)).toHaveLength(1);
    expect(html).toContain(`${copy.origin}${page.path === '/' ? '/' : page.path}`);
    expect(html).toContain('summary_large_image');
    expect(html).toContain('maximum-scale=5');
    expect(html).not.toMatch(/aggregateRating|YOUR_APP_ID|REAL_VALUE/);
    const data = JSON.parse(
      html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)![1]!,
    );
    expect(data.some((v: { '@type': string }) => v['@type'] === 'Organization')).toBe(true);
    expect(data.some((v: { '@type': string }) => v['@type'] === 'SoftwareApplication')).toBe(
      ['/', '/about', '/download'].includes(page.path),
    );
    expect(data.some((v: { '@type': string }) => v['@type'] === 'MobileApplication')).toBe(
      ['/', '/about', '/download'].includes(page.path),
    );
  }
});

it('publishes the approved upfront terms without advertising a trial or monthly plan', () => {
  const html = renderPage(pages.find((page) => page.path === '/pricing')!);
  for (const price of [
    '\u20b91,499 for 1 year',
    '\u20b9999 for 6 months',
    '\u20b92,499 for 1 year',
    '\u20b91,599 for 6 months',
    '$29.99 for 1 year',
    '$19.99 for 6 months',
    '$49.99 for 1 year',
    '$32.99 for 6 months',
  ])
    expect(html).toContain(price);
  expect(html).toContain('Personal tracking is free forever.');
  expect(html).not.toMatch(/cardless|free trial|\$4\.99 monthly|\$9\.99 monthly/i);
});

it('only publishes store links and banners with real configured availability', () => {
  const download = pages.find((p) => p.path === '/download')!;
  expect(renderPage(download)).not.toContain('apps.apple.com');
  expect(renderPage(download)).not.toContain('play.google.com');
  expect(storeConfig({ EXPO_PUBLIC_APPLE_APP_ID: 'YOUR_APP_ID' }).appleId).toBe('');
  const html = renderPage(download, {
    EXPO_PUBLIC_APPLE_APP_ID: '123456789',
    EXPO_PUBLIC_GOOGLE_PLAY_AVAILABLE: 'true',
  });
  expect(html).toContain('app-id=123456789');
  expect(html).toContain('id=app.calipartner.mobile');
});

it.each([
  ['?code=oauth-code', '', undefined, '/launch?code=oauth-code'],
  [
    '',
    '#access_token=example&refresh_token=example',
    undefined,
    '/launch#access_token=example&refresh_token=example',
  ],
  ['?error=access_denied', '', undefined, '/launch?error=access_denied'],
  ['?utm_source=search', '', undefined, undefined],
  ['?utm_source=search', '', 'www.calipartner.site', undefined],
  ['', '', 'app.calipartner.site', '/launch'],
  ['?tab=today', '', 'preview-123.vercel.app', '/launch?tab=today'],
])(
  'preserves OAuth returns while launching app hosts directly into the Expo shell: %s %s',
  (search, hash, hostname, expected) => {
    let target: string | undefined;
    vm.runInNewContext(authReturnScript, {
      URLSearchParams,
      location: {
        search,
        hash,
        hostname,
        replace: (value: string) => {
          target = value;
        },
      },
    });
    expect(target).toBe(expected);
  },
);

it('builds actual static HTML, a separate private app shell, sitemap and share image', async () => {
  temp = await mkdtemp(path.join(tmpdir(), 'calipartner-seo-'));
  await writeFile(
    path.join(temp, 'index.html'),
    '<html><head><title>Expo</title></head><body><script src="/bundle.js"></script></body></html>',
  );
  await writeFile(path.join(temp, 'manifest.json'), '{}');
  await buildPublicSite(temp, {});
  expect(await readFile(path.join(temp, 'app-shell.html'), 'utf8')).toContain('noindex,nofollow');
  expect(await readFile(path.join(temp, 'app-shell.html'), 'utf8')).toContain('/bundle.js');
  expect(await readFile(path.join(temp, 'index.html'), 'utf8')).toContain('site-home');
  expect(await readFile(path.join(temp, 'about.html'), 'utf8')).toContain('site-home');
  expect(await readFile(path.join(temp, 'privacy.html'), 'utf8')).toContain(
    'AI processing and consent',
  );
  expect(await readFile(path.join(temp, 'delete-account.html'), 'utf8')).toContain(
    'mailto:shibajyoti.maity06@gmail.com',
  );
  const sitemap = await readFile(path.join(temp, 'sitemap.xml'), 'utf8');
  expect(sitemap.match(/<url>/g)).toHaveLength(9);
  expect(sitemap).not.toMatch(/launch|auth|404|today/);
  expect((await readFile(path.join(temp, 'social-card.png'))).length).toBeGreaterThan(1000);
  const robots = await readFile(path.join(temp, 'robots.txt'), 'utf8');
  expect(robots).toContain('User-agent: OAI-SearchBot');
  expect(robots).toContain('User-agent: ChatGPT-User');
  expect(await readFile(path.join(temp, 'b8f9a2e64c1d30587e9b0a2f4c6d8e1a.txt'), 'utf8')).toBe(
    'b8f9a2e64c1d30587e9b0a2f4c6d8e1a',
  );
  await buildPublicSite(temp, {});
  expect(await readFile(path.join(temp, 'app-shell.html'), 'utf8')).toContain('/bundle.js');
  expect(routing.routes.at(-1)?.status).toBe(404);
}, 20000);
