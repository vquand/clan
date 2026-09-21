const CACHE_NAME = 'clan-archive-shell-v2';
const APP_SHELL = [
  '/',
  '/manifest.webmanifest',
  '/clan-favicon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-512-maskable.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('clan-archive-shell-'))
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

async function refreshRequest(request) {
  const response = await fetch(request);
  if (response.ok && response.type === 'basic') {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request, event) {
  const cached = (await caches.match(request)) || (await caches.match('/'));
  const refresh = refreshRequest(request).catch(() => undefined);

  if (cached) {
    event.waitUntil(refresh);
    return cached;
  }

  return (await refresh) || caches.match('/');
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  return refreshRequest(request);
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/')
  ) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(staleWhileRevalidate(request, event));
    return;
  }

  event.respondWith(cacheFirst(request));
});

self.addEventListener('notificationclick', (event) => {
  const targetUrl = event.notification.data?.url || '/#calendar';
  event.notification.close();
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        const matchingClient = clientList.find((client) =>
          client.url.startsWith(self.location.origin),
        );
        if (matchingClient) {
          return matchingClient.focus();
        }
        return self.clients.openWindow(targetUrl);
      }),
  );
});
