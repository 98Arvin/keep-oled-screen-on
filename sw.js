self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    (async () => {
      try {
        await self.clients.claim();
      } catch (_) {}

      try {
        const keys = await caches.keys();
        await Promise.all(keys.map(key => caches.delete(key)));
      } catch (_) {}

      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true
      });

      try {
        await self.registration.unregister();
      } catch (_) {}

      const stamp = Date.now();
      await Promise.all(
        clients.map(client => {
          try {
            const url = new URL(client.url);
            url.searchParams.set("_cache_reset", String(stamp));
            return client.navigate(url.toString()).catch(() => {});
          } catch (_) {
            return Promise.resolve();
          }
        })
      );
    })()
  );
});
