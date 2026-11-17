/* global self, caches, URL, fetch, Response */
// Cache only the public app shell. Account/API responses stay in the account-scoped database.
const shellCache = 'calipartner-shell-v2';
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(shellCache).then(async (cache) => {
      await cache.addAll(['/app-shell.html', '/manifest.json', '/icon.png']);
      await self.skipWaiting();
    }),
  );
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(async (keys) => {
      await Promise.all(
        keys
          .filter((key) => key.startsWith('calipartner-shell-') && key !== shellCache)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    }),
  );
});
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'WARM_SHELL' || !Array.isArray(event.data.urls)) return;
  const urls = event.data.urls.filter((value) => {
    const url = new URL(value, self.location.origin);
    return (
      url.origin === self.location.origin &&
      (url.pathname.startsWith('/_expo/') || url.pathname.startsWith('/assets/'))
    );
  });
  event.waitUntil(
    caches.open(shellCache).then((cache) => Promise.allSettled(urls.map((url) => cache.add(url)))),
  );
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    // Public HTML must never replace the offline app shell. OAuth returns stay network-only.
    if (
      [
        '/',
        '/index.html',
        '/features',
        '/pricing',
        '/download',
        '/privacy',
        '/terms',
        '/support',
        '/delete-account',
      ].includes(url.pathname.replace(/\/$/, '') || '/') ||
      url.searchParams.has('code') ||
      url.searchParams.has('error')
    )
      return;
    event.respondWith(
      fetch(request).catch(async () => (await caches.match('/app-shell.html')) || Response.error()),
    );
  } else if (url.pathname.startsWith('/_expo/') || url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.open(shellCache).then(async (cache) => {
        const saved = await cache.match(request);
        if (saved) return saved;
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      }),
    );
  }
});
