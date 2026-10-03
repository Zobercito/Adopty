// Adopty Service Worker — red primero, caché solo como respaldo offline.
// Estrategia conservadora: nunca sirve contenido stale cuando hay red.
const CACHE_NAME = 'adopty-v1';
const OFFLINE_URLS = ['/', '/favicon.svg', '/manifest.json'];

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
  // Solo GET del mismo origen; nunca cachear API ni auth.
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (request.url.includes('/api/') || request.url.includes('/auth/')) return;

  // Red primero; si falla, caché; si no, offline básico para navegación.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches
            .open(CACHE_NAME)
            .then((c) => c.put(request, clone))
            .catch(() => {});
        }
        return response;
      })
      .catch(() =>
        caches
          .match(request)
          .then(
            (cached) => cached || (request.mode === 'navigate' ? caches.match('/') : undefined),
          ),
      ),
  );
});
