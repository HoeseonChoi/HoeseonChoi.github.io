/*
 * home-inventory service worker (web/PWA only).
 *
 * - Static same-origin assets (metro bundles, fonts, icons): cache-first.
 *   They are content-hashed by `expo export`, so long-lived caching is safe.
 * - Navigations: network-first, cached copy as offline fallback.
 * - Never caches: non-GET, cross-origin (Supabase/OAuth), requests with an
 *   Authorization header, and /auth/* routes — auth responses never hit
 *   the cache.
 */
const VERSION = 'v1';
const STATIC_CACHE = `home-inventory-static-${VERSION}`;
const SHELL_CACHE = `home-inventory-shell-${VERSION}`;
const KNOWN_CACHES = [STATIC_CACHE, SHELL_CACHE];

const STATIC_ASSET = /^\/(?:_expo|assets|icons)\/|\.(?:js|css|png|jpe?g|webp|svg|gif|ico|woff2?|ttf|otf|webmanifest)$/i;
const AUTH_PATH = /^\/auth(?:\/|$)/;

const OFFLINE_HTML =
  '<!doctype html><html lang="ko"><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<title>우리집 재고</title></head><body style="font-family:sans-serif;' +
  'display:flex;min-height:100vh;align-items:center;justify-content:center;' +
  'margin:0;color:#111"><p>오프라인 상태예요. 네트워크를 확인한 뒤 다시 시도해주세요.</p>' +
  '</body></html>';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('home-inventory-') && !KNOWN_CACHES.includes(key))
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // Cross-origin (Supabase RPC/Auth/Realtime, OAuth, fonts CDN, ...) — let the
  // browser handle it; API responses are never cached.
  if (url.origin !== self.location.origin) return;
  // Defense in depth: never cache anything carrying credentials.
  if (request.headers.has('authorization')) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request, AUTH_PATH.test(url.pathname)));
    return;
  }
  if (STATIC_ASSET.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
  }
});

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

async function networkFirstNavigation(request, isAuthRoute) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok && !isAuthRoute) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    const root = await cache.match('/');
    if (root) return root;
    return new Response(OFFLINE_HTML, {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}
