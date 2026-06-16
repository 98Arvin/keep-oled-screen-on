const CACHE = 'oled-v3';
const ASSETS = ['/', '/index.html', '/circle-256.svg', '/manifest.json', '/circle-256.ico'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      const oldKeys = keys.filter(k => k !== CACHE);

      await Promise.all(oldKeys.map(k => caches.delete(k)));
      await self.clients.claim();

      if (oldKeys.length === 0) return;

      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      await Promise.all(clients.map(client =>
        client.navigate(client.url).catch(() => {})
      ));
    })()
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
