/* npm run build stamps this automatically. Bump manually for source-only deploys. */
const VERSION = 'v4';
const BASE = new URL('./', self.location.href);
const PREFIX = `antidote-${encodeURIComponent(BASE.pathname)}-`;
const CACHE = `${PREFIX}${VERSION}`;
const ASSETS = [
  './', 'index.html', 'styles.css', 'app.js', 'pwa.js', 'manifest.json', 'THIRD_PARTY_NOTICES.txt',
  'icons/favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
  'icons/maskable-512.png', 'games/2048/', 'games/2048/index.html',
  'games/2048/styles.css', 'games/2048/engine.js', 'games/2048/game.js',
  'games/2048/standalone.js',
  'games/shared.js', 'games/shared.css',
  'games/sudoku/', 'games/sudoku/index.html', 'games/sudoku/styles.css',
  'games/sudoku/engine.js', 'games/sudoku/game.js', 'games/sudoku/standalone.js',
  'games/blocks/', 'games/blocks/index.html', 'games/blocks/styles.css',
  'games/blocks/engine.js', 'games/blocks/game.js', 'games/blocks/standalone.js',
  "games/lexitrack/",
  "games/lexitrack/css/style.css",
  "games/lexitrack/index.html",
  "games/lexitrack/js/combined.js",
  "games/lexitrack/js/engine.js",
  "games/lexitrack/js/player.js",
  "games/lexitrack/player.html",
  "games/lexitrack/words.txt",
  "games/stones-of-five/",
  "games/stones-of-five/css/style.css",
  "games/stones-of-five/index.html",
  "games/stones-of-five/js/board.js",
  "games/stones-of-five/js/combined.js",
  "games/stones-of-five/js/game.js",
  "games/stones-of-five/js/player.js",
  "games/stones-of-five/player.html",
  "games/multiplayer/boot.js",
  "games/multiplayer/config.js",
  "games/multiplayer/frame.css",
  "games/multiplayer/session.js",
  "games/multiplayer/transport.js",
  "games/multiplayer/vendor/qrcode.js",
  "games/multiplayer/vendor/trystero.js",
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
    // Local development should reflect source edits on an ordinary refresh.
    // Keep the installed release as a fallback for deliberate offline testing.
    if (['localhost', '127.0.0.1', '[::1]'].includes(BASE.hostname)) {
      try {
        const response = await fetch(new Request(request, { cache: 'no-store' }));
        if (response.ok) return response;
        if (!cached) return response;
      } catch (error) { if (!cached) throw error; }
    }
    return cached || fetch(request);
  })());
});
