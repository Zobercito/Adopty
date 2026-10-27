// Adopty Service Worker — red primero; caché solo para páginas públicas y assets.
// Las rutas privadas y la API nunca se cachean (privacidad en equipos compartidos).
const CACHE_NAME = 'adopty-v2';
const OFFLINE_URLS = ['/', '/offline', '/favicon.svg', '/manifest.json'];

const PUBLIC_PAGES = new Set([
  '/',
  '/explorar',
  '/terminos',
  '/privacidad',
  '/login',
  '/register',
  '/recuperar',
  '/offline',
]);
const PUBLIC_ASSET_PREFIXES = [
  '/assets/',
  '/brand/',
  '/icon-',
  '/favicon',
  '/apple-touch-icon',
  '/manifest.json',
];

function esCacheable(rawUrl) {
  const url = new URL(rawUrl);
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return false;
  if (PUBLIC_ASSET_PREFIXES.some((p) => url.pathname.startsWith(p))) return true;
  // HTML: solo páginas públicas exactas y sin query (evita cachear filtros infinitos).
  return !url.search && PUBLIC_PAGES.has(url.pathname.replace(/\/+$/, '') || '/');
}

async function offlineFallback() {
  return (await caches.match('/offline')) || Response.error();
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(OFFLINE_URLS).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
      ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  // Rutas privadas/API: nunca se cachean. Si no hay red, se muestra /offline.
  if (!esCacheable(request.url)) {
    if (request.mode === 'navigate') {
      event.respondWith(fetch(request).catch(offlineFallback));
    }
    return;
  }

  // Públicas: red primero; si falla, caché; si no, /offline.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && response.type === 'basic') {
          const clone = response.clone();
          caches
            .open(CACHE_NAME)
            .then((c) => c.put(request, clone))
            .catch(() => {});
        }
        return response;
      })
      .catch(async () => (await caches.match(request)) || offlineFallback()),
  );
});
