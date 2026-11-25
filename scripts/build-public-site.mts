import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import QRCode from 'qrcode';
import { publicSite as copy } from '../app/src/i18n/publicSite';
import { publicWeb as token } from '../packages/ui/tokens/publicWeb';
import { pages, type PublicPage } from './site/pages';

export const INDEXNOW_KEY = 'b8f9a2e64c1d30587e9b0a2f4c6d8e1a';

export const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const json = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');
const link = (href: string, label: string, id: string, primary = false) =>
  `<a href="${escapeHtml(href)}" data-testid="${id}" aria-label="${escapeHtml(label)}"${primary ? ' class="action"' : ''}>${escapeHtml(label)}</a>`;
const email = (subject: string) => `mailto:${copy.email}?subject=${encodeURIComponent(subject)}`;

export function storeConfig(env: Record<string, string | undefined>) {
  const appleId = env.EXPO_PUBLIC_APPLE_APP_ID ?? '';
  return {
    appleId: /^[1-9]\d{5,14}$/.test(appleId) ? appleId : '',
    android: env.EXPO_PUBLIC_GOOGLE_PLAY_AVAILABLE === 'true',
  };
}

export function renderPage(page: PublicPage, env: Record<string, string | undefined> = {}) {
  const store = storeConfig(env);
  const canonical = page.path === '/' ? copy.origin + '/' : copy.origin + page.path;
  const schemas: unknown[] = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'CaliPartner',
      url: copy.origin + '/',
      logo: `${copy.origin}/icon.png`,
      email: copy.email,
    },
  ];
  if (page.path !== '/')
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'CaliPartner', item: copy.origin + '/' },
        { '@type': 'ListItem', position: 2, name: page.heading, item: canonical },
      ],
    });
  if (['/', '/about', '/download'].includes(page.path)) {
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'CaliPartner',
      url: copy.origin + '/',
      applicationCategory: 'HealthApplication',
      operatingSystem: 'Web, Android, iOS',
      description:
        'A social calorie, workout, and habit tracker built for accountability partners and friend squads.',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'INR',
        description: 'Free personal tracking; optional paid plans.',
      },
    });
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'MobileApplication',
      name: 'CaliPartner',
      operatingSystem: 'iOS, Android, Web',
      applicationCategory: 'HealthApplication',
      description: copy.description,
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'INR',
        description: 'Free personal tracking; optional paid plans.',
      },
    });
  }
  let extra = '';
  if (page.path === '/download') {
    extra = `<section><h2>App availability</h2>${store.android ? link('https://play.google.com/store/apps/details?id=app.calipartner.mobile&referrer=utm_source%3Dcalipartner_site%26utm_medium%3Dwebsite', 'Get CaliPartner on Google Play', 'download-android') : '<p>Google Play release: Coming soon. Use the web app today.</p>'}${store.appleId ? link(`https://apps.apple.com/app/id${store.appleId}`, 'Download CaliPartner on the App Store', 'download-ios') : '<p>App Store release: Coming soon. Use the web app today.</p>'}<figure><img src="/download-qr.svg" width="192" height="192" alt="QR code opening CaliPartner in your phone’s browser"><figcaption>Scan to open the web app.</figcaption></figure></section>`;
  }
  if (page.path === '/delete-account' || page.path === '/support')
    extra = `<section><h2>Contact us</h2>${link(email(page.path === '/delete-account' ? 'CaliPartner account deletion' : 'CaliPartner support'), page.path === '/delete-account' ? 'Open account deletion email' : 'Open support email', 'contact-email')}<p>If a mail app does not open, send your request to ${escapeHtml(copy.email)} using any email service.</p></section>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5">
<title>${escapeHtml(page.title)}</title><meta name="description" content="${escapeHtml(page.description)}"><meta name="robots" content="${page.noindex ? 'noindex,follow' : 'index,follow'}"><link rel="canonical" href="${canonical}">
<meta property="og:title" content="${escapeHtml(page.title)}"><meta property="og:description" content="${escapeHtml(page.description)}"><meta property="og:type" content="website"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${copy.origin}/social-card.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="CaliPartner — Indian food and fitness accountability">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeHtml(page.title)}"><meta name="twitter:description" content="${escapeHtml(page.description)}"><meta name="twitter:image" content="${copy.origin}/social-card.png">
${store.appleId ? `<meta name="apple-itunes-app" content="app-id=${store.appleId}">` : ''}
<link rel="icon" href="/favicon.png"><link rel="stylesheet" href="/public-site.css">
<script type="application/ld+json">${json(schemas)}</script>${page.path === '/' ? '<script src="/auth-return.js"></script>' : ''}
</head><body><a class="skip" href="#main" data-testid="skip-content">Skip to content</a>
<header><a class="brand" href="/" data-testid="site-home" aria-label="CaliPartner home"><img src="/logo.svg" width="48" height="48" alt=""><span>CaliPartner</span></a><nav aria-label="Main navigation">${link('/features', 'Features', 'nav-features')}${link('/pricing', 'Pricing', 'nav-pricing')}${link('/download', 'Get the app', 'nav-download')}</nav></header>
<main id="main"><div class="hero"><p class="eyebrow">${escapeHtml(copy.audience)}</p><h1>${escapeHtml(page.heading)}</h1><p class="intro">${escapeHtml(page.intro)}</p>${link('/launch?utm_source=calipartner_site&utm_medium=website', 'Open CaliPartner', 'open-app', true)}</div>
<div class="${page.path === '/about' || page.path === '/features' ? 'grid' : 'reading'}">${page.sections.map((section) => `<section><h2>${escapeHtml(section.title)}</h2><p>${escapeHtml(section.body)}</p></section>`).join('')}${extra}</div>
</main><footer><p>CaliPartner · General information, not medical advice.</p><nav aria-label="Footer navigation">${link('/privacy', 'Privacy', 'footer-privacy')}${link('/terms', 'Terms', 'footer-terms')}${link('/support', 'Support', 'footer-support')}${link('/delete-account', 'Delete account', 'footer-delete')}</nav></footer></body></html>`;
}

export const authReturnScript = `// Preserve existing root OAuth callbacks and launch app hosts directly into the Expo app.
const host = typeof location.hostname === 'string' ? location.hostname.toLowerCase() : '';
const query = new URLSearchParams(location.search);
const fragment = new URLSearchParams(location.hash.slice(1));
if (
  host === 'app.calipartner.site' ||
  host.endsWith('.vercel.app') ||
  host === 'localhost' ||
  host === '127.0.0.1' ||
  query.has('code') ||
  query.has('error') ||
  fragment.has('access_token') ||
  fragment.has('error')
) {
  location.replace('/launch' + location.search + location.hash);
}
`;

export async function buildPublicSite(
  dist: string,
  env: Record<string, string | undefined> = process.env,
) {
  // Keep the Expo SPA for existing app routes; public pages need no React or account initialization.
  const shell = path.join(dist, 'app-shell.html');
  let expo = await fs.readFile(path.join(dist, 'index.html'), 'utf8');
  if (!expo.includes('data-testid="site-home"')) {
    expo = expo
      .replace(/<title>.*?<\/title>/s, '<title>CaliPartner app</title>')
      .replace('</head>', '<meta name="robots" content="noindex,nofollow"></head>');
    await fs.writeFile(shell, expo);
  } else await fs.access(shell);
  for (const page of pages) {
    const filename = page.path === '/' ? 'index.html' : `${page.path.slice(1)}.html`;
    await fs.writeFile(path.join(dist, filename), renderPage(page, env));
  }
  await fs.writeFile(path.join(dist, 'auth-return.js'), authReturnScript);
  const c = token.colors,
    s = token.space;
  const css = `@font-face{font-family:'${token.uiFont}';src:url('/site-ui.ttf') format('truetype');font-weight:400;font-display:swap}@font-face{font-family:'${token.titleFont}';src:url('/site-title.ttf') format('truetype');font-weight:700;font-display:swap}
*{box-sizing:border-box}html{color-scheme:dark}body{margin:0;background:${c.bg0};color:${c.textHi};font-family:'${token.uiFont}',sans-serif;font-size:${token.body}px;line-height:1.65}a{color:${c.textHi};text-underline-offset:.25em;display:inline-flex;align-items:center;min-height:${token.touch}px;padding:${s[2]}px;overflow-wrap:anywhere}a:focus-visible{outline:3px solid ${c.apricot};outline-offset:3px}header,main,footer{width:min(100%,${token.width}px);margin:auto;padding:${s[5]}px}header,nav,.brand{display:flex;align-items:center;gap:${s[4]}px;flex-wrap:wrap}header{justify-content:space-between}.brand{text-decoration:none;font-family:'${token.titleFont}',sans-serif;font-weight:700}.hero{padding:${s[8]}px 0}.eyebrow{color:${c.textMid}}h1,h2{font-family:'${token.titleFont}',sans-serif;font-weight:700;line-height:1.15;text-wrap:balance}h1{font-size:clamp(${token.titleSmall}px,7vw,${token.title}px);max-width:${token.readingWidth}px;margin:${s[4]}px 0}h2{font-size:${token.heading}px}p{overflow-wrap:anywhere}.intro{max-width:${token.readingWidth}px;color:${c.textMid}}.action{background:${c.apricot};color:${c.onBrand};border-radius:${token.radius.button}px;padding:${s[3]}px ${s[5]}px;text-decoration:none}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:${s[5]}px}.reading{max-width:${token.readingWidth}px}.grid section{background:${c.s1};border:${token.border}px solid ${c.hairline};border-radius:${token.radius.card}px;padding:${s[5]}px}section{margin-bottom:${s[6]}px}section p,footer{color:${c.textMid}}footer{margin-top:${s[8]}px;border-top:${token.border}px solid ${c.hairline}}img{max-width:100%;height:auto}figure{margin:${s[4]}px 0}.skip{position:absolute;top:-100%;left:0;background:${c.s1}}.skip:focus{top:0}@media(max-width:${token.mobile}px){.grid{grid-template-columns:1fr}.hero{padding:${s[6]}px 0}nav{gap:${s[1]}px}header{gap:${s[2]}px}}`;
  await fs.writeFile(path.join(dist, 'public-site.css'), css);
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  await fs.copyFile(
    path.join(root, 'app/assets/fonts/Figtree_400Regular.ttf'),
    path.join(dist, 'site-ui.ttf'),
  );
  await fs.copyFile(
    path.join(root, 'app/assets/fonts/BricolageGrotesque_700Bold.ttf'),
    path.join(dist, 'site-title.ttf'),
  );
  await fs.writeFile(
    path.join(dist, 'download-qr.svg'),
    await QRCode.toString(`${copy.origin}/launch?utm_source=website_qr&utm_medium=qr`, {
      type: 'svg',
      margin: 4,
    }),
  );
  const logo = await fs.readFile(path.join(root, 'app/public/logo.svg'));
  const card = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg"><rect width="1200" height="630" fill="${c.bg0}"/><image href="data:image/svg+xml;base64,${logo.toString('base64')}" x="80" y="70" width="100" height="100"/><text x="80" y="270" font-size="72" fill="${c.textHi}" font-family="sans-serif">CaliPartner</text><text x="80" y="355" font-size="42" fill="${c.textMid}" font-family="sans-serif">Indian food. Fitness. Accountability.</text><rect x="80" y="430" width="470" height="72" rx="16" fill="${c.apricot}"/><text x="112" y="478" font-size="32" fill="${c.onBrand}" font-family="sans-serif">Start with free personal tracking</text></svg>`;
  await sharp(Buffer.from(card)).png().toFile(path.join(dist, 'social-card.png'));
  const robotsTxt = `User-agent: OAI-SearchBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: GPTBot
Allow: /

User-agent: Bingbot
Allow: /

User-agent: Googlebot
Allow: /

User-agent: *
Allow: /

Sitemap: ${copy.origin}/sitemap.xml
Sitemap: https://www.calipartner.site/sitemap.xml
Sitemap: https://calipartner.site/sitemap.xml
Sitemap: https://app.calipartner.site/sitemap.xml
`;
  await fs.writeFile(path.join(dist, 'robots.txt'), robotsTxt);
  await fs.writeFile(
    path.join(dist, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${pages
      .filter((p) => !p.noindex)
      .map((p) => `<url><loc>${copy.origin}${p.path === '/' ? '/' : p.path}</loc></url>`)
      .join('')}</urlset>`,
  );
  await fs.writeFile(path.join(dist, `${INDEXNOW_KEY}.txt`), INDEXNOW_KEY);
  const manifestFile = path.join(dist, 'manifest.json');
  const manifest = JSON.parse(await fs.readFile(manifestFile, 'utf8'));
  manifest.start_url = '/launch';
  manifest.description = copy.description;
  await fs.writeFile(manifestFile, JSON.stringify(manifest));
  console.log(
    `Public SEO pages: ${pages.filter((p) => !p.noindex).length} generated; Expo app shell preserved.`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildPublicSite(path.resolve(process.argv[2] ?? 'app/dist'));
}
