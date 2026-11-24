// Offline cache for Kairo's site. Bump the version when files change.
const CACHE = 'kairo-portfolio-v1';
const ASSETS = [
  './', './index.html', './blog.html', './docs.html', './404.html',
  './posts/small-tools.html', './posts/quiet-interfaces.html',
  './posts/testing-notes.html', './posts/cli-setup.html',
  './posts/type-scales.html', './posts/readme.html',
  './css/style.css', './js/main.js',
  './assets/icon.svg', './assets/icon-192.png', './assets/icon-512.png', './assets/og-preview.png',
  './manifest.webmanifest', './feed.xml', './sitemap.xml'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      });
    })
  );
});
