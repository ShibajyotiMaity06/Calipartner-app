/* global self, caches, URL, fetch, Response */
// Cache only the public app shell. Account/API responses stay in the account-scoped database.
const shellCache = 'calipartner-shell-v1';
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(shellCache).then(async (cache) => {
      await cache.addAll(['/index.html', '/manifest.json', '/icon.png']);
      await self.skipWaiting();
    }),
  );
});
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
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
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (response.ok) {
            const cache = await caches.open(shellCache);
            await cache.put('/index.html', response.clone());
          }
          return response;
        })
        .catch(async () => (await caches.match('/index.html')) || Response.error()),
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
