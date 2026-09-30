/* npm run build stamps this automatically. Bump manually for source-only deploys. */
const VERSION = 'v1';
const BASE = new URL('./', self.location.href);
const PREFIX = `antidote-${encodeURIComponent(BASE.pathname)}-`;
const CACHE = `${PREFIX}${VERSION}`;
const ASSETS = [
  './', 'index.html', 'styles.css', 'app.js', 'manifest.json',
  'icons/favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
  'icons/maskable-512.png', 'games/2048/', 'games/2048/index.html',
  'games/2048/styles.css', 'games/2048/engine.js', 'games/2048/game.js',
  'games/2048/standalone.js',
].map(path => new URL(path, BASE).href);
const PRECACHED = new Set(ASSETS);

self.addEventListener('install', event => {
  // Installation is atomic: a failed download leaves the old release intact.
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(
    ASSETS.map(url => new Request(url, { cache: 'reload' }))
  )));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith(PREFIX) && name !== CACHE) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_UPDATE') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== BASE.origin || !url.pathname.startsWith(BASE.pathname)) return;
  // Ignore query parameters only for explicitly shipped assets. Unknown URLs
  // go to the network and can never fill this cache with unbounded entries.
  url.search = '';
  url.hash = '';
  if (!PRECACHED.has(url.href)) return;
  event.respondWith((async () => {
    const cached = await (await caches.open(CACHE)).match(url.href);
    return cached || fetch(request);
  })());
});
